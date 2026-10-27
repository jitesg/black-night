/**
 * Format Parsing Engine — Flat text → structured DocumentModel
 *
 * Deterministic, anchor-phrase based. Never AI-driven.
 * Same input always produces the same output.
 *
 * Anchor table (verified against all current formats):
 *   First non-empty line           → header
 *   Line starting "सेवा मे"        → begins sewaMein block
 *   Lines until "महोदय"            → rest of sewaMein
 *   Line starting "महोदय"          → salutation
 *   Lines until closing anchor     → body paragraphs (split on blank lines)
 *   Line containing "प्रेषित है"   → closing
 *   Line starting "गवाहान"         → witnessLine
 *   Line starting "संलग्नक"        → attachments block
 *   Parenthesised name / trailing  → signature
 *
 * Fail-safe: unmatched line appended to currently open block (default: body).
 * Never throws, never drops content.
 *
 * Multi-letter support:
 *   splitIntoSubLetters() splits a resolved vivran on recurring header
 *   patterns so each sub-letter is parsed independently.
 */

import { hasFormatMarkers, markName, parseMarkedLetter, splitMarkedAttachment, splitMarkedLetters } from './formatMarkers';

// ─── Public types ─────────────────────────────────────────────────────────

export interface DocumentSignature {
  name: string;
  designation: string;
}

export interface DocumentModel {
  header: string;
  sewaMein: string[];
  salutation: string;
  body: string[];           // one entry per paragraph (split on blank lines)
  closing: string;
  witnessLine?: string;
  attachments: string[];    // numbered items under "संलग्नक"
  signature: DocumentSignature | null;
  /** Parsed from layout marks ([[शीर्षक]] …, see formatMarkers.ts). */
  marked?: boolean;
  /** Marked formats only: [[विषय]] / [[पक्ष]] lines (else derived from sewaMein). */
  subject?: string[];
  parties?: string[];
  /** Marked formats only: [[हस्ताक्षर]] lines. */
  signatureLines?: string[];
  /** Marked formats only: body in order — paragraphs and centred / right / split lines. */
  bodyBlocks?: { kind: 'para' | 'center' | 'right' | 'split'; text: string }[];
}

// ─── Anchor patterns ──────────────────────────────────────────────────────

const SEWA_MEIN_RE   = /^सेवा\s*मे/;
const SALUTATION_RE  = /^महोदय/;
const CLOSING_RE     = /प्रेषित\s*है/;
const WITNESS_RE     = /^गवाहान/;
const ATTACHMENT_RE  = /^संलग्नक/;
// Numbered list items under attachments: "1.", "2." etc.
const ATTACH_ITEM_RE = /^\d+\.\s*/;
// Parenthesised signature: "(Ram Singh)" or just a line after attachments
const SIG_PAREN_RE   = /^\((.+)\)$/;

// ─── Sub-letter split ─────────────────────────────────────────────────────

/**
 * Split a resolved vivran text into individual sub-letters.
 *
 * Each of the 5 BNSS formats bundles 6 stacked letters. The split fires on
 * the recurring header line that starts a new letter:
 *   /^(रिपोर्ट|न्यायालय|सेवा\s*में)/  at the start of a paragraph block.
 *
 * Strategy: collect lines; whenever we see a "new letter header" line AND we
 * already have content, flush the current buffer as one sub-letter.
 *
 * Returns a single-element array when the text contains only one letter
 * (guarantees the caller always gets DocumentModel[]).
 */
const SUB_LETTER_HEADER_RE = /^(रिपोर्ट|न्यायालय|सेवा\s*में)/;

export function splitIntoSubLetters(text: string): string[] {
  if (hasFormatMarkers(text)) return splitMarkedLetters(text);
  const lines = text.split('\n');
  const letters: string[] = [];
  let buffer: string[] = [];
  let prevWasBlank = true; // treat start-of-text as "after a blank line"

  for (const line of lines) {
    const trimmed = line.trim();
    const isBlank  = trimmed === '';

    // "रिपोर्ट सादर सेवा मे प्रेषित है" is the closing line, not a new letter.
    if (!isBlank && prevWasBlank && SUB_LETTER_HEADER_RE.test(trimmed) && !/प्रेषित/.test(trimmed) && buffer.some(l => l.trim())) {
      // Start of a new letter — flush the previous buffer
      const chunk = buffer.join('\n').trim();
      if (chunk) letters.push(chunk);
      buffer = [];
    }
    buffer.push(line);
    prevWasBlank = isBlank;
  }

  // Flush final buffer
  const last = buffer.join('\n').trim();
  if (last) letters.push(last);

  return letters.length ? letters : [text];
}

