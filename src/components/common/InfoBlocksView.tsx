/**
 * Renders an info note (src/lib/formatInfo.ts blocks) in the owner's docx blue design — used by the format ⓘ sheet
 * (FormatInfoSheet) and the law "विस्तृत विश्लेषण" card when a section has the owner's notes (src/lib/law/lawNotes.ts).
 * Dark theme uses darker shades of the same colours.
 */
import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { boldParts, type InfoBlock } from '@/lib/formatInfo';
import { NOTE_IMAGES } from '@/lib/law/lawNotes';

export const INFO_LIGHT = {
  navy: '#1F4E79', navyText: '#1F4E79', label: '#5A5A5A', sub: '#646464', line: '#D6E4F0', cellLine: '#BFD3E6',
  infoBg: '#EAF2F8', infoText: '#1F4E79', warnBg: '#FFF2CC', warnText: '#785000', warnBar: '#D6A000', keyBg: '#F2F6FA',
  headText: '#FFFFFF',
};
export const INFO_DARK = {
  navy: '#1F4E79', navyText: '#93C5FD', label: '#A3A3A3', sub: '#A3A3A3', line: '#1E3A5F', cellLine: '#2C4A6B',
  infoBg: '#14273A', infoText: '#BFDBFE', warnBg: '#3A2E0B', warnText: '#FDE68A', warnBar: '#D6A000', keyBg: '#16222F',
  headText: '#FFFFFF',
};

/** Tickable checklist (owner, BNSS 194 Inquest Duty Checklist): ticks live only while the screen is open, like the
 *  "आवश्यक तत्व" checklist; "n/total" + bar + रीसेट करें. */
function CheckList({ items, title, C, txt }: { items: string[]; title?: string; C: typeof INFO_LIGHT; txt: object }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (j: number) => setDone((prev) => { const n = new Set(prev); if (n.has(j)) n.delete(j); else n.add(j); return n; });
  const all = done.size === items.length && items.length > 0;
  return (
    <View style={{ borderWidth: 1, borderColor: C.cellLine, borderRadius: 10, padding: 12, marginVertical: 6, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '700', color: C.navyText }}>{title ?? 'चेकलिस्ट'}</Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: all ? '#16A34A' : C.infoBg }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: all ? '#FFFFFF' : C.infoText }}>{done.size}/{items.length}</Text>
        </View>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' }}>
        <View style={{ height: 5, width: `${items.length ? (done.size * 100) / items.length : 0}%`, backgroundColor: all ? '#16A34A' : C.navy }} />
      </View>
      {items.map((item, j) => {
        const on = done.has(j);
        return (
          <Pressable key={j} onPress={() => toggle(j)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
            style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 2 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, marginTop: 2, alignItems: 'center', justifyContent: 'center',
              borderColor: on ? '#16A34A' : C.cellLine, backgroundColor: on ? '#16A34A' : 'transparent' }}>
              {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <View style={{ flex: 1 }}><Rich s={item} style={{ ...txt, ...(on ? { opacity: 0.6 } : {}) }} /></View>
          </Pressable>
        );
      })}
      <Pressable onPress={() => setDone(new Set())} accessibilityRole="button"
        style={{ borderWidth: 1, borderColor: C.cellLine, borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginTop: 2 }}>
        <Text style={{ fontSize: 14, color: C.sub }}>रीसेट करें</Text>
      </Pressable>
    </View>
  );
}

function Rich({ s, style }: { s: string; style: object }) {
  return (
    <Text style={style}>
      {boldParts(s).map((p, i) => (p.bold ? <Text key={i} style={{ fontWeight: '700' }}>{p.text}</Text> : p.text))}
    </Text>
  );
}

