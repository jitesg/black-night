/**
 * FirPickerModal — pick a case (FIR) to link with a reminder.
 */
import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { FolderOpen, Search, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { searchFIRs, type FIR } from '@/lib/db/firRepo';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (fir: { id: string; label: string }) => void;
}

export function firLabel(f: Pick<FIR, 'fir_number' | 'section'>): string {
  return `FIR ${f.fir_number}${f.section ? ` · ${f.section}` : ''}`;
}

export function FirPickerModal({ visible, onClose, onPick }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const [q, setQ] = useState('');
  const [list, setList] = useState<FIR[]>([]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const id = setTimeout(() => {
      searchFIRs(q.trim())
        .then((rows) => { if (alive) setList(rows.slice(0, 100)); })
        .catch(() => { if (alive) setList([]); });
    }, 150);
    return () => { alive = false; clearTimeout(id); };
  }, [q, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ paddingBottom: NAV_BAR_INSET, flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, maxHeight: '80%', minHeight: '55%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
            <Text style={{ flex: 1, color: c.foreground, fontSize: 17, fontWeight: '700' }}>{t('reminders.pickCase')}</Text>
            <Pressable onPress={onClose} hitSlop={10}><X size={22} color={c.mutedForeground} /></Pressable>
          </View>
          <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: c.secondary }}>
            <Search size={16} color={c.mutedForeground} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('reminders.searchCase')}
              placeholderTextColor={c.mutedForeground}
              style={{ flex: 1, color: c.foreground, fontSize: 15, paddingVertical: 0 }}
            />
          </View>
          <FlatList
            data={list}
            keyExtractor={(f) => f.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={<Text style={{ color: c.mutedForeground, textAlign: 'center', marginTop: 24 }}>{t('reminders.noResults')}</Text>}
            renderItem={({ item: f }) => (
              <Pressable
                onPress={() => onPick({ id: f.id, label: firLabel(f) })}
                className="active:opacity-70"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C3AED1A' }}>
                  <FolderOpen size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: c.foreground, fontWeight: '700', fontSize: 14.5 }}>{firLabel(f)}</Text>
                  <Text numberOfLines={1} textBreakStrategy="simple" style={{ color: c.mutedForeground, fontSize: 12.5, marginTop: 2 }}>
                    {[f.complainant_name, f.crime_type].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
