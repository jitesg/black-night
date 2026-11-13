/**
 * "मुकदमा चुनें" (owner, phase 3): a format opened outside a मुकदमा can still take the FIR's
 * वादी / अभियुक्त / मु0अ0सं0 / धारा … — pick the मुकदमा here and its "@FIR.*" fields fill in.
 * Shown by formats/fill only when the format has such fields and no FIR came with it.
 */
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Check, Scale } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { getAllFIRs, searchFIRs, type FIR } from '@/lib/db/firRepo';

// Owner's design (F, colour 1, icon क, dark option 2): app-green card, green round badge (⚖ → ✓ once picked), green button.
const PICK_LIGHT = {
  bg: '#ECFDF3', border: '#86EFAC', title: '#14532D', desc: '#3F6B4E', num: '#14532D',
  badge: '#15803D', badgeIcon: '#FFFFFF', btn: '#15803D', btnText: '#FFFFFF',
};
const PICK_DARK = {
  bg: '#163322', border: '#2F5A3E', title: '#F1F5F9', desc: '#B7CCBF', num: '#FFFFFF',
  badge: '#4ADE80', badgeIcon: '#0F2016', btn: '#4ADE80', btnText: '#0F2016',
};

export function FirPickBanner({ picked, onPick }: { picked: FIR | null; onPick: (fir: FIR) => void }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const P = colorScheme === 'dark' ? PICK_DARK : PICK_LIGHT;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [list, setList] = useState<FIR[]>([]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const h = setTimeout(async () => {
      try {
        const rows = q.trim() ? await searchFIRs(q.trim()) : await getAllFIRs();
        if (live) setList(rows.slice(0, 100));
      } catch { if (live) setList([]); }
    }, 200);
    return () => { live = false; clearTimeout(h); };
  }, [open, q]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={picked ? `मु0अ0सं0 ${picked.fir_number} — बदलें` : 'मुकदमा चुनें'}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 15,
          borderWidth: 1, borderColor: P.border, backgroundColor: P.bg,
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: P.badge, alignItems: 'center', justifyContent: 'center' }}>
          {picked ? <Check size={20} color={P.badgeIcon} strokeWidth={3} /> : <Scale size={20} color={P.badgeIcon} strokeWidth={2.2} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {picked ? (
            <>
              <Text style={{ fontSize: 12, color: P.desc }}>मु0अ0सं0</Text>
              <Text numberOfLines={1} style={{ fontSize: 21, fontWeight: '800', color: P.num }}>{picked.fir_number}</Text>
              {[picked.section, picked.complainant_name ? `वादी ${picked.complainant_name}` : ''].filter(Boolean).length ? (
                <Text numberOfLines={2} style={{ fontSize: 12, color: P.desc }}>
                  {[picked.section, picked.complainant_name ? `वादी ${picked.complainant_name}` : ''].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 15, fontWeight: '800', color: P.title }}>मुकदमा चुनें</Text>
              <Text style={{ fontSize: 12, color: P.desc }}>वादी, अभियुक्त, धारा अपने-आप भरेंगे</Text>
            </>
          )}
        </View>
        {picked ? (
          <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: P.btn }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: P.btn }}>बदलें</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: P.btn }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: P.btnText }}>चुनें</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '85%', backgroundColor: C.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 14, paddingBottom: NAV_BAR_INSET + 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: C.foreground }}>मुकदमा चुनें</Text>
              <Pressable onPress={() => setOpen(false)} style={{ padding: 6 }}>
                <Text style={{ fontSize: 15, color: C.mutedForeground }}>बंद करें</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="मु0अ0सं0, वादी, अभियुक्त या धारा से खोजें"
                placeholderTextColor={C.mutedForeground}
                style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.foreground }}
              />
            </View>
            <FlatList
              data={list}
              keyExtractor={(f) => f.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 24, color: C.mutedForeground }}>कोई मुकदमा नहीं मिला</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setOpen(false); onPick(item); }}
                  style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.foreground }}>मु0अ0सं0 {item.fir_number}</Text>
                  {item.section ? <Text style={{ fontSize: 13, color: C.mutedForeground, marginTop: 2 }}>धारा {item.section}</Text> : null}
                  {item.complainant_name ? <Text style={{ fontSize: 13, color: C.mutedForeground, marginTop: 2 }}>वादी: {item.complainant_name}</Text> : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
