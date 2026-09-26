import type { Delivery, DependencyItem, FinalRuling, ReviewRecord, Verdict, VerdictKind } from './types';

/** GPL 系（Copyleft）许可证族 */
const GPL_FAMILY = ['GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'AGPL-3.0'];
const STRONG_COPYLEFT = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'];

/** 宽松许可证，保留声明即可分发 */
const PERMISSIVE = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
];

export function normalizeLicense(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/_/g, '-');
  const map: Record<string, string> = {
    '': 'UNKNOWN',
    UNKNOWN: 'UNKNOWN',
    APACHE: 'Apache-2.0',
    'APACHE-2': 'Apache-2.0',
    'APACHE-LICENSE-2.0': 'Apache-2.0',
    BSD: 'BSD-3-Clause',
    'BSD-3': 'BSD-3-Clause',
    'GPL-2': 'GPL-2.0',
    GPL2: 'GPL-2.0',
    'GPL-3': 'GPL-3.0',
    GPL3: 'GPL-3.0',
    'LGPL-2': 'LGPL-2.1',
    'LGPL-3': 'LGPL-3.0',
    AGPL: 'AGPL-3.0',
    PROPRIETARY: 'Proprietary',
    COMMERCIAL: 'Proprietary',
    'CC-BY-4.0': 'CC-BY-4.0',
  };
  return map[s] ?? raw.trim();
}

function isGplFamily(lic: string): boolean {
  return GPL_FAMILY.includes(normalizeLicense(lic));
}

/**
 * 自动规则给出初步结论（只依据条目与交付形态，不读存档）：
 * - blocked：许可证声明与扫描证据不一致（或证据缺失/冲突）、GPL 系用于闭源交付
 * - review：许可证未知、专有许可证、强 Copyleft 用在需确认的场景
 * - pass：宽松许可证且证据一致
 */
export function evaluate(item: DependencyItem, delivery: Delivery): Verdict {
  const declared = normalizeLicense(item.declaredLicense);
  const evidence = item.evidence.map(normalizeLicense);
  const reasons: string[] = [];

  // 1. 声明与扫描证据一致性检查
  if (evidence.length === 0) {
    reasons.push('缺少扫描证据：未发现任何许可证证据，无法核对声明');
    return { kind: 'blocked', reasons };
  }
  const evidenceSet = new Set(evidence);
  if (declared === 'UNKNOWN') {
    reasons.push('清单未声明许可证，而扫描证据为 ' + evidence.join('、'));
    return { kind: 'blocked', reasons };
  }
  if (!evidenceSet.has(declared)) {
    reasons.push(
      `声明许可证「${declared}」与扫描证据「${evidence.join('、')}」不一致，需送人工复核`,
    );
    return { kind: 'blocked', reasons };
  }
  if (evidenceSet.size > 1) {
    reasons.push(`扫描证据存在多个许可证：${evidence.join('、')}，需确认适用条款`);
    return { kind: 'blocked', reasons };
  }

  // 2. GPL 系：闭源交付时硬阻断，不能凭普通记录放行
  if (isGplFamily(declared)) {
    if (delivery === 'closed-source') {
      const strong = STRONG_COPYLEFT.includes(declared)
        ? '强 Copyleft'
        : 'LGPL 对动态链接以外的使用方式同样有约束';
      reasons.push(
        `${declared}（${strong}）用于闭源交付：衍生作品须以相同许可证开源，属硬阻断项`,
      );
      return { kind: 'blocked', reasons };
    }
    if (delivery === 'saas' && declared === 'AGPL-3.0') {
      reasons.push('AGPL-3.0 对网络服务使用者也触发开源义务，SaaS 场景需人工复核');
      return { kind: 'review', reasons };
    }
    reasons.push(`${declared} 属 Copyleft 许可证，当前交付形态（${delivery}）需确认合规义务`);
    return { kind: 'review', reasons };
  }

  // 3. 专有 / 未知许可证
  if (declared === 'Proprietary') {
    reasons.push('专有许可证：需确认商业授权覆盖当前发布渠道与交付形态');
    return { kind: 'review', reasons };
  }
  if (declared === 'CC-BY-4.0') {
    reasons.push('CC-BY-4.0 面向内容而非代码，需人工确认适用范围');
    return { kind: 'review', reasons };
  }

  // 4. 宽松许可证
  if (PERMISSIVE.includes(declared)) {
    reasons.push(`${declared} 为宽松许可证，保留版权与许可声明即可分发`);
    return { kind: 'pass', reasons };
  }

  reasons.push(`未收录的许可证「${declared}」，按保守策略送人工复核`);
  return { kind: 'review', reasons };
}

/**
 * 叠加人工复核存档，形成最终裁定：
 * - 证据不一致等阻断项必须经人工复核（处理人+依据+结论齐全）才能解除
 * - GPL 系用于闭源交付为硬阻断，人工「放行」记录也不能覆盖
 * - 自动通过项若已有复核记录，以人工记录为最终来源
 */
export function resolveRuling(
  item: DependencyItem,
  delivery: Delivery,
  review?: ReviewRecord,
): FinalRuling {
  const auto = evaluate(item, delivery);
  const hardBlocked =
    auto.kind === 'blocked' &&
    auto.reasons.some(r => r.includes('硬阻断') && isGplFamily(item.declaredLicense));

  if (review && (review.reviewer.trim() && review.basis.trim())) {
    if (hardBlocked) {
      // 硬阻断不可凭复核记录放行：记录留存，但最终结论维持阻断
      return {
        item,
        kind: 'blocked',
        source: 'manual',
        reasons: [...auto.reasons, `已有 ${review.reviewer} 的复核记录，但 GPL 硬阻断不接受普通放行`],
        review,
        reviewable: false,
        hardBlocked: true,
      };
    }
    const kind: VerdictKind = review.conclusion === 'approve' ? 'pass' : 'blocked';
    return {
      item,
      kind,
      source: 'manual',
      reasons: [...auto.reasons, `人工裁定（${review.reviewer}）：${review.basis}`],
      review,
      reviewable: true,
      hardBlocked: false,
    };
  }

  return {
    item,
    kind: auto.kind,
    source: 'auto',
    reasons: auto.reasons,
    review,
    // 自动阻断（证据不一致等）与自动待复核都允许进入人工复核
    reviewable: auto.kind !== 'pass' && !hardBlocked,
    hardBlocked,
  };
}

/** 阻断项是否清零：存在 kind === 'blocked' 即不可导出 */
export function countBlockers(rulings: FinalRuling[]): number {
  return rulings.filter(r => r.kind === 'blocked').length;
}
