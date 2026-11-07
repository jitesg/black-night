/**
 * केस डायरी "पर्चा" layout (owner's sample docx 297/2025): used by the Word export and the A4 preview.
 *
 *   पर्चा नं0 02 दिनाँक 15.07.2025 समय 14.00 से 17.00 बजे तक        (yellow highlight)
 *   कार्यवाही- बयान वादी, निरीक्षण घटना स्थल
 *   दौरा- ठकुराईनखेड़ा ।
 *   (blank)
 *   मुकदमा साराशः- <the FIR's मुकदमा सारांश box, as typed — the app writes nothing itself (owner)>   (label red)
 *   श्रीमान जी मुकदमा उपरोक्त मे पर्चा नं0 01 दिनाँक … को किता कर सेवा मे प्रेषित किया जा चुका है। …
 *   बयान वादी मुकदमा.......... <text>                                   (label red)
 *   …
 *   श्रीमान जी आज की कृत कार्यवाही का पर्चा किता कर सेवा मे प्रेषित है । विवेचना प्रचलित है ।
 *
 * Kokila 18pt, justified, single line spacing, 1 inch margins, diaries one after another. Pure — tests: scripts/test_case_diary_parcha.ts
 */
import { htmlToPlainText } from './stringUtils';
import { editorHtmlToMarkedText, hasEditorMarks, stripFormatMarkers } from './formatMarkers';

export interface ParchaRun { text: string; red?: boolean; highlight?: boolean }
/** `gapBefore` = empty space above the paragraph in lines (1.5 between two कार्यवाही / नैरेटिव — owner). */
export type ParchaPara = { runs: ParchaRun[]; gapBefore?: number } | { blank: true };

export interface ParchaEntry { entry_type: string; karyvahi_name?: string | null; vivran?: string | null; narrative_text?: string | null; narrative_template?: string | null }
export interface ParchaInput {
  no: number;
  date?: string | null; start?: string | null; end?: string | null;
  places?: string[];
  entries: ParchaEntry[];
  prev?: { no: number; date?: string | null } | null;
}

const t = (v: unknown) => (v == null ? '' : String(v).trim());
const pad2 = (n: number) => String(n).padStart(2, '0');
/** "2025-07-08" → "08.07.2025" */
export function pDate(v: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t(v));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : t(v);
}
/** "18:50" → "18.50" */
export const pTime = (v: string | null | undefined) => t(v).replace(':', '.');

