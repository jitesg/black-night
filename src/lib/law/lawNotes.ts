/**
 * Owner's detailed notes for a law section (e.g. BNSS 35 — BNSS_Dhara_35_Vistrit_Notes_Hindi.docx), shown in the "विस्तृत विश्लेषण"
 * card INSTEAD of the generated explain_*.json analysis (owner). Text as in the docx (extracted by script, not retyped), blocks as in
 * src/lib/formatInfo.ts. Add a note: assets/law-notes/<ACT>-<n>.json + one line in NOTES.
 */
import type { FormatInfo } from '@/lib/formatInfo';

const NOTES: Record<string, () => FormatInfo> = {
  'BNSS-35': () => require('../../../assets/law-notes/BNSS-35.json') as FormatInfo,
};

export function getLawNote(act: string, n: number): FormatInfo | null {
  const k = `${act}-${n}`;
  if (!(k in NOTES)) return null;
  try { return NOTES[k](); } catch { return null; }
}
