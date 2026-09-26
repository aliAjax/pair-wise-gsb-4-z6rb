import { useEffect, useMemo, useState } from 'react';
import { parseManifest } from './license/parser';
import { countBlockers, resolveRuling } from './license/rules';
import { clearArchive, loadArchive, saveArchive } from './license/storage';
import { buildMarkdownReport, downloadMarkdown } from './license/report';
import { ImportPanel, SAMPLE_MANIFEST } from './components/ImportPanel';
import { ItemTable } from './components/ItemTable';
import { ReviewPanel } from './components/ReviewPanel';
import type { Delivery, FinalRuling, ReviewConclusion, VerdictKind } from './license/types';

export default function App() {
  // 存档层：重开页面恢复清单、交付形态与全部复核记录
  const [archive] = useState(loadArchive);
  const [manifestText, setManifestText] = useState(archive.manifestText || SAMPLE_MANIFEST);
  const [delivery, setDelivery] = useState<Delivery>(archive.delivery);
  const [reviews, setReviews] = useState(archive.reviews);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<VerdictKind | 'all'>('all');
  const [savedAt, setSavedAt] = useState(archive.savedAt);

  // 解析层：清单文本 → 条目
  const parsed = useMemo(() => parseManifest(manifestText), [manifestText]);

  // 判断层：条目 × 交付形态 × 复核记录 → 最终裁定
  const rulings: FinalRuling[] = useMemo(
    () => parsed.items.map(item => resolveRuling(item, delivery, reviews[item.id])),
    [parsed.items, delivery, reviews],
  );
  const blockers = countBlockers(rulings);
  const selected = rulings.find(r => r.item.id === selectedId) ?? null;

  // 存档层：任何变化即时落盘
  useEffect(() => {
    setSavedAt(saveArchive({ reviews, delivery, manifestText }).savedAt);
  }, [reviews, delivery, manifestText]);

  const handleAnalyze = () => {
    setParseErrors(parsed.errors);
    setSelectedId(parsed.items[0]?.id ?? null);
  };

  const handleSaveReview = (itemId: string, reviewer: string, basis: string, conclusion: ReviewConclusion) => {
    setReviews(prev => ({
      ...prev,
      [itemId]: { reviewer, basis, conclusion, updatedAt: new Date().toISOString() },
    }));
  };

  const handleClearReview = (itemId: string) => {
    setReviews(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleReset = () => {
    clearArchive();
    setReviews({});
    setDelivery('closed-source');
    setManifestText(SAMPLE_MANIFEST);
    setParseErrors([]);
    setSelectedId(null);
  };

  // 阻断项清零后才能导出
  const handleExport = () => {
    if (blockers > 0) return;
    downloadMarkdown(buildMarkdownReport(rulings, delivery));
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="logo">L</div>
          <div>
            <h1>License Lens</h1>
            <small>依赖许可证兼容性分析</small>
          </div>
        </div>
        <div className="top-actions">
          {savedAt && (
            <span className="saved-at">已自动保存 {new Date(savedAt).toLocaleTimeString('zh-CN', { hour12: false })}</span>
          )}
          <button className="btn" onClick={handleReset}>重置</button>
          <button
            className="btn primary"
            disabled={blockers > 0 || rulings.length === 0}
            title={blockers > 0 ? `还有 ${blockers} 个阻断项，清零后才能导出` : '导出 Markdown 报告'}
            onClick={handleExport}
          >
            导出 Markdown{blockers > 0 ? `（${blockers} 项阻断）` : ''}
          </button>
        </div>
      </header>

      <main className="layout">
        <ImportPanel
          text={manifestText}
          errors={parseErrors}
          delivery={delivery}
          onTextChange={setManifestText}
          onDeliveryChange={setDelivery}
          onAnalyze={handleAnalyze}
          onLoadSample={() => setManifestText(SAMPLE_MANIFEST)}
        />
        <ItemTable
          rulings={rulings}
          filter={filter}
          onFilterChange={setFilter}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ReviewPanel
          ruling={selected}
          onSaveReview={handleSaveReview}
          onClearReview={handleClearReview}
        />
      </main>
    </div>
  );
}
