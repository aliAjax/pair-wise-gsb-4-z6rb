import { CHANNEL_LABELS, CONCLUSION_LABELS, DELIVERY_LABELS, SOURCE_LABELS, VERDICT_LABELS } from './types';
import type { Delivery, FinalRuling } from './types';

/** 导出层：根据最终裁定生成 Markdown 报告，逐项带最终结论与裁定来源 */
export function buildMarkdownReport(rulings: FinalRuling[], delivery: Delivery): string {
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const lines: string[] = [
    '# License Lens 依赖许可证分析报告',
    '',
    `- 生成时间：${now}`,
    `- 交付形态：${DELIVERY_LABELS[delivery]}`,
    `- 条目总数：${rulings.length}`,
    `- 通过：${rulings.filter(r => r.kind === 'pass').length} · 待复核：${rulings.filter(r => r.kind === 'review').length} · 阻断：${rulings.filter(r => r.kind === 'blocked').length}`,
    '',
    '## 逐项结论',
    '',
    '| 依赖 | 版本 | 发布渠道 | 声明许可证 | 扫描证据 | 最终结论 | 裁定来源 |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const r of rulings) {
    const evidence = r.item.evidence.length ? r.item.evidence.join(', ') : '（无）';
    lines.push(
      `| ${r.item.name} | ${r.item.version || '—'} | ${CHANNEL_LABELS[r.item.channel]} | ${r.item.declaredLicense} | ${evidence} | ${VERDICT_LABELS[r.kind]} | ${SOURCE_LABELS[r.source]} |`,
    );
  }

  lines.push('', '## 裁定明细', '');
  for (const r of rulings) {
    lines.push(
      `### ${r.item.name}@${r.item.version || '—'}（${CHANNEL_LABELS[r.item.channel]}）— ${VERDICT_LABELS[r.kind]}`,
      '',
      `- 声明许可证：${r.item.declaredLicense}`,
      `- 扫描证据：${r.item.evidence.length ? r.item.evidence.join('、') : '无'}`,
      `- 最终结论：${VERDICT_LABELS[r.kind]}`,
      `- 裁定来源：${SOURCE_LABELS[r.source]}`,
    );
    if (r.review) {
      lines.push(
        `- 人工处理人：${r.review.reviewer}`,
        `- 复核依据：${r.review.basis}`,
        `- 人工结论：${CONCLUSION_LABELS[r.review.conclusion]}`,
        `- 处理时间：${new Date(r.review.updatedAt).toLocaleString('zh-CN', { hour12: false })}`,
      );
    }
    for (const reason of r.reasons) lines.push(`- 依据：${reason}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function downloadMarkdown(content: string, filename = 'license-lens-report.md'): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
