/**
 * ✕ (clear) and 📋 (copy) inside a filled text box — name / father / address fields (owner).
 * Clearing shows "मिटाया गया · वापस लाएँ" for 5 s; copying shows "कॉपी हुआ".
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useColorScheme } from 'nativewind';
import { Copy, X } from 'lucide-react-native';
import { THEME } from '@/lib/theme';

export function useClearCopy(value: string, onChange: (v: string) => void, enabled = true) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const [undo, setUndo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const later = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  const clear = () => {
    setCopied(false);
    setUndo(value);
    onChange('');
    later(() => setUndo(null), 5000);
  };
  const copy = async () => {
    try { await Clipboard.setStringAsync(value); } catch { /* ignore */ }
    setUndo(null);
    setCopied(true);
    later(() => setCopied(false), 1500);
  };
  const restore = () => {
    if (undo !== null) onChange(undo);
    setUndo(null);
  };

  const show = enabled && !!String(value ?? '').length;
  const icons = show ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 6 }}>
      <Pressable onPress={copy} hitSlop={6} accessibilityLabel="कॉपी करें" style={{ padding: 4 }}>
        <Copy size={15} color={c.mutedForeground} />
      </Pressable>
      <Pressable onPress={clear} hitSlop={6} accessibilityLabel="मिटाएँ" style={{ padding: 4 }}>
        <X size={17} color={c.mutedForeground} />
      </Pressable>
    </View>
  ) : null;

  const notice = undo !== null ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
      <Text style={{ fontSize: 12, lineHeight: 18, color: c.mutedForeground }}>मिटाया गया</Text>
      <Pressable onPress={restore} hitSlop={8}>
        <Text style={{ fontSize: 12.5, lineHeight: 18, fontWeight: '700', color: c.primary }}>वापस लाएँ</Text>
      </Pressable>
    </View>
  ) : copied ? (
    <Text style={{ fontSize: 12, lineHeight: 18, color: c.primary, marginTop: 4 }}>✓ कॉपी हुआ</Text>
  ) : null;

  return { icons, notice };
}
