// 工作流编排：把解析条目组装成依赖项，串联扫描证据、规则引擎与人工复核，
// 得出每个条目的最终结论与裁定来源。本模块仍是纯函数，不接触存储与 DOM。

import { evaluate, isMismatch } from './rules';
import { scanItem } from './scanner';
import type {
  Channel,
  DependencyItem,
  FinalStatus,
  ItemAssessment,
  ReviewRecord,
  RulingSource,
} from './types';
import { itemKey } from './types';
import type { ParsedEntry } from './parser';
import type { Delivery } from './types';

/** 解析结果 → 依赖条目（同一包换渠道会产生不同 id，需重新判断） */
export function buildItems(entries: ParsedEntry[], channel: Channel, now: number): DependencyItem[] {
  const seen = new Set<string>();
  const items: DependencyItem[] = [];
  entries.forEach(e => {
    const id = itemKey(e.name, e.version, channel);
    if (seen.has(id)) return; // 清单内重复行只判一次
    seen.add(id);
    items.push({
      id,
      name: e.name,
      version: e.version,
      channel,
      declaredLicense: e.declaredLicense,
      addedAt: now,
    });
  });
  return items;
}

function resolveFinal(
  verdict: ReturnType<typeof evaluate>,
  review: ReviewRecord | undefined,
): Pick<ItemAssessment, 'finalStatus' | 'rulingSource' | 'review'> {
  // 策略锁优先：GPL 系用于闭源交付，人工记录照样保存但不能凭它放行
  if (verdict.policyLocked) {
    return { finalStatus: 'blocked', rulingSource: '策略锁定', review };
  }

  if (review) {
    return review.decision === 'approved'
      ? { finalStatus: 'pass', rulingSource: '人工复核', review }
      : { finalStatus: 'blocked', rulingSource: '人工复核', review };
  }

  if (verdict.conclusion === 'blocked') return { finalStatus: 'blocked', rulingSource: '规则引擎', review };
  if (verdict.conclusion === 'review') return { finalStatus: 'review', rulingSource: '规则引擎', review };
  return { finalStatus: 'pass', rulingSource: '规则引擎', review };
}

/** 对单个条目执行完整判断链 */
export function assessItem(
  item: DependencyItem,
  delivery: Delivery,
  reviews: Record<string, ReviewRecord>,
): ItemAssessment {
  const evidence = scanItem(item);
  const verdict = evaluate(item, evidence, delivery);
  const mismatch = isMismatch(item, evidence);
  const resolved = resolveFinal(verdict, reviews[item.id]);
  return { item, evidence, verdict, mismatch, ...resolved };
}

export function assessAll(
  items: DependencyItem[],
  delivery: Delivery,
  reviews: Record<string, ReviewRecord>,
): ItemAssessment[] {
  return items.map(item => assessItem(item, delivery, reviews));
}

/** 阻断项 = 待复核 + 阻断；全部裁定为通过才允许导出 */
export function blockingCount(assessments: ItemAssessment[]): number {
  return assessments.filter(a => a.finalStatus !== 'pass').length;
}

export function statusCounts(assessments: ItemAssessment[]): Record<FinalStatus, number> {
  return {
    pass: assessments.filter(a => a.finalStatus === 'pass').length,
    review: assessments.filter(a => a.finalStatus === 'review').length,
    blocked: assessments.filter(a => a.finalStatus === 'blocked').length,
  };
}

export type { RulingSource };
