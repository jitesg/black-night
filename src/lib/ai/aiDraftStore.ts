/**
 * aiDraftStore.ts
 * Module-level store for handing off AI-generated drafts to existing editors.
 * In-memory only — never persisted to SQLite.
 *
 * Usage:
 *   // In AICopilotModal (after user taps "Open in Editor"):
 *   aiDraftStore.setDraft(draft);
 *   router.push('/(app)/mukadma/[firId]/add-case-diary');
 *
 *   // In the target editor screen (on mount):
 *   const draft = aiDraftStore.consumeDraft();
 *   if (draft) setContent(draft.content);
 */

import type { AIDraft } from '@/ai/AITypes';

class AIDraftStore {
  private draft: AIDraft | null = null;

  setDraft(draft: AIDraft): void {
    this.draft = draft;
  }

  /** Returns the pending draft and clears it (consume-once). */
  consumeDraft(): AIDraft | null {
    const d = this.draft;
    this.draft = null;
    return d;
  }

  peek(): AIDraft | null {
    return this.draft;
  }

  hasDraft(): boolean {
    return this.draft !== null;
  }

  clear(): void {
    this.draft = null;
  }
}

export const aiDraftStore = new AIDraftStore();
