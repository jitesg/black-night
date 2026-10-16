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
