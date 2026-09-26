import { useEffect, useState } from 'react';
import { CHANNEL_LABELS, CONCLUSION_LABELS, SOURCE_LABELS, VERDICT_LABELS } from '../license/types';
import type { FinalRuling, ReviewConclusion } from '../license/types';

interface Props {
  ruling: FinalRuling | null;
  onSaveReview: (itemId: string, reviewer: string, basis: string, conclusion: ReviewConclusion) => void;
  onClearReview: (itemId: string) => void;
}

/** 人工复核面板：处理人、依据、结论跟着当前条目保存 */
export function ReviewPanel({ ruling, onSaveReview, onClearReview }: Props) {
  const [reviewer, setReviewer] = useState('');
  const [basis, setBasis] = useState('');
  const [conclusion, setConclusion] = useState<ReviewConclusion>('approve');

  // 切换条目时载入该条目已有的复核记录
  useEffect(() => {
    setReviewer(ruling?.review?.reviewer ?? '');
    setBasis(ruling?.review?.basis ?? '');
    setConclusion(ruling?.review?.conclusion ?? 'approve');
  }, [ruling?.item.id, ruling?.review]);

  if (!ruling) {
    return (
      <section className="panel review-panel">
        <h2>③ 人工复核</h2>
        <p className="empty">在列表中选择一条依赖查看判定依据。</p>
      </section>
    );
  }

  const { item } = ruling;
  const canSubmit = reviewer.trim().length > 0 && basis.trim().length > 0;

  return (
    <section className="panel review-panel">
      <h2>③ 人工复核</h2>
      <div className="review-target">
        <strong>{item.name}@{item.version || '—'}</strong>
        <span className="meta">{CHANNEL_LABELS[item.channel]} · 声明 {item.declaredLicense}</span>
        <span className={`badge ${ruling.kind}`}>{VERDICT_LABELS[ruling.kind]}</span>
        <span className="meta">裁定来源：{SOURCE_LABELS[ruling.source]}</span>
      </div>

      <div className="reasons">
        <h3>判定依据</h3>
        <ul>{ruling.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </div>

      {ruling.hardBlocked && (
        <p className="hard-blocked-note">
          GPL 系许可证用于闭源交付属硬阻断，不能凭人工复核记录放行，请移除该依赖或调整交付形态。
        </p>
      )}

      {ruling.reviewable ? (
        <div className="review-form">
          <label>
            处理人
            <input
              value={reviewer}
              onChange={e => setReviewer(e.target.value)}
              placeholder="复核人姓名"
            />
          </label>
          <label>
            复核依据
            <textarea
              value={basis}
              onChange={e => setBasis(e.target.value)}
              placeholder="例如：已核对上游仓库 LICENSE 文件，声明以仓库为准"
              rows={3}
            />
          </label>
          <div className="conclusion-picker">
            结论
            {(['approve', 'reject'] as const).map(c => (
              <label key={c} className={`radio ${conclusion === c ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="conclusion"
                  checked={conclusion === c}
                  onChange={() => setConclusion(c)}
                />
                {CONCLUSION_LABELS[c]}
              </label>
            ))}
          </div>
          <div className="review-actions">
            <button
              className="btn primary"
              disabled={!canSubmit}
              onClick={() => onSaveReview(item.id, reviewer.trim(), basis.trim(), conclusion)}
            >
              保存复核结论
            </button>
            {ruling.review && (
              <button className="btn" onClick={() => onClearReview(item.id)}>清除复核记录</button>
            )}
          </div>
          {ruling.review && (
            <p className="saved-note">
              已保存：{ruling.review.reviewer} · {CONCLUSION_LABELS[ruling.review.conclusion]} ·{' '}
              {new Date(ruling.review.updatedAt).toLocaleString('zh-CN', { hour12: false })}
            </p>
          )}
        </div>
      ) : (
        !ruling.hardBlocked && <p className="ok-note">该条目自动规则已通过，无需人工复核。</p>
      )}
    </section>
  );
}
