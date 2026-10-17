/**
 * caseDiaryExport.ts
 *
 * Generates a DOCX file for a single Case Diary, or for all diaries of a
 * mukadma merged into one file, and opens the native share/save dialog.
 *
 * Approach:
 *   - `docx` (pure-JS) builds the document in memory as a Blob/ArrayBuffer.
 *   - `expo-file-system` writes it to the app cache directory.
 *   - `expo-sharing` opens the native share sheet so the user can save to
 *     Files, send via email, WhatsApp, etc.
 *
 * All entries are included in exact sequence_order (already sorted by
 * getEntriesByDiary). Narrative entries show narrative_text; Karyvahi
 * entries show karyvahi_name + vivran.
 */

import {
  Document, Footer, Packer, Paragraph, PageNumber, TextRun,
  HeadingLevel, AlignmentType, BorderStyle,
  TableCell, TableRow, Table, WidthType, ShadingType,
} from 'docx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  getCaseDiaryById, getCaseDiariesByFIR, getEntriesByDiary, deserializePlaces,
  type CaseDiary,
} from '@/lib/db/caseDiaryRepo';
import { getFIRById } from '@/lib/db/firRepo';

// ─── constants ────────────────────────────────────────────────────────────────

// A4 with 1" margins: usable width = 9072 DXA (twips).
// Label column = 30%, value column = 70%.
const COL_LABEL_W = 2722;
const COL_VALUE_W = 6350;
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' } as const;
const CELL_BORDERS = {
  top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Grey-shaded label/value row for the metadata header table.
 * Uses ShadingType.CLEAR (not SOLID) to prevent black backgrounds in Word.
 */
function headerRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        borders: CELL_BORDERS,
        width: { size: COL_LABEL_W, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold: true, size: 20 })],
        })],
      }),
      new TableCell({
        borders: CELL_BORDERS,
        width: { size: COL_VALUE_W, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: value, size: 20 })],
        })],
      }),
    ],
  });
}

/** Thin horizontal rule between entries. */
function divider(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' } },
    children: [],
    spacing: { before: 80, after: 80 },
  });
}

/** Numbered entry-type heading label (Hindi + English). */
function entryTypeLabel(type: 'karyvahi' | 'narrative', idx: number): string {
  const n = String(idx + 1).padStart(2, '0');
  return type === 'karyvahi'
    ? `${n}. कार्यवाही (Karyvahi)`
    : `${n}. विवरण (Narrative)`;
}

/**
 * Splits a multiline string into separate Paragraphs — one per non-empty line.
 * Preserves Hindi Unicode text. Empty lines become a small spacer paragraph.
 * Per docx-js spec: NEVER use \n inside TextRun.
 */
function textParas(text: string, color = '111827'): Paragraph[] {
  return text.split('\n').map(line =>
    new Paragraph({
      spacing: { after: line.trim() ? 60 : 40 },
      children: [new TextRun({ text: line, size: 20, color })],
    }),
  );
}

// ─── document builders ────────────────────────────────────────────────────────

type Block = Paragraph | Table;

/** Builds the title, details table and entries for one case diary. */
async function buildDiaryBlocks(
  diary: CaseDiary,
  fir: Awaited<ReturnType<typeof getFIRById>>,
  diaryNumber?: number,
): Promise<Block[]> {
  const entries = await getEntriesByDiary(diary.id); // already in sequence_order
  const places = deserializePlaces(diary.places_visited);

  // 2. Build document content ─────────────────────────────────────────────────

  // Title
  const titlePara = new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 80, lineRule: 'auto' },
    children: [new TextRun({
      text: diaryNumber ? `केस डायरी संख्या ${diaryNumber} (Case Diary No. ${diaryNumber})` : 'केस डायरी (Case Diary)',
      bold: true, size: 48,
    })],
  });

  const subtitlePara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 320, lineRule: 'auto' },
    children: [
      new TextRun({
        text: fir ? `FIR No: ${fir.fir_number}` : '',
        size: 22,
        color: '6B7280',
      }),
    ],
  });

  // Metadata table — columnWidths at table level + DXA on each cell (docx-js requirement)
  const metaRows: TableRow[] = [
    headerRow('तैयारी की तारीख (Date)', diary.preparation_date ?? '—'),
    ...(fir ? [headerRow('FIR नंबर (FIR No.)', fir.fir_number)] : []),
    ...(fir?.crime_type ? [headerRow('अपराध प्रकार (Crime Type)', fir.crime_type)] : []),
    ...(fir?.section ? [headerRow('धारा (Section)', fir.section)] : []),
    ...(diary.start_time || diary.end_time
      ? [headerRow('समय (Time)', `${diary.start_time ?? '—'}  →  ${diary.end_time ?? '—'}`)]
      : []),
    ...(places.length > 0 ? [headerRow('भ्रमण स्थान (Places)', places.join(', '))] : []),
    headerRow('कुल प्रविष्टियाँ (Entries)', String(entries.length)),
  ];

  const metaTable = new Table({
    columnWidths: [COL_LABEL_W, COL_VALUE_W],
    rows: metaRows,
  });

  // Timeline heading
  const timelineHeading = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 160, lineRule: 'auto' },
    children: [new TextRun({ text: 'जाँच विवरण (Investigation Timeline)', bold: true, size: 28 })],
  });

  // Entry blocks
  const entryParas: Paragraph[] = [];

  entries.forEach((entry, i) => {
    const isKaryvahi = entry.entry_type === 'karyvahi';

    // Entry sub-heading
    entryParas.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 80, lineRule: 'auto' },
      children: [new TextRun({
        text: entryTypeLabel(entry.entry_type, i),
        bold: true,
        size: 24,
        color: isKaryvahi ? '1E3A5F' : '374151',
      })],
    }));

    if (isKaryvahi) {
      // Action name
      entryParas.push(new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: 'कार्यवाही: ', bold: true, size: 20 }),
          new TextRun({ text: entry.karyvahi_name ?? '—', size: 20 }),
        ],
      }));

      // Format badge (if any)
      if (entry.format_used) {
        entryParas.push(new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: 'प्रारूप (Format): ', bold: true, size: 20, color: '7C3AED' }),
            new TextRun({ text: entry.format_used, size: 20, color: '7C3AED' }),
          ],
        }));
      }

      // Vivran (multiline — split into one Paragraph per line)
      entryParas.push(new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: 'विवरण (Description):', bold: true, size: 20 })],
      }));
      const vivranText = entry.vivran?.trim();
      if (vivranText) {
        entryParas.push(...textParas(vivranText));
      } else {
        entryParas.push(new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: '(कोई विवरण दर्ज नहीं)', italics: true, size: 20, color: '9CA3AF' })],
        }));
      }

    } else {
      // Narrative template badge (if any)
      if (entry.narrative_template) {
        entryParas.push(new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: 'प्रारूप (Format): ', bold: true, size: 20, color: '7C3AED' }),
            new TextRun({ text: entry.narrative_template, size: 20, color: '7C3AED' }),
          ],
        }));
      }

      // Narrative text (multiline)
      entryParas.push(new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: 'अवलोकन (Observation):', bold: true, size: 20 })],
      }));
      const narrativeText = entry.narrative_text?.trim();
      if (narrativeText) {
        entryParas.push(...textParas(narrativeText));
      } else {
        entryParas.push(new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: '(कोई टेक्स्ट दर्ज नहीं)', italics: true, size: 20, color: '9CA3AF' })],
        }));
      }
    }

    // Thin rule between entries (skip after last)
    if (i < entries.length - 1) {
      entryParas.push(divider());
    }
  });

  // Empty-diary placeholder
  const emptyPara = new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ text: 'इस डायरी में कोई प्रविष्टि नहीं है।', italics: true, color: '9CA3AF', size: 20 })],
  });

  return [
    titlePara,
    subtitlePara,
    metaTable,
    timelineHeading,
    ...(entries.length === 0 ? [emptyPara] : entryParas),
  ];
}

