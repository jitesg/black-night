/**
 * Shared pieces of the प्रार्थना पत्र आख्या + कार्यवाही screens (owner: both look alike).
 *   ReportDateField  — date box that opens the app calendar; shows dd/mm/yyyy, stores YYYY-MM-DD.
 *   HeaderDocButton  — ".doc" at the top right of the header; faded / not pressable while the text is empty.
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { CalendarDays, Download } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { htmlToPlainText } from '@/lib/stringUtils';

/** "2026-11-17" → "17/11/2026" (owner: dates as dd/mm/yyyy everywhere); anything else unchanged. */
function showDate(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Date box that opens the app's calendar (DatePickerModal) — same look as the other form boxes. */
export function ReportDateField({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, color: C.mutedForeground, fontWeight: '500' }}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel={`${label} चुनें`}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderWidth: 1, borderColor: error ? C.destructive : C.border, borderRadius: 12,
          paddingHorizontal: 14, minHeight: 48, backgroundColor: C.card,
        }}>
          <Text style={{ fontSize: 15, color: value ? C.foreground : C.mutedForeground }}>
            {value ? showDate(value) : 'तारीख चुनें (dd/mm/yyyy)'}
          </Text>
          <CalendarDays size={18} color={C.mutedForeground} />
        </View>
      </Pressable>
      {error ? <Text style={{ fontSize: 12, color: C.destructive }}>{error}</Text> : null}
      <DatePickerModal
        visible={open}
        value={value}
        label={label}
        onConfirm={(v) => { onChange(v); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/** Header ".doc" button (owner: top right) — faded and not pressable while the text is empty. */
export function HeaderDocButton({ source, title }: { source: string; title: string }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const [busy, setBusy] = useState(false);
  const empty = !htmlToPlainText(source).trim();
  const exportWord = async () => {
    if (busy || empty) return;
    setBusy(true);
    try {
      // loaded on tap only — keeps the docx library out of the screen's first render
      const { exportReportToDocx } = await import('@/lib/reportDocxExport');
      await exportReportToDocx(source, title);
    } catch (e) {
      Alert.alert('Word फ़ाइल नहीं बनी', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const fg = empty ? C.mutedForeground : C.primaryForeground;
  return (
    <Pressable onPress={exportWord} disabled={busy || empty} accessibilityLabel="Word फ़ाइल (.doc)" style={{ marginLeft: 4 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
        backgroundColor: empty ? C.muted : C.primary, opacity: busy ? 0.7 : 1,
      }}>
        {busy ? <ActivityIndicator size={14} color={fg} /> : <Download size={14} color={fg} />}
        <Text numberOfLines={1} textBreakStrategy="simple" style={{ fontSize: 14, fontWeight: '700', color: fg }}>.doc</Text>
      </View>
    </Pressable>
  );
}
