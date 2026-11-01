/**
 * reportRecordCore.ts — "हाल के कार्य" (owner): every report made from a predefined format is kept as a record.
 * Pure helpers (no DB / RN) — tests: scripts/test_report_records.ts.
 */
import { searchNormalize } from './searchUtils';

export interface ReportRecord {
  id: string;
  format_id: string | null;
  format_title: string;
  module: string | null;
  summary: string | null;
  marked_text: string;
  edited_html: string | null;
  created_at: number; // unix seconds
  updated_at: number;
  /** 'draft' = half-filled form from the Formats list (values_json), else a generated report. */
  status?: string | null;
  values_json?: string | null;
}

export const isDraftRecord = (r: Pick<ReportRecord, 'status'>) => r.status === 'draft';

export type RecordRange = 'today' | 'week' | 'all';

/** Where the report was made → Hindi tag shown on the card. */
export function moduleLabel(module: string | null | undefined): string {
  switch (String(module ?? '').trim()) {
    case 'GD': return 'GD';
    case 'NK': case 'BNSS Karyavahi': return 'निरोधात्मक';
    case 'Nyayalay': return 'न्यायालय';
    case 'Prarthna Patra': return 'प्रार्थना पत्र';
    case 'Case Diary': return 'केस डायरी';
    case 'Narrative': return 'विवरण';
    default: return 'प्रारूप';
  }
}

const first = (v: unknown) => String(v ?? '').trim();

/** First name in a person / accused group value (JSON array). */
function groupFirstName(raw: string): string {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const p = arr.find((e) => e && first(e.name));
      if (p) {
        const many = arr.filter((e) => e && first(e.name)).length;
        return first(p.name) + (many > 1 ? ' आदि' : '');
      }
    }
  } catch { /* not JSON */ }
  return '';
}

/** First vehicle number in an item_group value. */
function firstVehicle(raw: string): string {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const v = arr.find((r) => r && first(r.vno));
      if (v) return `वाहन ${first(v.vno)}${arr.filter((r) => r && first(r.vno)).length > 1 ? ' आदि' : ''}`;
    }
  } catch { /* not JSON */ }
  return '';
}

/**
 * One short line that tells reports apart: "मु0अ0सं0 245/2026 · राम कुमार" (FIR number + first person /
 * vehicle / name field), else the विषय line of the text.
 */
export function reportSummary(values: Record<string, string>, plainText: string): string {
  const parts: string[] = [];
  const firKey = Object.keys(values).find((k) => /^fir(no|number)?$/i.test(k) && first(values[k]));
  if (firKey) parts.push(`मु0अ0सं0 ${first(values[firKey])}`);
  let who = '';
  for (const [k, v] of Object.entries(values)) {
    const t = first(v);
    if (!t || !t.startsWith('[')) continue;
    who = /veh/i.test(k) ? firstVehicle(t) : groupFirstName(t);
    if (who) break;
  }
  if (!who) {
    const nameKey = ['DName', 'PName', 'EmpName', 'VictimName', 'Name', 'village', 'Village']
      .find((k) => first(values[k]));
    if (nameKey) who = first(values[nameKey]);
  }
  if (who) parts.push(who);
  if (parts.length) return parts.join(' · ').slice(0, 120);
  const subject = plainText.split('\n').map((l) => l.trim()).find((l) => /^विषय/.test(l));
  const line = subject ?? plainText.split('\n').map((l) => l.trim()).find((l) => l.length > 10) ?? '';
  return line.replace(/^विषय\s*[:\-–]*\s*/, '').slice(0, 120);
}

/** Start of the day / of the last 7 days (local time), unix seconds. */
export function rangeStart(range: RecordRange, now: Date = new Date()): number {
  if (range === 'all') return 0;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (range === 'week') d.setDate(d.getDate() - 6);
  return Math.floor(d.getTime() / 1000);
}

export function matchesRecord(r: Pick<ReportRecord, 'format_title' | 'summary' | 'module'>, query: string): boolean {
  const q = searchNormalize(query).trim();
  if (!q) return true;
  const hay = searchNormalize(`${r.format_title} ${r.summary ?? ''} ${moduleLabel(r.module)}`);
  return q.split(/\s+/).every((w) => hay.includes(w));
}

const p2 = (n: number) => String(n).padStart(2, '0');
export const dayKey = (ts: number) => { const d = new Date(ts * 1000); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`; };
export const timeLabel = (ts: number) => {
  const d = new Date(ts * 1000);
  const h = d.getHours();
  return `${p2(((h + 11) % 12) + 1)}:${p2(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Records (newest first) → day groups with a heading "आज — 01.11.2026" / "कल — …" / date. */
export function groupByDay<T extends { created_at: number }>(rows: T[], now: Date = new Date()): { title: string; items: T[] }[] {
  const today = dayKey(Math.floor(now.getTime() / 1000));
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const yesterday = dayKey(Math.floor(y.getTime() / 1000));
  const out: { title: string; items: T[] }[] = [];
  for (const r of rows) {
    const k = dayKey(r.created_at);
    const title = k === today ? `आज — ${k}` : k === yesterday ? `कल — ${k}` : k;
    const last = out[out.length - 1];
    if (last && last.title === title) last.items.push(r); else out.push({ title, items: [r] });
  }
  return out;
}

/** Same format generated again within this many seconds → the newer text replaces the record (corrections). */
export const REPLACE_WINDOW_S = 15 * 60;