/** Wraps sections (one per diary, each starting on a new page) in a document. */
function buildDocument(sectionsChildren: Block[][]): Document {
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Title', name: 'Title', basedOn: 'Normal',
          run: { size: 48, bold: true, color: '000000' },
          paragraph: { spacing: { after: 80, lineRule: 'auto' }, alignment: AlignmentType.CENTER },
        },
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, color: '111827' },
          paragraph: { spacing: { before: 480, after: 160, lineRule: 'auto' }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, color: '1E3A5F' },
          paragraph: { spacing: { before: 320, after: 80, lineRule: 'auto' }, outlineLevel: 1 },
        },
        {
          id: 'Normal', name: 'Normal',
          run: { font: 'Arial', size: 20, color: '111827' },
          paragraph: { spacing: { line: 360, lineRule: 'atLeast' } },
        },
      ],
    },
    sections: sectionsChildren.map((children) => ({
        properties: {
          page: { margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 } },
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'पृष्ठ ', size: 18, color: '9CA3AF' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '9CA3AF' }),
                new TextRun({ text: ' / ', size: 18, color: '9CA3AF' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '9CA3AF' }),
              ],
            })],
          }),
        },
        children,
      })),
  });
}

/** Packs the document, writes it to the cache folder and opens the share sheet. */
async function saveAndShare(doc: Document, filename: string): Promise<void> {
  // toBase64String works on phones; toBuffer needs Node's Buffer, which
  // React Native doesn't have, so the export failed silently on mobile.
  const base64 = await Packer.toBase64String(doc);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('इस डिवाइस पर शेयरिंग उपलब्ध नहीं है');

  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dialogTitle: `Export — ${filename}`,
    UTI: 'org.openxmlformats.wordprocessingml.document',
  });
}

const safe = (v: string | undefined | null, fallback: string) =>
  (v ?? fallback).replace(/[^a-z0-9]/gi, '_');

// ─── public API ───────────────────────────────────────────────────────────────

/** Exports one case diary as a .docx file. */
export async function exportCaseDiaryToDocx(diaryId: string): Promise<void> {
  const diary = await getCaseDiaryById(diaryId);
  if (!diary) throw new Error('Case diary not found');
  const fir = await getFIRById(diary.fir_id);

  const doc = buildDocument([await buildDiaryBlocks(diary, fir)]);
  const filename = `Case_Diary_${safe(fir?.fir_number, 'fir')}_${safe(diary.preparation_date, 'diary')}.docx`;
  await saveAndShare(doc, filename);
}

/**
 * Merges every case diary of a mukadma (FIR) into one .docx, oldest first,
 * each diary starting on a new page.
 */
export async function exportAllCaseDiariesToDocx(firId: string): Promise<void> {
  const [diaries, fir] = await Promise.all([getCaseDiariesByFIR(firId), getFIRById(firId)]);
  if (diaries.length === 0) throw new Error('इस मुकदमे में कोई केस डायरी नहीं है');

  // Same order and numbering as the Case Diary tab (oldest created first).
  const ordered = [...diaries].sort((a, b) => a.created_at - b.created_at);

  const sections: Block[][] = [];
  for (let i = 0; i < ordered.length; i++) {
    sections.push(await buildDiaryBlocks(ordered[i], fir, i + 1));
  }

  const filename = `Case_Diary_All_${safe(fir?.fir_number, 'fir')}.docx`;
  await saveAndShare(buildDocument(sections), filename);
}
