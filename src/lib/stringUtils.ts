/**
 * stripHtmlTags — removes all HTML markup and decodes basic entities.
 * Use before rendering rich-text fields (editor_content, report_content, etc.)
 * inside React Native <Text> components, which do not parse HTML.
 */
export const stripHtmlTags = (htmlString?: string | null): string => {
  if (!htmlString) return '';
  return htmlString
    .replace(/<[^>]*>?/gm, '')    // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')       // Convert non-breaking spaces
    .replace(/&amp;/g, '&')        // Convert ampersands
    .replace(/&lt;/g, '<')         // Convert less-than
    .replace(/&gt;/g, '>')         // Convert greater-than
    .replace(/&quot;/g, '"')       // Convert quotes
    .replace(/&#39;/g, "'")        // Convert apostrophes
    .trim();
};

/**
 * htmlToPlainText — converts rich-editor HTML into plain text, keeping line
 * breaks. User-created formats are saved as HTML; the report/print pipeline
 * expects plain text, otherwise tags like <div> and &nbsp; show up literally.
 * Plain text (no tags) is returned unchanged.
 */
export const htmlToPlainText = (input?: string | null): string => {
  if (!input) return '';
  if (!/<[a-z][\s\S]*?>|&nbsp;|&#\d+;/i.test(input)) return input;
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
