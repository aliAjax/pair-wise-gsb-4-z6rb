// 数据模型：解析、判断、存档、界面四层共享的类型与常量定义。

/** 发布渠道：同一包换渠道即视为新条目，需要重新判断 */
export type Channel = 'npm' | 'github' | 'internal' | 'vendor';

/** 项目交付方式：决定 Copyleft 条款是否被触发 */
export type Delivery = 'proprietary-distribution' | 'saas' | 'internal';

export interface DependencyItem {
  /** 条目身份 = 名称@版本|渠道，复核记录按此键归档 */
  id: string;
  name: string;
  version: string;
  channel: Channel;
  /** 清单中声明的许可证原文，空串表示未声明 */
  declaredLicense: string;
  addedAt: number;
}

export interface ScanEvidence {
  /** 扫描识别出的许可证（SPDX 风格标识或 UNKNOWN） */
  detectedLicense: string;
  /** 证据来源说明 */
  source: string;
  confidence: 'high' | 'low';
}

export type RuleConclusion = 'pass' | 'review' | 'blocked';

export interface RuleVerdict {
  conclusion: RuleConclusion;
  /** 逐条判断依据，界面与报告共用 */
  reasons: string[];
  /** 策略锁定：GPL 系用于闭源交付时，人工复核记录不能放行 */
  policyLocked: boolean;
}

export interface ReviewRecord {
  reviewer: string;
  rationale: string;
  decision: 'approved' | 'rejected';
  updatedAt: string;
}

export type FinalStatus = 'pass' | 'review' | 'blocked';
export type RulingSource = '规则引擎' | '人工复核' | '策略锁定';

export interface ItemAssessment {
  item: DependencyItem;
  evidence: ScanEvidence;
  verdict: RuleVerdict;
  review?: ReviewRecord;
  mismatch: boolean;
  finalStatus: FinalStatus;
  rulingSource: RulingSource;
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  npm: 'npm 公共源',
  github: 'GitHub 源码',
  internal: '内部镜像',
  vendor: '商业渠道',
};

export const DELIVERY_LABEL: Record<Delivery, string> = {
  'proprietary-distribution': '闭源分发交付',
  saas: 'SaaS 在线服务',
  internal: '内部使用',
};

export const STATUS_LABEL: Record<FinalStatus, string> = {
  pass: '兼容通过',
  review: '待复核',
  blocked: '阻断',
};

/** 条目身份键：名称@版本|发布渠道 */
export function itemKey(name: string, version: string, channel: Channel): string {
  return `${name.trim()}@${version.trim() || 'unknown'}|${channel}`;
}