export function InfoBlocksView({ blocks }: { blocks: InfoBlock[] }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const th = THEME[dark ? 'dark' : 'light'];
  const C = dark ? INFO_DARK : INFO_LIGHT;
  const txt = { fontSize: 15, lineHeight: 25, color: th.foreground };
  const cell = { fontSize: 13.5, lineHeight: 21, color: th.foreground };

  const renderBlock = (b: InfoBlock, i: number) => {
    switch (b.t) {
      case 'head':
        return (
          <View key={i} style={{ alignItems: 'center', marginBottom: 10 }}>
            {b.label ? <Text style={{ fontSize: 11, letterSpacing: 2, fontWeight: '700', color: C.label, textAlign: 'center' }}>{b.label}</Text> : null}
            {b.title ? <Text style={{ fontSize: 18, lineHeight: 28, fontWeight: '700', color: C.navyText, textAlign: 'center' }}>{b.title}</Text> : null}
            {b.sub ? <Text style={{ fontSize: 13, lineHeight: 20, color: C.sub, textAlign: 'center' }}>{b.sub}</Text> : null}
            {(b.lines ?? []).map((l, j) => (
              <Text key={j} style={{ fontSize: j === 0 ? 15 : 13, lineHeight: j === 0 ? 24 : 20, fontWeight: j === 0 ? '700' : '400',
                color: j === 0 ? C.navyText : C.sub, textAlign: 'center' }}>{l}</Text>
            ))}
          </View>
        );
      case 'box': {
        const warn = b.tone === 'warn';
        return (
          <View key={i} style={{ backgroundColor: warn ? C.warnBg : C.infoBg, borderLeftWidth: 4, borderLeftColor: warn ? C.warnBar : C.navy,
            borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, marginVertical: 8 }}>
            <Text style={{ fontSize: 14.5, lineHeight: 24, color: warn ? C.warnText : C.infoText }}>
              {b.label ? <Text style={{ fontWeight: '700' }}>{b.label}: </Text> : null}{b.x}
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
      case 'h2':
        return <Text key={i} style={{ fontSize: 15, lineHeight: 24, fontWeight: '700', color: C.navyText, marginTop: 10, marginBottom: 2 }}>{b.x}</Text>;
      case 'p':
        return <Rich key={i} s={b.x} style={{ ...txt, marginVertical: 3 }} />;
      case 'tag':
        return (
          <View key={i} style={{ alignSelf: 'flex-start', backgroundColor: C.infoBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginVertical: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.infoText }}>{b.x}</Text>
          </View>
        );
      case 'card':
        return (
          <View key={i} style={{ borderWidth: 1, borderColor: C.cellLine, backgroundColor: C.keyBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginVertical: 6 }}>
            <InfoBlocksView blocks={b.blocks} />
          </View>
        );
      case 'img': {
        const src = NOTE_IMAGES[b.key];
        if (!src) return null;
        const meta = Image.resolveAssetSource(src);
        const ratio = meta?.width && meta?.height ? meta.width / meta.height : 1.6;
        return (
          <View key={i} style={{ marginVertical: 8, gap: 4 }}>
            <Image source={src} style={{ width: '100%', aspectRatio: ratio, borderRadius: 8 }} resizeMode="contain" accessibilityLabel={b.caption} />
            {b.caption ? <Text style={{ fontSize: 12.5, color: C.sub, textAlign: 'center' }}>{b.caption}</Text> : null}
          </View>
        );
      }
      case 'check':
        if (b.interactive) return <CheckList key={i} items={b.i} title={b.title} C={C} txt={txt} />;
      // falls through — a plain (non-tickable) ☐ list
      case 'ul':
      case 'ol':
        return (
          <View key={i} style={{ marginVertical: 3, gap: 3 }}>
            {b.i.map((item, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
                <Text style={{ ...txt, minWidth: b.t === 'ol' ? 20 : 12, color: C.navyText, fontWeight: '700' }}>
                  {b.t === 'ol' ? `${j + 1}.` : b.t === 'check' ? '☐' : '•'}
                </Text>
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
                  <View key={j} style={{ flex: 1, padding: 6, borderLeftWidth: j ? 1 : 0, borderLeftColor: C.cellLine, ...(j === 0 ? { backgroundColor: C.keyBg } : {}) }}>
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

  return <View>{blocks.map(renderBlock)}</View>;
}
