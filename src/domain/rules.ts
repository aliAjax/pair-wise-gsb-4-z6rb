// 判断层：许可证知识库与规则引擎。
// 输入「条目 + 扫描证据」，输出机器初判、依据与策略锁。
// 规则引擎不保存任何状态，也不知道界面存在。

import type { Delivery, DependencyItem, RuleVerdict, ScanEvidence } from './types';

type LicenseFamily =
  | 'permissive'
  | 'weak-copyleft'
  | 'strong-copyleft'
  | 'attribution-cc'
  | 'public-domain'
  | 'proprietary'
  | 'unknown';

interface LicenseKnowledge {
  family: LicenseFamily;
  /** 该许可证/族的标准名称（报告用） */
  canonical: string;
  aliases: string[];
}

const KNOWLEDGE: LicenseKnowledge[] = [
  { family: 'permissive', canonical: 'MIT', aliases: ['MIT', 'MIT License', 'Expat'] },
  { family: 'permissive', canonical: 'Apache-2.0', aliases: ['Apache-2.0', 'Apache 2.0', 'Apache License 2.0', 'Apache'] },
  { family: 'permissive', canonical: 'BSD-3-Clause', aliases: ['BSD-3-Clause', 'BSD 3-Clause', 'BSD-3', 'New BSD'] },
  { family: 'permissive', canonical: 'BSD-2-Clause', aliases: ['BSD-2-Clause', 'BSD 2-Clause', 'Simplified BSD'] },
  { family: 'permissive', canonical: 'ISC', aliases: ['ISC', 'ISC License'] },
  { family: 'weak-copyleft', canonical: 'LGPL-2.1', aliases: ['LGPL-2.1', 'LGPL 2.1', 'LGPL-2.1-only'] },
  { family: 'weak-copyleft', canonical: 'LGPL-3.0', aliases: ['LGPL-3.0', 'LGPL 3.0', 'LGPL-3.0-only', 'LGPL'] },
  { family: 'weak-copyleft', canonical: 'MPL-2.0', aliases: ['MPL-2.0', 'MPL 2.0', 'MPL'] },
  { family: 'weak-copyleft', canonical: 'EPL-2.0', aliases: ['EPL-2.0', 'EPL 2.0', 'EPL'] },
  { family: 'strong-copyleft', canonical: 'GPL-2.0', aliases: ['GPL-2.0', 'GPL 2.0', 'GPL-2.0-only', 'GPLv2'] },
  { family: 'strong-copyleft', canonical: 'GPL-3.0', aliases: ['GPL-3.0', 'GPL 3.0', 'GPL-3.0-only', 'GPLv3', 'GPL'] },
  { family: 'strong-copyleft', canonical: 'AGPL-3.0', aliases: ['AGPL-3.0', 'AGPL 3.0', 'AGPL'] },
  { family: 'attribution-cc', canonical: 'CC-BY-4.0', aliases: ['CC-BY-4.0', 'CC BY 4.0'] },
  { family: 'public-domain', canonical: 'CC0-1.0', aliases: ['CC0-1.0', 'CC0', 'Unlicense', '0BSD'] },
  { family: 'proprietary', canonical: 'Proprietary', aliases: ['Proprietary', 'Commercial', 'UNLICENSED'] },
];

const UNKNOWN: LicenseKnowledge = { family: 'unknown', canonical: 'UNKNOWN', aliases: [] };

function normalizeLicense(raw: string): LicenseKnowledge {
  const key = raw.trim();
  if (!key || key.toUpperCase() === 'UNKNOWN') return UNKNOWN;
  const exact = KNOWLEDGE.find(k => k.aliases.some(a => a.toLowerCase() === key.toLowerCase()));
  if (exact) return exact;
  const loose = KNOWLEDGE.find(k =>
    k.aliases.some(a => key.toLowerCase().includes(a.toLowerCase())),
  );
  return loose ?? UNKNOWN;
}

