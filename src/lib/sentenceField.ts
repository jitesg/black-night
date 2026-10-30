/**
 * sentenceField.ts — field_type "sentence": the user picks a situation card and
 * fills the coloured blanks of a ready sentence (owner's idea for "विवरण
 * गिरफ्तारी"). Pure — tests: scripts/test_template_adi.ts.
 *
 * Config (key.dropdown_options JSON):
 *   { "hint": "...", "cards": [{ "id", "icon", "label", "text" }],
 *     "slots": { "<name>": { label, title, type: text|multiline|choice|date, options, default ("today" for date),
 *                            optional, before, after, placeholder, showIf, whenHidden, remember } },
 *     "extraLabel": "..." }
 * Card text = normal template text (other {{tokens}} allowed, rendered by the engine) with blanks
 * written as <<name>>. Never put a blank inside a {{…}} token — use the slot's showIf / whenHidden.
 * Value (stored) = JSON { "card": id, "s": { name: text }, "extra": text }. A plain (old) value is used as is.
 */
import { evalShowIf } from './formatShowIf';

export interface SentenceSlot {
  label?: string;
  /** heading of the fill sheet (default: label) */
  title?: string;
  type?: 'text' | 'multiline' | 'choice' | 'date';
  options?: string[];
  default?: string;
  optional?: boolean;
  before?: string;
  after?: string;
  placeholder?: string;
  showIf?: string;
  whenHidden?: string;
  remember?: boolean;
}
export interface SentenceCard { id: string; icon?: string; label: string; text: string }
export interface SentenceConfig { hint?: string; cards: SentenceCard[]; slots: Record<string, SentenceSlot>; extraLabel?: string }
export interface SentenceValue { card: string; s: Record<string, string>; extra: string; legacy?: string }

export type SentencePart = { kind: 'text'; text: string } | { kind: 'slot'; name: string };

export function parseSentenceConfig(raw: string | null | undefined): SentenceConfig {
  try {
    const v = JSON.parse(String(raw ?? ''));
    if (v && Array.isArray(v.cards)) {
      return {
        hint: typeof v.hint === 'string' ? v.hint : undefined,
        cards: v.cards.filter((c: SentenceCard) => c && c.id && typeof c.text === 'string'),
        slots: v.slots && typeof v.slots === 'object' ? v.slots : {},
        extraLabel: typeof v.extraLabel === 'string' ? v.extraLabel : undefined,
      };
    }
  } catch { /* bad config */ }
  return { cards: [], slots: {} };
}

export function parseSentenceValue(raw: string | null | undefined): SentenceValue {
  const t = String(raw ?? '').trim();
  if (t.startsWith('{')) {
    try {
      const v = JSON.parse(t);
      if (v && typeof v === 'object' && 'card' in v) {
        return { card: String(v.card ?? ''), s: v.s && typeof v.s === 'object' ? v.s : {}, extra: String(v.extra ?? '') };
      }
    } catch { /* plain text */ }
  }
  return { card: '', s: {}, extra: '', legacy: t || undefined };
}

export function serializeSentenceValue(v: SentenceValue): string {
  return JSON.stringify({ card: v.card, s: v.s, extra: v.extra });
}

export function splitCardText(text: string): SentencePart[] {
  const out: SentencePart[] = [];
  const re = /<<([A-Za-z0-9_]+)>>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    out.push({ kind: 'slot', name: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export function todayDmy(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function slotVisible(slot: SentenceSlot | undefined, values: Record<string, string>): boolean {
  return !slot?.showIf || evalShowIf(slot.showIf, values);
}

/** The slot's text: typed value, else its default ("today" → today's date for date slots). */
export function slotText(slot: SentenceSlot | undefined, typed: string | undefined): string {
  const t = String(typed ?? '').trim();
  if (t) return t;
  const d = slot?.default ?? '';
  if (d === 'today') return todayDmy();
  return d;
}

export function findCard(cfg: SentenceConfig, id: string): SentenceCard | undefined {
  return cfg.cards.find((c) => c.id === id);
}

/** Visible, required blanks of the chosen card that are still empty. */
export function pendingSlots(cfg: SentenceConfig, v: SentenceValue, values: Record<string, string>): string[] {
  const card = findCard(cfg, v.card);
  if (!card) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of splitCardText(card.text)) {
    if (p.kind !== 'slot' || seen.has(p.name)) continue;
    seen.add(p.name);
    const slot = cfg.slots[p.name];
    if (!slotVisible(slot, values) || slot?.optional) continue;
    if (!slotText(slot, v.s[p.name])) out.push(p.name);
  }
  return out;
}

/** True when the field has what it needs (card chosen + every required blank), or an old plain value. */
export function isSentenceComplete(cfg: SentenceConfig, raw: string, values: Record<string, string>): boolean {
  const v = parseSentenceValue(raw);
  if (v.legacy) return true;
  if (!findCard(cfg, v.card)) return false;
  return pendingSlots(cfg, v, values).length === 0;
}

/** The sentence as template text (other {{tokens}} are left for the engine). */
export function composeSentence(cfg: SentenceConfig, raw: string, values: Record<string, string>): string {
  const v = parseSentenceValue(raw);
  if (v.legacy) return v.legacy;
  const card = findCard(cfg, v.card);
  if (!card) return v.extra.trim();
  let out = '';
  for (const p of splitCardText(card.text)) {
    if (p.kind === 'text') { out += p.text; continue; }
    const slot = cfg.slots[p.name];
    if (!slotVisible(slot, values)) { out += slot?.whenHidden ?? ''; continue; }
    const t = slotText(slot, v.s[p.name]);
    if (t) out += `${slot?.before ?? ''}${t}${slot?.after ?? ''}`;
    else if (!slot?.optional) out += '……';
  }
  const extra = v.extra.trim();
  return (extra ? `${out.trim()} ${extra}` : out.trim()).replace(/ {2,}/g, ' ');
}
