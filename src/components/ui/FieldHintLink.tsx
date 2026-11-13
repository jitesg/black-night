/**
 * "ⓘ कैसे भरें?" (owner, design B): a small blue text link at the right end of a format field's label line. A tap opens a
 * floating box with the field's tip ({"hint": "…"} in dropdown_options); a tap outside (or ✕) closes it. Never printed.
 * Was a separate "ⓘ भरने का तरीका जानें" chip above the field (owner: looked awkward).
 */
import React, { useRef, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { splitHint } from '@/lib/hintParts';

export const HINT_LINK_LABEL = 'कैसे भरें?';

/** `title` = the field's label (box header "ⓘ <title> — कैसे भरें"). */
export function HintLink({ text, title }: { text?: string; title?: string }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const c = THEME[dark ? 'dark' : 'light'];
  const { width: winW, height: winH } = useWindowDimensions();
  const btnRef = useRef<View>(null);
  const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  if (!text) return null;
  const accent = dark ? '#60A5FA' : '#2563EB';
  // box = owner's design C: green header strip, tip, example in a light-green box with a green bar, small note
  const G = dark
    ? { head: '#4ADE80', headText: '#0F2016', line: '#2F5A3E', exBg: '#163322', exBar: '#4ADE80' }
    : { head: '#15803D', headText: '#FFFFFF', line: '#86EFAC', exBg: '#ECFDF3', exBar: '#15803D' };
  const parts = splitHint(text);
  const name = String(title ?? '').replace(/\s*\*+\s*$/, '').trim();
  const open = () => btnRef.current?.measureInWindow((x, y, w, h) => setPos({ x, y, w, h }));
  const close = () => setPos(null);
  const boxW = Math.min(winW - 24, 420);
  const left = pos ? Math.max(12, Math.min(pos.x + pos.w - boxW, winW - boxW - 12)) : 12;
  const below = pos ? pos.y + pos.h + 8 : 0;
  const placeAbove = pos ? below > winH * 0.6 : false; // near the bottom → open upwards
  return (
    <>
      <Pressable
        ref={btnRef}
        onPress={pos ? close : open}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={HINT_LINK_LABEL}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0, alignSelf: 'flex-start' }}
      >
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: accent }}>ⓘ</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: accent }}>{HINT_LINK_LABEL}</Text>
      </Pressable>
      <Modal visible={!!pos} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}>
          {pos ? (
            <View
              onStartShouldSetResponder={() => true}
              style={{ position: 'absolute', left, width: boxW,
                ...(placeAbove ? { bottom: winH - pos.y + 8 } : { top: below }),
                backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: G.line, overflow: 'hidden', elevation: 8,
                shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: G.head, paddingHorizontal: 14, paddingVertical: 9 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: G.headText }}>
                  {name ? `ⓘ ${name} — कैसे भरें` : 'ⓘ कैसे भरें'}
                </Text>
                <Pressable onPress={close} hitSlop={10} accessibilityLabel="बंद करें"><X size={18} color={G.headText} /></Pressable>
              </View>
              <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 8 }}>
                {parts.main ? <Text style={{ fontSize: 17, lineHeight: 28, color: c.foreground }}>{parts.main}</Text> : null}
                {parts.example ? (
                  <View style={{ borderLeftWidth: 3, borderLeftColor: G.exBar, backgroundColor: G.exBg, borderTopRightRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 16, lineHeight: 26, color: c.foreground }}>
                      जैसे: <Text style={{ fontWeight: '700' }}>{parts.example}</Text>
                    </Text>
                  </View>
                ) : null}
                {parts.note ? <Text style={{ fontSize: 14, lineHeight: 22, color: c.mutedForeground }}>{parts.note}</Text> : null}
              </View>
            </View>
          ) : null}
        </Pressable>
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
