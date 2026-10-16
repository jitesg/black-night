/**
 * caseDiaryExport.ts
 *
 * Generates a DOCX file for a single Case Diary and triggers the native
 * share/save dialog via expo-sharing.
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

import { getCaseDiaryById, getEntriesByDiary, deserializePlaces } from '@/lib/db/caseDiaryRepo';
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

// ─── main export function ─────────────────────────────────────────────────────

export async function exportCaseDiaryToDocx(diaryId: string): Promise<void> {
  // 1. Load data
  const diary = await getCaseDiaryById(diaryId);
  if (!diary) throw new Error('Case diary not found');

  const [entries, fir] = await Promise.all([
    getEntriesByDiary(diaryId), // already in sequence_order
    getFIRById(diary.fir_id),
  ]);

  const places = deserializePlaces(diary.places_visited);

  // 2. Build document content ─────────────────────────────────────────────────

  // Title
  const titlePara = new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 80, lineRule: 'auto' },
    children: [new TextRun({ text: 'केस डायरी (Case Diary)', bold: true, size: 48 })],
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

  // 3. Assemble document with page-number footer
  const doc = new Document({
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
    sections: [
      {
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
        children: [
          titlePara,
          subtitlePara,
          metaTable,
          timelineHeading,
          ...(entries.length === 0 ? [emptyPara] : entryParas),
        ],
      },
    ],
  });

  // 4. Pack → base64 → write to cache
  const buffer = await Packer.toBuffer(doc);
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Build base64 in chunks to avoid call-stack overflow on large docs
  const CHUNK = 8192;
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const base64 = btoa(binary);

  const safeDate = (diary.preparation_date ?? 'diary').replace(/[^a-z0-9]/gi, '_');
  const firNum   = fir?.fir_number?.replace(/[^a-z0-9]/gi, '_') ?? 'fir';
  const filename = `Case_Diary_${firNum}_${safeDate}.docx`;
  const uri      = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 5. Share via native sheet
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('इस डिवाइस पर शेयरिंग उपलब्ध नहीं है');

  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dialogTitle: `Export — ${filename}`,
    UTI: 'org.openxmlformats.wordprocessingml.document',
  });
}
