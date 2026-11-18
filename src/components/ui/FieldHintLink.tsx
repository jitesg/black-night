/**
 * "ⓘ कैसे भरें?" (owner): a small blue text link at the right end of a format field's label line. A tap opens a sheet from
 * the bottom (owner's design B — was a floating green box that covered the next field): ⓘ + the field's name, the tip
 * ({"hint": "…"} in dropdown_options; a tip that only repeats the name is left out), the example (short lists as chips,
 * else one line), a small note and "समझ गया". A tap outside / ✕ / back closes it. Never printed. THEME colours, light + dark.
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Info, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { exampleChips, splitHint, tipRepeatsTitle } from '@/lib/hintParts';

export const HINT_LINK_LABEL = 'कैसे भरें?';

/** `title` = the field's label (sheet heading "ⓘ <title>"). */
export function HintLink({ text, title }: { text?: string; title?: string }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const c = THEME[dark ? 'dark' : 'light'];
  const { height: winH } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const accent = dark ? '#60A5FA' : '#2563EB';
  const chipC = dark
    ? { bg: '#1E3A8A55', border: '#3B82F680', text: '#BFDBFE' }
    : { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' };
  const exBox = dark ? { bg: '#1E293B', bar: '#60A5FA' } : { bg: '#F1F5F9', bar: '#2563EB' };
  const parts = splitHint(text);
  const name = String(title ?? '').replace(/\s*\*+\s*$/, '').trim();
  const main = parts.main && !tipRepeatsTitle(parts.main, name) ? parts.main : '';
  const chips = exampleChips(parts.example);
  const close = () => setOpen(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={HINT_LINK_LABEL}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0, alignSelf: 'flex-start' }}
      >
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: accent }}>ⓘ</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: accent }}>{HINT_LINK_LABEL}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} accessibilityLabel="बंद करें" />
          <View
            style={{
              backgroundColor: c.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: winH * 0.75,
              paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 + NAV_BAR_INSET,
              elevation: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: -4 },
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 14 }} />
            {/* heading: ⓘ + the field's name + ✕ */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: chipC.bg }}>
                <Info size={19} color={accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.mutedForeground }}>कैसे भरें</Text>
                <Text style={{ fontSize: 18, lineHeight: 28, fontWeight: '700', color: c.foreground }}>{name || 'यह खाना'}</Text>
              </View>
              <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="बंद करें"
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.muted }}>
                <X size={18} color={c.mutedForeground} />
              </Pressable>
            </View>
            <View style={{ height: 1, backgroundColor: c.border, marginTop: 14, marginBottom: 4 }} />
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingTop: 10, gap: 14 }} showsVerticalScrollIndicator={false}>
              {main ? <Text style={{ fontSize: 17, lineHeight: 29, color: c.foreground }}>{main}</Text> : null}
              {parts.example ? (
                chips.length ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: c.mutedForeground }}>उदाहरण</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {chips.map((ch) => (
                        <View key={ch} style={{ backgroundColor: chipC.bg, borderWidth: 1, borderColor: chipC.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: chipC.text }}>{ch}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={{ borderLeftWidth: 3, borderLeftColor: exBox.bar, backgroundColor: exBox.bg, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: c.mutedForeground, marginBottom: 2 }}>उदाहरण</Text>
                    <Text style={{ fontSize: 16.5, lineHeight: 27, fontWeight: '600', color: c.foreground }}>{parts.example}</Text>
                  </View>
                )
              ) : null}
              {parts.note ? <Text style={{ fontSize: 14.5, lineHeight: 23, color: c.mutedForeground }}>{parts.note}</Text> : null}
            </ScrollView>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="समझ गया" style={{ marginTop: 18 }}>
              <View style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.primaryForeground }}>समझ गया</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

/** A field's label line with the link at its right end (just the label when there is no tip). */
export function LabelWithHint({ hint, title, children }: { hint?: string; title?: string; children: React.ReactNode }) {
  if (!hint) return <>{children}</>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      <HintLink text={hint} title={title} />
    </View>
  );
}
