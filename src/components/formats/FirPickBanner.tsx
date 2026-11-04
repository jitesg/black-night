/**
 * "मुकदमा चुनें" (owner, phase 3): a format opened outside a मुकदमा can still take the FIR's
 * वादी / अभियुक्त / मु0अ0सं0 / धारा … — pick the मुकदमा here and its "@FIR.*" fields fill in.
 * Shown by formats/fill only when the format has such fields and no FIR came with it.
 */
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { getAllFIRs, searchFIRs, type FIR } from '@/lib/db/firRepo';

export function FirPickBanner({ picked, onPick }: { picked: FIR | null; onPick: (fir: FIR) => void }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
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
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12,
          borderWidth: 1, borderColor: picked ? '#86EFAC' : '#A5B4FC', backgroundColor: picked ? '#F0FDF4' : '#EEF2FF',
        }}
      >
        <Text style={{ fontSize: 20 }}>📁</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: picked ? '#166534' : '#3730A3' }}>
            {picked ? `मु0अ0सं0 ${picked.fir_number} की जानकारी भरी गयी` : 'मुकदमा चुनें'}
          </Text>
          <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }} numberOfLines={2}>
            {picked
              ? [picked.section, picked.complainant_name].filter(Boolean).join(' · ') || 'बदलने के लिये छुएँ'
              : 'मुकदमा चुनने पर वादी, अभियुक्त, मु0अ0सं0, धारा अपने-आप भर जायेंगे'}
          </Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: picked ? '#166534' : '#4F46E5' }}>{picked ? 'बदलें' : 'चुनें ›'}</Text>
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
