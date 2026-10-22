/**
 * caseCore.ts — pure helpers for the "न्यायिक निर्णय (पुलिस)" hub (L39).
 * Rows: sys-case-<slug> (content_type 'case_note'); sidecar assets/reg/cases_index.json.
 * No React Native imports (tested with node: scripts/test_cases.ts).
 */
import type { RegIndexData, RegPara } from '../regulations/regCore';

export type Court = 'SC' | 'HC';

export interface CaseMeta {
  caseName: string;   // "Joginder Kumar v. State of U.P. and Others"
  citation: string;   // "(1994) 4 SCC 260; AIR 1994 SC 1349"
  court: Court;
  courtName: string;  // "Supreme Court", "Bombay High Court"
  headline: string;   // "# …" line
  hasUpdate: boolean; // description has "⚠ अद्यतन"
}

export const CASES_SOURCE_NOTE =
  'स्रोत: SC/HC Rulings on Police संकलन (1990–2000 के निर्णय) + आधुनिक BNSS/नवीन निर्णय अद्यतन';
export const CASES_FOOTER_NOTE =
  "ये 1990 के दशक के निर्णय हैं; कई बिंदु CrPC→BNSS (1 जुलाई 2024) और बाद के फ़ैसलों से बदले हैं — 'अद्यतन' पंक्तियाँ देखें। कोर्ट में उद्धरण से पहले मूल निर्णय से सिटेशन मिलाएँ।";

/** Reads headline, "(Case — citation)" and "Court: …" from a description. Never throws. */
export function parseCaseMeta(description: string | null | undefined, tags = '', fallbackName = ''): CaseMeta {
  const d = String(description ?? '');
  const lines = d.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const headline = (lines.find((l) => l.startsWith('# ')) ?? '').replace(/^#\s+/, '');
  const sub = lines.find((l) => /^\(.*\)$/.test(l)) ?? '';
  const inner = sub.replace(/^\(\s*/, '').replace(/\s*\)$/, '');
  const dash = inner.indexOf(' — ');
  const caseLine = /^Case:\s*(.+)$/m.exec(d)?.[1]?.trim() ?? '';
  const caseName = (dash >= 0 ? inner.slice(0, dash) : caseLine || fallbackName).trim();
  const citation = (dash >= 0 ? inner.slice(dash + 3) : /^Citation:\s*(.+)$/m.exec(d)?.[1] ?? '').trim();
  const courtName = (/^Court:\s*([^(\n]+)/m.exec(d)?.[1] ?? '').trim()
    || (/Supreme Court/i.test(tags) ? 'Supreme Court' : (/[\w ]+High Court/i.exec(tags)?.[0] ?? '').trim());
  const court: Court = /supreme/i.test(courtName) || (!courtName && /Supreme Court/i.test(tags)) ? 'SC' : 'HC';
  return { caseName, citation, court, courtName, headline, hasUpdate: d.includes('⚠ अद्यतन') };
}

export interface CaseItem {
  id: string;
  para: RegPara | null;      // null when the sidecar has no entry (never crash)
  title: string;             // Hindi headline (paras[id].t, else the "# " line, else row title)
  meta: CaseMeta;
  tags: string[];
  available: boolean;        // row text is in the app
  topic: string;             // Hindi chapter (para.chT, else subcategory)
}

export interface CaseRowLite { id: string; title: string; tags?: string; subcategory?: string; description?: string }

/** Joins sidecar entries and rows (sidecar order first, then rows without a sidecar entry). */
export function buildCaseItems(index: RegIndexData | null, rows: CaseRowLite[]): CaseItem[] {
  const byId = new Map(rows.filter((r) => r?.id?.startsWith('sys-case-')).map((r) => [r.id, r]));
  const ids = [
    ...Object.keys(index?.paras ?? {}).filter((id) => id.startsWith('sys-case-')),
    ...[...byId.keys()].filter((id) => !index?.paras?.[id]),
  ];
  return ids.map((id) => {
    const para = index?.paras?.[id] ?? null;
    const row = byId.get(id);
    const tags = String(row?.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    const meta = parseCaseMeta(row?.description, row?.tags ?? '', para?.en ?? row?.title ?? '');
    const topic = para?.chT || String(row?.subcategory ?? '').replace(/^न्यायिक निर्णय\s*[—-]\s*/, '') || 'अन्य';
    return {
      id, para, meta, tags, available: !!row, topic,
      title: para?.t || meta.headline || String(row?.title ?? id),
    };
  });
}

export interface CaseFilter { query?: string; court?: 'all' | Court; topic?: string | null; verifiedOnly?: boolean }

function norm(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[.\s]+/g, ' ').trim();
}

/** Search (name, citation, tags, Hindi/English words, CrPC/BNSS tokens) + court/topic/verified filters. */
export function filterCases(items: CaseItem[], f: CaseFilter): CaseItem[] {
  const q = norm(f.query ?? '');
  const words = q.split(' ').filter(Boolean);
  return items.filter((it) => {
    if (f.court && f.court !== 'all' && (!it.available || it.meta.court !== f.court)) return false;
    if (f.topic && it.topic !== f.topic) return false;
    if (f.verifiedOnly && it.para?.verified !== true) return false;
    if (!words.length) return true;
    const hay = norm([it.title, it.meta.caseName, it.meta.citation, it.para?.en ?? '', it.para?.t ?? '', it.topic, it.tags.join(' ')].join(' '));
    // "D.K. Basu" → "d k basu"; every word must appear
    return words.every((w) => hay.includes(w));
  });
}

/** Chapter order from the sidecar (I.1 … IV.4), then any extra topics. */
export function topicOrder(index: RegIndexData | null, items: CaseItem[]): string[] {
  const out = (index?.chapters ?? []).filter((c) => c.part === 'CASE').map((c) => c.ch);
  for (const it of items) if (!out.includes(it.topic)) out.push(it.topic);
  return out;
}
