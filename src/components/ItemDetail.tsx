import { useEffect, useState } from 'react';
import { FileSignature, Lock, UserCheck, UserX } from 'lucide-react';
import type { Delivery, ItemAssessment, ReviewRecord } from '../domain/types';
import { CHANNEL_LABEL, DELIVERY_LABEL, STATUS_LABEL } from '../domain/types';

interface Props {
  assessment?: ItemAssessment;
  delivery: Delivery;
  onSaveReview: (id: string, record: Omit<ReviewRecord, 'updatedAt'>) => void;
}

export default function ItemDetail({ assessment, delivery, onSaveReview }: Props) {
  const [reviewer, setReviewer] = useState('');
  const [rationale, setRationale] = useState('');
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [error, setError] = useState('');

  // 切换条目时，表单回填当前条目自己保存的复核记录
  useEffect(() => {
    setReviewer(assessment?.review?.reviewer ?? '');
    setRationale(assessment?.review?.rationale ?? '');
    setDecision(assessment?.review?.decision ?? 'approved');
    setError('');
  }, [assessment?.item.id, assessment?.review]);

  if (!assessment) {
    return (
      <section className="ll-panel ll-detail ll-detail-empty">
        <p>从左侧选择一个依赖，查看扫描证据、判断依据并提交人工复核。</p>
      </section>
    );
  }

  const { item, evidence, verdict, mismatch, finalStatus, rulingSource, review } = assessment;
  const locked = verdict.policyLocked;

  const submit = () => {
    if (!reviewer.trim() || !rationale.trim()) {
      setError('处理人与复核依据均为必填，记录会随当前条目保存');
      return;
    }
    if (locked && decision === 'approved') {
      setError('该条目被策略锁定，不能人工放行；可记录驳回意见');
      return;
    }
    setError('');
    onSaveReview(item.id, { reviewer: reviewer.trim(), rationale: rationale.trim(), decision });
  };

  return (
    <section className="ll-panel ll-detail">
      <header className="ll-detail-head">
        <div>
          <h3>{item.name}</h3>
          <span>{item.version || '版本未知'} · {CHANNEL_LABEL[item.channel]}</span>
        </div>
        <div className={`ll-badge big ${finalStatus}`}>{STATUS_LABEL[finalStatus]}</div>
      </header>

      <div className="ll-source-line">
        裁定来源：<b>{rulingSource}</b>
        <span className="ll-delivery">当前交付方式：{DELIVERY_LABEL[delivery]}</span>
      </div>

      <div className="ll-evidence">
        <div className={mismatch ? 'll-ev-card mismatch' : 'll-ev-card'}>
          <small>清单声明</small>
          <strong>{item.declaredLicense || '未声明'}</strong>
        </div>
        <div className="ll-ev-arrow">→</div>
        <div className="ll-ev-card">
          <small>扫描证据（置信度 {evidence.confidence === 'high' ? '高' : '低'}）</small>
          <strong>{evidence.detectedLicense}</strong>
          <p>{evidence.source}</p>
        </div>
      </div>

      {mismatch && (
        <div className="ll-alert warn">
          声明许可证与扫描证据不一致，不能采信清单声明，须人工复核后裁定。
        </div>
      )}
      {locked && (
        <div className="ll-alert lock">
          <Lock size={14} />
          策略锁定：{evidence.detectedLicense} 用于闭源分发交付时触发 Copyleft 冲突，
          普通复核记录不能放行，必须更换组件或开源交付。
        </div>
      )}

      <div className="ll-reasons">
        <h4>规则判断依据</h4>
        <ul>
          {verdict.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      {review && (
        <div className={`ll-saved-review ${review.decision}`}>
          <h4>
            {review.decision === 'approved' ? <UserCheck size={14} /> : <UserX size={14} />}
            已保存的人工复核（{review.updatedAt}）
          </h4>
          <p><b>处理人：</b>{review.reviewer}</p>
          <p><b>依据：</b>{review.rationale}</p>
          <p><b>裁定：</b>{review.decision === 'approved' ? '人工放行' : '人工驳回'}</p>
        </div>
      )}

      <div className="ll-review-form">
        <h4><FileSignature size={14} />人工复核（记录随当前条目保存）</h4>
        <label className="ll-field">
          <span>处理人</span>
          <input value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="姓名 / 工号" />
        </label>
        <label className="ll-field">
          <span>复核依据</span>
          <textarea
            value={rationale}
            onChange={e => setRationale(e.target.value)}
            placeholder="引用许可证条款、法务意见或授权凭证，说明放行/驳回理由"
          />
        </label>
        <div className="ll-decision">
          <button
            type="button"
            className={decision === 'approved' ? 'll-dec approved active' : 'll-dec approved'}
            onClick={() => setDecision('approved')}
            disabled={locked}
            title={locked ? '策略锁定条目不能放行' : '人工放行'}
          >
            <UserCheck size={14} />人工放行
          </button>
          <button
            type="button"
            className={decision === 'rejected' ? 'll-dec rejected active' : 'll-dec rejected'}
            onClick={() => setDecision('rejected')}
          >
            <UserX size={14} />人工驳回
          </button>
        </div>
        {error && <div className="ll-form-error">{error}</div>}
        <button className="ll-primary ll-block" onClick={submit}>保存复核记录</button>
      </div>
    </section>
  );
}
