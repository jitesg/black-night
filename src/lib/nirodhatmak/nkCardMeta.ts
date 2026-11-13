/**
 * निरोधात्मक card (owner): no "कार्यवाही प्रकार" box any more (the दिनांक box stays) — the card's middle line is the format's
 * title without the section numbers ("बीट सूचना 126/135 की कार्यवाही" → "बीट सूचना की कार्यवाही").
 * Pure — tests: scripts/test_nk_card_meta.ts
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