/** 扫描证据是否与清单声明属于同一许可证族 */
export function isMismatch(item: DependencyItem, evidence: ScanEvidence): boolean {
  if (!item.declaredLicense) return false; // 未声明走 unknown 规则，不算声明冲突
  const declared = normalizeLicense(item.declaredLicense);
  const detected = normalizeLicense(evidence.detectedLicense);
  if (declared.family === 'unknown' || detected.family === 'unknown') {
    return declared.canonical !== detected.canonical;
  }
  return declared.family !== detected.family || declared.canonical !== detected.canonical;
}

export function evaluate(
  item: DependencyItem,
  evidence: ScanEvidence,
  delivery: Delivery,
): RuleVerdict {
  const reasons: string[] = [];
  const detected = normalizeLicense(evidence.detectedLicense);
  const mismatch = isMismatch(item, evidence);

  if (item.declaredLicense) {
    reasons.push(
      mismatch
        ? `清单声明许可证「${item.declaredLicense}」与扫描证据「${evidence.detectedLicense}」不一致，不能采信清单声明`
        : `清单声明与扫描证据一致：${evidence.detectedLicense}`,
    );
  } else {
    reasons.push('清单未声明许可证');
  }
  reasons.push(`扫描依据：${evidence.source}（置信度 ${evidence.confidence === 'high' ? '高' : '低'}）`);

  switch (detected.family) {
    case 'permissive':
    case 'public-domain':
      reasons.push(`${detected.canonical} 属于宽松/公共领域许可，保留版权与许可声明即可分发`);
      if (mismatch) return { conclusion: 'review', reasons, policyLocked: false };
      if (evidence.confidence === 'low') return { conclusion: 'review', reasons, policyLocked: false };
      return { conclusion: 'pass', reasons, policyLocked: false };

    case 'weak-copyleft':
      reasons.push(`${detected.canonical} 是弱 Copyleft 许可，需保证组件可被独立替换/链接，修改部分须开源`);
      if (delivery === 'proprietary-distribution') {
        reasons.push('闭源分发交付时，弱 Copyleft 的链接与替换方式需要法务确认');
        return { conclusion: 'review', reasons, policyLocked: false };
      }
      reasons.push('当前交付方式（SaaS/内部使用）不触发该许可的分发条款');
      return { conclusion: mismatch ? 'review' : 'pass', reasons, policyLocked: false };

    case 'strong-copyleft': {
      const agpl = detected.canonical === 'AGPL-3.0';
      if (delivery === 'proprietary-distribution') {
        reasons.push(
          `${detected.canonical} 是 Copyleft 许可，要求衍生作品整体以相同许可证开源，与闭源分发交付直接冲突`,
        );
        // 策略锁：GPL 系用于闭源交付，任何普通记录/人工放行都不能解除
        return { conclusion: 'blocked', reasons, policyLocked: true };
      }
      if (delivery === 'saas') {
        if (agpl) {
          reasons.push('AGPL 的网络使用条款覆盖 SaaS 场景，闭源 SaaS 不能放行');
          return { conclusion: 'blocked', reasons, policyLocked: true };
        }
        reasons.push('GPL 的 copyleft 由「分发」触发，SaaS 不分发二进制，但需法务确认边界');
        return { conclusion: 'review', reasons, policyLocked: false };
      }
      reasons.push('仅内部使用、不分发，copyleft 义务暂不触发，仍需保留许可文本');
      return { conclusion: mismatch ? 'review' : 'pass', reasons, policyLocked: false };
    }

    case 'attribution-cc':
      reasons.push(`${detected.canonical} 是内容署名许可，用于代码分发时适用范围与署名义务需人工确认`);
      return { conclusion: 'review', reasons, policyLocked: false };

    case 'proprietary':
      reasons.push('专有/商业许可证，必须核对采购授权与再分发条款，不能凭普通开源流程放行');
      return { conclusion: 'review', reasons, policyLocked: false };

    default:
      reasons.push('未能识别许可证，缺少分发依据');
      return { conclusion: 'review', reasons, policyLocked: false };
  }
}

export const licenseOptions = KNOWLEDGE.map(k => k.canonical).filter(
  (v, i, arr) => arr.indexOf(v) === i,
);