/** Editor HTML / marked text → plain paragraphs. */
export function textParas(raw: string | null | undefined): string[] {
  const src = t(raw);
  if (!src) return [];
  const plain = /<[a-z][\s\S]*>/i.test(src) ? (hasEditorMarks(src) ? editorHtmlToMarkedText(src) : htmlToPlainText(src)) : src;
  return stripFormatMarkers(plain).split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

const line = (...runs: ParchaRun[]): ParchaPara => ({ runs });

/** One पर्चा as paragraphs. `saransh` = the FIR's मुकदमा सारांश box (same for every पर्चा; empty → no सारांश line). */
export function buildParcha(p: ParchaInput, saransh: string): ParchaPara[] {
  const out: ParchaPara[] = [];
  const time = pTime(p.start) && pTime(p.end) ? ` समय ${pTime(p.start)} से ${pTime(p.end)} बजे तक`
    : pTime(p.start) ? ` समय ${pTime(p.start)} बजे से` : '';
  out.push(line({ text: `पर्चा नं0 ${pad2(p.no)} दिनाँक ${pDate(p.date) || '..........'}${time}`, highlight: true }));
  const names = p.entries.filter((e) => e.entry_type === 'karyvahi').map((e) => t(e.karyvahi_name)).filter(Boolean);
  const sar = textParas(saransh);
  const kary = p.no === 1 ? [...(sar.length ? ['मुकदमा साराशं'] : []), 'विवेचना ग्रहण', ...names] : names;
  if (kary.length) out.push(line({ text: `कार्यवाही- ${Array.from(new Set(kary)).join(', ')}` }));
  out.push(line({ text: `दौरा- ${(p.places ?? []).filter(Boolean).join(' व ') || 'थाना कार्यालय'} ।` }));
  out.push({ blank: true });
  sar.forEach((s, i) => out.push(i === 0 ? line({ text: 'मुकदमा साराशः- ', red: true }, { text: s }) : line({ text: s })));
  out.push(line({
    text: p.no === 1 || !p.prev
      ? 'श्रीमान जी मुकदमा उपरोक्त थाना हाजा पर पंजीकृत होकर विवेचना हस्व आदेश SHO महोदय के मुझ उ0नि0 को आवंटित होकर थाना कार्यालय से नकल चिक, नकल रपट प्राप्त हुए। मुकदमा उपरोक्त की विवेचना ग्रहण कर मशरूफ विवेचना हो रहा हूँ।'
      : `श्रीमान जी मुकदमा उपरोक्त मे पर्चा नं0 ${pad2(p.prev.no)} दिनाँक ${pDate(p.prev.date)} को किता कर सेवा मे प्रेषित किया जा चुका है। आज मै विवेचक दीगर कार्यसरकार से फुरसत पाकर मुकदमा उपरोक्त की विवेचना मे मशरूफ हुआ।`,
  }));
  let shown = 0;
  for (const e of p.entries) {
    const isK = e.entry_type === 'karyvahi';
    const label = t(isK ? e.karyvahi_name : e.narrative_template);
    const paras = textParas(isK ? e.vivran : e.narrative_text);
    if (!paras.length) continue;
    // Old diaries got an automatic "मुकदमा सारांश:" note as their first entry — the सारांश is printed above already.
    if (!isK && /^मुकदमा\s*सारांश\s*:/.test(paras[0])) continue;
    paras.forEach((para, i) => {
      const pp = i === 0 && label && isK ? line({ text: `${label}.......... `, red: true }, { text: para }) : line({ text: para });
      if (i === 0 && shown > 0) (pp as { gapBefore?: number }).gapBefore = 1.5; // 1.5 lines between two entries (owner)
      out.push(pp);
    });
    shown += 1;
  }
  out.push(line({ text: 'श्रीमान जी आज की कृत कार्यवाही का पर्चा किता कर सेवा मे प्रेषित है । विवेचना प्रचलित है ।' }));
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A4 preview page: same text as the Word file, split into 210 × 297 mm sheets (1 inch margins). */
export function parchaHtml(paras: ParchaPara[]): string {
  const body = paras.map((p) => ('blank' in p ? '<p class="blk">&nbsp;</p>'
    : `<p class="blk"${p.gapBefore ? ` style="margin-top:${p.gapBefore * 31}px"` : ''}>${p.runs.map((r) => {
      const txt = esc(r.text);
      return r.highlight ? `<span class="hl">${txt}</span>` : r.red ? `<span class="red">${txt}</span>` : txt;
    }).join('')}</p>`)).join('\n');
  return `<!DOCTYPE html>
<html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=840"><title>केस डायरी</title>
<style>
  @page { size: A4; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #e8e8e8; padding: 16px 0 32px; color: #000;
    font-family: 'Kokila', 'Mangal', 'Noto Serif Devanagari', 'Noto Sans Devanagari', serif; font-size: 18pt; line-height: 31px; }
  .sheet { position: relative; width: 210mm; height: 297mm; margin: 0 auto 16px; background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15); padding: 25.4mm; }
  .win { position: relative; overflow: hidden; }
  .win .txt { position: absolute; left: 0; right: 0; top: 0; }
  .pno { position: absolute; bottom: 9mm; left: 0; right: 0; text-align: center; font-size: 11pt; line-height: 1; color: #888; }
  #src { width: 210mm; padding: 0 25.4mm; }
  p.blk { text-align: justify; }
  .hl { background: #ffff00; }
  .red { color: #ff0000; }
</style></head><body>
<div id="src"><div class="txt">
${body}
</div></div>
<script>
(function () {
  // Pages cut on line boundaries: every line is 31px; the gaps between entries (1.5 lines) sit between
  // paragraphs, so the lines are listed paragraph by paragraph and each sheet ends after its last whole line
  // (a gap at the top of the next sheet is skipped). Each sheet shows the same text moved up.
  var L = 31;
  var src = document.getElementById('src');
  var txt = src.firstElementChild;
  var probe = document.createElement('div'); probe.className = 'sheet'; document.body.appendChild(probe);
  var st = getComputedStyle(probe);
  var inner = probe.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom);
  document.body.removeChild(probe);
  var H = Math.floor(inner / L) * L;
  var tops = [];
  var ps = txt.children;
  var base = txt.getBoundingClientRect().top;
  for (var k = 0; k < ps.length; k++) {
    var r = ps[k].getBoundingClientRect();
    var nl = Math.max(1, Math.round(r.height / L));
    for (var j = 0; j < nl; j++) tops.push(Math.round(r.top - base) + j * L);
  }
  var cuts = [];
  var li = 0;
  while (li < tops.length) {
    var start = tops[li], end = start + L; li++;
    while (li < tops.length && tops[li] + L <= start + H) { end = tops[li] + L; li++; }
    cuts.push([start, end]);
  }
  if (!cuts.length) cuts.push([0, H]);
  var n = cuts.length;
  for (var i = 0; i < n; i++) {
    var s = document.createElement('div'); s.className = 'sheet';
    var w = document.createElement('div'); w.className = 'win'; w.style.height = (cuts[i][1] - cuts[i][0]) + 'px';
    var c = txt.cloneNode(true); c.style.top = (-cuts[i][0]) + 'px';
    w.appendChild(c); s.appendChild(w);
    var p = document.createElement('div'); p.className = 'pno'; p.textContent = 'पृष्ठ ' + (i + 1) + ' / ' + n; s.appendChild(p);
    document.body.insertBefore(s, src);
  }
  src.parentNode.removeChild(src);
})();
</script></body></html>`;
}
