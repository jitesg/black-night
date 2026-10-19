/**
 * TimePickerModal — wheel-style time picker: slide hour and minute up/down,
 * tap AM/PM. value / onConfirm use 24-hour "HH:MM".
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, ScrollView, Text, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

interface Props {
  visible: boolean;
  value: string;
  title?: string;
  accentColor?: string;
  onConfirm: (hhmm: string) => void;
  onClose: () => void;
}

const ITEM_H = 48;
const VISIBLE = 5; // odd: the middle row is the selected one
const PAD = Math.floor(VISIBLE / 2);

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i);  // 0..59

function parse(v: string): { h12: number; m: number; pm: boolean } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(v || '');
  const h = match ? Math.min(23, Number(match[1])) : 9;
  const m = match ? Math.min(59, Number(match[2])) : 0;
  return { h12: h % 12 || 12, m, pm: h >= 12 };
}

export function formatTime12(v: string): string {
  const { h12, m, pm } = parse(v);
  return `${h12}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;
}

interface WheelProps {
  items: number[];
  index: number;
  onChange: (index: number) => void;
  format: (n: number) => string;
  color: string;
  mutedColor: string;
  width: number;
}

/** One scrolling column that snaps to rows. */
const Wheel = memo(function Wheel({ items, index, onChange, format, color, mutedColor, width }: WheelProps) {
  const ref = useRef<ScrollView>(null);
  const [live, setLive] = useState(index);
  const settled = useRef(index);

  // Jump to the given index when the modal opens / value changes from outside.
  useEffect(() => {
    settled.current = index;
    setLive(index);
    const id = setTimeout(() => ref.current?.scrollTo({ y: index * ITEM_H, animated: false }), 0);
    return () => clearTimeout(id);
  }, [index]);

  const idxFrom = (y: number) => Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = idxFrom(e.nativeEvent.contentOffset.y);
    setLive((prev) => (prev === i ? prev : i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const settle = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = idxFrom(e.nativeEvent.contentOffset.y);
    if (i !== settled.current) {
      settled.current = i;
      onChange(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, onChange]);

  return (
    <View style={{ width, height: ITEM_H * VISIBLE }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentOffset={{ x: 0, y: index * ITEM_H }}
        contentContainerStyle={{ paddingVertical: PAD * ITEM_H }}
      >
        {items.map((n, i) => {
          const dist = Math.abs(i - live);
          return (
            <Pressable
              key={n}
              onPress={() => ref.current?.scrollTo({ y: i * ITEM_H, animated: true })}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                style={{
                  color: dist === 0 ? color : mutedColor,
                  fontSize: dist === 0 ? 30 : dist === 1 ? 22 : 18,
                  fontWeight: dist === 0 ? '800' : '500',
                  opacity: dist === 0 ? 1 : dist === 1 ? 0.7 : 0.4,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {format(n)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

export function TimePickerModal({ visible, value, title = 'समय चुनें', accentColor = '#2563EB', onConfirm, onClose }: Props) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const [sel, setSel] = useState(() => parse(value));
  const [start, setStart] = useState(() => parse(value));

  useEffect(() => {
    if (visible) {
      const p = parse(value);
      setSel(p);
      setStart(p);
    }
  }, [visible, value]);

  const onHour = useCallback((i: number) => setSel((s) => ({ ...s, h12: HOURS[i] })), []);
  const onMinute = useCallback((i: number) => setSel((s) => ({ ...s, m: MINUTES[i] })), []);
  const pad2 = useCallback((n: number) => String(n).padStart(2, '0'), []);
  const plain = useCallback((n: number) => String(n), []);

  const confirm = () => {
    const h24 = (sel.h12 % 12) + (sel.pm ? 12 : 0);
    onConfirm(`${String(h24).padStart(2, '0')}:${String(sel.m).padStart(2, '0')}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34 }}>
          <Text style={{ color: c.foreground, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
          <Text style={{ color: accentColor, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 4 }}>
            {sel.h12}:{String(sel.m).padStart(2, '0')} {sel.pm ? 'PM' : 'AM'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            {/* Selection band behind the middle row */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', left: 8, right: 8, top: PAD * ITEM_H, height: ITEM_H,
                borderRadius: 14, backgroundColor: `${accentColor}1A`, borderWidth: 1, borderColor: `${accentColor}55`,
              }}
            />
            <Wheel
              items={HOURS}
              index={HOURS.indexOf(start.h12)}
              onChange={onHour}
              format={plain}
              color={c.foreground}
              mutedColor={c.mutedForeground}
              width={84}
            />
            <Text style={{ color: c.foreground, fontSize: 30, fontWeight: '800', marginHorizontal: 4, marginTop: -4 }}>:</Text>
            <Wheel
              items={MINUTES}
              index={start.m}
              onChange={onMinute}
              format={pad2}
              color={c.foreground}
              mutedColor={c.mutedForeground}
              width={84}
            />
            {/* AM / PM */}
            <View style={{ marginLeft: 14, gap: 8 }}>
              {(['AM', 'PM'] as const).map((p) => {
                const active = (p === 'PM') === sel.pm;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setSel((s) => ({ ...s, pm: p === 'PM' }))}
                    style={{
                      width: 58, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: active ? accentColor : c.secondary,
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : c.secondaryForeground, fontWeight: '700', fontSize: 15 }}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={onClose}
              style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: c.foreground, fontWeight: '600' }}>रद्द करें</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>ठीक है</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
