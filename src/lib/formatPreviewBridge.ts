/**
 * formatPreviewBridge — in-memory singleton that passes large report strings
 * from fill.tsx → preview.tsx without encoding them into a URL parameter.
 *
 * This avoids the URL overflow crash caused by encodeURIComponent on multi-KB
 * HTML strings. Only lightweight IDs (formatId, formatTitle, callingModule)
 * travel via router.push; all payload stays here.
 */

interface FormatPreviewPayload {
  reportText: string;
  formatHtml: string;
  formatEditorHtml: string;
}

const _empty: FormatPreviewPayload = {
  reportText: '',
  formatHtml: '',
  formatEditorHtml: '',
};

let _data: FormatPreviewPayload = { ..._empty };

export const formatPreviewBridge = {
  /** Store the generated report payload before navigating to preview. */
  set(data: FormatPreviewPayload): void {
    _data = { ...data };
  },

  /** Retrieve the stored payload (call on preview screen mount). */
  get(): FormatPreviewPayload {
    return { ..._data };
  },

  /** Clear after consumption to free memory. */
  clear(): void {
    _data = { ..._empty };
  },
};
