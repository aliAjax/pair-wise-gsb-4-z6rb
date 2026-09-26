import { useEffect, useMemo, useState } from 'react';
import { parseManifest } from './domain/parser';
import { buildItems, assessAll } from './domain/workflow';
import type { Channel, Delivery, ReviewRecord } from './domain/types';
import { loadState, saveState, clearState, type LensState } from './storage/store';
import { canExport, exportBlockedReason, buildMarkdown, downloadMarkdown } from './report/markdown';
import ManifestPanel from './components/ManifestPanel';
import ResultsList from './components/ResultsList';
import ItemDetail from './components/ItemDetail';
import { Ban, Download, Scale, ShieldCheck } from 'lucide-react';

export const SEED_MANIFEST = [
  'react@18.3.1 MIT',
  'lodash@4.17.21 MIT',
  'sharp@0.33.4 Apache-2.0',
  'axios@1.7.2 MIT',
  'zod@3.23.8 MIT',
  'ui-kit@3.0.0 MIT',
  'font-awesome@6.5.2 CC-BY-4.0',
  'some-proprietary@1.0.0 Proprietary',
  'legacy-gpl@2.4.0 GPL-3.0',
  'libfoo@2.0.0 MIT',
].join('\n');

function initialState(): LensState {
  const loaded = loadState();
  if (loaded.manifestText || loaded.items.length > 0) return loaded;
  // 首次打开：载入示例并立即给出逐项结论
  const items = buildItems(parseManifest(SEED_MANIFEST).entries, 'npm', Date.now());
  return {
    manifestText: SEED_MANIFEST,
    channel: 'npm',
    delivery: 'proprietary-distribution',
    items,
    reviews: {},
    updatedAt: '',
  };
}

