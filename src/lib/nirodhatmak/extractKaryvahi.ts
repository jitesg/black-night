/**
 * extractKaryvahi.ts — pulls card facts out of a निरोधात्मक कार्यवाही's editor text:
 * village (ग्राम …), dispute (… विवाद) and the sections applied (धारा 126/135 BNSS …).
 * Pure functions (tested with node: scripts/test_nirodhatmak_extract.ts). Never throw.
 */

export interface KaryvahiFacts {
  village: string;
  dispute: string;
  sections: string[]; // e.g. ["धारा 126/135 BNSS"]
}

const clean = (s: string) => s.normalize('NFC').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** "ग्राम सरैया में …" → "सरैया" (first occurrence; up to 4 words before "में/मे"). */
export function extractVillage(text: string): string {
  const t = clean(text);
  const m = /ग्राम\s+([^।,;:()\n]{2,40}?)\s+(?:में|मे|मैं)\s/.exec(`${t} `);
  if (!m) return '';
  const v = m[1].replace(/^[-–—:]\s*/, '').trim();
  return v.split(/\s+/).length <= 4 ? v : '';
}

const HARD_STOP = new Set(['बीच', 'में', 'मे', 'आपस', 'उम्र', 'वर्ष', 'निवासी', 'ग्राम', 'व', 'तथा', 'और', 'एवं', 'है', 'हैं', 'था', 'से', 'पर', 'जो', 'कि']);
const CONNECT = new Set(['के', 'का', 'की']);

/** "… के बीच जमीनी विवाद चल रहा है" → "जमीनी विवाद"; "रास्ते को लेकर विवाद" kept whole. */
export function extractDispute(text: string): string {
  const t = clean(text);
  // Prefer the facts sentence (before "जो किसी भी समय …") and skip the standard closing lines.
  const facts = t.split(/जो\s+किसी\s+भी\s+समय/)[0] ?? t;
  const words = facts.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (!/^विवाद/.test(words[i])) continue;
    const out: string[] = [];
    let connectors = 0;
    for (let j = i - 1; j >= 0 && out.length < 4; j--) {
      const w = words[j].replace(/[।,;:()]/g, '');
      if (!w || HARD_STOP.has(w) || /\d/.test(w) || /[।,;]$/.test(words[j])) break;
      if (CONNECT.has(w)) {
        // "मेड़ के विवाद" ok; a second connector ("सनेही के मेड़ के") ends the phrase
        if (out[0] === 'लेकर') { out.unshift(w); continue; }
        if (connectors++ > 0 || out.length > 0) break;
      }
      out.unshift(w);
    }
    const phrase = [...out, words[i].replace(/[।,;:]+$/, '')].join(' ').trim();
    if (out.length) return phrase;
  }
  // No "विवाद": the clause just before "। जो किसी भी समय" (the {{Matter}} value)
  const m = /([^।]{3,80})।\s*जो\s+किसी\s+भी\s+समय/.exec(t);
  if (m) {
    const ws = m[1].trim().split(/\s+/);
    return ws.slice(-6).join(' ');
  }
  return '';
}

const ACT = '(BNSS|बीएनएसएस|CrPC|सीआरपीसी|द0\\s?प्र0\\s?सं0|भा0\\s?ना0\\s?सु0\\s?सं0)';

/** Sections of the action: "… के विरुद्ध धारा 126/135 BNSS की कार्यवाही" (else the heading "अन्तर्गत धारा …"). */
export function extractSections(text: string): string[] {
  const t = clean(text);
  const out: string[] = [];
  const add = (no: string, act: string) => {
    const s = `धारा ${no.replace(/\s+/g, '')} ${act.replace(/\s+/g, '')}`;
    if (!out.includes(s)) out.push(s);
  };
  const action = new RegExp(`धारा\\s+([\\d/ ,]+?)\\s*${ACT}\\s+(?:की|के)\\s+(?:अन्तर्गत\\s+|अंतर्गत\\s+)?कार्यवाही`, 'g');
  for (const m of t.matchAll(action)) add(m[1], m[2]);
  if (!out.length) {
    const head = new RegExp(`(?:अन्तर्गत|अंतर्गत)\\s+धारा\\s+([\\d/ ,]+?)\\s*${ACT}`, 'g');
    for (const m of t.matchAll(head)) add(m[1], m[2]);
  }
  if (!out.length) {
    const any = new RegExp(`धारा\\s+([\\d/]+(?:\\s*,\\s*[\\d/]+)*)\\s*${ACT}`, 'g');
    for (const m of t.matchAll(any)) add(m[1], m[2]);
  }
  return out.slice(0, 3);
}

export function extractKaryvahiFacts(text: string | null | undefined): KaryvahiFacts {
  const t = String(text ?? '');
  try {
    return { village: extractVillage(t), dispute: extractDispute(t), sections: extractSections(t) };
  } catch {
    return { village: '', dispute: '', sections: [] };
  }
}
