/**
 * InvestSuite कार्यालय — small UI kit (navy look from the owner-approved sample; light + dark).
 * Plain style objects (Pressable function styles were ignored on the phone — CLAUDE.md).
 */
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';

export function useOfficeColors() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return dark
    ? { dark, bg: '#0F172A', card: '#1E293B', border: '#334155', text: '#F1F5F9', muted: '#94A3B8', navy: '#93C5FD',
        head: '#0B2545', onNavy: '#0F172A', chipOnBg: '#93C5FD', green: '#4ADE80', greenBg: '#14532D', amberBg: '#422006',
        amber: '#FCD34D', red: '#F87171', input: '#0F172A', soft: '#1E3A5F' }
    : { dark, bg: '#F5F7FA', card: '#FFFFFF', border: '#E2E8F0', text: '#0F172A', muted: '#64748B', navy: '#1E3A5F',
        head: '#1E3A5F', onNavy: '#FFFFFF', chipOnBg: '#1E3A5F', green: '#166534', greenBg: '#DCFCE7', amberBg: '#FEF3C7',
        amber: '#92400E', red: '#DC2626', input: '#FFFFFF', soft: '#EEF2FF' };
}
export type OfficeColors = ReturnType<typeof useOfficeColors>;

export function OfficeHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  const C = useOfficeColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: C.head, paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {back ? (
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="वापस">
          <ChevronLeft size={24} color="#fff" />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: '#fff', opacity: 0.85, fontSize: 12.5 }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function OfficeCard({ children, style }: { children: ReactNode; style?: object }) {
  const C = useOfficeColors();
  return <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, ...style }}>{children}</View>;
}

export function Field({ label, value, onChange, placeholder, keyboardType, maxLength, big }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: KeyboardTypeOptions; maxLength?: number; big?: boolean;
}) {
  const C = useOfficeColors();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={{
          borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.input, color: C.text,
          paddingHorizontal: 12, paddingVertical: big ? 12 : 10, fontSize: big ? 26 : 15.5,
          letterSpacing: big ? 8 : 0, textAlign: big ? 'center' : 'left', fontWeight: big ? '700' : '400',
        }}
      />
    </View>
  );
}

export function Chips<T extends string>({ label, options, value, onChange }: {
  label?: string; options: { value: T; label: string }[]; value: T | ''; onChange: (v: T) => void;
}) {
  const C = useOfficeColors();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityLabel={o.label}>
              <View style={{ borderWidth: 1, borderColor: on ? C.navy : C.border, backgroundColor: on ? C.navy : C.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Text style={{ fontSize: 14, color: on ? C.onNavy : C.text, fontWeight: on ? '700' : '400' }}>{o.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function OfficeButton({ label, onPress, busy, kind = 'navy', disabled }: {
  label: string; onPress: () => void; busy?: boolean; kind?: 'navy' | 'green' | 'outline' | 'whatsapp' | 'danger'; disabled?: boolean;
}) {
  const C = useOfficeColors();
  const bg = kind === 'green' ? '#16A34A' : kind === 'whatsapp' ? '#25D366' : kind === 'danger' ? '#DC2626' : kind === 'outline' ? 'transparent' : C.navy;
  const fg = kind === 'outline' ? C.navy : kind === 'navy' ? C.onNavy : '#FFFFFF';
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} accessibilityLabel={label}>
      <View style={{
        backgroundColor: bg, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
        borderWidth: kind === 'outline' ? 1.5 : 0, borderColor: C.navy, opacity: disabled ? 0.5 : pressed ? 0.8 : 1, minHeight: 50,
      }}>
        {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 15.5, fontWeight: '700' }}>{label}</Text>}
      </View>
    </Pressable>
  );
}

export function ErrorText({ text }: { text: string }) {
  const C = useOfficeColors();
  return text ? <Text style={{ color: C.red, fontSize: 13.5, fontWeight: '600' }}>{text}</Text> : null;
}