// ─── Parser ───────────────────────────────────────────────────────────────

type Block = 'header' | 'sewaMein' | 'salutation' | 'body' | 'closing'
           | 'witness' | 'attachments' | 'signature';

/**
 * Parse a single sub-letter text into a DocumentModel.
 *
 * The parser is a simple state machine driven by anchor phrases.
 * It never relies on leading-whitespace counts — that whitespace is a
 * legacy artifact from manually-spaced templates (confirmed from .docx XML).
 */
export function parseIntoDocumentModel(text: string): DocumentModel {
  if (hasFormatMarkers(text)) return parseMarkedLetter(text);
  const model: DocumentModel = {
    header: '',
    sewaMein: [],
    salutation: '',
    body: [],
    closing: '',
    witnessLine: undefined,
    attachments: [],
    signature: null,
  };

  const lines = text.split('\n');
  let state: Block = 'header';
  // Track paragraph accumulation for body (paragraphs split on blank lines)
  let bodyParagraph: string[] = [];

  const flushBodyParagraph = () => {
    const p = bodyParagraph.join(' ').replace(/\s{2,}/g, ' ').trim();
    if (p) model.body.push(p);
    bodyParagraph = [];
  };

  for (const rawLine of lines) {
    const line    = rawLine;          // preserve for output
    const trimmed = rawLine.trim();
    const isBlank = trimmed === '';

    // ── State transitions via anchors ────────────────────────────────────
    if (SEWA_MEIN_RE.test(trimmed) && state === 'header') {
      state = 'sewaMein';
      // The "सेवा में" line itself is the first sewaMein entry
      model.sewaMein.push(trimmed);
      continue;
    }

    if (SALUTATION_RE.test(trimmed) && (state === 'sewaMein' || state === 'header')) {
      state = 'salutation';
      model.salutation = trimmed;
      continue;
    }

    if (CLOSING_RE.test(trimmed) && state !== 'closing') {
      flushBodyParagraph();
      state = 'closing';
      model.closing = trimmed.replace(/\s{2,}/g, ' ').trim();
      continue;
    }

    if (WITNESS_RE.test(trimmed)) {
      flushBodyParagraph();
      state = 'witness';
      model.witnessLine = trimmed;
      continue;
    }

    if (ATTACHMENT_RE.test(trimmed)) {
      flushBodyParagraph();
      state = 'attachments';
      // The "संलग्नक" header line is not itself an item — skip storing it
      // unless it already contains an item inline
      const afterColon = trimmed.replace(/^संलग्नक\s*[-:–]?\s*/, '').trim();
      if (afterColon) model.attachments.push(afterColon);
      continue;
    }

    // ── Content accumulation ─────────────────────────────────────────────
    switch (state) {
      case 'header':
        if (!isBlank && !model.header) {
          model.header = trimmed;
        } else if (!isBlank) {
          // Second non-blank line before sewaMein → still header context
          // (some formats have a two-line header)
          model.header += ' ' + trimmed;
        }
        break;

      case 'sewaMein':
        if (!isBlank) {
          model.sewaMein.push(trimmed);
        }
        break;

      case 'salutation':
        // After salutation line, transition to body on next non-blank
        if (!isBlank) {
          state = 'body';
          bodyParagraph.push(trimmed.replace(/\s{2,}/g, ' '));
        }
        break;

      case 'body':
        if (isBlank) {
          flushBodyParagraph();
        } else {
          bodyParagraph.push(trimmed.replace(/\s{2,}/g, ' '));
        }
        break;

      case 'closing':
      case 'witness':
        // After closing/witness, append to the same line if non-blank
        if (!isBlank) {
          if (state === 'closing') {
            model.closing += ' ' + trimmed.replace(/\s{2,}/g, ' ').trim();
          } else {
            model.witnessLine = (model.witnessLine ?? '') + ' ' + trimmed;
          }
        }
        break;

      case 'attachments': {
        if (isBlank) break;
        if (ATTACH_ITEM_RE.test(trimmed)) {
          model.attachments.push(trimmed);
        } else {
          // Could be a signature line after attachments
          const parenMatch = SIG_PAREN_RE.exec(trimmed);
          if (parenMatch) {
            _parseSignatureIntoModel(parenMatch[1], model);
            state = 'signature';
          } else if (/^\(/.test(trimmed) || model.attachments.length > 0) {
            // Treat as continuation of last attachment or signature
            if (!model.signature) {
              _parseSignatureIntoModel(trimmed, model);
              state = 'signature';
            } else {
              model.attachments.push(trimmed);
            }
          } else {
            model.attachments.push(trimmed);
          }
        }
        break;
      }

      case 'signature':
        // Additional designation lines after the name
        if (!isBlank && model.signature) {
          if (!model.signature.designation) {
            model.signature.designation = trimmed;
          } else {
            model.signature.designation += ' ' + trimmed;
          }
        }
        break;
    }
  }

  // Flush any trailing body paragraph
  flushBodyParagraph();

  return model;
}

// ─── Editor renderer (pell-rich-editor compatible, inline styles) ─────────────
/**
 * Render a DocumentModel to HTML that uses inline `style` attributes only —
 * no external stylesheet required. Designed for pell-rich-editor, which
 * serialises `execCommand('justifyRight')` as `<div style="text-align:right">`.
 *
 * Formatting produced:
 *   • Header           — right-aligned, bold, underlined
 *   • Sewa Mein block  — indented left (12.7mm / 1.5em)
 *   • Salutation       — normal (left)
 *   • Body paragraphs  — justified, first-line indent 12.7mm
 *   • Closing          — right-aligned
 *   • Witness line     — left
 *   • Attachments      — numbered list, left
 *   • Signature name   — right-aligned, bold
 *   • Signature desig. — right-aligned, italic
 *
 * The pell editor preserves inline `style` attributes on `<div>` / `<p>` /
 * `<span>` blocks. Bold/underline survive as `<b>`/`<u>` tags (pell uses
 * execCommand('bold'/'underline') which wraps text in those tags).
 *
 * Multi-sub-letter separator: an `<hr>` between letters with a small paragraph
 * gap — gives the user a clear visual boundary while editing.
 *
 * This function is intentionally output-only (no side effects).
 */
export function renderDocumentModelForEditor(model: DocumentModel): string {
  if (model.marked) return renderMarkedModelForEditor(model);
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Inline style constants — mirrors the CSS classes in buildPrintHtml
  const S_RIGHT   = 'text-align:right;';
  const S_JUSTIFY = 'text-align:justify;text-indent:1.5em;';
  const S_INDENT  = 'margin-left:1.5em;';
  const S_LEFT    = 'text-align:left;';

  const parts: string[] = [];

  // Header — right-aligned, bold, underlined
  if (model.header) {
    parts.push(
      `<div style="${S_RIGHT}"><b><u>${esc(model.header)}</u></b></div>`
    );
  }

  // Sewa Mein — indented block
  if (model.sewaMein.length) {
    const lines = model.sewaMein
      .map((l) => `<div style="${S_LEFT}${S_INDENT}">${esc(l)}</div>`)
      .join('');
    parts.push(lines);
  }

  // Blank spacer between sewa mein and salutation
  if (model.sewaMein.length && model.salutation) {
    parts.push('<div><br></div>');
  }

  // Salutation — left-aligned
  if (model.salutation) {
    parts.push(`<div style="${S_LEFT}">${esc(model.salutation)}</div>`);
  }

  // Body paragraphs — justified with first-line indent
  for (const para of model.body) {
    parts.push(`<div style="${S_JUSTIFY}">${esc(para)}</div>`);
  }

  // Blank line before closing
  if (model.closing) {
    parts.push('<div><br></div>');
    parts.push(`<div style="${S_RIGHT}">${esc(model.closing)}</div>`);
  }

  // Witness line — left
  if (model.witnessLine) {
    parts.push(`<div style="${S_LEFT}">${esc(model.witnessLine)}</div>`);
  }

  // Attachments — numbered list
  if (model.attachments.length) {
    // Numbers written as text (1., 2., 3. for every letter): editor HTML lists
    // could merge across letters and continue the count (13, 14, 15).
    const items = model.attachments
      .map((a, i) => `<div style="padding-left:1.5em;">${i + 1}. ${esc(a.replace(/^\d+\.\s*/, ''))}</div>`)
      .join('');
    parts.push(
      `<div style="${S_LEFT}"><b>संलग्नक -</b>${items}</div>`
    );
  }

  // Signature — right-aligned
  if (model.signature) {
    parts.push('<div><br></div>');
    parts.push(
      `<div style="${S_RIGHT}"><b>${esc(model.signature.name)}</b></div>`
    );
    if (model.signature.designation) {
      parts.push(
        `<div style="${S_RIGHT}"><i>${esc(model.signature.designation)}</i></div>`
      );
    }
  }

  return parts.join('\n');
}

/**
 * Editor HTML for a format with layout marks: same look as the print, and every
 * block carries a hidden data-fmt="<mark name>" so the print can rebuild the
 * layout after the text was edited (formatMarkers.editorHtmlToMarkedText).
 * Attachments are a two-column table (item | signature part), like the print.
 */
function renderMarkedModelForEditor(model: DocumentModel): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const div = (role: Parameters<typeof markName>[0], style: string, html: string) =>
    `<div data-fmt="${markName(role)}" style="${style}">${html}</div>`;
  const parts: string[] = [];
  if (model.header) parts.push(div('header', 'text-align:right;', `<b><u>${esc(model.header)}</u></b>`));
  model.sewaMein.forEach((l, i) => {
    const label = i === 0 && /^सेवा\s*मे/.test(l.trim());
    parts.push(div('sewa', label ? 'text-align:left;' : 'text-align:left;margin-left:1.5em;', esc(l)));
  });
  for (const l of model.subject ?? []) parts.push(div('subject', 'text-align:left;margin-left:1.5em;', esc(l)));
  for (const l of model.parties ?? []) parts.push(div('party', 'text-align:left;', esc(l)));
  if (model.salutation) parts.push(div('salutation', 'text-align:left;margin-top:0.6em;', esc(model.salutation)));
  for (const b of model.bodyBlocks ?? []) {
    if (b.kind === 'para') parts.push(div('body', 'text-align:justify;text-indent:1.5em;', esc(b.text)));
    else if (b.kind === 'center') parts.push(div('center', 'text-align:center;', `<b>${esc(b.text)}</b>`));
    else if (b.kind === 'right') parts.push(div('right', 'text-align:right;', esc(b.text)));
    else {
      const { left, right } = splitMarkedAttachment(b.text);
      parts.push(`<table data-fmt="${markName('split')}" style="width:100%;border-collapse:collapse;border:none;"><tr><td style="text-align:left;vertical-align:top;">${esc(left)}</td><td style="text-align:right;vertical-align:top;">${esc(right)}</td></tr></table>`);
    }
  }
  if (model.closing) parts.push(div('closing', 'text-align:right;margin-top:0.6em;', esc(model.closing)));
  if (model.witnessLine) parts.push(div('witness', 'text-align:left;', esc(model.witnessLine)));
  if (model.attachments.length) {
    parts.push(div('attachments', 'text-align:left;margin-top:0.6em;', '<b>संलग्नक -</b>'));
    const rows = model.attachments.map((a, i) => {
      const { left, right } = splitMarkedAttachment(a);
      return `<tr><td style="width:55%;vertical-align:top;">${i + 1}. ${esc(left)}</td><td style="width:45%;text-align:center;vertical-align:top;">${esc(right)}</td></tr>`;
    }).join('');
    parts.push(`<table data-fmt="${markName('attachments')}" style="width:100%;border-collapse:collapse;border:none;">${rows}</table>`);
  }
  for (const l of model.signatureLines ?? []) parts.push(div('signature', 'text-align:right;', esc(l)));
  return parts.join('\n');
}

/**
 * Render an array of DocumentModels (from splitIntoSubLetters) into a single
 * HTML string for the pell editor, with `<hr>` separators between sub-letters.
 *
 * Reuse the already-parsed models[] — do NOT call parseIntoDocumentModel again.
 */
export function renderModelsForEditor(models: DocumentModel[]): string {
  const SEP = '<div><br></div><hr style="border:none;border-top:1px solid #CBD5E1;margin:12px 0;"><div><br></div>';
  return models.map(renderDocumentModelForEditor).join(SEP);
}

// ─── Signature helper ─────────────────────────────────────────────────────

function _parseSignatureIntoModel(raw: string, model: DocumentModel): void {
  // Strip parens if present
  const cleaned = raw.replace(/^\(/, '').replace(/\)$/, '').trim();
  // Lines like "नाम\nपदनाम" rarely appear as one string, but handle both
  const parts = cleaned.split(/[\n/]/).map(s => s.trim()).filter(Boolean);
  model.signature = {
    name:        parts[0] ?? cleaned,
    designation: parts.slice(1).join(', '),
  };
}
