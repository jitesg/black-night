/**
 * reportDocxExport.ts — a generated report (editor HTML or plain text) → .docx
 * in the same fixed layout as the A4 print (src/lib/printLayout.ts):
 * one page per letter, header right / bold / underlined, सेवा में indented,
 * body justified with a first-line indent, closing centred, attachments with
 * the signature lines on the right; margins 0.5 inch, Kokila font.
 *
 * Used by निरोधात्मक कार्यवाही (card menu + editor screen).
 */
import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow,
  TextRun, WidthType,
} from 'docx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { parseIntoDocumentModel, splitIntoSubLetters, type DocumentModel } from './formatParsingEngine';
import { editorHtmlToMarkedText, hasEditorMarks, hasFormatMarkers } from './formatMarkers';
import { looksLikeLetter, splitAttachmentLine, splitClosing, splitPlainText, splitSewaMein } from './printLayout';
import { markdownToHtml, needsMigration } from './markdownToHtml';
import { htmlToPlainText } from './stringUtils';

const FONT = 'Kokila';
const SIZE = 32;            // half-points → 16 pt
const INDENT = 720;         // 0.5 inch (twips)
const MARGIN = 720;         // 0.5 inch on every side
const PAGE_W = 11906;       // A4 width (twips)
const TEXT_W = PAGE_W - 2 * MARGIN;
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

const run = (text: string, o: { bold?: boolean; underline?: boolean } = {}) => new TextRun({
  text,
  font: { ascii: FONT, hAnsi: FONT, cs: FONT },
  size: SIZE,
  sizeComplexScript: SIZE,
  bold: o.bold,
  boldComplexScript: o.bold,
  underline: o.underline ? {} : undefined,
});

type ParaOpts = {
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  bold?: boolean; underline?: boolean; indentLeft?: number; firstLine?: number;
  before?: number; after?: number; pageBreak?: boolean;
};
const para = (text: string, o: ParaOpts = {}) => new Paragraph({
  children: [run(text, o)],
  alignment: o.align,
  indent: o.indentLeft || o.firstLine ? { left: o.indentLeft, firstLine: o.firstLine } : undefined,
  spacing: { before: o.before ?? 0, after: o.after ?? 0, line: 276 },
  pageBreakBefore: o.pageBreak,
});

const cell = (text: string, align: ParaOpts['align'], width: number, bold = false) => new TableCell({
  borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
  width: { size: width, type: WidthType.DXA },
  children: [para(text, { align, bold })],
});

/** Two-column borderless table (attachments | signature, or शासन | बनाम …). */
function twoCol(rows: [string, string, boolean?][], leftW: number): Table {
  return new Table({
    width: { size: TEXT_W, type: WidthType.DXA },
    columnWidths: [leftW, TEXT_W - leftW],
    borders: NO_BORDERS,
    rows: rows.map(([l, r, bold]) => new TableRow({
      children: [cell(l, AlignmentType.LEFT, leftW, !!bold), cell(r, AlignmentType.RIGHT, TEXT_W - leftW)],
    })),
  });
}

