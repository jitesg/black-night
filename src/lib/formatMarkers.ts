/**
 * formatMarkers.ts — layout marks (पहचान चिह्न) in predefined formats.
 *
 * A format line can start with a mark that says what the line is, so the print
 * layout does not have to guess:
 *
 *   [[पत्र]]            a new letter / new A4 sheet starts here (line of its own)
 *   [[शीर्षक]] …        heading (right, bold, underlined)
 *   [[सेवा में]] …      सेवा में + addressee lines
 *   [[विषय]] …          subject line(s)
 *   [[पक्ष]] …          वादी / प्रथम पक्ष … lines
 *   [[महोदय]] …         salutation
 *   [[विवरण]] …         body (paragraphs split on blank lines)
 *   [[समापन]] …         closing ("रिपोर्ट सादर सेवा मे प्रेषित है")
 *   [[गवाह]] …          witness line
 *   [[संलग्नक]] …       attachments; each following line = "item | signature part"
 *   [[हस्ताक्षर]] …     signature lines (right)
 *   [[बीच]] …           centred bold line(s) (court notice titles)
 *   [[दाएँ]] …          right-aligned line(s) (e.g. "उपजिला मजिस्ट्रेट …")
 *   [[दोनों ओर]] …      "left | right" on one line (e.g. "शासन | बनाम …")
 *   [[सूची]] …          lines kept one per line, left, no indent (names list: {{Key#list}})
 *
 * Unmarked lines belong to the section above them. Formats without marks keep
 * the old automatic detection. Marks never show to the user: generateReport
 * strips them (stripFormatMarkers) except in the formats/fill print pipeline,
 * and the editor keeps them as hidden data-fmt attributes (editorHtmlToMarkedText).
 *
 * Pure — tested with node: scripts/test_format_markers.ts
 */
import type { DocumentModel } from './formatParsingEngine';

export type MarkRole =
  | 'letter' | 'header' | 'sewa' | 'subject' | 'party' | 'salutation'
  | 'body' | 'closing' | 'witness' | 'attachments' | 'signature'
  | 'center' | 'right' | 'split' | 'list';

export const MARK_ROLES: Record<string, MarkRole> = {
  'पत्र': 'letter',
  'शीर्षक': 'header',
  'सेवा में': 'sewa',
  'सेवा मे': 'sewa',
  'विषय': 'subject',
  'पक्ष': 'party',
  'महोदय': 'salutation',
  'विवरण': 'body',
  'समापन': 'closing',
  'गवाह': 'witness',
  'संलग्नक': 'attachments',
  'हस्ताक्षर': 'signature',
  'बीच': 'center',
  'दाएँ': 'right',
  'दाये': 'right',
  'दायें': 'right',
  'दोनों ओर': 'split',
  'सूची': 'list',
};

const ROLE_NAME: Record<MarkRole, string> = {
  letter: 'पत्र', header: 'शीर्षक', sewa: 'सेवा में', subject: 'विषय', party: 'पक्ष',
  salutation: 'महोदय', body: 'विवरण', closing: 'समापन', witness: 'गवाह',
  attachments: 'संलग्नक', signature: 'हस्ताक्षर',
  center: 'बीच', right: 'दाएँ', split: 'दोनों ओर', list: 'सूची',
};

/** Hindi name of a role, as written in the mark. */
export const markName = (role: MarkRole): string => ROLE_NAME[role];

const MARK_RE = /^\s*\[\[\s*([^\]]+?)\s*\]\]\s?/;

/** Mark at the start of a line → { role, rest } (null when the line has no known mark). */
export function readMark(line: string): { role: MarkRole; rest: string } | null {
  const m = MARK_RE.exec(line);
  if (!m) return null;
  const role = MARK_ROLES[m[1].replace(/\s+/g, ' ')];
  if (!role) return null;
  return { role, rest: line.slice(m[0].length) };
}

export function hasFormatMarkers(text: string | null | undefined): boolean {
  if (!text) return false;
  return String(text).split('\n').some((l) => readMark(l) !== null);
}

/** "रिपोर्ट चालानी 01 वर्क | (जीतेश सिंह)" → left / right. */
export function splitMarkedAttachment(line: string): { left: string; right: string } {
  const t = line.trim().replace(/^\d{1,2}\s*[.)]\s*/, '');
  const at = t.indexOf('|');
  if (at < 0) return { left: t, right: '' };
  return { left: t.slice(0, at).trim(), right: t.slice(at + 1).trim() };
}

/**
 * Plain text without marks (copy / share / save / old screens). Attachment lines
 * get their number back and the "|" becomes a tab, like the Word original.
 */
