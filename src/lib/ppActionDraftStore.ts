/**
 * Module-level singleton store for passing generated format content
 * from the fill-format screen back to the Take Action editor.
 *
 * This avoids URL param length limits and AsyncStorage async overhead
 * for a simple, synchronous in-process handoff within a single navigation
 * session. The consumer calls consume() once and the store self-clears.
 */

interface ActionDraft {
  generatedText: string;
  formatTitle: string;
  formatId: string;
}

let _pending: ActionDraft | null = null;

export const ppActionDraftStore = {
  /** Called by fill-format.tsx before router.back() */
  set(draft: ActionDraft): void {
    _pending = draft;
  },

  /** Called by take-action.tsx in useFocusEffect — reads and clears in one step */
  consume(): ActionDraft | null {
    const v = _pending;
    _pending = null;
    return v;
  },

  /** Peek without clearing — useful for debugging */
  peek(): ActionDraft | null {
    return _pending;
  },
};
