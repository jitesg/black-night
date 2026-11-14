/**
 * "ⓘ प्रारूप की जानकारी" bottom sheet (owner): the format's info note (src/lib/formatInfo.ts) in the docx's blue design —
 * INFO NOTE head, blue "मुख्य बात" box, numbered headings, bullet / number lists, yellow "ध्यान दें" box, comparison table,
 * question-answer table — and "प्रारूप भरें →" at the bottom. Dark theme uses darker shades of the same colours.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { boldParts, getFormatInfo, type InfoBlock } from '@/lib/formatInfo';

const LIGHT = {
  navy: '#1F4E79', navyText: '#1F4E79', label: '#5A5A5A', sub: '#646464', line: '#D6E4F0', cellLine: '#BFD3E6',
  infoBg: '#EAF2F8', infoText: '#1F4E79', warnBg: '#FFF2CC', warnText: '#785000', warnBar: '#D6A000', keyBg: '#F4F8FC',
  headText: '#FFFFFF',
};
const DARK = {
  navy: '#1F4E79', navyText: '#93C5FD', label: '#A3A3A3', sub: '#A3A3A3', line: '#1E3A5F', cellLine: '#2C4A6B',
  infoBg: '#14273A', infoText: '#BFDBFE', warnBg: '#3A2E0B', warnText: '#FDE68A', warnBar: '#D6A000', keyBg: '#16222F',
  headText: '#FFFFFF',
};

function Rich({ s, style }: { s: string; style: object }) {
  return (
    <Text style={style}>
      {boldParts(s).map((p, i) => (p.bold ? <Text key={i} style={{ fontWeight: '700' }}>{p.text}</Text> : p.text))}
    </Text>
  );
}

export function FormatInfoSheet({ formatId, visible, onClose, onFill }: {
  formatId: string; visible: boolean; onClose: () => void; onFill?: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const th = THEME[dark ? 'dark' : 'light'];
  const C = dark ? DARK : LIGHT;
  const { height } = useWindowDimensions();
  const info = visible ? getFormatInfo(formatId) : null;
  if (!visible) return null;
  const txt = { fontSize: 15, lineHeight: 25, color: th.foreground };
  const cell = { fontSize: 13.5, lineHeight: 21, color: th.foreground };

  const renderBlock = (b: InfoBlock, i: number) => {
    switch (b.t) {
      case 'head':
        return (
          <View key={i} style={{ alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 11, letterSpacing: 2, fontWeight: '700', color: C.label }}>{b.label}</Text>
            <Text style={{ fontSize: 18, lineHeight: 28, fontWeight: '700', color: C.navyText, textAlign: 'center' }}>{b.title}</Text>
            {b.sub ? <Text style={{ fontSize: 13, lineHeight: 20, color: C.sub, textAlign: 'center' }}>{b.sub}</Text> : null}
          </View>
        );
      case 'box': {
        const warn = b.tone === 'warn';
        return (
          <View key={i} style={{ backgroundColor: warn ? C.warnBg : C.infoBg, borderLeftWidth: 4, borderLeftColor: warn ? C.warnBar : C.navy,
            borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, marginVertical: 8 }}>
            <Text style={{ fontSize: 14.5, lineHeight: 24, color: warn ? C.warnText : C.infoText }}>
              <Text style={{ fontWeight: '700' }}>{b.label}: </Text>{b.x}
            </Text>
          </View>
        );
      }
      case 'h':
        return (
          <View key={i} style={{ marginTop: 14, marginBottom: 4, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Text style={{ fontSize: 16, lineHeight: 25, fontWeight: '700', color: C.navyText }}>{b.x}</Text>
          </View>
        );
      case 'p':
        return <Rich key={i} s={b.x} style={{ ...txt, marginVertical: 3 }} />;
      case 'ul':
      case 'ol':
        return (
          <View key={i} style={{ marginVertical: 3, gap: 3 }}>
            {b.i.map((item, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
                <Text style={{ ...txt, minWidth: b.t === 'ol' ? 20 : 10, color: C.navyText, fontWeight: '700' }}>{b.t === 'ol' ? `${j + 1}.` : '•'}</Text>
                <View style={{ flex: 1 }}><Rich s={item} style={txt} /></View>
              </View>
            ))}
          </View>
        );
      case 'table':
        return (
          <View key={i} style={{ borderWidth: 1, borderColor: C.cellLine, borderRadius: 6, overflow: 'hidden', marginVertical: 6 }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.navy }}>
              {b.head.map((h, j) => (
                <View key={j} style={{ flex: 1, padding: 6, borderLeftWidth: j ? 1 : 0, borderLeftColor: '#ffffff33' }}>
                  <Text style={{ ...cell, color: C.headText, fontWeight: '700' }}>{h}</Text>
                </View>
              ))}
            </View>
            {b.rows.map((r, ri) => (
              <View key={ri} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.cellLine }}>
                {r.map((c, j) => (
                  <View key={j} style={{ flex: 1, padding: 6, borderLeftWidth: j ? 1 : 0, borderLeftColor: C.cellLine, backgroundColor: j === 0 ? C.keyBg : undefined }}>
                    <Text style={{ ...cell, ...(j === 0 ? { fontWeight: '700' } : {}) }}>{c}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      case 'qa':
        return (
          <View key={i} style={{ borderWidth: 1, borderColor: C.cellLine, borderRadius: 6, overflow: 'hidden', marginVertical: 6 }}>
            {b.rows.map((r, ri) => (
              <View key={ri} style={{ flexDirection: 'row', borderTopWidth: ri ? 1 : 0, borderTopColor: C.cellLine }}>
                <View style={{ width: '42%', padding: 6, backgroundColor: C.infoBg }}>
                  <Text style={{ ...cell, fontWeight: '700', color: C.infoText }}>{r[0]}</Text>
                </View>
                <View style={{ flex: 1, padding: 6, borderLeftWidth: 1, borderLeftColor: C.cellLine }}>
                  <Text style={cell}>{r[1]}</Text>
                </View>
              </View>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)', paddingBottom: NAV_BAR_INSET }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="बंद करें" />
        <View style={{ maxHeight: height * 0.9, backgroundColor: th.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' }}>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: th.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.navy, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.headText }}>ⓘ प्रारूप की जानकारी</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="बंद करें"><X size={20} color={C.headText} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            {info ? info.blocks.map(renderBlock) : (
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
