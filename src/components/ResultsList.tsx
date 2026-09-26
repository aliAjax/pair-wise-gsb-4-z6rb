import { AlertTriangle, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import type { ItemAssessment, FinalStatus } from '../domain/types';
import { CHANNEL_LABEL, STATUS_LABEL } from '../domain/types';

type Filter = 'all' | FinalStatus;

interface Props {
  assessments: ItemAssessment[];
  filter: Filter;
  query: string;
  counts: Record<Filter, number>;
  selectedId: string | null;
  onFilter: (f: Filter) => void;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pass', label: '兼容通过' },
  { key: 'review', label: '待复核' },
  { key: 'blocked', label: '阻断' },
];

function StatusBadge({ status }: { status: FinalStatus }) {
  const map = {
    pass: { className: 'll-badge pass', icon: <CheckCircle2 size={12} /> },
    review: { className: 'll-badge review', icon: <AlertTriangle size={12} /> },
    blocked: { className: 'll-badge blocked', icon: <ShieldAlert size={12} /> },
  } as const;
  const m = map[status];
  return <span className={m.className}>{m.icon}{STATUS_LABEL[status]}</span>;
}

export default function ResultsList({
  assessments,
  filter,
  query,
  counts,
  selectedId,
  onFilter,
  onQuery,
  onSelect,
}: Props) {
  const q = query.trim().toLowerCase();
  const visible = assessments.filter(
    a =>
      (filter === 'all' || a.finalStatus === filter) &&
      (!q ||
        a.item.name.toLowerCase().includes(q) ||
        a.item.declaredLicense.toLowerCase().includes(q) ||
        a.evidence.detectedLicense.toLowerCase().includes(q)),
  );

  return (
    <section className="ll-panel ll-results">
      <div className="ll-results-head">
        <h3>分析结果</h3>
        <div className="ll-search">
          <Search size={14} />
          <input value={query} onChange={e => onQuery(e.target.value)} placeholder="搜索依赖或许可证…" />
        </div>
      </div>

      <div className="ll-filters">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={filter === f.key ? 'll-chip active' : 'll-chip'}
            onClick={() => onFilter(f.key)}
          >
            {f.label} <b>{counts[f.key]}</b>
          </button>
        ))}
      </div>

      <div className="ll-table-head">
        <div>依赖</div>
        <div>声明 / 扫描</div>
        <div>结论</div>
      </div>

      <div className="ll-rows">
        {visible.map(a => (
          <button
            key={a.item.id}
            className={selectedId === a.item.id ? 'll-row selected' : 'll-row'}
            onClick={() => onSelect(a.item.id)}
          >
            <div className="ll-pkg">
              <div className="ll-pkg-icon">◈</div>
              <div>
                <strong>{a.item.name}</strong>
                <span>
                  {a.item.version || '—'} · {CHANNEL_LABEL[a.item.channel]}
                </span>
              </div>
            </div>
            <div className="ll-licenses">
              <span className={`ll-lic declared ${a.mismatch ? 'mismatch' : ''}`}>
                {a.item.declaredLicense || '未声明'}
              </span>
              <i>→</i>
              <span className="ll-lic detected">{a.evidence.detectedLicense}</span>
              {a.mismatch && <em className="ll-mismatch-tag">不一致</em>}
            </div>
            <StatusBadge status={a.finalStatus} />
          </button>
        ))}
        {visible.length === 0 && (
          <div className="ll-empty">没有匹配的依赖条目，请先在左侧粘贴清单并分析</div>
        )}
      </div>
    </section>
  );
}
