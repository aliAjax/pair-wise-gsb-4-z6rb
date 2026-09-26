# License Lens

纯前端开源依赖许可证兼容性分析工具，面向发版安全门禁。

## 能力

- 粘贴或上传依赖清单（每行 `名称@版本 许可证`，或直接粘贴 `package.json`），逐项给出许可结论与判断依据
- 清单声明许可证与制品扫描证据不一致的条目自动进入人工复核；处理人、依据、裁定随条目保存
- 条目身份含发布渠道：同一包换渠道重新扫描、重新判断（如 npm 版为 MIT、商业渠道重新打包为 GPL）
- GPL/AGPL 系用于闭源交付（及 AGPL 用于 SaaS）时由策略锁定阻断，普通复核记录不能放行
- 阻断项（待复核 + 阻断）清零前禁止导出 Markdown；报告逐项含最终结论与裁定来源
- 所有状态写入浏览器本地存档，重开页面可接着处理

## 架构（解析 / 判断 / 存档 / 界面各自独立）

```
src/
  domain/            解析与判断，纯函数，不依赖 React 与存储
    types.ts         数据模型
    parser.ts        解析层：清单文本 / package.json → 结构化条目
    scanner.ts       扫描证据层：模拟制品 LICENSE 扫描（渠道相关）
    rules.ts         许可证知识库与规则引擎（含策略锁）
    workflow.ts      编排：条目 + 证据 + 规则 + 人工复核 → 最终结论/裁定来源
  storage/store.ts   存档层：localStorage 持久化与恢复
  report/markdown.ts 报告层：阻断校验与 Markdown 导出
  components/        界面层：ManifestPanel / ResultsList / ItemDetail
  App.tsx            组合根，只负责串联四层
```

## 开发

```bash
npm install
npm run dev      # 本地开发
npm run build    # 类型检查 + 构建
npm run preview  # 预览构建产物
```
