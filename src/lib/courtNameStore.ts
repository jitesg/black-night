/**
 * Own names for the suggestion lists (owner, तरीका ख): a name typed in a न्यायालय box / a सेवा में box is remembered when the
 * report is made / the कागज़ is saved, so it is suggested next time. Kept on this phone only (expo-sqlite localStorage), one list
 * per kind; rules in courtNames.ts / sewaNames.ts.
 */
import 'expo-sqlite/localStorage/install';
import { addCustomCourt, isCourtKey } from './courtNames';
import { addCustomSewa, isSewaKey } from './sewaNames';

declare const localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined;

export type NameKind = 'court' | 'sewa';
const KEYS: Record<NameKind, string> = { court: 'investsuite:court_names_custom', sewa: 'investsuite:sewa_names_custom' };

/** The officer's own names of that kind, newest first ([] when none / storage unavailable). */
export function getCustomNames(kind: NameKind): string[] {
  try {
    const v = JSON.parse((typeof localStorage !== 'undefined' && localStorage?.getItem(KEYS[kind])) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

/** Remember one typed name (a name from the owner's list is not stored twice). */
export function rememberName(kind: NameKind, name: string | null | undefined): void {
  try {
    if (!name || typeof localStorage === 'undefined') return;
    const cur = getCustomNames(kind);
    const next = kind === 'court' ? addCustomCourt(cur, name) : addCustomSewa(cur, name);
    if (JSON.stringify(next) !== JSON.stringify(cur)) localStorage?.setItem(KEYS[kind], JSON.stringify(next));
  } catch { /* storage unavailable — suggestions just stay as they were */ }
}

/** The officer's own court names, newest first. */
export function getCustomCourts(): string[] { return getCustomNames('court'); }

/** Remember one typed court name. */
export function rememberCourtName(name: string | null | undefined): void { rememberName('court', name); }

/**
 * After a report from a format: remember what was typed in its court boxes ({"court": true}) and the first line of its
 * सेवा में boxes ({"sewa": true} — the lines below are सर्किल / जनपद, not a post).
 */
export async function rememberCourtNamesForFormat(formatId: string | null | undefined, values: Record<string, string> | undefined): Promise<void> {
  if (!formatId || !values) return;
  try {
    const { getFormatKeys } = await import('./db/predefinedFormatRepo');
    for (const k of await getFormatKeys(formatId)) {
      if (isCourtKey(k.dropdown_options)) rememberCourtName(values[k.key_name]);
      else if (isSewaKey(k.dropdown_options)) {
        const first = String(values[k.key_name] ?? '').split('\n').map((l) => l.trim()).find(Boolean);
        rememberName('sewa', first);
      }
    }
  } catch { /* never block saving a report */ }
}
