import { useRef, useState } from 'react';
import { FileUp, ListChecks, RotateCcw, Trash2 } from 'lucide-react';
import type { Channel } from '../domain/types';
import { CHANNEL_LABEL } from '../domain/types';

interface Props {
  manifestText: string;
  channel: Channel;
  onManifestChange: (text: string) => void;
  onChannelChange: (channel: Channel) => void;
  onAnalyze: (text: string, channel: Channel) => void;
  onReset: () => void;
  onClear: () => void;
}

const CHANNELS: Channel[] = ['npm', 'github', 'internal', 'vendor'];

export default function ManifestPanel({
  manifestText,
  channel,
  onManifestChange,
  onChannelChange,
  onAnalyze,
  onReset,
  onClear,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      onManifestChange(text);
      onAnalyze(text, channel);
    };
    reader.readAsText(file);
  };

  return (
    <aside className="ll-panel ll-manifest">
      <h3>导入依赖清单</h3>

      <textarea
        className="ll-textarea"
        spellCheck={false}
        placeholder={'每行一个依赖，例如：\nreact@18.3.1 MIT\nlodash@4.17.21 MIT\n\n也可直接粘贴 package.json'}
        value={manifestText}
        onChange={e => onManifestChange(e.target.value)}
      />

      <label className="ll-field">
        <span>发布渠道</span>
        <select value={channel} onChange={e => onChannelChange(e.target.value as Channel)}>
          {CHANNELS.map(c => (
            <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
          ))}
        </select>
      </label>
      <p className="ll-hint">同一包更换发布渠道（如 npm → 商业渠道）会作为新条目重新扫描判断。</p>

      <button className="ll-primary ll-block" onClick={() => onAnalyze(manifestText, channel)}>
        <ListChecks size={15} />
        开始分析
      </button>

      <div
        className={`ll-drop ${dragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
      >
        <FileUp size={17} />
        <span>拖放 package.json / 许可证清单，或</span>
        <button type="button" onClick={() => fileRef.current?.click()}>选择文件</button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.json,.csv,.lock"
          hidden
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = '';
          }}
        />
      </div>

      <div className="ll-manifest-actions">
        <button className="ll-ghost" onClick={onReset}><RotateCcw size={13} />重置示例</button>
        <button className="ll-ghost danger" onClick={onClear}><Trash2 size={13} />清空工作区</button>
      </div>
    </aside>
  );
}
