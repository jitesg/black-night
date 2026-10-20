/**
 * DatePickerModal — Shared themed date picker for all form screens.
 *
 * Design:
 *   • Bottom-sheet modal with smooth slide-up + fade-in animation
 *   • Own lightweight month calendar (plain JS dates, no Intl / timezone code —
 *     the old react-native-ui-datepicker crashed on Android Hermes)
 *   • Calendar and action buttons use the app's primary color (#1E3A5F)
 *   • Works on iOS, Android, and Web identically (no native module)
 *
 * Usage:
 *   <DatePickerModal
 *     visible={show}
 *     value={dateString}          // "YYYY-MM-DD" or "" for today
 *     label="Occurrence Date"
 *     accentColor="#1E3A5F"       // optional, defaults to primary navy
 *     onConfirm={(v) => setDate(v)}
 *     onClose={() => setShow(false)}
 *   />
 *
 * The trigger field (tappable row that opens the modal) is NOT included here
 * — each screen renders its own field so it can match its existing form layout.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView, Text, TouchableWithoutFeedback, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

// ── Date helpers (local-midnight, no UTC shift) ───────────────────────────────

export function dateStrToObj(s: string): Date {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function dateObjToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DatePickerModalProps {
  visible: boolean;
  /** Current value as "YYYY-MM-DD", or "" to pre-select today */
  value: string;
  /** Label shown in the modal header */
  label: string;
  /** Primary accent color for the calendar and Confirm button */
  accentColor?: string;
  onConfirm: (dateStr: string) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ACCENT_DEFAULT = '#1E3A5F';

export function DatePickerModal({
  visible,
  value,
  label,
  accentColor = ACCENT_DEFAULT,
  onConfirm,
  onClose,
}: DatePickerModalProps) {
  const { t, i18n } = useTranslation();
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  // Pending selection — only committed when user taps Confirm
  const [pending, setPending] = useState<string>(value || dateObjToStr(new Date()));

  // Re-seed pending whenever the modal opens so it shows the current saved value
  useEffect(() => {
    if (visible) setPending(value || dateObjToStr(new Date()));
  }, [visible, value]);

  // ── Animation ──────────────────────────────────────────────────────────────
  const slideAnim   = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 24,
          stiffness: 220,
          mass: 0.85,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  const handleConfirm = () => {
    onConfirm(pending);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dim backdrop — tap to dismiss */}
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.48)',
          opacity: backdropAnim,
        }}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <TouchableWithoutFeedback onPress={() => { /* absorb touch — keep sheet open */ }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
            }}
          >
            <SafeAreaView edges={['bottom']}>
              <View style={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 8 }}>
                {/* Header row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>{label}</Text>
                  <Pressable
                    onPress={onClose}
                    style={{ padding: 6, borderRadius: 8, backgroundColor: colors.muted }}
                    accessibilityLabel="Close date picker"
                  >
                    <X size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>

                {/* Calendar */}
                <MonthCalendar
                  value={pending}
                  accent={accentColor}
                  hindi={i18n.language?.startsWith('hi') ?? false}
                  colors={colors}
                  onSelect={setPending}
                />

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 4 }}>
                  <Pressable
                    onPress={onClose}
                    style={{
                      flex: 1, borderWidth: 1, borderColor: colors.border,
                      borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.mutedForeground }}>
                      {t('datePicker.cancel')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirm}
                    style={{
                      flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                      backgroundColor: accentColor,
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                      {t('datePicker.confirm')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </Modal>
  );
}

// ── MonthCalendar — tiny pure-JS calendar grid ───────────────────────────────

const MONTHS_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_HI = ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'];
const DAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type CalColors = { foreground: string; mutedForeground: string; muted: string; border: string };

function MonthCalendar({
  value, accent, hindi, colors, onSelect,
}: {
  value: string;
  accent: string;
  hindi: boolean;
  colors: CalColors;
  onSelect: (dateStr: string) => void;
}) {
  const selected = dateStrToObj(value);
  const [view, setView] = useState({ y: selected.getFullYear(), m: selected.getMonth() });
  const [pickYear, setPickYear] = useState(false);

  // Jump to the selected month whenever the value changes from outside
  useEffect(() => {
    const d = dateStrToObj(value);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }, [value]);

  const todayStr = dateObjToStr(new Date());
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay();
    const count = new Date(view.y, view.m + 1, 0).getDate();
    const out: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= count; d++) out.push(d);
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const months = hindi ? MONTHS_HI : MONTHS_EN;
  const days = hindi ? DAYS_HI : DAYS_EN;
  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = thisYear + 5; y >= thisYear - 60; y--) years.push(y);

  const navBtn = { padding: 8, borderRadius: 10, backgroundColor: colors.muted } as const;

  return (
    <View>
      {/* Month header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 }}>
        <Pressable onPress={() => shift(-1)} style={navBtn} accessibilityLabel="Previous month" hitSlop={6}>
          <ChevronLeft size={18} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={() => setPickYear((v) => !v)} hitSlop={6} accessibilityLabel="Choose year">
          <Text style={{ fontSize: 16, fontWeight: '700', color: accent }}>
            {months[view.m]} {view.y}
          </Text>
        </Pressable>
        <Pressable onPress={() => shift(1)} style={navBtn} accessibilityLabel="Next month" hitSlop={6}>
          <ChevronRight size={18} color={colors.foreground} />
        </Pressable>
      </View>

      {pickYear ? (
        <ScrollView style={{ height: 280 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {years.map((y) => {
            const on = y === view.y;
            return (
              <Pressable
                key={y}
                onPress={() => { setView({ y, m: view.m }); setPickYear(false); }}
                style={{ width: '25%', paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden',
                  fontSize: 15, fontWeight: on ? '700' : '500',
                  color: on ? '#fff' : colors.foreground,
                  backgroundColor: on ? accent : 'transparent',
                }}>
                  {y}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ height: 280 }}>
          {/* Weekday labels */}
          <View style={{ flexDirection: 'row' }}>
            {days.map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.mutedForeground, paddingVertical: 6 }}>
                {d}
              </Text>
            ))}
          </View>
          {/* Day grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => {
              if (d === null) return <View key={i} style={{ width: `${100 / 7}%`, height: 40 }} />;
              const str = dateObjToStr(new Date(view.y, view.m, d));
              const isSel = str === value;
              const isToday = str === todayStr;
              return (
                <Pressable
                  key={i}
                  onPress={() => onSelect(str)}
                  style={{ width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel={str}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSel ? accent : 'transparent',
                    borderWidth: isToday && !isSel ? 1.5 : 0, borderColor: accent,
                  }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: isSel ? '700' : isToday ? '600' : '400',
                      color: isSel ? '#fff' : isToday ? accent : colors.foreground,
                    }}>
                      {d}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
