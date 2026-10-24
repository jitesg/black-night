/**
 * printLayout.ts — fixed, print-ready letter layout for generated reports.
 *
 * Every sub-letter becomes its own A4 sheet (.doc-letter) with a fixed order:
 *   header (right, bold, underlined) → सेवा में + addressee (indented)
 *   → वादी / पक्ष lines → महोदय → body (justified, first-line indent)
 *   → closing (right) → गवाहान → bottom table: संलग्नक (left) | signature (right)
 *
 * Templates put the signature on the same lines as the attachments, separated by
 * a run of spaces/tabs ("1. रिपोर्ट चालानी 01 वर्क        (जीतेश सिंह)"); those
 * are split into a two-column table so the print matches the Word original.
 *
 * Pure string functions (tested with node: scripts/test_print_layout.ts).
 */
import { parseIntoDocumentModel, splitIntoSubLetters, type DocumentModel } from './formatParsingEngine';

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "1.\tरिपोर्ट चालानी 01 वर्क        (जीतेश सिंह)" → { no: '1', left: 'रिपोर्ट चालानी 01 वर्क', right: '(जीतेश सिंह)' } */
export function splitAttachmentLine(line: string): { no: string; left: string; right: string } {
  const raw = String(line ?? '').replace(/ /g, ' ');
  const m = /^\s*(\d{1,2})\s*[.)]\s*/.exec(raw);
  const no = m ? m[1] : '';
  const rest = m ? raw.slice(m[0].length) : raw.trim();
  // A tab, or 3+ spaces, separates the attachment from the signature column.
  const parts = rest.split(/\t+|\s{3,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { no, left: (parts[0] ?? '').trim(), right: '' };
  return { no, left: parts.slice(0, -1).join(' '), right: parts[parts.length - 1] };
}

/** सेवा में block → addressee lines, the "विषय –" line(s) and the वादी / पक्ष lines. */
export function splitSewaMein(lines: string[]): { addressee: string[]; subject: string[]; parties: string[] } {
  const addressee: string[] = [];
  const subject: string[] = [];
  const parties: string[] = [];
  let zone: 'addr' | 'subj' | 'party' = 'addr';
  for (const l of lines) {
    const t = l.trim();
    if (/^विषय/.test(t)) zone = 'subj';
    else if (/^(वादी|वादिनी|प्रथम\s*पक्ष|द्वितीय\s*पक्ष|विपक्षी|अभियुक्त|प्रार्थी)/.test(t)) zone = 'party';
    (zone === 'addr' ? addressee : zone === 'subj' ? subject : parties).push(l);
  }
  return { addressee, subject, parties };
}

/**
 * "रिपोर्ट सादर सेवा मे प्रेषित है । ( जीतेश सिंह ) उ0नि0 थाना बछरावा रायबरेली ।"
 * → closing "रिपोर्ट सादर सेवा मे प्रेषित है ।" + signature ["( जीतेश सिंह )", "उ0नि0", "थाना बछरावा रायबरेली ।"]
 */
export function splitClosing(closing: string): { closing: string; signature: string[] } {
  const c = String(closing ?? '').trim();
  const m = /^(.*?प्रेषित\s*है\s*[।.]?)\s*(.*)$/.exec(c);
  if (!m || !m[2].trim()) return { closing: c, signature: [] };
  let rest = m[2].trim();
  const sig: string[] = [];
  const name = /^(\([^)]*\))\s*(.*)$/.exec(rest);
  if (name) { sig.push(name[1]); rest = name[2].trim(); }
  if (rest) {
    const at = rest.search(/(^|\s)(थाना|जनपद)\s/);
    if (at > 0) { sig.push(rest.slice(0, at).trim()); sig.push(rest.slice(at).trim()); }
    else sig.push(rest);
  }
  return { closing: m[1].trim(), signature: sig.filter(Boolean) };
}

/** A real heading is one short line; a long first line (e.g. a फर्द note) is body text. */
export function isHeading(line: string): boolean {
  const t = String(line ?? '').trim();
  return t.length > 0 && t.length <= 140;
}

