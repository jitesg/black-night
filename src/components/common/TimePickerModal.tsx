/**
 * TimePickerModal — tap-to-pick time (hour grid, 5-minute grid, AM/PM).
 * value / onConfirm use 24-hour "HH:MM".
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
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

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

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

export function TimePickerModal({ visible, value, title = 'समय चुनें', accentColor = '#2563EB', onConfirm, onClose }: Props) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const [sel, setSel] = useState(() => parse(value));

  useEffect(() => {
    if (visible) setSel(parse(value));
  }, [visible, value]);

  const confirm = () => {
    const h24 = (sel.h12 % 12) + (sel.pm ? 12 : 0);
    onConfirm(`${String(h24).padStart(2, '0')}:${String(sel.m).padStart(2, '0')}`);
  };

  const cell = (active: boolean) => ({
    width: '23%' as const,
    height: 40,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: active ? accentColor : c.secondary,
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34 }}
        >
          <Text style={{ color: c.foreground, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{title}</Text>

          {/* Big preview + AM/PM */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 12, marginBottom: 14 }}>
            <Text style={{ color: c.foreground, fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {sel.h12}:{String(sel.m).padStart(2, '0')}
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: c.secondary, borderRadius: 999, padding: 3 }}>
              {(['AM', 'PM'] as const).map((p) => {
                const active = (p === 'PM') === sel.pm;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setSel((s) => ({ ...s, pm: p === 'PM' }))}
                    style={{ paddingHorizontal: 14, height: 32, borderRadius: 999, justifyContent: 'center', backgroundColor: active ? accentColor : 'transparent' }}
                  >
                    <Text style={{ color: active ? '#fff' : c.secondaryForeground, fontWeight: '700', fontSize: 13 }}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={{ color: c.mutedForeground, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>घंटा</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
            {HOURS.map((h) => (
              <Pressable key={h} onPress={() => setSel((s) => ({ ...s, h12: h }))} style={cell(sel.h12 === h)}>
                <Text style={{ color: sel.h12 === h ? '#fff' : c.foreground, fontWeight: '600', fontSize: 15 }}>{h}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: c.mutedForeground, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 }}>मिनट</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
            {MINUTES.map((m) => (
              <Pressable key={m} onPress={() => setSel((s) => ({ ...s, m }))} style={cell(sel.m === m)}>
                <Text style={{ color: sel.m === m ? '#fff' : c.foreground, fontWeight: '600', fontSize: 15 }}>
                  :{String(m).padStart(2, '0')}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={onClose}
              style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: c.foreground, fontWeight: '600' }}>रद्द करें</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>ठीक है</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
