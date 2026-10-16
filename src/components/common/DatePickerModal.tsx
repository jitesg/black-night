/**
 * DatePickerModal — Shared themed date picker for all form screens.
 *
 * Design:
 *   • Bottom-sheet modal with smooth slide-up + fade-in animation
 *   • Uses react-native-ui-datepicker (already installed, pure-JS, web-safe)
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

import { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, Text, TouchableWithoutFeedback, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from 'react-native-ui-datepicker';
import { X } from 'lucide-react-native';
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
  const { t } = useTranslation();
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
                <DateTimePicker
                  mode="single"
                  date={dateStrToObj(pending)}
                  styles={{
                    selected: { backgroundColor: accentColor, borderRadius: 8 },
                    selected_label: { color: '#fff', fontWeight: '700' },
                    today: { borderWidth: 1.5, borderColor: accentColor, borderRadius: 8 },
                    today_label: { color: accentColor, fontWeight: '600' },
                    month_selector_label: { color: accentColor, fontWeight: '700' },
                    year_selector_label: { color: accentColor, fontWeight: '700' },
                  }}
                  onChange={(params) => {
                    const raw = params.date;
                    if (!raw) return;
                    const d =
                      raw instanceof Date ? raw
                      : typeof raw === 'string' || typeof raw === 'number' ? new Date(raw)
                      : (raw as { toDate(): Date }).toDate();
                    setPending(dateObjToStr(d));
                  }}
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
