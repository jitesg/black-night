/**
 * Format Fixing Engine — Adaptive A4 font-fit
 *
 * Algorithm (presentation-only — wording never changes):
 *   1. Start at profile.fontSizeNormal.
 *   2. Inject font-size / line-spacing CSS variables into the HTML.
 *   3. On native: measure rendered scrollHeight via WebView postMessage.
 *      On web:    measure via hidden <iframe> contentDocument.scrollingElement.scrollHeight.
 *   4. If content fits one A4 page → done.
 *   5. If fontSize > fontSizeMin → decrease by 1pt, go to step 2.
 *   6. If at fontSizeMin and still overflows → stop shrinking; report
 *      pageCount = Math.ceil(contentHeight / pageHeight). The final HTML
 *      already has page-break hints between sub-letter groups from
 *      renderDocumentModel().
 *
 * A4 usable height = 297mm − margins.top − margins.bottom  (converted to px at 96dpi).
 * 1mm = 3.7795275591px at 96dpi.
 */

import type { LayoutProfile } from './db/predefinedFormatRepo';

export interface FixFormatResult {
  html: string;
  pageCount: number;
  finalFontSize: number;
}

const MM_TO_PX = 3.7795275591;

function _usableHeightPx(profile: LayoutProfile): number {
  const heightMm = 297 - profile.margins.top - profile.margins.bottom;
  return heightMm * MM_TO_PX;
}

/**
 * Inject CSS variable overrides for font-size and line-height into an HTML string.
 * The variables --doc-font-size and --doc-line-height must already be referenced
 * inside the HTML's <style> block (inserted by renderDocumentModel / buildPrintHtml).
 */
function _injectFontVars(html: string, fontSize: number, lineHeight: number): string {
  const override = `<style id="fix-vars">
:root{--doc-font-size:${fontSize}pt;--doc-line-height:${lineHeight};}
</style>`;
  // Insert before </head> so it overrides any earlier declarations
  return html.replace('</head>', `${override}</head>`);
}

/**
 * Synchronous height measurement using a hidden <iframe> on Web.
 * Returns the scrollHeight of the .page element, or 0 on failure.
 */
function _measureHeightWeb(html: string): number {
  if (typeof document === 'undefined') return 0;
  try {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:1px;visibility:hidden;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) { document.body.removeChild(iframe); return 0; }
    doc.open();
    doc.write(html);
    doc.close();
    // Force layout
    const page = doc.querySelector('.page') as HTMLElement | null;
    const height = page ? page.scrollHeight : doc.documentElement.scrollHeight;
    document.body.removeChild(iframe);
    return height;
  } catch {
    return 0;
  }
}

/**
 * fixFormat — synchronous on Web (iframe measurement), async-compatible.
 *
 * On native: we cannot easily run a synchronous WebView measurement here, so
 * we skip the shrink loop and return the HTML with the normal font size. The
 * PrintPreviewModal / WebView will still display correctly — the font just
 * stays at fontSizeNormal. A future enhancement could add an async
 * postMessage-based measurement loop, but that requires a mounted component.
 *
 * On web (preview): full shrink loop runs synchronously via hidden iframe.
 */
export function fixFormat(
  html: string,
  profile: LayoutProfile,
  _title: string,
): FixFormatResult {
  const isWeb = typeof document !== 'undefined';
  const usableHeightPx = _usableHeightPx(profile);

  let fontSize   = profile.fontSizeNormal;
  let lineHeight = profile.lineSpacingNormal;

  if (!isWeb) {
    // Native: inject normal font vars and return immediately
    const fixedHtml = _injectFontVars(html, fontSize, lineHeight);
    return { html: fixedHtml, pageCount: 1, finalFontSize: fontSize };
  }

  // Web: shrink loop
  const range = profile.fontSizeNormal - profile.fontSizeMin;

  for (let step = 0; step <= range; step++) {
    const currentFontSize   = profile.fontSizeNormal - step;
    const shrinkRatio        = step / Math.max(range, 1);
    const currentLineHeight  = profile.lineSpacingNormal -
      shrinkRatio * (profile.lineSpacingNormal - profile.lineSpacingMin);

    const candidate = _injectFontVars(html, currentFontSize, Math.max(currentLineHeight, profile.lineSpacingMin));
    const contentHeight = _measureHeightWeb(candidate);

    if (contentHeight <= usableHeightPx || currentFontSize <= profile.fontSizeMin) {
      const pageCount = contentHeight > 0
        ? Math.max(1, Math.ceil(contentHeight / usableHeightPx))
        : 1;
      return {
        html: candidate,
        pageCount,
        finalFontSize: currentFontSize,
      };
    }

    fontSize   = currentFontSize;
    lineHeight = currentLineHeight;
  }

  // Fallback: fontSizeMin, compute pages
  const finalHtml    = _injectFontVars(html, profile.fontSizeMin, profile.lineSpacingMin);
  const finalHeight  = _measureHeightWeb(finalHtml);
  const pageCount    = finalHeight > 0 ? Math.max(1, Math.ceil(finalHeight / usableHeightPx)) : 1;
  return { html: finalHtml, pageCount, finalFontSize: profile.fontSizeMin };
}
