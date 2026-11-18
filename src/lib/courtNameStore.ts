/**
 * न्यायालय के नाम — the officer's own names (owner, तरीका ख): a court name typed in a court box is remembered when the report is
 * made / the कागज़ is saved, so it is suggested next time. Kept on this phone only (expo-sqlite localStorage); rules in courtNames.ts.
 */
import 'expo-sqlite/localStorage/install';
import { addCustomCourt, isCourtKey } from './courtNames';

declare const localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined;

const KEY = 'investsuite:court_names_custom';

/** The officer's own court names, newest first ([] when none / storage unavailable). */
export function getCustomCourts(): string[] {
  try {
    const v = JSON.parse((typeof localStorage !== 'undefined' && localStorage?.getItem(KEY)) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

/** Remember one typed court name (a name from the owner's list is not stored twice). */
export function rememberCourtName(name: string | null | undefined): void {
  try {
    if (!name || typeof localStorage === 'undefined') return;
    const cur = getCustomCourts();
    const next = addCustomCourt(cur, name);
    if (JSON.stringify(next) !== JSON.stringify(cur)) localStorage?.setItem(KEY, JSON.stringify(next));
  } catch { /* storage unavailable — suggestions just stay as they were */ }
}

/** After a report from a format: remember what was typed in its court boxes ({"court": true} keys). */
export async function rememberCourtNamesForFormat(formatId: string | null | undefined, values: Record<string, string> | undefined): Promise<void> {
  if (!formatId || !values) return;
  try {
    const { getFormatKeys } = await import('./db/predefinedFormatRepo');
    for (const k of await getFormatKeys(formatId)) {
      if (isCourtKey(k.dropdown_options)) rememberCourtName(values[k.key_name]);
    }
  } catch { /* never block saving a report */ }
}
