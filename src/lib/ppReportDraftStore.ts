/**
 * Module-level singleton store for passing generated format content
 * from the PP fill-format screen back to the Report editor.
 *
 * Mirrors the ppActionDraftStore pattern. Consumer calls consume() once
 * (in useFocusEffect) and the store self-clears.
 */

interface ReportDraft {
  generatedText: string;
  formatTitle: string;
  formatId: string;
}

let _pending: ReportDraft | null = null;

export const ppReportDraftStore = {
  /** Called by pp fill-format.tsx (report mode) before router.back() */
  set(draft: ReportDraft): void {
    _pending = draft;
  },

  /** Called by report.tsx in useFocusEffect — reads and clears in one step */
  consume(): ReportDraft | null {
    const v = _pending;
    _pending = null;
    return v;
  },

  peek(): ReportDraft | null {
    return _pending;
  },
};