/** HTML for one sub-letter (one A4 sheet). */
export function renderLetterHtml(model: DocumentModel): string {
  const out: string[] = ['<div class="doc-letter">'];
  const headerIsBody = !!model.header && !isHeading(model.header);
  if (model.header && !headerIsBody) out.push(`<div class="doc-header">${esc(model.header)}</div>`);

  const { addressee, subject, parties } = splitSewaMein(model.sewaMein ?? []);
  if (addressee.length) {
    const [first, ...rest] = addressee;
    const isSewa = /^सेवा\s*मे/.test(first.trim());
    out.push('<div class="doc-sewa-mein">');
    if (isSewa) out.push(`<p class="sewa-label">${esc(first)}</p>`);
    for (const l of isSewa ? rest : addressee) out.push(`<p class="sewa-line">${esc(l)}</p>`);
    out.push('</div>');
  }
  if (subject.length) {
    out.push(`<div class="doc-subject">${subject.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`);
  }
  if (parties.length) {
    out.push(`<div class="doc-parties">${parties.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`);
  }

  if (model.salutation) out.push(`<div class="doc-salutation">${esc(model.salutation)}</div>`);
  const body = [...(headerIsBody ? [model.header] : []), ...(model.body ?? [])];
  if (body.length) {
    out.push(`<div class="doc-body">${body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>`);
  }
  const close = splitClosing(model.closing ?? '');
  if (close.closing) out.push(`<div class="doc-closing">${esc(close.closing)}</div>`);
  if (model.witnessLine) out.push(`<div class="doc-witness">${esc(model.witnessLine)}</div>`);

  // Bottom: attachments (left) | signature (right), row by row like the original.
  const rows = (model.attachments ?? []).map(splitAttachmentLine);
  const sigExtra: string[] = [...close.signature];
  if (model.signature) {
    if (model.signature.name) sigExtra.push(model.signature.name);
    if (model.signature.designation) sigExtra.push(model.signature.designation);
  }
  if (rows.length || sigExtra.length) {
    const tr: string[] = [];
    if (rows.length) tr.push('<tr><td class="att att-title">संलग्नक -</td><td class="sig"></td></tr>');
    for (const r of rows) {
      tr.push(`<tr><td class="att">${r.no ? `${esc(r.no)}. ` : ''}${esc(r.left)}</td><td class="sig">${esc(r.right)}</td></tr>`);
    }
    for (const s of sigExtra) tr.push(`<tr><td class="att"></td><td class="sig">${esc(s)}</td></tr>`);
    out.push(`<table class="doc-foot">${tr.join('')}</table>`);
  }

  out.push('</div>');
  return out.join('\n');
}

/**
 * Runs inside the printed HTML (preview WebView, PDF renderer, browser):
 * shrinks each sheet's font in 0.5pt steps until it fits one A4 page.
 * Uses a smaller start size when the Kokila font is not installed (phones).
 */
export const LETTER_FIT_SCRIPT = `
(function () {
  function fit() {
    var H = 297 * 3.7795275591 + 2;
    var root = getComputedStyle(document.documentElement);
    var base = parseFloat(root.getPropertyValue('--doc-font-size')) || 17;
    try {
      if (!(document.fonts && document.fonts.check && document.fonts.check('12pt Kokila'))) base = Math.min(base, 15);
    } catch (e) { base = Math.min(base, 15); }
    var MIN = 14; // smallest print size (pt, like Word's 14)
    base = Math.max(base, MIN);
    var sheets = document.querySelectorAll('.doc-letter');
    for (var i = 0; i < sheets.length; i++) {
      var el = sheets[i], fs = base, n = 0;
      el.style.fontSize = fs + 'pt';
      while (el.scrollHeight > H && fs > MIN && n < 40) { fs -= 0.5; n++; el.style.fontSize = fs + 'pt'; }
    }
  }
  if (document.readyState === 'complete') fit(); else window.addEventListener('load', fit);
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); } catch (e) {}
})();`;