export function stripFormatMarkers(text: string): string {
  if (!hasFormatMarkers(text)) return text;
  const out: string[] = [];
  let inAtt = false;
  let n = 0;
  for (const line of text.split('\n')) {
    const mk = readMark(line);
    if (mk) {
      inAtt = mk.role === 'attachments';
      n = 0;
      if (mk.role === 'letter') { if (mk.rest.trim()) out.push(mk.rest); continue; }
      out.push(mk.rest);
      continue;
    }
    if (inAtt && line.trim()) {
      const { left, right } = splitMarkedAttachment(line);
      n += 1;
      out.push(`${n}.\t${left}${right ? `\t\t\t${right}` : ''}`);
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Split marked text into letters at [[पत्र]] (marks kept). */
export function splitMarkedLetters(text: string): string[] {
  const letters: string[] = [];
  let buf: string[] = [];
  const flush = () => { const c = buf.join('\n').trim(); if (c) letters.push(c); buf = []; };
  for (const line of text.split('\n')) {
    const mk = readMark(line);
    if (mk?.role === 'letter') { flush(); if (mk.rest.trim()) buf.push(mk.rest); continue; }
    buf.push(line);
  }
  flush();
  return letters.length ? letters : [text];
}

/** One marked letter → DocumentModel (sections come only from the marks). */
export function parseMarkedLetter(text: string): DocumentModel {
  const model: DocumentModel = {
    header: '', sewaMein: [], salutation: '', body: [], closing: '',
    witnessLine: undefined, attachments: [], signature: null,
    marked: true, subject: [], parties: [], signatureLines: [], bodyBlocks: [],
  };
  let role: MarkRole = 'header';
  let para: string[] = [];
  const clean = (s: string) => s.replace(/\s{2,}/g, ' ').trim();
  const flushPara = () => {
    const p = clean(para.join(' '));
    if (p) { model.body.push(p); model.bodyBlocks!.push({ kind: 'para', text: p }); }
    para = [];
  };
  const join = (a: string, b: string) => (a ? `${a} ${b}` : b);

  for (const raw of text.split('\n')) {
    const mk = readMark(raw);
    let line = raw;
    if (mk) {
      if (role === 'body') flushPara();
      role = mk.role === 'letter' ? role : mk.role;
      line = mk.rest;
    }
    const t = line.trim();
    if (!t) { if (role === 'body') flushPara(); continue; }
    switch (role) {
      case 'header': model.header = join(model.header, clean(t)); break;
      case 'sewa': model.sewaMein.push(t); break;
      case 'subject': model.subject!.push(t); break;
      case 'party': model.parties!.push(t); break;
      case 'salutation':
        if (!model.salutation) model.salutation = t;
        else { role = 'body'; para.push(t); }
        break;
      case 'body': para.push(t); break;
      case 'closing': model.closing = join(model.closing, clean(t)); break;
      case 'witness': model.witnessLine = join(model.witnessLine ?? '', clean(t)); break;
      case 'attachments':
        // "संलग्नक -" itself is the title, not an item.
        if (mk && /^संलग्नक\s*[-:–]?\s*$/.test(t)) break;
        model.attachments.push(t.replace(/^संलग्नक\s*[-:–]\s*/, ''));
        break;
      case 'signature': model.signatureLines!.push(t); break;
      case 'center': case 'right': case 'split':
        model.bodyBlocks!.push({ kind: role, text: clean(t) });
        break;
      // [[सूची]]: every line stays its own line (left, no indent) — names one per line.
      case 'list':
        model.bodyBlocks!.push({ kind: 'line', text: clean(t) });
        break;
      default: break;
    }
  }
  flushPara();
  return model;
}

// ─── Editor HTML (hidden data-fmt attributes) → marked text ─────────────────

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&amp;': '&' };
const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
  .replace(/&(nbsp|lt|gt|quot|#39|amp);/g, (m) => ENTITIES[m] ?? m);

export function hasEditorMarks(html: string | null | undefined): boolean {
  return !!html && /data-fmt="/.test(html);
}

/**
 * Editor HTML made by renderModelsForEditor for a marked format (blocks carry
 * data-fmt="<mark name>", letters are separated by <hr>, attachments are a
 * table) → marked plain text, so the print keeps the format's layout even
 * after the text was edited. Lines the user added inherit the block above.
 */
export function editorHtmlToMarkedText(html: string): string {
  const out: string[] = [];
  const stack: (string | null)[] = [];
  let lastRole: string | null = null;
  let buf = '';
  let cells: string[] | null = null;
  let cell: string | null = null;

  const current = (): string | null => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i]) return stack[i];
    return null;
  };
  const emit = (text: string, role: string | null) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) { out.push(''); return; }
    if (role && role !== lastRole) { out.push(`[[${role}]] ${t}`); lastRole = role; return; }
    // Body paragraphs stay separate paragraphs.
    if (role === markName('body')) out.push('');
    out.push(t);
  };
  const flush = () => { if (buf.trim()) emit(buf, current()); buf = ''; };

  for (const tok of html.split(/(<[^>]+>)/)) {
    if (!tok) continue;
    if (tok[0] !== '<') {
      const text = decode(tok);
      if (cell !== null) cell += text; else buf += text;
      continue;
    }
    const tag = /^<\s*(\/?)\s*([a-zA-Z0-9]+)/.exec(tok);
    if (!tag) continue;
    const closing = tag[1] === '/';
    const name = tag[2].toLowerCase();
    const fmt = /data-fmt="([^"]*)"/.exec(tok)?.[1] ?? null;
    if (name === 'hr') { flush(); out.push(`[[${markName('letter')}]]`); lastRole = null; continue; }
    if (name === 'br') { if (cell !== null) cell += ' '; else if (buf.trim()) flush(); continue; }
    if (name === 'td' || name === 'th') {
      if (!closing) cell = '';
      else if (cell !== null) { cells?.push(cell.replace(/\s+/g, ' ').trim()); cell = null; }
      continue;
    }
    if (name === 'tr') {
      if (!closing) { flush(); cells = []; continue; }
      if (cells) {
        const [first = '', ...rest] = cells;
        const left = first.replace(/^\d{1,2}\s*[.)]\s*/, '');
        const right = rest.filter(Boolean).join(' ');
        if (left || right) emit(right ? `${left} | ${right}` : left, current());
      }
      cells = null;
      continue;
    }
    if (['div', 'p', 'table', 'h1', 'h2', 'h3', 'li', 'blockquote'].includes(name)) {
      if (!closing) { flush(); stack.push(fmt); }
      else { flush(); stack.pop(); }
    }
  }
  flush();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
