import { CHANNEL_LABELS, SOURCE_LABELS, VERDICT_LABELS } from '../license/types';
import type { FinalRuling, VerdictKind } from '../license/types';

interface Props {
  rulings: FinalRuling[];
  filter: VerdictKind | 'all';
  onFilterChange: (f: VerdictKind | 'all') => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const FILTERS: Array<{ key: VerdictKind | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pass', label: '通过' },
  { key: 'review', label: '待复核' },
  { key: 'blocked', label: '阻断' },
];

/** 逐项许可结论列表 */
export function ItemTable({ rulings, filter, onFilterChange, selectedId, onSelect }: Props) {
  const counts: Record<VerdictKind | 'all', number> = {
    all: rulings.length,
    pass: rulings.filter(r => r.kind === 'pass').length,
    review: rulings.filter(r => r.kind === 'review').length,
    blocked: rulings.filter(r => r.kind === 'blocked').length,
  };
  const visible = filter === 'all' ? rulings : rulings.filter(r => r.kind === filter);

  return (
    <section className="panel table-panel">
      <div className="table-head">
        <h2>② 逐项许可结论</h2>
        <div className="filters">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`chip ${filter === f.key ? 'active' : ''} ${f.key}`}
              onClick={() => onFilterChange(f.key)}
            >
              {f.label} {counts[f.key]}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="empty">暂无条目，请先粘贴清单并解析。</p>
      ) : (
        <table className="item-table">
          <thead>
            <tr>
              <th>依赖</th>
              <th>渠道</th>
              <th>声明许可证</th>
              <th>扫描证据</th>
              <th>最终结论</th>
              <th>裁定来源</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr
                key={r.item.id}
                className={`${selectedId === r.item.id ? 'selected' : ''} kind-${r.kind}`}
                onClick={() => onSelect(r.item.id)}
              >
                <td>
                  <strong>{r.item.name}</strong>
                  <span className="version">@{r.item.version || '—'}</span>
                </td>
                <td>{CHANNEL_LABELS[r.item.channel]}</td>
                <td><code>{r.item.declaredLicense}</code></td>
                <td>{r.item.evidence.length ? r.item.evidence.join('、') : <em>无</em>}</td>
                <td><span className={`badge ${r.kind}`}>{VERDICT_LABELS[r.kind]}</span></td>
                <td>{SOURCE_LABELS[r.source]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
