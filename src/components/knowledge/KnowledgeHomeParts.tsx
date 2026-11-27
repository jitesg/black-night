/**
 * ज्ञानकोष होम — new layout part 1 (owner, sample approved): "🕘 हाल में देखा" chips, "📂 विभाग" 2-column gradient tiles
 * (each module once, its count inside the tile — replaces the old count strip + फर्द card + category list) and "⭐ सहेजे गए".
 * Lists come from src/lib/knowledge/knowledgeVisits.ts (this phone only). THEME colours for text / cards; tiles = module colours,
 * deeper in dark mode. Gradients drawn by react-native-svg at the tile's measured size (Android "100%" Svg bug, see SummaryBento).
 */
import { memo, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import type { KnowledgeVisit } from '@/lib/knowledge/knowledgeVisitsCore';

type Icon = ComponentType<{ size: number; color: string; strokeWidth?: number }>;
const W = '#FFFFFF';

export interface KnowledgeTile {
  key: string;
  label: string;
  sub: string;
  icon: Icon;
  route: string;
  /** [from, to] light / dark */
  light: [string, string];
  dark: [string, string];
  /** Act tiles (विधि पुस्तकालय): short name big, no wrap */
  big?: boolean;
}

export const GradientTile = memo(function GradientTile({ tile }: { tile: KnowledgeTile }) {
  const { colorScheme } = useColorScheme();
  const [from, to] = colorScheme === 'dark' ? tile.dark : tile.light;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const I = tile.icon;
  const id = `kg-${tile.key}`;
  return (
    <Pressable
      onPress={() => router.push(tile.route as never)}
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!size || Math.abs(size.w - width) > 0.5 || Math.abs(size.h - height) > 0.5) setSize({ w: width, h: height });
      }}
      style={{ flex: 1, minHeight: 96, borderRadius: 18, overflow: 'hidden', borderCurve: 'continuous', backgroundColor: from,
        padding: 12, justifyContent: 'space-between' } as object}
    >
      {size ? (
        <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
        <I size={18} color={W} strokeWidth={2.2} />
      </View>
      <View style={{ marginTop: 10 }}>
        <Text numberOfLines={1} style={{ fontSize: tile.big ? 20 : 15, fontWeight: '800', color: W }}>{tile.label}</Text>
        <Text numberOfLines={tile.big ? 2 : 1} style={{ fontSize: 11.5, fontWeight: '600', color: W, opacity: 0.92 }}>{tile.sub}</Text>
      </View>
    </Pressable>
  );
});

/** 2 columns; an odd last tile takes half the width. */
export const KnowledgeTileGrid = memo(function KnowledgeTileGrid({ tiles }: { tiles: KnowledgeTile[] }) {
  const rows: KnowledgeTile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r[0].key} style={{ flexDirection: 'row', gap: 10 }}>
          {r.map((tl) => <GradientTile key={tl.key} tile={tl} />)}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
});

export function SectionTitle({ text, action }: { text: string; action?: ReactNode }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.4, color: C.mutedForeground }}>{text}</Text>
      {action}
    </View>
  );
}

/** "🕘 हाल में देखा" — one row of chips (newest first). Nothing shown when empty. */
export const RecentVisitChips = memo(function RecentVisitChips({ items, title }: { items: KnowledgeVisit[]; title: string }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  if (!items.length) return null;
  return (
    <View>
      <SectionTitle text={title} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
        {items.map((v) => (
          <Pressable
            key={v.route}
            onPress={() => router.push(v.route as never)}
            accessibilityRole="button"
            accessibilityLabel={v.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: 220, borderRadius: 999, borderWidth: 1, borderColor: C.border,
              backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 7 }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: v.color }} />
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: C.foreground, flexShrink: 1 }}>{v.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});

/** "⭐ सहेजे गए" — card list; 5 rows, "सब देखें (n)" opens the rest. Nothing shown when empty. */
export const SavedVisitList = memo(function SavedVisitList({ items, title, moreLabel, lessLabel }: {
  items: KnowledgeVisit[]; title: string; moreLabel: (n: number) => string; lessLabel: string;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, 5);
  return (
    <View>
      <SectionTitle
        text={title}
        action={items.length > 5 ? (
          <Pressable onPress={() => setAll((x) => !x)} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.primary }}>{all ? lessLabel : moreLabel(items.length)}</Text>
          </Pressable>
        ) : undefined}
      />
      <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 12, borderCurve: 'continuous' } as object}>
        {shown.map((v, i) => (
          <Pressable
            key={v.route}
            onPress={() => router.push(v.route as never)}
            accessibilityRole="button"
            accessibilityLabel={v.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}
          >
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: v.color }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: C.foreground }}>{v.label}</Text>
              {v.title ? <Text numberOfLines={1} style={{ fontSize: 12, color: C.mutedForeground, marginTop: 1 }}>{v.title}</Text> : null}
            </View>
            <Text style={{ fontSize: 15 }}>⭐</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});
