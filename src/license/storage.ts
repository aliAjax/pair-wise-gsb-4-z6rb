import type { Delivery, ReviewRecord } from './types';

/**
 * 存档层：只负责持久化，与解析、判断、界面解耦。
 * 复核记录以条目 id（名称@版本::渠道）为键，换渠道会得到新 id，即需重新处理。
 */
export interface ArchiveState {
  reviews: Record<string, ReviewRecord>;
  delivery: Delivery;
  manifestText: string;
  savedAt?: string;
}

const STORAGE_KEY = 'license-lens-archive-v1';

const EMPTY: ArchiveState = { reviews: {}, delivery: 'closed-source', manifestText: '' };

export function loadArchive(): ArchiveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<ArchiveState>;
    return {
      reviews: parsed.reviews && typeof parsed.reviews === 'object' ? parsed.reviews : {},
      delivery: parsed.delivery ?? EMPTY.delivery,
      manifestText: typeof parsed.manifestText === 'string' ? parsed.manifestText : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : undefined,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveArchive(state: ArchiveState): ArchiveState {
  const next: ArchiveState = { ...state, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 存储不可用时静默降级：本次会话仍可继续处理
  }
  return next;
}

export function clearArchive(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
