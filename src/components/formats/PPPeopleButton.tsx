/**
 * "📄 प्रार्थना पत्र से भरें" (owner): on an आवेदक / विपक्षी समूह inside the प्रार्थना पत्र fill screen — puts that
 * प्रार्थना पत्र's आवेदक (or विपक्षी) cards into the group again (blank cards replaced, no duplicates).
 * Shown only inside a PPPeopleContext (prarthna-patra/fill-format); the same cards also fill the group when the format opens.
 */
import { createContext, useContext, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { FileText } from 'lucide-react-native';
import type { GroupRole } from '@/lib/ppPeople';

export interface PPPeopleCtx {
  applicants: Record<string, string>[];
  opponents: Record<string, string>[];
}

export const PPPeopleContext = createContext<PPPeopleCtx | null>(null);

export function PPPeopleButton({ role, onInsert }: { role: GroupRole; onInsert: (cards: Record<string, string>[]) => void }) {
  const ctx = useContext(PPPeopleContext);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [note, setNote] = useState('');
  if (!ctx) return null;
  const cards = role === 'avedak' ? ctx.applicants : ctx.opponents;
  const who = role === 'avedak' ? 'आवेदक' : 'विपक्षी';
  const fg = dark ? '#A5B4FC' : '#2D52B8';
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityLabel={`प्रार्थना पत्र से ${who} भरें`}
        onPress={() => {
          if (!cards.length) { setNote(`इस प्रार्थना पत्र में कोई ${who} नहीं लिखा है`); return; }
          onInsert(cards.map((c, i) => ({ ...c, _id: `pp_pick_${Date.now()}_${i}` })));
          setNote(`✓ प्रार्थना पत्र के ${cards.length} ${who} भर दिये गये`);
        }}
      >
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          borderWidth: 1.5, borderStyle: 'dashed', borderColor: fg, borderRadius: 12,
          backgroundColor: dark ? '#1E2A4A' : '#EEF2FF', paddingVertical: 9,
        }}>
          <FileText size={15} color={fg} />
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: fg }}>प्रार्थना पत्र से भरें</Text>
        </View>
      </Pressable>
      {note ? <Text style={{ fontSize: 12, color: dark ? '#9CAFA3' : '#5D6B5D' }}>{note}</Text> : null}
    </View>
  );
}
