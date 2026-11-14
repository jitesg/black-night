/**
 * "ⓘ प्रारूप की जानकारी" (owner): an info note per predefined format, shown from the ⓘ button on the format card
 * (FormatCard → FormatInfoSheet). Notes live in assets/format-info/<format id>.json — the owner's docx text as is
 * (blue design of the docx). Add a new note: put the JSON there and one line in NOTES below.
 *
 * Blocks: head {label,title,sub,lines} · box {tone info|warn,label,x} · h / h2 {x} · p {x} · ul / ol / check (☐) {i: string[]} ·
 * table {head: string[], rows: string[][]} · qa {rows: [q, a][]}. "**…**" inside text = bold.
 */
export type InfoBlock =
  | { t: 'head'; label: string; title: string; sub?: string; lines?: string[] }
  | { t: 'box'; tone: 'info' | 'warn'; label: string; x: string }
  | { t: 'h' | 'h2' | 'p'; x: string }
  | { t: 'ul' | 'ol' | 'check'; i: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'qa'; rows: string[][] };

export interface FormatInfo { v: number; blocks: InfoBlock[] }

const NOTES: Record<string, () => FormatInfo> = {
  'sys-fmt-notice-179-bnss': () => require('../../assets/format-info/sys-fmt-notice-179-bnss.json') as FormatInfo,
  'sys-fmt-notice-35-3-bnss': () => require('../../assets/format-info/sys-fmt-notice-35-3-bnss.json') as FormatInfo,
};

export function hasFormatInfo(formatId: string | null | undefined): boolean {
  return !!formatId && formatId in NOTES;
}

export function getFormatInfo(formatId: string | null | undefined): FormatInfo | null {
  if (!formatId || !(formatId in NOTES)) return null;
  try { return NOTES[formatId](); } catch { return null; }
}

/** "a **b** c" → [{text:'a ',bold:false},{text:'b',bold:true},{text:' c',bold:false}] */
export function boldParts(s: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false });
  return out;
}
