/**
 * न्यायालय के नाम — सुझाव (owner). The owner's list of 24 courts + names the officer typed himself (kept on the phone, see
 * courtNameStore.ts). Shown ONLY under the court-name boxes: format keys with dropdown_options {"court": true} and the
 * न्यायालय module's "न्यायालय का नाम" box. Pure — tests scripts/test_court_names.ts.
 */
import { queryTokens, searchNormalize } from './searchUtils';

/** The owner's list (24 names, in the owner's order). */
export const COURT_NAMES: readonly string[] = [
  'श्रीमान मुख्य न्यायिक मजिस्ट्रेट (CJM)',
  'श्रीमान अपर मुख्य न्यायिक मजिस्ट्रेट (ACJM)',
  'श्रीमान न्यायिक मजिस्ट्रेट प्रथम श्रेणी (JM-I)',
  'श्रीमान न्यायिक मजिस्ट्रेट द्वितीय श्रेणी (JM-II)',
  'श्रीमान सिविल जज (जू0डि0) / न्यायिक मजिस्ट्रेट',
  'श्रीमान विशेष मुख्य न्यायिक मजिस्ट्रेट (Special CJM)',
  'श्रीमान रेलवे मजिस्ट्रेट',
  'श्रीमान महानगर मजिस्ट्रेट (Metropolitan Magistrate)',
  'श्रीमान जनपद एवं सत्र न्यायाधीश',
  'श्रीमान अपर जनपद एवं सत्र न्यायाधीश (ADJ)',
  'श्रीमान विशेष न्यायाधीश (SC/ST Act)',
  'श्रीमान विशेष न्यायाधीश (POCSO Act)',
  'श्रीमान विशेष न्यायाधीश (NDPS Act)',
  'श्रीमान विशेष न्यायाधीश (गैंगस्टर एक्ट)',
  'श्रीमान विशेष न्यायाधीश (भ्रष्टाचार निवारण अधिनियम)',
  'श्रीमान विशेष न्यायाधीश (महिला उत्पीड़न)',
  'श्रीमान फास्ट ट्रैक कोर्ट (FTC)',
  'श्रीमान अपर सत्र न्यायाधीश / विशेष न्यायाधीश',
  'श्रीमान प्रधान न्यायाधीश, परिवार न्यायालय',
  'श्रीमान अपर प्रधान न्यायाधीश, परिवार न्यायालय',
  'श्रीमान किशोर न्याय बोर्ड (JJB)',
  'श्रीमान विशेष न्यायालय (विद्युत अधिनियम)',
  'श्रीमान श्रम न्यायालय',
  'श्रीमान मोटर दुर्घटना दावा अधिकरण',
];

/** At most this many own names are kept (newest first). */
export const MAX_CUSTOM_COURTS = 30;

export interface CourtHit { name: string; custom: boolean }

/** True for a format key marked {"court": true}. */
export function isCourtKey(dropdownOptions: string | null | undefined): boolean {
  if (!dropdownOptions || !dropdownOptions.includes('"court"')) return false;
  try { return (JSON.parse(dropdownOptions) as { court?: unknown }).court === true; } catch { return false; }
}

const clean = (s: string) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Names for what is typed: every typed word somewhere in the name (any order, spelling-normalised; "cjm" finds CJM / ACJM).
 * Own names first, then the owner's list; the name already in the box is not offered. Nothing for an empty box.
 */
export function matchCourtNames(query: string, custom: readonly string[], limit = 6): CourtHit[] {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const typed = searchNormalize(query);
  const seen = new Set<string>();
  const out: CourtHit[] = [];
  const consider = (name: string, isCustom: boolean) => {
    const n = searchNormalize(name);
    if (!n || seen.has(n) || n === typed) return;
    seen.add(n);
    if (tokens.every((t) => n.includes(t))) out.push({ name, custom: isCustom });
  };
  for (const c of custom) consider(c, true);
  for (const c of COURT_NAMES) consider(c, false);
  return out.slice(0, limit);
}

/** The own-names list after a box was used with `name`: added on top (new), moved on top (known), list names skipped. */
export function addCustomCourt(custom: readonly string[], name: string): string[] {
  const v = clean(name);
  const n = searchNormalize(v);
  if (n.replace(/\s/g, '').length < 4) return [...custom];
  if (COURT_NAMES.some((c) => searchNormalize(c) === n)) return [...custom];
  return [v, ...custom.filter((c) => searchNormalize(c) !== n)].slice(0, MAX_CUSTOM_COURTS);
}