/** CSS for "letters" mode (one A4 sheet per .doc-letter). */
export const LETTER_SHEET_CSS = `
  body.letters { background: #e8e8e8; padding: 16px 0 32px; }
  .letters .page { width: auto; min-height: 0; padding: 0; margin: 0; background: none; box-shadow: none; }
  .letters .page > :not(.doc-letter) { display: none; }
  .letters .doc-letter {
    width: 210mm; min-height: 297mm; margin: 0 auto 16px; background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    padding: 12.7mm; /* 0.5 inch on every side */
    font-size: var(--doc-font-size); line-height: var(--doc-line-height);
  }
  .letters .doc-header { text-align: right; font-weight: bold; text-decoration: underline; margin-bottom: 0.6em; }
  .letters .doc-sewa-mein { margin: 0.4em 0 0.4em 0; }
  .letters .doc-sewa-mein p { margin: 0; }
  .letters .doc-sewa-mein .sewa-line { padding-left: var(--doc-indent); }
  .letters .doc-title-line { text-align: center; font-weight: bold; text-decoration: underline; margin: 0.4em 0 0.6em; }
  .letters .doc-body p.doc-note { text-indent: 0; font-size: 0.85em; font-style: italic; }
  .letters .doc-subject { margin: 0.4em 0 0; }
  .letters .doc-subject p { margin: 0; padding-left: var(--doc-indent); text-indent: calc(-1 * var(--doc-indent) / 2); }
  .letters .doc-parties { margin: 0.5em 0 0; }
  .letters .doc-parties p { margin: 0; }
  .letters .doc-salutation { margin: 0.8em 0 0.3em; }
  .letters .doc-body p { text-align: justify; text-indent: var(--doc-indent); margin: 0 0 0.3em; }
  .letters .doc-closing { text-align: right; margin-top: 0.6em; }
  .letters .doc-witness { margin-top: 0.4em; }
  .letters .doc-foot { width: 100%; border-collapse: collapse; margin-top: 0.8em; }
  .letters .doc-foot td { border: none; padding: 0 2pt; vertical-align: top; background: none; }
  .letters .doc-foot td.att { width: 55%; }
  .letters .doc-foot td.att-title { font-weight: bold; }
  .letters .doc-foot td.sig { width: 45%; text-align: center; }
  @page { size: A4; margin: 12.7mm; }
  @media print {
    body.letters { background: #fff; padding: 0; }
    /* small top padding: Devanagari matras of the first line must not spill onto the previous page */
    .letters .doc-letter { padding: 0.35em 0 0 !important; min-height: 0 !important; width: auto !important; }
    .letters .doc-letter { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
    .letters .doc-letter:last-child { break-after: auto; page-break-after: auto; }
  }
`;

/** Plain text looks like a letter (सेवा में … महोदय) → use the fixed letter layout. */
export function looksLikeLetter(text: string): boolean {
  return /सेवा\s*मे/.test(text) && /महोदय/.test(text);
}

/**
 * Text that is not a letter (फर्द, GD entry, पर्चा …): one sheet, one paragraph per
 * line. A leading "नोट-" line is a small note, the first title-like line is centred,
 * and the short lines at the end ("(नाम)", पद, थाना, जनपद) are the signature at the right.
 */
const TITLE_WORD = /फर्द|रिपोर्ट|तस्करा|रवानगी|वापसी|पर्चा|प्रार्थना|आवेदन|सूचना|नकल|विवरण|मेमो|ज्ञापन/;
export function splitPlainText(text: string): { notes: string[]; title: string; paras: string[]; signature: string[] } {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]{2,}/g, ' ').trim()).filter(Boolean);
  const notes: string[] = [];
  let title = '';
  while (lines.length && /^नोट\s*[-–:]/.test(lines[0])) notes.push(lines.shift() as string);
  if (lines.length > 1 && lines[0].length <= 200 && (TITLE_WORD.test(lines[0]) || lines[0].length <= 60)) title = lines.shift() as string;
  const signature: string[] = [];
  // Signature tail: short lines after the last long line, starting at a "(नाम)" line if there is one.
  let k = lines.length;
  while (k > 1 && lines[k - 1].length <= 45 && lines.length - k < 6) k -= 1;
  if (k < lines.length) {
    const tail = lines.slice(k);
    const p = tail.findIndex((l) => /^\(.+\)$/.test(l));
    const from = p >= 0 ? k + p : k;
    signature.push(...lines.splice(from));
  }
  // "… (जीतेश सिंह) उ0नि0 थाना …" glued to the last paragraph.
  if (!signature.length && lines.length) {
    const m = /^(.*[।|.])\s*(\([^()]{2,40}\)\s*.{0,80})$/.exec(lines[lines.length - 1]);
    if (m) { lines[lines.length - 1] = m[1]; signature.push(...splitClosing(`प्रेषित है । ${m[2]}`).signature); }
  }
  return { notes, title, paras: lines, signature };
}

export function renderPlainSheetHtml(text: string): string {
  const { notes, title, paras, signature } = splitPlainText(text);
  const out: string[] = ['<div class="doc-letter doc-plain">'];
  for (const n of notes) out.push(`<div class="doc-body"><p class="doc-note">${esc(n)}</p></div>`);
  if (title) out.push(`<div class="doc-title-line">${esc(title)}</div>`);
  if (paras.length) out.push(`<div class="doc-body">${paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div>`);
  if (signature.length) {
    out.push(`<table class="doc-foot">${signature.map((l) => `<tr><td class="att"></td><td class="sig">${esc(l)}</td></tr>`).join('')}</table>`);
  }
  out.push('</div>');
  return out.join('\n');
}

/** Generated text → fixed print HTML fragment (one sheet per letter). */
export function renderTextForPrint(text: string): string {
  const t = String(text ?? '');
  if (looksLikeLetter(t)) return splitIntoSubLetters(t).map(parseIntoDocumentModel).map(renderLetterHtml).join('\n');
  return renderPlainSheetHtml(t);
}
