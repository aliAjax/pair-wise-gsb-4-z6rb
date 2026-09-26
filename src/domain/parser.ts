// 解析层：把粘贴的清单文本或 package.json 内容解析为结构化条目。
// 纯函数，不依赖判断、存档与界面。

export interface ParsedEntry {
  name: string;
  version: string;
  declaredLicense: string;
}

export interface ParseResult {
  entries: ParsedEntry[];
  /** 无法识别的行，原样返回供界面提示 */
  skipped: string[];
  format: 'package.json' | 'lines' | 'empty';
}

export function parseManifest(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { entries: [], skipped: [], format: 'empty' };

  const fromJson = tryPackageJson(trimmed);
  if (fromJson) return { entries: fromJson, skipped: [], format: 'package.json' };

  const entries: ParsedEntry[] = [];
  const skipped: string[] = [];
  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const entry = parseLine(line);
    if (entry) entries.push(entry);
    else skipped.push(line);
  }
  return { entries, skipped, format: 'lines' };
}

/** 支持：name@version 许可证 / name@version / name 许可证（含 @scope 包名） */
function parseLine(line: string): ParsedEntry | null {
  let m = line.match(/^(@[\w.-]+\/[\w./-]+|[\w./-]+)@([\w][\w.+-]*)\s+(\S.*)$/);
  if (m) return { name: m[1], version: m[2], declaredLicense: m[3].trim() };
  m = line.match(/^(@[\w.-]+\/[\w./-]+|[\w./-]+)@([\w][\w.+-]*)$/);
  if (m) return { name: m[1], version: m[2], declaredLicense: '' };
  // 无版本号的裸名只在尾部像许可证标识时采信，避免把任意文本误判为条目
  m = line.match(/^(@[\w.-]+\/[\w./-]+|[\w./-]+)\s+([A-Za-z][\w.+-]*(?:\s+(?:License|Clause|Only))?)$/);
  if (m && looksLikeLicense(m[2])) return { name: m[1], version: '', declaredLicense: m[2].trim() };
  return null;
}

const LICENSE_HINTS = /MIT|Apache|BSD|ISC|GPL|LGPL|AGPL|MPL|EPL|CC-?BY|CC0|Unlicense|Proprietary|Commercial|UNLICENSED/i;

function looksLikeLicense(text: string): boolean {
  return LICENSE_HINTS.test(text);
}

function tryPackageJson(text: string): ParsedEntry[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  const entries: ParsedEntry[] = [];
  let found = false;
  for (const section of sections) {
    const deps = (data as Record<string, unknown>)[section];
    if (typeof deps !== 'object' || deps === null) continue;
    found = true;
    for (const [name, range] of Object.entries(deps as Record<string, unknown>)) {
      entries.push({ name, version: cleanVersion(String(range)), declaredLicense: '' });
    }
  }
  return found ? entries : null;
}

function cleanVersion(range: string): string {
  return range.replace(/^[\^~>=<\s]+/, '').trim();
}
