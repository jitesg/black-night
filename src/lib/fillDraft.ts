/**
 * Half-filled format drafts for the module paths (owner's rules):
 *   • GD / निरोधात्मक / मुकदमा कार्यवाही (formats/fill with callingModule), न्यायालय, प्रार्थना पत्र fill screens
 *   • a format always opens empty; a saved draft is offered by a "अधूरा ड्राफ़्ट जारी रखें" button
 *   • "रद्द करें" deletes it, "ड्राफ़्ट रखें" keeps it, a generated report deletes it
 * The direct path (Formats list, no callingModule) keeps its drafts in "हाल के कार्य" (reportRecordRepo).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (scope: string, formatId: string, ctx?: string | null) =>
  `investsuite:fill_draft_v2:${scope}:${formatId}${ctx ? `:${ctx}` : ''}`;

export async function loadFillDraft(scope: string, formatId: string, ctx?: string | null): Promise<Record<string, string> | null> {
  try {
    const raw = await AsyncStorage.getItem(key(scope, formatId, ctx));
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, string>;
    return v && typeof v === 'object' && Object.keys(v).length ? v : null;
  } catch { return null; }
}

export function saveFillDraft(scope: string, formatId: string, ctx: string | null | undefined, values: Record<string, string>): void {
  AsyncStorage.setItem(key(scope, formatId, ctx), JSON.stringify(values)).catch(() => null);
}

export function clearFillDraft(scope: string, formatId: string, ctx?: string | null): void {
  AsyncStorage.removeItem(key(scope, formatId, ctx)).catch(() => null);
}
