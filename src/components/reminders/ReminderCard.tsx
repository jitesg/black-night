/**
 * ReminderCard — one reminder in the list.
 *  - round check on the left (colour = priority) marks it done
 *  - swipe right → "पूरा"; swipe left → "स्नूज़" / "हटाएँ"
 *  - missed reminders show quick snooze buttons
 *  - tap opens the editor; the case chip opens the linked FIR
 */
import React, { memo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { AlarmClock, BellOff, Check, Clock, FolderOpen, RefreshCw, Trash2, AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import type { Reminder } from '@/lib/db/reminderRepo';
import { dueMs } from '@/lib/reminderService';
import {
  CATEGORY_META, DONE_COLOR, OVERDUE_COLOR, PRIORITY_META, dayLabel, fmtTime, relative, repeatSummary, tint,
} from './reminderUi';

export interface ReminderCardProps {
  reminder: Reminder;
  /** Time to show (snooze / pending occurrence). */
  at: number;
  state: 'overdue' | 'pending' | 'done';
  showDay: boolean;
  onPress: (r: Reminder) => void;
  onToggleDone: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
  onSnooze: (r: Reminder, minutes: number | 'tomorrow') => void;
  onOpenCase: (r: Reminder) => void;
}

function ActionButton({ color, icon, label, onPress }: { color: string; icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 76, alignItems: 'center', justifyContent: 'center', backgroundColor: color, gap: 4 }}
    >
      {icon}
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export const ReminderCard = memo(function ReminderCard({
  reminder: r, at, state, showDay, onPress, onToggleDone, onDelete, onSnooze, onOpenCase,
}: ReminderCardProps) {
  const { t, i18n } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];
  const swipeRef = useRef<SwipeableMethods>(null);

  const cat = CATEGORY_META[r.category] ?? CATEGORY_META.general;
  const CatIcon = cat.icon;
  const pr = PRIORITY_META[r.priority] ?? PRIORITY_META.normal;
  const isDone = state === 'done';
  const isOverdue = state === 'overdue';
  const snoozed = !isDone && r.snooze_until > Date.now();
  const accent = isOverdue ? OVERDUE_COLOR : snoozed ? '#D97706' : c.primary;
  const checkColor = isDone ? DONE_COLOR : r.priority === 'high' ? pr.color : isOverdue ? OVERDUE_COLOR : c.mutedForeground;

  const close = (fn: () => void) => () => {
    swipeRef.current?.close();
    fn();
  };

  const chip = (bg: string, fg: string, icon: React.ReactNode, label: string, onPressChip?: () => void) => {
    const body = (
      <>
        {icon}
        <Text textBreakStrategy="simple" numberOfLines={1} style={{ color: fg, fontSize: 11.5, lineHeight: 15, fontWeight: '600', includeFontPadding: false, maxWidth: 160 }}>
          {label}
        </Text>
      </>
    );
    const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: bg };
    return onPressChip ? (
      <Pressable onPress={onPressChip} hitSlop={4} style={style} className="active:opacity-70">{body}</Pressable>
    ) : (
      <View style={style}>{body}</View>
    );
  };

  return (
    <View style={{ marginBottom: 10, borderRadius: 18, overflow: 'hidden' }}>
      <ReanimatedSwipeable
        ref={swipeRef}
        friction={1.6}
        leftThreshold={60}
        rightThreshold={60}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={() => (
          <ActionButton
            color={isDone ? '#64748B' : DONE_COLOR}
            icon={<Check size={20} color="#fff" strokeWidth={3} />}
            label={isDone ? t('reminders.undo') : t('reminders.tabDone')}
            onPress={close(() => onToggleDone(r))}
          />
        )}
        renderRightActions={() => (
          <View style={{ flexDirection: 'row' }}>
            {!isDone ? (
              <ActionButton
                color="#D97706"
                icon={<AlarmClock size={20} color="#fff" />}
                label={t('reminders.snooze')}
                onPress={close(() => onSnooze(r, 60))}
              />
            ) : null}
            <ActionButton
              color="#DC2626"
              icon={<Trash2 size={20} color="#fff" />}
              label={t('common.delete')}
              onPress={close(() => onDelete(r))}
            />
          </View>
        )}
      >
        <Pressable
          onPress={() => onPress(r)}
          style={{
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: isOverdue ? `${OVERDUE_COLOR}55` : c.border,
            borderRadius: 18,
            paddingVertical: 12,
            paddingLeft: 12,
            paddingRight: 12,
            flexDirection: 'row',
            gap: 12,
            opacity: isDone ? 0.7 : 1,
          }}
        >
          {/* Check */}
          <Pressable
            onPress={() => onToggleDone(r)}
            hitSlop={10}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isDone }}
            style={{
              width: 26, height: 26, borderRadius: 13, marginTop: 1,
              borderWidth: 2, borderColor: checkColor,
              backgroundColor: isDone ? DONE_COLOR : r.priority === 'high' ? tint(pr.color, isDark) : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isDone ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
          </Pressable>

          {/* Body */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <Text
                numberOfLines={2}
                textBreakStrategy="simple"
                style={{
                  flex: 1, color: isDone ? c.mutedForeground : c.foreground, fontSize: 15.5, lineHeight: 21, fontWeight: '600',
                  textDecorationLine: isDone ? 'line-through' : 'none',
                }}
              >
                {r.title}
              </Text>
              <View style={{ width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(cat.color, isDark) }}>
                <CatIcon size={14} color={cat.color} />
              </View>
            </View>

            {r.note ? (
              <Text numberOfLines={2} textBreakStrategy="simple" style={{ color: c.mutedForeground, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                {r.note}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
              {chip(
                tint(accent, isDark),
                accent,
                isOverdue ? <AlertTriangle size={11} color={accent} /> : snoozed ? <AlarmClock size={11} color={accent} /> : <Clock size={11} color={accent} />,
                `${showDay ? `${dayLabel(at, t, i18n.language)}, ` : ''}${fmtTime(at)}${isDone ? '' : ` · ${relative(at, t)}`}`,
              )}
              {r.repeat_mode !== 'once'
                ? chip(c.secondary, c.secondaryForeground, <RefreshCw size={10} color={c.secondaryForeground} />, repeatSummary(r, dueMs(r), t))
                : null}
              {r.fir_label
                ? chip(tint('#7C3AED', isDark), isDark ? '#C4B5FD' : '#6D28D9', <FolderOpen size={11} color={isDark ? '#C4B5FD' : '#6D28D9'} />, r.fir_label, () => onOpenCase(r))
                : null}
              {r.sound === 'silent' ? <BellOff size={13} color={c.mutedForeground} /> : null}
              {r.nag_min > 0 && !isDone ? (
                <Text style={{ color: c.mutedForeground, fontSize: 11 }}>🔁 {r.nag_min}′</Text>
              ) : null}
            </View>

            {isOverdue ? (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                {([10, 60, 'tomorrow'] as const).map((m) => (
                  <Pressable
                    key={String(m)}
                    onPress={() => onSnooze(r, m)}
                    className="active:opacity-70"
                    style={{ height: 30, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }}
                  >
                    <Text style={{ color: c.foreground, fontSize: 12.5, fontWeight: '600' }}>
                      {m === 10 ? t('reminders.s10') : m === 60 ? t('reminders.s60') : t('reminders.sTomorrow')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
});
