import { DELIVERIES, DELIVERY_LABELS } from '../license/types';
import type { Delivery } from '../license/types';

interface Props {
  text: string;
  errors: string[];
  delivery: Delivery;
  onTextChange: (text: string) => void;
  onDeliveryChange: (d: Delivery) => void;
  onAnalyze: () => void;
  onLoadSample: () => void;
}

const SAMPLE = `# 行格式：名称@版本 声明许可证 渠道 evidence:证据1,证据2
react@18.3.1 MIT npm evidence:MIT
lodash@4.17.21 MIT npm evidence:MIT
sharp@0.33.4 Apache-2.0 npm evidence:Apache-2.0
left-pad-legacy@1.3.0 MIT npm evidence:MIT,GPL-3.0
vendor-sdk@2.1.0 UNKNOWN cdn evidence:Proprietary
copyleft-ui@4.0.0 GPL-3.0 bundle evidence:GPL-3.0
axios@1.7.2 MIT mirror evidence:MIT
zod@3.23.8 MIT npm evidence:MIT`;

export function ImportPanel({ text, errors, delivery, onTextChange, onDeliveryChange, onAnalyze, onLoadSample }: Props) {
  return (
    <section className="panel import-panel">
      <h2>① 粘贴依赖清单</h2>
      <textarea
        className="manifest-input"
        value={text}
        onChange={e => onTextChange(e.target.value)}
        placeholder={'每行一条：名称@版本 声明许可证 渠道 evidence:证据\n也支持粘贴 JSON 数组或 package.json'}
        spellCheck={false}
      />
      <div className="import-actions">
        <button className="btn primary" onClick={onAnalyze}>解析清单</button>
        <button className="btn" onClick={() => onTextChange(SAMPLE)}>填入示例</button>
        <label className="delivery-select">
          交付形态
          <select value={delivery} onChange={e => onDeliveryChange(e.target.value as Delivery)}>
            {DELIVERIES.map(d => (
              <option key={d} value={d}>{DELIVERY_LABELS[d]}</option>
            ))}
          </select>
        </label>
      </div>
      {errors.length > 0 && (
        <ul className="parse-errors">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      <p className="hint">
        渠道可选：npm / bundle / cdn / mirror。同一包换发布渠道会作为新条目重新判断；
        声明许可证与扫描证据不一致的条目会进入人工复核。
      </p>
    </section>
  );
}

export { SAMPLE as SAMPLE_MANIFEST };
