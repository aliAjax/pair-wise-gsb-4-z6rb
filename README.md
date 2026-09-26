# License Lens

纯前端开源依赖许可证兼容性分析工具，帮助发版前对依赖清单逐项裁定，并对声明许可证与扫描证据不一致的条目进行人工复核。

## 启动

```bash
npm install
npm run dev      # 开发
npm run build    # 构建到 dist/
```

## 用法

1. **解析**：粘贴依赖清单（每行 `名称@版本 声明许可证 渠道 evidence:证据`，也支持 JSON 数组与 `package.json`），点击「解析清单」逐项看到许可结论。
2. **判断**：宽松许可证且声明与扫描证据一致即自动通过；证据缺失、不一致或冲突的条目标记为阻断；GPL 系用于闭源交付为硬阻断，不能凭人工记录放行。
3. **复核**：阻断 / 待复核条目可在右侧录入处理人、复核依据与结论（放行 / 阻断），记录跟着当前条目保存；GPL 硬阻断除外。
4. **导出**：阻断项清零后才能导出 Markdown，报告逐项带最终结论与裁定来源（自动规则 / 人工复核）。
5. 所有清单与复核记录自动持久化到 localStorage，重开页面可接着处理。

## 架构

解析、判断、存档、界面四层各自独立，位于 `src/license/` 与 `src/components/`：

- `license/parser.ts` — 清单解析（行格式 / JSON / package.json）
- `license/rules.ts` — 许可证规则与最终裁定（含 GPL 硬阻断）
- `license/storage.ts` — localStorage 存档
- `license/report.ts` — Markdown 报告导出
- `license/types.ts` — 共享类型

条目身份为 `名称@版本::发布渠道`，同一包换了发布渠道即作为新条目重新判断。
