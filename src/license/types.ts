/** 发布渠道：同一依赖按「名称@版本::渠道」区分，换渠道需重新判断 */
export type Channel = 'npm' | 'bundle' | 'cdn' | 'mirror';

/** 交付形态：影响 GPL 系等 Copyleft 许可证的兼容性判断 */
export type Delivery = 'closed-source' | 'open-source' | 'saas' | 'internal';

export const CHANNELS: readonly Channel[] = ['npm', 'bundle', 'cdn', 'mirror'];

export const CHANNEL_LABELS: Record<Channel, string> = {
  npm: 'npm 仓库',
  bundle: '打包分发',
  cdn: 'CDN 外链',
  mirror: '内部镜像',
};

export const DELIVERIES: readonly Delivery[] = ['closed-source', 'open-source', 'saas', 'internal'];

export const DELIVERY_LABELS: Record<Delivery, string> = {
  'closed-source': '闭源交付',
  'open-source': '开源交付',
  saas: 'SaaS 服务',
  internal: '内部使用',
};

/** 一条依赖清单条目 */
export interface DependencyItem {
  /** 条目身份：名称@版本::渠道（渠道变更即视为新条目） */
  id: string;
  name: string;
  version: string;
  channel: Channel;
  /** 声明的许可证（SPDX 标识或 UNKNOWN） */
  declaredLicense: string;
  /** 扫描证据：扫描工具实际发现的许可证 */
  evidence: string[];
}

export type VerdictKind = 'pass' | 'review' | 'blocked';

export const VERDICT_LABELS: Record<VerdictKind, string> = {
  pass: '通过',
  review: '待复核',
  blocked: '阻断',
};

/** 自动规则的初步结论 */
export interface Verdict {
  kind: VerdictKind;
  reasons: string[];
}

export type ReviewConclusion = 'approve' | 'reject';

export const CONCLUSION_LABELS: Record<ReviewConclusion, string> = {
  approve: '放行',
  reject: '阻断',
};

/** 人工复核记录：处理人、依据、结论都跟着条目保存 */
export interface ReviewRecord {
  reviewer: string;
  basis: string;
  conclusion: ReviewConclusion;
  updatedAt: string;
}

export type RulingSource = 'auto' | 'manual';

export const SOURCE_LABELS: Record<RulingSource, string> = {
  auto: '自动规则',
  manual: '人工复核',
};

/** 最终裁定：自动结论叠加人工复核记录后的结果 */
export interface FinalRuling {
  item: DependencyItem;
  kind: VerdictKind;
  source: RulingSource;
  reasons: string[];
  review?: ReviewRecord;
  /** 自动结论为「待复核」，允许人工复核改变结论 */
  reviewable: boolean;
  /** GPL 系硬阻断：不能凭人工复核记录放行 */
  hardBlocked: boolean;
}
