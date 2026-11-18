/**
 * 🧪 टेस्ट डेटा card (owner, sample approved) — Developer options → Test Utilities, at the top.
 * "टेस्ट डेटा भरें" fills every module with made-up entries (db/testDataRepo.fillTestData; थाना / जनपद / नाम from the
 * settings); "टेस्ट डेटा हटाएँ" removes exactly those. Both ask first. One set at a time. THEME colours, light + dark.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { countTestData, fillTestData, getTestDataIds, removeTestData, type FillResult } from '@/lib/db/testDataRepo';
import { _addAudit } from '@/lib/devOptionsStore';

const MODULES: [string, string, keyof FillResult['counts'] | 'gpLabel' | 'diaryLabel'][] = [
  ['📁', 'मुकदमा', 'fir'], ['📨', 'प्रार्थना पत्र', 'pp'], ['⚖️', 'न्यायालय', 'court'], ['🛡', 'निरोधात्मक', 'nk'],
  ['🏘', 'हल्का', 'gpLabel'], ['📒', 'GD', 'gd'], ['⏰', 'रिमाइंडर', 'reminder'], ['📑', 'केस डायरी', 'diaryLabel'],
];
const PLAN: Record<string, string> = { fir: '6', pp: '10', court: '6', nk: '4', gpLabel: '2 GP', gd: '5', reminder: '3', diaryLabel: '4 पर्चा' };

export function TestDataCard() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const C = dark ? THEME.dark : THEME.light;
  const { workspace } = useWorkspace();
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState<'' | 'fill' | 'remove'>('');
  const [ask, setAsk] = useState<'' | 'fill' | 'remove'>('');
  const [done, setDone] = useState<FillResult | null>(null);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => { setCount(countTestData(await getTestDataIds().catch(() => null))); }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (what: 'fill' | 'remove') => {
    setAsk(''); setBusy(what); setMsg(''); setDone(null);
    try {
      if (what === 'fill') {
        const r = await fillTestData({ thana: workspace.police_station ?? '', district: workspace.district ?? '', officer: workspace.officer_name ?? '' });
        setDone(r);
        _addAudit({ action: 'टेस्ट डेटा भरें', section: 'Test Utilities', outcome: 'success', detail: JSON.stringify(r.counts) });
      } else {
        const n = await removeTestData();
        setMsg(`✓ ${n} टेस्ट entries हटा दी गईं।`);
        _addAudit({ action: 'टेस्ट डेटा हटाएँ', section: 'Test Utilities', outcome: 'success', detail: String(n) });
      }
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy('');
      await refresh();
    }
  };

  const okBox = { backgroundColor: dark ? '#163322' : '#ECFDF3', borderColor: dark ? '#166534' : '#86EFAC', textColor: dark ? '#4ADE80' : '#15803D' };
  const btn = (label: string, onPress: () => void, kind: 'fill' | 'remove', disabled: boolean) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={{ marginTop: 10 }}>
      <View style={{
        borderRadius: 12, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
        opacity: disabled ? 0.45 : 1,
        ...(kind === 'fill' ? { backgroundColor: C.primary } : { borderWidth: 1.5, borderColor: C.destructive, backgroundColor: C.card }),
      }}>
        {busy === kind ? <ActivityIndicator size={16} color={kind === 'fill' ? C.primaryForeground : C.destructive} /> : null}
        <Text style={{ fontSize: 14, fontWeight: '700', color: kind === 'fill' ? C.primaryForeground : C.destructive }}>{label}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.foreground }}>🧪 टेस्ट डेटा</Text>
        {count ? (
          <View style={{ backgroundColor: dark ? '#451A03' : '#FEF3C7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: dark ? '#FCD34D' : '#92400E' }}>भरा हुआ · {count}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 2 }}>
        एक बटन से पूरे app में नमूना entries — सब काल्पनिक नाम, थाना / जनपद आपकी सेटिंग से{workspace.police_station ? ` (${workspace.police_station} / ${workspace.district})` : ''}।
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {MODULES.map(([icon, word, key]) => (
          <View key={key} style={{ width: '48.5%', flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.muted, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, color: C.foreground }}>{icon} {word}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.foreground }}>{PLAN[key]}</Text>
          </View>
        ))}
      </View>

      {done ? (
        <View style={{ marginTop: 10, borderWidth: 1, borderRadius: 12, padding: 10, backgroundColor: okBox.backgroundColor, borderColor: okBox.borderColor }}>
          <Text style={{ fontSize: 12.5, color: okBox.textColor, lineHeight: 20 }}>
            ✓ भर दिया ({Math.max(1, Math.round(done.ms / 1000))} सेकंड){'\n'}
            📁 {done.counts.fir} · 📨 {done.counts.pp} · ⚖️ {done.counts.court} · 🛡 {done.counts.nk} · 🏘 {done.counts.gp} · 📒 {done.counts.gd} · ⏰ {done.counts.reminder} · 📑 {done.counts.diary}{'\n'}
            अब यह आज़माएँ:{'\n'}
            {'• किसी card में नाम लिखें "राम" → रामपाल (कई जगह मिला)\n'}
            {`• मु0अ0सं0 में "120" → 120/${new Date().getFullYear()} + धारा\n`}
            • 🔔 घंटी → समय निकले / आज वाले काम
          </Text>
        </View>
      ) : null}
      {msg ? <Text style={{ fontSize: 12.5, color: msg.startsWith('⚠️') ? C.destructive : okBox.textColor, marginTop: 10 }}>{msg}</Text> : null}

      {btn('＋ टेस्ट डेटा भरें', () => setAsk('fill'), 'fill', !!busy || count > 0)}
      {btn('🗑 टेस्ट डेटा हटाएँ', () => setAsk('remove'), 'remove', !!busy || count === 0)}
      <Text style={{ fontSize: 11.5, color: C.mutedForeground, marginTop: 8 }}>
        {count ? 'दोबारा "भरें" तभी जब पहले हटाएँ — एक साथ दो बार नहीं भरेगा।' : 'अभी फ़ोन में टेस्ट डेटा: नहीं'}
      </Text>

      <AlertDialog open={!!ask} onOpenChange={(o) => { if (!o) setAsk(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ask === 'fill' ? 'टेस्ट डेटा भरें?' : 'टेस्ट डेटा हटाएँ?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {ask === 'fill'
                ? 'लगभग 48 नमूना entries सभी modules में जुड़ेंगी। आपका असली डेटा नहीं बदलेगा। बाद में "टेस्ट डेटा हटाएँ" से सब निकल जाएँगी।'
                : 'सिर्फ़ टेस्ट वाली entries हटेंगी — आपका असली डेटा वैसा ही रहेगा।'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* footer is flex-col-reverse: written in reverse of the on-screen order */}
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setAsk('')}><Text>रद्द करें</Text></AlertDialogCancel>
            <AlertDialogAction
              style={{ backgroundColor: ask === 'fill' ? C.primary : C.destructive }}
              onPress={() => { if (ask) void run(ask); }}
            >
              <Text style={{ color: ask === 'fill' ? C.primaryForeground : C.destructiveForeground }}>{ask === 'fill' ? 'हाँ, भरें' : 'हाँ, हटाएँ'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
