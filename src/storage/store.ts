// 存档层：负责把会话状态持久化到浏览器存储，并从存档恢复。
// 解析/判断逻辑不关心数据从哪里来；界面也不直接读写 localStorage。

import type { Channel, Delivery, ReviewRecord } from '../domain/types';

const STORAGE_KEY = 'license-lens:v1';

export interface LensState {
  /** 最近一次粘贴/导入的清单原文，重开可继续编辑 */
  manifestText: string;
  /** 解析时选择的发布渠道 */
  channel: Channel;
  /** 当前项目的交付方式 */
  delivery: Delivery;
  /** 已解析的依赖条目 */
  items: import('../domain/types').DependencyItem[];
  /** 按条目 id 归档的人工复核记录 */
  reviews: Record<string, ReviewRecord>;
  updatedAt: string;
}

const EMPTY_STATE: LensState = {
  manifestText: '',
  channel: 'npm',
  delivery: 'proprietary-distribution',
  items: [],
  reviews: {},
  updatedAt: '',
};

export function loadState(): LensState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    const parsed = JSON.parse(raw) as Partial<LensState>;
    return {
      manifestText: typeof parsed.manifestText === 'string' ? parsed.manifestText : '',
      channel: (parsed.channel as Channel) ?? 'npm',
      delivery: (parsed.delivery as Delivery) ?? 'proprietary-distribution',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      reviews: parsed.reviews && typeof parsed.reviews === 'object' ? parsed.reviews : {},
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function saveState(state: Omit<LensState, 'updatedAt'>): LensState {
  const next: LensState = { ...state, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 存储不可用时界面仍可在当前会话工作
  }
  return next;
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
