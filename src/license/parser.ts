import { CHANNELS } from './types';
import type { Channel, DependencyItem } from './types';

export interface ParseResult {
  items: DependencyItem[];
  errors: string[];
}

/** 条目身份：同一包换了发布渠道即为不同条目，需重新判断 */
export function makeItemId(name: string, version: string, channel: Channel): string {
  return `${name}@${version || '0'}::${channel}`;
}

function asChannel(raw: unknown): Channel | null {
  return typeof raw === 'string' && (CHANNELS as readonly string[]).includes(raw)
    ? (raw as Channel)
    : null;
}

function asEvidence(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(/[,，、|]/).map(s => s.trim()).filter(Boolean);
  return [];
}

type RawEntry = Record<string, unknown>;

function entryFromJson(raw: RawEntry, errors: string[], index: number): DependencyItem | null {
  const name = String(raw.name ?? '').trim();
  if (!name) {
    errors.push(`第 ${index} 条：缺少依赖名称，已跳过`);
    return null;
  }
  const version = String(raw.version ?? '').trim().replace(/^[\^~>=<\s]+/, '');
  const declaredLicense =
    String(raw.declaredLicense ?? raw.declared ?? raw.license ?? 'UNKNOWN').trim() || 'UNKNOWN';
  let channel: Channel = 'npm';
  if (raw.channel != null) {
    const parsed = asChannel(raw.channel);
    if (parsed) channel = parsed;
    else errors.push(`${name}：无法识别的渠道 "${String(raw.channel)}"，已按 npm 仓库处理`);
  }
  const evidence = asEvidence(raw.evidence);
  return { id: makeItemId(name, version, channel), name, version, channel, declaredLicense, evidence };
}

/** 行格式：名称@版本 声明许可证 渠道 evidence:证据1,证据2（渠道与证据可省略、顺序不限） */
function parseLine(line: string, lineNo: number, errors: string[]): DependencyItem | null {
  const tokens = line.split(/\s+/).filter(Boolean);
  const head = tokens[0];
  // 兼容 @scope/name@version：取最后一个 @ 作为版本分隔
  const at = head.lastIndexOf('@');
  const name = at > 0 ? head.slice(0, at) : head;
  const version = at > 0 ? head.slice(at + 1) : '';
  if (!name) {
    errors.push(`第 ${lineNo} 行：缺少依赖名称，已跳过`);
    return null;
  }
  let declaredLicense = 'UNKNOWN';
  let channel: Channel = 'npm';
  let evidence: string[] = [];
  const rest = tokens.slice(1);
  if (rest.length > 0 && !rest[0].includes(':') && !rest[0].includes('=')) {
    declaredLicense = rest.shift() as string;
  }
  for (const token of rest) {
    const ev = token.match(/^evidence[:=](.+)$/i);
    if (ev) {
      evidence = ev[1].split(/[,，、|]/).map(s => s.trim()).filter(Boolean);
      continue;
    }
    const ch = asChannel(token);
    if (ch) {
      channel = ch;
      continue;
    }
    errors.push(`第 ${lineNo} 行：无法识别的字段 "${token}"，已忽略`);
  }
  return { id: makeItemId(name, version, channel), name, version, channel, declaredLicense, evidence };
}

function parseJson(text: string, errors: string[]): DependencyItem[] {
  const data: unknown = JSON.parse(text);
  if (Array.isArray(data)) {
    return data
      .map((raw, i) => entryFromJson(raw as RawEntry, errors, i + 1))
      .filter((e): e is DependencyItem => e !== null);
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const deps: Record<string, unknown> = {
      ...(obj.dependencies as Record<string, unknown> | undefined),
      ...(obj.devDependencies as Record<string, unknown> | undefined),
    };
    const names = Object.keys(deps);
    if (names.length > 0) {
      // package.json 形态：只有版本号，许可证与证据待补
      return names
        .map((name, i) => entryFromJson({ name, version: deps[name] }, errors, i + 1))
        .filter((e): e is DependencyItem => e !== null);
    }
    const single = entryFromJson(obj, errors, 1);
    return single ? [single] : [];
  }
  errors.push('JSON 内容不是依赖对象或数组');
  return [];
}

/** 解析：清单文本 → 依赖条目。支持行格式、JSON 数组、package.json，纯函数无副作用 */
export function parseManifest(text: string): ParseResult {
  const errors: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return { items: [], errors };

  let entries: DependencyItem[];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      entries = parseJson(trimmed, errors);
    } catch (err) {
      errors.push(`JSON 解析失败：${err instanceof Error ? err.message : String(err)}`);
      entries = [];
    }
  } else {
    entries = [];
    trimmed.split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const entry = parseLine(line, i + 1, errors);
      if (entry) entries.push(entry);
    });
  }

  // 以 名称@版本::渠道 去重；同一包不同渠道是不同条目，各自独立判断
  const seen = new Map<string, DependencyItem>();
  for (const item of entries) {
    const dup = seen.get(item.id);
    if (dup) {
      dup.evidence = Array.from(new Set([...dup.evidence, ...item.evidence]));
      errors.push(`${item.name}@${item.version}（${item.channel}）：重复条目已合并`);
    } else {
      seen.set(item.id, item);
    }
  }
  return { items: [...seen.values()], errors };
}
