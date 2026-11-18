/**
 * Chosen cards → ONE Word file (owner, sample approved — प्रार्थना पत्र + न्यायालय list selection).
 * Each chosen paper's report starts on a new page (exportReportToDocx with a list), the same layout as its own ".doc"
 * button: प्रार्थना पत्र = आख्या (+ बीट सूचना / NCR कार्यवाही, oldest first); न्यायालय = रिपोर्ट. A paper without a report
 * is left out and counted (`skipped`) so the screen can say so. Nothing leaves the phone except through the share sheet.
 */
import { htmlToPlainText } from './stringUtils';
import { markedToEditorHtml } from './reportLayout';

export interface BatchResult { exported: number; skipped: number }

const filled = (s: string | null | undefined) => !!s && !!htmlToPlainText(s).trim();
const today = () => { const d = new Date(); return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`; };

/** Several प्रार्थना पत्र → one .doc; `skipped` = papers with no आख्या / कार्यवाही. */
export async function exportPrarthnaPatraBatch(ids: readonly string[]): Promise<BatchResult> {
  const { getPPWithDetails } = await import('./db/prarthnaPatraRepo');
  const sources: string[] = [];
  let papers = 0;
  let skipped = 0;
  for (const id of ids) {
    const pp = await getPPWithDetails(id);
    if (!pp) continue;
    const own: string[] = [];
    const r = pp.report;
    if (r && filled(r.report_content)) own.push(r.report_marked ? markedToEditorHtml(r.report_marked) : r.report_content);
    // actions come newest first from the repo — the file reads oldest first
    for (const a of [...pp.actions].reverse()) if (filled(a.action_content)) own.push(a.action_content);
    if (own.length) { sources.push(...own); papers += 1; } else skipped += 1;
  }
  if (sources.length) {
    const { exportReportToDocx } = await import('./reportDocxExport');
    await exportReportToDocx(sources, `प्रार्थना_पत्र_${papers}_आख्या_${today()}`);
  }
  return { exported: papers, skipped };
}

/** Several न्यायालय कागज़ → one .doc; `skipped` = papers with no रिपोर्ट. */
export async function exportNyayalayBatch(ids: readonly string[]): Promise<BatchResult> {
  const { getNyayalayReport } = await import('./db/nyayalayRepo');
  const sources: string[] = [];
  let skipped = 0;
  for (const id of ids) {
    const r = await getNyayalayReport(id);
    if (r && filled(r.report_content)) sources.push(r.report_marked ? markedToEditorHtml(r.report_marked) : r.report_content);
    else skipped += 1;
  }
  if (sources.length) {
    const { exportReportToDocx } = await import('./reportDocxExport');
    await exportReportToDocx(sources, `न्यायालय_${sources.length}_रिपोर्ट_${today()}`);
  }
  return { exported: sources.length, skipped };
}
