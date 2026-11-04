/**
 * केस डायरी का A4 प्रीव्यू (owner): one diary → A4 sheets (210 × 297 mm, 0.5 inch margins), split into pages by a
 * small script, page number at the bottom, officer signature at the end. Pure — tests: scripts/test_case_diary_print.ts
 */
import { htmlToPlainText } from './stringUtils';
import { editorHtmlToMarkedText, hasEditorMarks, stripFormatMarkers } from './formatMarkers';

export interface CdPrintEntry {
  entry_type: 'karyvahi' | 'narrative' | string;
  karyvahi_name?: string | null;
  vivran?: string | null;
  narrative_text?: string | null;
  narrative_template?: string | null;
}
export interface CdPrintInput {
  diaryNumber?: number | null;
  preparation_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  places?: string[];
  fir?: { fir_number?: string | null; section?: string | null; complainant_name?: string | null } | null;
  entries: CdPrintEntry[];
  policeStation?: string;
  district?: string;
  officerName?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const t = (v: unknown) => (v == null ? '' : String(v).trim());
/** "2025-07-01" → "01.07.2025" */
export function cdDate(v: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t(v));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : t(v);
}

/** Editor HTML / marked text → plain paragraphs (blank lines dropped). */
export function entryParagraphs(raw: string | null | undefined): string[] {
  const src = t(raw);
  if (!src) return [];
  const plain = /<[a-z][\s\S]*>/i.test(src)
    ? (hasEditorMarks(src) ? editorHtmlToMarkedText(src) : htmlToPlainText(src))
    : src;
  return stripFormatMarkers(plain).split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

/** Body blocks (each one a <div class="blk"> so the page-splitter can move it to the next sheet). */
export function caseDiaryBlocks(p: CdPrintInput): string[] {
  const blocks: string[] = [];
  const no = p.diaryNumber ? String(p.diaryNumber).padStart(2, '0') : '';
  blocks.push(`<p class="cd-title">केस डायरी${no ? ` संख्या – ${no}` : ''}</p>`);
  const ps = [p.policeStation ? `थाना ${esc(p.policeStation)}` : '', p.district ? `जनपद ${esc(p.district)}` : ''].filter(Boolean).join(' ');
  if (ps) blocks.push(`<p class="cd-sub">${ps}</p>`);
  const rows: [string, string][] = [];
  const fir = p.fir;
  if (fir && (t(fir.fir_number) || t(fir.section))) {
    rows.push(['मु0अ0सं0 / धारा', [t(fir.fir_number), t(fir.section) ? `धारा ${t(fir.section)}` : ''].filter(Boolean).join(' ')]);
  }
  if (t(fir?.complainant_name)) rows.push(['वादी', t(fir?.complainant_name)]);
  rows.push(['दिनांक', cdDate(p.preparation_date) || '—']);
  if (t(p.start_time) || t(p.end_time)) rows.push(['समय', `आरम्भ ${t(p.start_time) || '—'}  ·  समाप्ति ${t(p.end_time) || '—'}`]);
  if (p.places?.length) rows.push(['भ्रमण स्थान', p.places.join(', ')]);
  blocks.push(`<table class="cd-meta">${rows.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</table>`);

  let any = false;
  for (const e of p.entries) {
    const isK = e.entry_type === 'karyvahi';
    const head = t(isK ? e.karyvahi_name : e.narrative_template);
    const paras = entryParagraphs(isK ? e.vivran : e.narrative_text);
    if (!head && !paras.length) continue;
    any = true;
    if (head) blocks.push(`<p class="cd-head">${esc(head)} –</p>`);
    for (const para of paras) blocks.push(`<p class="cd-para">${esc(para)}</p>`);
  }
  if (!any) blocks.push('<p class="cd-empty">इस केस डायरी में अभी कोई कार्यवाही / विवरण दर्ज नहीं है।</p>');

  const sign = [p.officerName ? `( ${esc(p.officerName)} )` : '', 'विवेचक', ps].filter(Boolean);
  blocks.push(`<div class="cd-sign">${sign.map((l) => `<p>${l}</p>`).join('')}</div>`);
  return blocks;
}

/** Full HTML page for the WebView / iframe. */
export function buildCaseDiaryPrintHtml(p: CdPrintInput): string {
  const blocks = caseDiaryBlocks(p).map((b) => `<div class="blk">${b}</div>`).join('\n');
  return `<!DOCTYPE html>
<html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=840">
<title>केस डायरी</title>
<style>
  @page { size: A4; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #e8e8e8; padding: 16px 0 32px; color: #000;
    font-family: 'Kokila', 'Mangal', 'Noto Serif Devanagari', 'Noto Sans Devanagari', serif; font-size: 16pt; line-height: 1.5; }
  .sheet { position: relative; width: 210mm; height: 297mm; margin: 0 auto 16px; background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15); padding: 12.7mm 12.7mm 18mm; overflow: hidden; }
  .sheet .pno { position: absolute; bottom: 7mm; left: 0; right: 0; text-align: center; font-size: 11pt; color: #555; }
  #src { width: 210mm; padding: 0 12.7mm; }
  .cd-title { text-align: center; font-weight: bold; text-decoration: underline; font-size: 1.15em; }
  .cd-sub { text-align: center; margin-bottom: 0.3em; }
  .cd-meta { width: 100%; border-collapse: collapse; margin: 0.3em 0 0.6em; font-size: 0.92em; }
  .cd-meta th, .cd-meta td { border: 1px solid #000; padding: 0.15em 0.4em; text-align: left; vertical-align: top; }
  .cd-meta th { width: 30%; font-weight: bold; }
  .cd-head { font-weight: bold; text-decoration: underline; margin-top: 0.5em; }
  .cd-para { text-align: justify; text-indent: 12.7mm; }
  .cd-empty { font-style: italic; color: #555; margin-top: 1em; }
  .cd-sign { margin-top: 2.2em; text-align: right; }
  @media print { body { background: none; padding: 0; } .sheet { margin: 0; box-shadow: none; page-break-after: always; } }
</style></head>
<body>
<div id="src">
${blocks}
</div>
<script>
(function () {
  var src = document.getElementById('src');
  var blks = Array.prototype.slice.call(src.children);
  var sheets = [];
  function newSheet() {
    var s = document.createElement('div'); s.className = 'sheet';
    var body = document.createElement('div'); s.appendChild(body);
    document.body.insertBefore(s, src); sheets.push(s); return body;
  }
  var cur = newSheet();
  var limit = cur.parentNode.clientHeight - parseFloat(getComputedStyle(cur.parentNode).paddingTop) - parseFloat(getComputedStyle(cur.parentNode).paddingBottom);
  blks.forEach(function (b) {
    cur.appendChild(b);
    if (cur.scrollHeight > limit && cur.children.length > 1) { cur.removeChild(b); cur = newSheet(); cur.appendChild(b); }
  });
  src.parentNode.removeChild(src);
  sheets.forEach(function (s, i) {
    var n = document.createElement('div'); n.className = 'pno';
    n.textContent = 'पृष्ठ ' + (i + 1) + ' / ' + sheets.length; s.appendChild(n);
  });
})();
</script>
</body></html>`;
}
