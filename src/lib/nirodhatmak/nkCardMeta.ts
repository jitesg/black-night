/**
 * निरोधात्मक card (owner): no "कार्यवाही दिनांक" / "कार्यवाही प्रकार" boxes any more — the card's date and middle line come
 * from the report. Middle line = the format's title without the section numbers ("बीट सूचना 126/135 की कार्यवाही" →
 * "बीट सूचना की कार्यवाही"); date = the format's "कार्यवाही करने की तिथि" (DateOfAction), else the day the report was made
 * (the 170 formats have no such field). Pure — tests: scripts/test_nk_card_meta.ts
 */

export const NK_NO_FORMAT_TYPE = 'निरोधात्मक कार्यवाही';

/** Format title without धारा numbers: "170/126/135 – PRV द्वारा लाए जाने पर (एकपक्षीय)" → "PRV द्वारा लाए जाने पर (एकपक्षीय)". */
export function cleanFormatTitle(title: string | null | undefined): string {
  let t = String(title ?? '').trim();
  if (!t) return '';
  t = t
    .replace(/(धारा\s*)?\d+(\(\d+\))?(\s*\/\s*\d+(\(\d+\))?)+(\s*(BNSS|बीएनएसएस|बी0एन0एस0एस0))?/g, ' ')
    .replace(/^\s*[–—-]\s*/, '')
    .replace(/\s+[–—-]\s*$/, '')
    .replace(/\s+([–—-])\s+[–—-]\s+/g, ' $1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t || String(title).trim();
}

/** "YYYY-MM-DD" from a format date value (picker gives YYYY-MM-DD; typed dd.mm.yyyy / dd/mm/yyyy also read). */
export function toYmd(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** The card's date: the report's कार्यवाही करने की तिथि, else `reportDay` (YYYY-MM-DD, the day the report was made). */
export function nkActionDate(values: Record<string, unknown> | null | undefined, reportDay: string): string {
  return toYmd(values?.DateOfAction as string | undefined) ?? reportDay;
}
