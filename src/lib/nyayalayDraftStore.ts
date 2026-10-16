/**
 * Module-level singleton store for passing generated format content
 * from the Nyayalay fill-format screen back to the report editor.
 * Same pattern as ppActionDraftStore — consumer calls consume() once.
 */

interface NyayalayDraft {
  generatedText: string;
  formatTitle: string;
  formatId: string;
}

let _pending: NyayalayDraft | null = null;

export const nyayalayDraftStore = {
  set(draft: NyayalayDraft): void {
    _pending = draft;
  },
  consume(): NyayalayDraft | null {
    const v = _pending;
    _pending = null;
    return v;
  },
  peek(): NyayalayDraft | null {
    return _pending;
  },
};
