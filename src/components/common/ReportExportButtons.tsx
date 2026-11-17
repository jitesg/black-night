/**
 * "🖨 A4 प्रीव्यू" + "⬇ .doc" for a report shown as text (प्रार्थना पत्र आख्या, its detail screen, बीट सूचना / NCR कार्यवाही) — owner.
 * Same A4 sheet as the editor's print preview (PrintPreviewModal) and the same Word file as the प्रारूप screen
 * (exportReportToDocx), so a report prints alike everywhere. `source` = plain text, editor HTML, or the format's
 * editor HTML with layout marks (reportLayout.layoutSource).
 */
import { memo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { FileText, Printer } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { PrintPreviewModal } from '@/components/common/DocumentEditor';

interface Props {
  /** What to print / export. Empty → the buttons are not shown. */
  source: string;
  /** Sheet title + Word file name. */
  title: string;
  /** 'large' = full-width pair under an editor box; 'small' = pills inside a card. */
  size?: 'large' | 'small';
  /** Hide the A4 button (a screen that already has its own A4 preview — बीट सूचना / NCR editor). */
  wordOnly?: boolean;
}

export const ReportExportButtons = memo(function ReportExportButtons({ source, title, size = 'large', wordOnly }: Props) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!source.trim()) return null;

  const exportWord = async () => {
    if (busy) return;
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

  const big = size === 'large';
  const box = {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6,
    borderRadius: big ? 12 : 999, paddingVertical: big ? 11 : 5, paddingHorizontal: big ? 8 : 12, borderWidth: 1.5,
  };
  const fs = big ? 14 : 12.5;

  return (
    <View style={{ flexDirection: 'row', gap: 8, ...(big ? {} : { marginTop: 10 }) }}>
      {!wordOnly ? (
        <Pressable onPress={() => setPreview(true)} accessibilityLabel="A4 प्रीव्यू" style={big ? { flex: 1 } : undefined}>
          <View style={{ ...box, borderColor: C.primary, backgroundColor: C.card }}>
            <Printer size={big ? 16 : 13} color={C.primary} />
            <Text numberOfLines={1} textBreakStrategy="simple" style={{ fontSize: fs, fontWeight: '700', color: C.primary }}>A4 प्रीव्यू</Text>
          </View>
        </Pressable>
      ) : null}
      <Pressable onPress={exportWord} disabled={busy} accessibilityLabel="Word फ़ाइल (.doc)" style={big ? { flex: 1 } : undefined}>
        <View style={{ ...box, borderColor: C.primary, backgroundColor: C.primary, opacity: busy ? 0.7 : 1 }}>
          {busy ? <ActivityIndicator size={big ? 16 : 13} color={C.primaryForeground} /> : <FileText size={big ? 16 : 13} color={C.primaryForeground} />}
          <Text numberOfLines={1} textBreakStrategy="simple" style={{ fontSize: fs, fontWeight: '700', color: C.primaryForeground }}>
            {big ? '.doc (Word)' : '.doc'}
          </Text>
        </View>
      </Pressable>
      {!wordOnly ? <PrintPreviewModal visible={preview} onClose={() => setPreview(false)} value={source} title={title} /> : null}
    </View>
  );
});
