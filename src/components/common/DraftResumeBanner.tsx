/** "इस प्रारूप का अधूरा ड्राफ़्ट सहेजा हुआ है" + जारी रखें / हटाएँ — shown on a fill screen that opened empty. */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { FileClock } from 'lucide-react-native';
import { THEME } from '@/lib/theme';

export function DraftResumeBanner({ onResume, onDiscard }: { onResume: () => void; onDiscard: () => void }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const c = THEME[dark ? 'dark' : 'light'];
  const amber = dark ? '#FBBF24' : '#B45309';
  return (
    <View style={{ borderWidth: 1.5, borderColor: `${amber}88`, backgroundColor: `${amber}14`, borderRadius: 14, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <FileClock size={18} color={amber} />
        <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, fontWeight: '700', color: c.foreground }}>इस प्रारूप का अधूरा ड्राफ़्ट सहेजा हुआ है</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={onResume} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: amber }}>
          <Text style={{ fontSize: 13.5, lineHeight: 20, fontWeight: '700', color: dark ? '#1F1300' : '#FFFFFF' }}>अधूरा ड्राफ़्ट जारी रखें</Text>
        </Pressable>
        <Pressable onPress={onDiscard} style={{ paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ fontSize: 13.5, lineHeight: 20, fontWeight: '600', color: c.mutedForeground }}>हटाएँ</Text>
        </Pressable>
      </View>
    </View>
  );
}
