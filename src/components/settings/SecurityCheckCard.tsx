/**
 * Settings → सुरक्षा → "सुरक्षा जाँच": read-only report (owner's optimisation pass). Shows facts only; changes nothing.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { hasAppLockPinSet } from '@/lib/appLockAuth';
import { getGeminiKey } from '@/ai/geminiDirect';

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean | null }) {
  const color = ok == null ? undefined : ok ? '#16A34A' : '#D97706';
  return (
    <View className="flex-row items-start gap-3 px-4 py-3 border-b border-border">
      <Text className="flex-1 text-sm text-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-muted-foreground" style={color ? { color, maxWidth: '55%', textAlign: 'right' } : { maxWidth: '55%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export function SecurityCheckCard() {
  const { settings } = useSettingsStore();
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  useEffect(() => { hasAppLockPinSet().then(setPinSet).catch(() => setPinSet(null)); }, []);
  let aiKey = false;
  try { aiKey = !!getGeminiKey(); } catch { /* unavailable */ }
  const perms = (Constants.expoConfig?.android?.permissions ?? []) as string[];
  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
      <Row label="ऐप लॉक" value={settings.appLock ? 'चालू' : 'बंद'} ok={settings.appLock} />
      <Row label="PIN सेट है" value={pinSet == null ? '—' : pinSet ? 'हाँ' : 'नहीं'} ok={pinSet} />
      <Row label="फ़ोन पर डेटा एन्क्रिप्शन" value="बंद (फ़ोन का स्क्रीन लॉक ज़रूरी)" ok={false} />
      <Row label="केस डेटा सर्वर पर" value="नहीं जाता (सिर्फ़ फ़ोन पर)" ok />
      <Row label="सर्वर टेबल RLS" value="ai_model_cache — चालू (कोड के अनुसार)" ok />
      <Row label="AI key (Gemini)" value={aiKey ? 'सहेजी है (फ़ोन पर, बिना एन्क्रिप्शन)' : 'नहीं'} ok={aiKey ? false : null} />
      <Row label="अंतिम बैकअप" value={settings.lastBackupDate ?? 'कभी नहीं'} ok={settings.lastBackupDate ? true : false} />
      <View className="px-4 py-3">
        <Text className="text-sm text-foreground">अनुमतियाँ ({perms.length})</Text>
        <Text className="text-xs text-muted-foreground mt-1">{perms.map((p) => p.replace('android.permission.', '')).join(', ') || '—'}</Text>
      </View>
    </View>
  );
}
