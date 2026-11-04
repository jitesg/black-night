/** पर्चा paragraphs → Word document (Kokila 18pt, justified, single spacing, 1 inch margins) — owner's sample layout. */
import { AlignmentType, Document, Paragraph, TextRun } from 'docx';
import type { ParchaPara } from './caseDiaryParcha';

export function parchaDocument(paras: ParchaPara[]): Document {
  const children = paras.map((p) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 0, line: 240, lineRule: 'auto' },
    children: 'blank' in p ? [] : p.runs.map((r) => new TextRun({
      text: r.text, font: 'Kokila', size: 36, sizeComplexScript: 36, color: r.red ? 'FF0000' : '000000',
      ...(r.highlight ? { highlight: 'yellow' as const } : {}),
    })),
  }));
  return new Document({
    styles: { default: { document: { run: { font: 'Kokila', size: 36, sizeComplexScript: 36 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });
}
