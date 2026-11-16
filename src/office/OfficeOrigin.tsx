/**
 * InvestSuite: how a कागज़ from the थाना कार्यालय looks (owner, चरण ग sample) — list-card line "📥 कार्यालय से" + "नया",
 * and the detail banner (time, who sent it, कार्यालय की टिप्पणी, रद्द). Shared by प्रार्थना पत्र and न्यायालय.
 */
import { Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { parseMeta, showSentAt } from './officerSyncCore';

export const OFFICE_BLUE = { light: '#1F4E79', dark: '#93C5FD' } as const;

interface OfficeRowLike { office_task_id?: string | null; office_json?: string | null; office_new?: number | null }

export const isFromOffice = (r: OfficeRowLike | null | undefined) => !!r?.office_task_id;
export const isOfficeCancelled = (r: OfficeRowLike | null | undefined) => !!parseMeta(r?.office_json)?.cancelled;

/** Card border colour for an office कागज़ (undefined = keep the card's own). */
export function officeBorder(r: OfficeRowLike | null | undefined, dark: boolean): string | undefined {
  return isFromOffice(r) ? OFFICE_BLUE[dark ? 'dark' : 'light'] : undefined;
}

/** "📥 कार्यालय से" + red "नया" / grey "रद्द (कार्यालय)" for list cards. */
export function OfficeCardTag({ row }: { row: OfficeRowLike }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  if (!isFromOffice(row)) return null;
  const cancelled = isOfficeCancelled(row);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: OFFICE_BLUE[dark ? 'dark' : 'light'] }}>📥 कार्यालय से</Text>
      {cancelled ? (
        <View style={{ backgroundColor: dark ? '#334155' : '#E2E8F0', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: dark ? '#CBD5E1' : '#475569' }}>रद्द (कार्यालय)</Text>
        </View>
      ) : row.office_new ? (
        <View style={{ backgroundColor: '#DC2626', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>नया</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Detail-screen banner. */
export function OfficeOriginBanner({ row }: { row: OfficeRowLike }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const meta = parseMeta(row.office_json);
  if (!isFromOffice(row) || !meta) return null;
  const blue = OFFICE_BLUE[dark ? 'dark' : 'light'];
  return (
    <View style={{ backgroundColor: dark ? '#172554' : '#EEF2FF', borderWidth: 1, borderColor: blue, borderRadius: 14, padding: 12, gap: 3 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: blue }}>📥 कार्यालय से आया</Text>
      <Text style={{ fontSize: 12.5, color: dark ? '#CBD5E1' : '#475569' }}>{[showSentAt(meta.sentAt), meta.from].filter(Boolean).join(' · ')}</Text>
      {meta.note ? <Text style={{ fontSize: 13.5, color: dark ? '#F1F5F9' : '#111827', marginTop: 2 }}>💬 “{meta.note}”</Text> : null}
      {meta.cancelled ? (
        <Text style={{ fontSize: 13, fontWeight: '700', color: dark ? '#FCA5A5' : '#B91C1C', marginTop: 2 }}>
          ✖ कार्यालय ने यह कागज़ रद्द कर दिया है — चाहें तो हटा दें।
        </Text>
      ) : null}
    </View>
  );
}

/** Extra line for the delete dialog. */
export const OFFICE_DELETE_WARNING = '⚠️ यह कागज़ कार्यालय से आया है। हटाने पर सिर्फ़ आपके फ़ोन से हटेगा — कार्यालय में बना रहेगा और वहाँ “अधिकारी ने अपने फ़ोन से हटाया” दिखेगा।';