/** One letter → Word blocks (mirrors renderLetterHtml). */
function letterBlocks(model: DocumentModel, first: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  let pageBreak = !first;
  const push = (p: Paragraph | Table) => { out.push(p); };
  const p = (text: string, o: ParaOpts = {}) => { push(para(text, { ...o, pageBreak: pageBreak || undefined })); pageBreak = false; };

  const headerIsBody = !!model.header && model.header.trim().length > 140;
  if (model.header && !headerIsBody) p(model.header, { align: AlignmentType.RIGHT, bold: true, underline: true, after: 120 });

  const auto = splitSewaMein(model.sewaMein ?? []);
  const addressee = model.marked ? (model.sewaMein ?? []) : auto.addressee;
  const subject = model.marked ? (model.subject ?? []) : auto.subject;
  const parties = model.marked ? (model.parties ?? []) : auto.parties;
  addressee.forEach((l, i) => {
    const label = i === 0 && /^सेवा\s*मे/.test(l.trim());
    p(l, { indentLeft: label ? undefined : INDENT, before: i === 0 ? 80 : 0 });
  });
  subject.forEach((l, i) => p(l, { indentLeft: INDENT, before: i === 0 ? 80 : 0 }));
  parties.forEach((l, i) => p(l, { before: i === 0 ? 100 : 0 }));
  if (model.salutation) p(model.salutation, { before: 160, after: 60 });

  if (model.marked) {
    for (const b of model.bodyBlocks ?? []) {
      if (b.kind === 'center') p(b.text, { align: AlignmentType.CENTER, bold: true });
      else if (b.kind === 'right') p(b.text, { align: AlignmentType.RIGHT, before: 120, after: 60 });
      else if (b.kind === 'split') {
        const at = b.text.indexOf('|');
        push(twoCol([[at < 0 ? b.text : b.text.slice(0, at).trim(), at < 0 ? '' : b.text.slice(at + 1).trim()]], Math.round(TEXT_W / 2)));
      } else p(b.text, { align: AlignmentType.JUSTIFIED, firstLine: INDENT, after: 60 });
    }
  } else {
    for (const b of [...(headerIsBody ? [model.header] : []), ...(model.body ?? [])]) {
      p(b, { align: AlignmentType.JUSTIFIED, firstLine: INDENT, after: 60 });
    }
  }

  const close = splitClosing(model.closing ?? '');
  if (close.closing) p(close.closing, { align: AlignmentType.CENTER, before: 120 });
  if (model.witnessLine) p(model.witnessLine, { before: 80 });

  const rows = (model.attachments ?? []).map(splitAttachmentLine);
  const sig = [...close.signature, ...(model.signatureLines ?? [])];
  if (model.signature?.name) sig.push(model.signature.name);
  if (model.signature?.designation) sig.push(model.signature.designation);
  if (rows.length || sig.length) {
    if (pageBreak) p('');
    const tr: [string, string, boolean?][] = [];
    if (rows.length) tr.push(['संलग्नक -', '', true]);
    rows.forEach((r, i) => tr.push([`${r.no || model.marked ? `${i + 1}. ` : ''}${r.left}`, r.right]));
    for (const s of sig) tr.push(['', s]);
    out.push(para('', { before: 120 }));
    out.push(twoCol(tr, Math.round(TEXT_W * 0.5)));
  }
  return out;
}

/** Text that is not a letter (फर्द, GD …): title centred, paragraphs, signature right. */
function plainBlocks(text: string): Paragraph[] {
  const { notes, title, paras, signature } = splitPlainText(text);
  return [
    ...notes.map((n) => para(n, { after: 60 })),
    ...(title ? [para(title, { align: AlignmentType.CENTER, bold: true, underline: true, after: 120 })] : []),
    ...paras.map((t) => para(t, { align: AlignmentType.JUSTIFIED, firstLine: INDENT, after: 60 })),
    ...signature.map((s, i) => para(s, { align: AlignmentType.RIGHT, before: i === 0 ? 200 : 0 })),
  ];
}

/** Editor HTML / plain text → the text the print layout reads (layout marks kept). */
export function reportSourceText(content: string): string {
  const v = String(content ?? '');
  if (hasEditorMarks(v)) return editorHtmlToMarkedText(v);
  const html = needsMigration(v) ? markdownToHtml(v) : v;
  return htmlToPlainText(html);
}

export function buildReportDocx(content: string): Document {
  const text = reportSourceText(content);
  const children = hasFormatMarkers(text) || looksLikeLetter(text)
    ? splitIntoSubLetters(text).map(parseIntoDocumentModel).flatMap((m, i) => letterBlocks(m, i === 0))
    : plainBlocks(text);
  return new Document({
    styles: { default: { document: { run: { font: { ascii: FONT, hAnsi: FONT, cs: FONT }, size: SIZE } } } },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      children: children.length ? children : [para('')],
    }],
  });
}

/** Builds the .docx, saves it in the cache folder and opens the share / save sheet. */
export async function exportReportToDocx(content: string, fileBase: string): Promise<void> {
  if (!String(content ?? '').trim()) throw new Error('रिपोर्ट खाली है');
  const base64 = await Packer.toBase64String(buildReportDocx(content));
  const name = (fileBase || 'report').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, '_').slice(0, 60) || 'report';
  const uri = `${FileSystem.cacheDirectory}${name}.docx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) throw new Error('इस डिवाइस पर शेयरिंग उपलब्ध नहीं है');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dialogTitle: `Word — ${name}.docx`,
    UTI: 'org.openxmlformats.wordprocessingml.document',
  });
}
