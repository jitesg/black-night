/**
 * Open a saved "हाल के कार्य" record in the normal जनरेटेड रिपोर्ट screen (formats/preview):
 * rebuilds the A4 print HTML and the editor HTML from the saved marked text (same pipeline as formats/fill).
 */
import { router } from 'expo-router';
import { buildPrintHtml } from '@/components/common/DocumentEditor';
import { fixFormat } from '@/lib/formatFixingEngine';
import { stripFormatMarkers } from '@/lib/formatMarkers';
import { parseIntoDocumentModel, renderModelsForEditor, splitIntoSubLetters } from '@/lib/formatParsingEngine';
import { formatPreviewBridge } from '@/lib/formatPreviewBridge';
import { DEFAULT_LAYOUT_PROFILE } from '@/lib/db/predefinedFormatRepo';
import { renderTextForPrint } from '@/lib/printLayout';
import type { ReportRecord } from '@/lib/reportRecordCore';

export function openReportRecord(r: ReportRecord): void {
  const marked = r.marked_text;
  const { html: fixedHtml } = fixFormat(buildPrintHtml(renderTextForPrint(marked), r.format_title), DEFAULT_LAYOUT_PROFILE, r.format_title);
  const editorHtml = renderModelsForEditor(splitIntoSubLetters(marked).map(parseIntoDocumentModel));
  formatPreviewBridge.set({
    reportText: stripFormatMarkers(marked),
    formatHtml: fixedHtml,
    formatEditorHtml: editorHtml,
    recordId: r.id,
    editedHtml: r.edited_html ?? undefined,
  });
  router.push(`/(app)/formats/preview?formatId=${encodeURIComponent(r.format_id ?? '')}&formatTitle=${encodeURIComponent(r.format_title)}` as never);
}
