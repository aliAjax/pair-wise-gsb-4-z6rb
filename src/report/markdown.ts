// 报告层：生成 Markdown 报告。逐项给出最终结论与裁定来源。
// 阻断项（待复核/阻断）未清零时拒绝导出，调用方界面也会同步禁用按钮。

import type { ItemAssessment } from '../domain/types';
import { CHANNEL_LABEL, DELIVERY_LABEL, STATUS_LABEL } from '../domain/types';
import type { Delivery } from '../domain/types';
import { blockingCount } from '../domain/workflow';

export function canExport(assessments: ItemAssessment[]): boolean {
  return assessments.length > 0 && blockingCount(assessments) === 0;
}

export function exportBlockedReason(assessments: ItemAssessment[]): string {
  if (assessments.length === 0) return '还没有可导出的分析条目';
  const n = blockingCount(assessments);
  return `仍有 ${n} 个阻断项（待复核或阻断）未清零，暂不能导出报告`;
}

export function buildMarkdown(
  assessments: ItemAssessment[],
  delivery: Delivery,
  generatedAt: string,
): string {
  if (!canExport(assessments)) {
    throw new Error(exportBlockedReason(assessments));
  }

  const lines: string[] = [];
  lines.push('# License Lens 依赖许可证分析报告');
  lines.push('');
  lines.push(`- 生成时间：${generatedAt}`);
  lines.push(`- 交付方式：${DELIVERY_LABEL[delivery]}`);
  lines.push(`- 分析条目：${assessments.length}`);
  lines.push(`- 最终结论：全部 ${assessments.length} 项兼容通过，阻断项已清零`);
  lines.push('');
  lines.push('## 逐项结论');
  lines.push('');
  lines.push('| # | 依赖 | 版本 | 发布渠道 | 声明许可证 | 扫描证据 | 最终结论 | 裁定来源 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  assessments.forEach((a, i) => {
    lines.push(
      `| ${i + 1} | ${a.item.name} | ${a.item.version || '—'} | ${CHANNEL_LABEL[a.item.channel]} | ` +
        `${a.item.declaredLicense || '未声明'} | ${a.evidence.detectedLicense} | ` +
        `${STATUS_LABEL[a.finalStatus]} | ${a.rulingSource} |`,
    );
  });
  lines.push('');
  lines.push('## 裁定依据');
  lines.push('');
  assessments.forEach((a, i) => {
    lines.push(`### ${i + 1}. ${a.item.name}@${a.item.version || '—'}（${CHANNEL_LABEL[a.item.channel]}）`);
    lines.push('');
    lines.push(`- 最终结论：**${STATUS_LABEL[a.finalStatus]}**`);
    lines.push(`- 裁定来源：${a.rulingSource}`);
    lines.push('- 判断依据：');
    a.verdict.reasons.forEach(r => lines.push(`  - ${r}`));
    if (a.review) {
      lines.push(
        `- 人工复核：处理人 ${a.review.reviewer}，结论 ${a.review.decision === 'approved' ? '人工放行' : '人工驳回'}，时间 ${a.review.updatedAt}`,
      );
      lines.push(`- 复核依据：${a.review.rationale}`);
    }
    lines.push('');
  });
  return lines.join('\n');
}

export function downloadMarkdown(markdown: string, filename = 'license-report.md'): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