export default function App() {
  const [state, setState] = useState<LensState>(initialState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pass' | 'review' | 'blocked'>('all');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);

  // 存档层独立工作：任何变化都持久化，重开页面可接着处理
  useEffect(() => {
    saveState({
      manifestText: state.manifestText,
      channel: state.channel,
      delivery: state.delivery,
      items: state.items,
      reviews: state.reviews,
    });
  }, [state]);

  // 判断层独立工作：条目、交付方式、复核记录任一变化都会重新裁定
  const assessments = useMemo(
    () => assessAll(state.items, state.delivery, state.reviews),
    [state.items, state.delivery, state.reviews],
  );

  const selected =
    assessments.find(a => a.item.id === selectedId) ??
    (filter === 'all' ? assessments[0] : undefined);

  const counts = useMemo(() => {
    const c = { all: assessments.length, pass: 0, review: 0, blocked: 0 };
    assessments.forEach(a => {
      c[a.finalStatus] += 1;
    });
    return c;
  }, [assessments]);

  const exportable = canExport(assessments);

  const analyze = (text: string, channel: Channel) => {
    const result = parseManifest(text);
    if (result.format === 'empty') {
      setNotice({ kind: 'warn', text: '清单为空，请粘贴或上传依赖清单后再分析' });
      return;
    }
    const items = buildItems(result.entries, channel, Date.now());
    setState(s => ({ ...s, manifestText: text, channel, items }));
    setSelectedId(items[0]?.id ?? null);
    const skippedNote = result.skipped.length
      ? `，${result.skipped.length} 行无法识别已跳过`
      : '';
    const channelNote = `（渠道：${channel}，同包换渠道需重新判断）`;
    setNotice({
      kind: 'ok',
      text: `分析完成，共 ${items.length} 个条目${skippedNote}${channelNote}`,
    });
  };

  const saveReview = (id: string, record: Omit<ReviewRecord, 'updatedAt'>) => {
    const full: ReviewRecord = { ...record, updatedAt: new Date().toLocaleString('zh-CN') };
    setState(s => ({ ...s, reviews: { ...s.reviews, [id]: full } }));
    setNotice({
      kind: 'ok',
      text: `复核记录已随条目保存：${record.decision === 'approved' ? '人工放行' : '人工驳回'}`,
    });
  };

  const resetDemo = () => {
    clearState();
    const items = buildItems(parseManifest(SEED_MANIFEST).entries, 'npm', Date.now());
    setState({
      manifestText: SEED_MANIFEST,
      channel: 'npm',
      delivery: 'proprietary-distribution',
      items,
      reviews: {},
      updatedAt: '',
    });
    setSelectedId(items[0]?.id ?? null);
    setFilter('all');
    setQuery('');
    setNotice({ kind: 'ok', text: '已重置为示例数据，复核记录已清空' });
  };

  const clearAll = () => {
    clearState();
    setState({
      manifestText: '',
      channel: state.channel,
      delivery: state.delivery,
      items: [],
      reviews: {},
      updatedAt: '',
    });
    setSelectedId(null);
    setNotice({ kind: 'ok', text: '工作区与本地存档已清空' });
  };

  const handleExport = () => {
    if (!exportable) {
      setNotice({ kind: 'warn', text: exportBlockedReason(assessments) });
      return;
    }
    const md = buildMarkdown(assessments, state.delivery, new Date().toLocaleString('zh-CN'));
    downloadMarkdown(md);
    setNotice({ kind: 'ok', text: 'Markdown 报告已导出，逐项含最终结论与裁定来源' });
  };

  const setDelivery = (delivery: Delivery) => {
    setState(s => ({ ...s, delivery }));
    setNotice({ kind: 'ok', text: '交付方式已变更，全部条目按新策略重新裁定' });
  };

  return (
    <div className="ll-shell">
      <header className="ll-topbar">
        <div className="ll-brand">
          <div className="ll-logo"><ShieldCheck size={20} /></div>
          <div>
            <h1>License Lens</h1>
            <span>依赖许可证兼容性分析 · 发版安全门禁</span>
          </div>
        </div>
        <div className="ll-policy">
          <Scale size={15} />
          <label htmlFor="delivery">交付方式</label>
          <select
            id="delivery"
            value={state.delivery}
            onChange={e => setDelivery(e.target.value as Delivery)}
          >
            <option value="proprietary-distribution">闭源分发交付</option>
            <option value="saas">SaaS 在线服务</option>
            <option value="internal">仅内部使用</option>
          </select>
        </div>
        <button
          className={exportable ? 'll-primary' : 'll-primary ll-primary-disabled'}
          onClick={handleExport}
          disabled={!exportable}
          title={exportable ? '导出 Markdown 报告' : exportBlockedReason(assessments)}
        >
          {exportable ? <Download size={15} /> : <Ban size={15} />}
          导出 Markdown
        </button>
      </header>

      {notice && (
        <div className={`ll-notice ${notice.kind}`} onClick={() => setNotice(null)}>
          {notice.text}
        </div>
      )}
      {!exportable && assessments.length > 0 && (
        <div className="ll-gate">
          <Ban size={14} />
          发版门禁未通过：{exportBlockedReason(assessments)}。全部条目裁定为通过后才可导出报告。
        </div>
      )}

      <div className="ll-layout">
        <ManifestPanel
          manifestText={state.manifestText}
          channel={state.channel}
          onManifestChange={text => setState(s => ({ ...s, manifestText: text }))}
          onChannelChange={channel => setState(s => ({ ...s, channel }))}
          onAnalyze={analyze}
          onReset={resetDemo}
          onClear={clearAll}
        />

        <main className="ll-main">
          <section className="ll-metrics">
            <div><small>已分析依赖</small><b>{counts.all}</b></div>
            <div className="good"><small>兼容通过</small><b>{counts.pass}</b></div>
            <div className="warn"><small>待人工复核</small><b>{counts.review}</b></div>
            <div className="bad"><small>阻断</small><b>{counts.blocked}</b></div>
          </section>

          <div className="ll-workgrid">
            <ResultsList
              assessments={assessments}
              filter={filter}
              query={query}
              counts={counts}
              selectedId={selected?.item.id ?? null}
              onFilter={setFilter}
              onQuery={setQuery}
              onSelect={id => setSelectedId(id)}
            />
            <ItemDetail
              assessment={selected}
              delivery={state.delivery}
              onSaveReview={saveReview}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
