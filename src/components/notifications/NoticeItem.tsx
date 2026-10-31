/**
 * NoticeItem — one card on the सूचनाएँ screen.
 * Look: big coloured icon tile, bold title with the time label on the right,
 * body text, then one extra row by kind — progress bar (केस डायरी), small info
 * items (सं0 / अंतिम तिथि / time) and an action chip. Rounded white card with
 * a soft shadow (owner's reference design).
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Bell, CalendarClock, FileText, FileWarning, NotebookPen, Scale, Scroll } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import type { NoticeCard, NoticeKind, NoticeLevel } from '@/lib/noticeCards';

export const KIND_META: Record<NoticeKind, { label: string; icon: typeof Bell; tile: string; soft: { light: string; dark: string } }> = {
  cd:       { label: 'केस डायरी',     icon: NotebookPen, tile: '#8B5CF6', soft: { light: '#7C3AED', dark: '#C4B5FD' } },
  court:    { label: 'न्यायालय',      icon: Scale,       tile: '#3B82F6', soft: { light: '#1D4ED8', dark: '#93C5FD' } },
  petition: { label: 'प्रार्थना पत्र', icon: Scroll,      tile: '#14B8A6', soft: { light: '#0F766E', dark: '#5EEAD4' } },
  reminder: { label: 'रिमाइंडर',      icon: Bell,        tile: '#F59E0B', soft: { light: '#B45309', dark: '#FCD34D' } },
  nk:       { label: 'निरोधात्मक',     icon: FileWarning, tile: '#EF4444', soft: { light: '#DC2626', dark: '#FCA5A5' } },
};

const LEVEL_COLOR: Record<NoticeLevel, { light: string; dark: string }> = {
  over: { light: '#DC2626', dark: '#F87171' },
  warn: { light: '#D97706', dark: '#FBBF24' },
  info: { light: '#64748B', dark: '#94A3B8' },
};

export function NoticeItem({ card, isDark }: { card: NoticeCard; isDark: boolean }) {
  const palette = THEME[isDark ? 'dark' : 'light'];
  const meta = KIND_META[card.kind];
  const Icon = meta.icon;
  const accent = isDark ? meta.soft.dark : meta.soft.light;
  const levelColor = LEVEL_COLOR[card.level][isDark ? 'dark' : 'light'];
  const go = () => router.push(card.route as never);
  const items = card.meta ?? [];
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={go}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.body}`}
      // Plain style object (not a function): on the phone the function form was ignored —
      // the card lost its background, border and the icon-beside-text row.
      style={{
        flexDirection: 'row', gap: 12, padding: 16, borderRadius: 22,
        backgroundColor: isDark ? '#1E2530' : palette.card,
        borderWidth: 1.5, borderColor: isDark ? '#3A4556' : '#D6DEEA',
        shadowColor: isDark ? '#000' : '#1E3A8A', shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
        opacity: pressed ? 0.85 : 1,
      }}
    >
      {/* Icon tile */}
      <View style={{
        width: 28, height: 28, borderRadius: 8, marginTop: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: meta.tile,
      }}>
        <Icon size={14} color="#FFFFFF" strokeWidth={2.4} />
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        {/* Title + time */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 15.5, lineHeight: 23, fontWeight: '800', color: palette.foreground }}>
            {card.title}
          </Text>
          <Text style={{ fontSize: 12.5, lineHeight: 20, fontWeight: card.level === 'info' ? '500' : '700', color: levelColor }}>
            {card.when}
          </Text>
        </View>

        {/* Body */}
        <Text style={{ fontSize: 13.5, lineHeight: 21, color: palette.mutedForeground }}>{card.body}</Text>

        {/* Progress (केस डायरी gap) */}
        {card.progress ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: `${accent}${isDark ? '33' : '22'}`, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(card.progress.value * 100)}%`, height: 8, borderRadius: 4, backgroundColor: card.level === 'over' ? levelColor : accent }} />
            </View>
            <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '700', color: card.level === 'over' ? levelColor : accent }}>{card.progress.label}</Text>
          </View>
        ) : null}

        {/* Info items */}
        {items.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 }}>
            {items.map((m, i) => {
              const MIcon = /तिथि|दिनांक|आज|\d{1,2}:\d{2}/.test(m) ? CalendarClock : FileText;
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  {i > 0 ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: palette.border, marginRight: 3 }} /> : null}
                  <MIcon size={14} color={palette.mutedForeground} />
                  <Text style={{ fontSize: 12.5, lineHeight: 19, color: palette.foreground }}>{m}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Action chip + kind label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          {card.action ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: 10, backgroundColor: `${accent}${isDark ? '26' : '14'}`,
            }}>
              <Text style={{ fontSize: 13, lineHeight: 19, fontWeight: '700', color: accent }}>{card.action}</Text>
              <ArrowRight size={14} color={accent} />
            </View>
          ) : <View />}
          <Text style={{ fontSize: 11.5, lineHeight: 17, fontWeight: '600', color: accent }}>{meta.label}</Text>
        </View>
      </View>
    </Pressable>
  );
}
