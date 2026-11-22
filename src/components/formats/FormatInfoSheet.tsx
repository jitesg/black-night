/**
 * "ⓘ प्रारूप की जानकारी" bottom sheet (owner): the format's info note (src/lib/formatInfo.ts) in the docx's blue design —
 * INFO NOTE head, blue "मुख्य बात" box, numbered headings, bullet / number lists, yellow "ध्यान दें" box, comparison table,
 * question-answer table — and "प्रारूप भरें →" at the bottom. Dark theme uses darker shades of the same colours.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { getFormatInfo } from '@/lib/formatInfo';
import { InfoBlocksView, INFO_DARK, INFO_LIGHT } from '@/components/common/InfoBlocksView';
import { InfoSearchBox, useInfoSearch } from '@/components/common/InfoSearch';

export function FormatInfoSheet({ formatId, visible, onClose, onFill }: {
  formatId: string; visible: boolean; onClose: () => void; onFill?: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const th = THEME[dark ? 'dark' : 'light'];
  const C = dark ? INFO_DARK : INFO_LIGHT;
  const { height } = useWindowDimensions();
  const info = visible ? getFormatInfo(formatId) : null;
  const search = useInfoSearch(info?.blocks);
  if (!visible) return null;
  const txt = { fontSize: 15, lineHeight: 25, color: th.foreground };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)', paddingBottom: NAV_BAR_INSET }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="बंद करें" />
        {/* 🔍 open → fixed height (owner's bug: the sheet shrank and jumped with every letter, and collapsed when nothing matched) */}
        <View style={{ ...(search.open ? { height: height * 0.9 } : { maxHeight: height * 0.9 }), backgroundColor: th.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' }}>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: th.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.navy, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.headText }}>ⓘ प्रारूप की जानकारी</Text>
            {search.long ? (
              <Pressable onPress={search.toggle} hitSlop={12} accessibilityLabel="इस पन्ने में खोजें" style={{ marginRight: 14 }}>
                <Search size={20} color={C.headText} />
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="बंद करें"><X size={20} color={C.headText} /></Pressable>
          </View>
          {search.open ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
              <InfoSearchBox q={search.q} setQ={search.setQ} count={search.count} active={search.active} onClose={search.close} autoFocus />
            </View>
          ) : null}
          <ScrollView style={search.open ? { flex: 1 } : undefined} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            {info && search.active && !search.count ? (
              // nothing matched: say so where the text was + one tap back to the whole note
              <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 12, gap: 10 }}>
                <Search size={34} color={th.mutedForeground} />
                <Text style={{ fontSize: 15, color: th.foreground, textAlign: 'center' }}>{`"${search.q.trim()}" — इस जानकारी में कुछ नहीं मिला`}</Text>
                <Pressable
                  onPress={() => search.setQ('')}
                  accessibilityRole="button"
                  style={{ marginTop: 4, borderWidth: 1.5, borderColor: C.navyText, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
                >
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.navyText }}>खोज हटाएँ</Text>
                </Pressable>
              </View>
            ) : info ? <InfoBlocksView blocks={search.shown} highlight={search.active ? search.q : ''} /> : (
              <Text style={{ ...txt, color: th.mutedForeground }}>इस प्रारूप की जानकारी अभी उपलब्ध नहीं है।</Text>
            )}
          </ScrollView>
          {onFill ? (
            <Pressable
              onPress={() => { onClose(); onFill(); }}
              accessibilityRole="button"
              style={{ margin: 16, marginTop: 8, backgroundColor: C.navy, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: C.headText, fontSize: 15, fontWeight: '700' }}>प्रारूप भरें →</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
