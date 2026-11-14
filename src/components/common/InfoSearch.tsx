/**
 * 🔍 search inside a long info note (owner) — the box + result count used by the ⓘ format sheet (FormatInfoSheet) and the
 * law "विस्तृत विश्लेषण" note (DetailedAnalysisCard). Rules in src/lib/infoSearch.ts; matches are marked yellow by
 * InfoBlocksView `highlight`.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import type { InfoBlock } from '@/lib/formatInfo';
import { filterInfoBlocks, isLongInfo } from '@/lib/infoSearch';
import { isTypoTolerant } from '@/lib/searchUtils';
import { INFO_DARK, INFO_LIGHT } from '@/components/common/InfoBlocksView';

export function useInfoSearch(blocks: InfoBlock[] | null | undefined) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const long = useMemo(() => isLongInfo(blocks), [blocks]);
  const result = useMemo(() => filterInfoBlocks(blocks ?? [], q, isTypoTolerant()), [blocks, q]);
  const active = open && !!q.trim();
  return {
    long, open, q, setQ, active,
    toggle: () => { setOpen((o) => !o); setQ(''); },
    close: () => { setOpen(false); setQ(''); },
    shown: active ? result.blocks : (blocks ?? []),
    /** matches for q whether or not the box was opened from a 🔍 (the law note keeps its box always open) */
    filtered: q.trim() ? result.blocks : (blocks ?? []),
    count: result.count,
  };
}

/** Search box + "n भाग मिले" line. `autoFocus` when it opens from a 🔍 button. */
export function InfoSearchBox({ q, setQ, count, active, onClose, autoFocus, placeholder }: {
  q: string; setQ: (s: string) => void; count: number; active: boolean; onClose?: () => void; autoFocus?: boolean; placeholder?: string;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const th = THEME[dark ? 'dark' : 'light'];
  const C = dark ? INFO_DARK : INFO_LIGHT;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: C.navy, borderRadius: 12,
        paddingHorizontal: 12, backgroundColor: th.card }}>
        <Search size={18} color={C.navyText} />
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus={autoFocus}
          placeholder={placeholder ?? 'इस पन्ने में खोजें…'}
          placeholderTextColor={th.mutedForeground}
          returnKeyType="search"
          style={{ flex: 1, fontSize: 15, paddingVertical: 9, color: th.foreground }}
        />
        {q || onClose ? (
          <Pressable onPress={() => (q ? setQ('') : onClose?.())} hitSlop={10} accessibilityLabel="खोज हटाएँ">
            <X size={18} color={th.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {active ? (
        <Text style={{ fontSize: 13, fontWeight: '600', color: count ? C.navyText : th.destructive }}>
          {count ? `"${q.trim()}" — ${count} भाग मिले` : `"${q.trim()}" — कुछ नहीं मिला`}
        </Text>
      ) : null}
    </View>
  );
}
