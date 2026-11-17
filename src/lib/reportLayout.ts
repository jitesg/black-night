/**
 * Keeps a format's layout (तालिका, बीच, दाएँ, bold, चित्र …) for reports that are shown as plain text in a box — प्रार्थना पत्र
 * आख्या and न्यायालय आख्या (owner: the same format printed right from the प्रारूप list but lost its layout from there).
 *
 * The box keeps the plain text (no [[…]] marks for the officer to see); next to it we keep the MARKED text of the format.
 * While the box still holds exactly that text, A4 प्रीव्यू / .doc use the marked version; once the officer changes the text,
 * they use the box text (layout guessed, as before). Pure — tests: scripts/test_report_layout.ts
 */
import { parseIntoDocumentModel, renderModelsForEditor, splitIntoSubLetters } from './formatParsingEngine';

/** Plain text in the box + the marked text it came from. */
export interface LayoutTrack { plain: string; marked: string }

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Same words, whitespace ignored (the box may trim / re-wrap). */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return norm(a) === norm(b);
}

/** Marked format text → the editor HTML with hidden data-fmt marks (what A4 / Word / the editor read). */
export function markedToEditorHtml(marked: string | null | undefined): string {
  const m = (marked ?? '').trim();
  if (!m) return '';
  return renderModelsForEditor(splitIntoSubLetters(m).map(parseIntoDocumentModel));
}

/**
 * A generated format was put into the box (after any text already there, with a blank line — like the screens do).
 * Returns the new track, or null when the earlier text was typed by hand (then no marked version can stand for it).
 */
export function appendTrack(prev: LayoutTrack | null, boxBefore: string, genPlain: string, genMarked: string): LayoutTrack | null {
  const plain = boxBefore.trim() ? `${boxBefore}\n\n${genPlain}` : genPlain;
  if (!genMarked.trim()) return null;
  if (!boxBefore.trim()) return { plain, marked: genMarked };
  if (prev && sameText(prev.plain, boxBefore)) return { plain, marked: `${prev.marked}\n\n${genMarked}` };
  return null;
}

/** The marked text to save with the report — only while the box is unchanged; '' otherwise. */
export function markedToSave(track: LayoutTrack | null, content: string): string {
  return track && track.marked && sameText(track.plain, content) ? track.marked : '';
}

/** What A4 प्रीव्यू / .doc should read: the format's layout while unchanged, else the box text. */
export function layoutSource(track: LayoutTrack | null, content: string): string {
  const m = markedToSave(track, content);
  return m ? markedToEditorHtml(m) : content;
}
