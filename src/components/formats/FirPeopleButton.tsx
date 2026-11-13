/**
 * "📁 मुकदमे से भरें" (owner): a small button on every person group field of a format. It lists the people of the
 * मुकदमा chosen at the top of the form (वादी + अभियुक्त, rules in src/lib/firPeople.ts); the ticked ones go into the
 * field. No मुकदमा chosen yet → the sheet first asks for one (and the form takes it like the "मुकदमा चुनें" box).
 * Shown only inside a FirPeopleContext (format fill screens) — never on the FIR screens themselves.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { getAllFIRs, getFIRById, searchFIRs, type FIR } from '@/lib/db/firRepo';
import { getAccusedByFIR } from '@/lib/db/firAccusedRepo';
import { firPeople, personLine, type FirPerson } from '@/lib/firPeople';

export interface FirPeopleCtx {
  /** मुकदमा of the form (opened from it, or chosen in the "मुकदमा चुनें" box) */
  firId: string | null;
  /** the form takes a मुकदमा chosen from the button's sheet (null = the form's मुकदमा is fixed) */
  onPickFir?: (fir: FIR) => void;
}

export const FirPeopleContext = createContext<FirPeopleCtx | null>(null);

const ACCENT = '#4F46E5';

export function FirPeopleButton({ onInsert, multi = true }: { onInsert: (people: FirPerson[]) => void; multi?: boolean }) {
  const ctx = useContext(FirPeopleContext);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const C = isDark ? THEME.dark : THEME.light;
  const [open, setOpen] = useState(false);
  const [firId, setFirId] = useState<string | null>(null);
  const [firLabel, setFirLabel] = useState('');
  const [people, setPeople] = useState<FirPerson[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [firs, setFirs] = useState<FIR[]>([]);

  const activeFir = firId ?? ctx?.firId ?? null;

  // people of the मुकदमा
  useEffect(() => {
    if (!open || !activeFir) return;
    let live = true;
    setPeople(null);
    (async () => {
      try {
        const [f, acc] = await Promise.all([getFIRById(activeFir), getAccusedByFIR(activeFir).catch(() => [])]);
        if (!live) return;
        setFirLabel(f ? `मु0अ0सं0 ${f.fir_number}${f.section ? ` · धारा ${f.section}` : ''}` : '');
        setPeople(firPeople(f, acc));
      } catch { if (live) setPeople([]); }
    })();
    return () => { live = false; };
  }, [open, activeFir]);

  // मुकदमा list when none is chosen yet
  useEffect(() => {
    if (!open || activeFir) return;
    let live = true;
    const h = setTimeout(async () => {
      try {
        const rows = q.trim() ? await searchFIRs(q.trim()) : await getAllFIRs();
        if (live) setFirs(rows.slice(0, 100));
      } catch { if (live) setFirs([]); }
    }, 200);
    return () => { live = false; clearTimeout(h); };
  }, [open, activeFir, q]);

  if (!ctx) return null;

  const close = () => { setOpen(false); setSel(new Set()); setFirId(null); setQ(''); };
  const toggle = (id: string) => setSel((prev) => {
    const next = new Set(multi ? prev : []);
    if (prev.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const insert = () => {
    const picked = (people ?? []).filter((p) => sel.has(p.id));
    if (picked.length) onInsert(picked);
    close();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="मुकदमे से भरें"
        hitSlop={6}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
          backgroundColor: isDark ? '#4F46E533' : '#EEF2FF', borderWidth: 1, borderColor: isDark ? '#818CF8' : '#C7D2FE',
        }}
      >
        <Text style={{ fontSize: 12 }}>📁</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#C7D2FE' : ACCENT }}>मुकदमे से भरें</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ maxHeight: '85%', backgroundColor: C.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 14, paddingBottom: NAV_BAR_INSET + 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 6 }}>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: C.foreground }}>
                {activeFir ? 'किसे भरना है?' : 'पहले मुकदमा चुनें'}
              </Text>
              <Pressable onPress={close} style={{ padding: 6 }}>
                <Text style={{ fontSize: 15, color: C.mutedForeground }}>बंद करें</Text>
              </Pressable>
            </View>

            {activeFir ? (
              <>
                {firLabel ? (
                  <Text style={{ paddingHorizontal: 16, marginBottom: 8, fontSize: 13, color: C.mutedForeground }} numberOfLines={1}>{firLabel}</Text>
                ) : null}
                {people === null ? (
                  <ActivityIndicator style={{ padding: 24 }} color={ACCENT} />
                ) : (
                  <FlatList
                    data={people}
                    keyExtractor={(p) => p.id}
                    ListEmptyComponent={
                      <Text style={{ textAlign: 'center', padding: 24, color: C.mutedForeground }}>
                        इस मुकदमे में वादी / अभियुक्त का नाम दर्ज नहीं है
                      </Text>
                    }
                    renderItem={({ item }) => {
                      const on = sel.has(item.id);
                      return (
                        <Pressable
                          onPress={() => toggle(item.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, padding: 12,
                            borderRadius: 14, borderWidth: 1, borderColor: on ? ACCENT : C.border, backgroundColor: on ? `${ACCENT}14` : C.card,
                          }}
                        >
                          <View style={{
                            width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? ACCENT : C.mutedForeground,
                            backgroundColor: on ? ACCENT : 'transparent', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {on ? <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: item.isAccused ? '#DC2626' : '#15803D' }}>{item.role}</Text>
                            <Text style={{ fontSize: 15, color: C.foreground }}>{personLine(item)}</Text>
                          </View>
                        </Pressable>
                      );
                    }}
                  />
                )}
                <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 6 }}>
                  {multi && people && people.length > 1 ? (
                    <Pressable
                      onPress={() => setSel(new Set(sel.size === people.length ? [] : people.map((p) => p.id)))}
                      style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground }}>{sel.size === people.length ? 'सब हटाएँ' : 'सभी चुनें'}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={insert}
                    disabled={sel.size === 0}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: sel.size ? ACCENT : C.secondary }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: sel.size ? '#FFFFFF' : C.mutedForeground }}>
                      भरें{sel.size ? ` (${sel.size})` : ''}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
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
                  data={firs}
                  keyExtractor={(f) => f.id}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 24, color: C.mutedForeground }}>कोई मुकदमा नहीं मिला</Text>}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => { setFirId(item.id); ctx.onPickFir?.(item); }}
                      style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: C.foreground }}>मु0अ0सं0 {item.fir_number}</Text>
                      <Text style={{ fontSize: 13, color: C.mutedForeground }} numberOfLines={2}>
                        {[item.section, item.complainant_name].filter(Boolean).join(' · ')}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
