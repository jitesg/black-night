/**
 * Search + Filter, design "C" (owner): a ⚙︎ button inside the search box (with the number of filters on),
 * the chosen filters as chips with ✕ under the box, and a sheet from the bottom with the filter groups
 * (one choice per group, "सभी" = off) and "सब हटाएँ" / "लागू करें (n)". Same look in every module
 * (निरोधात्मक, हल्का); colours from THEME so light and dark both work, accent = the module colour.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SlidersHorizontal, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

export interface FilterOption { value: string; label: string }
export interface FilterGroupDef {
  key: string; label: string; options: FilterOption[];
  /** A choice that is always set (e.g. sort order): no "सभी" chip, never counted / shown as a chip while it is `defaultValue`. */
  noAll?: boolean;
  defaultValue?: string;
}
/** group key → chosen value (null / missing = सभी). */
export type FilterValues = Record<string, string | null | undefined>;

export function activeFilterCount(values: FilterValues, groups?: FilterGroupDef[]): number {
  const def = new Map((groups ?? []).map((g) => [g.key, g.defaultValue]));
  return Object.entries(values).filter(([k, v]) => v != null && v !== '' && v !== def.get(k)).length;
}

function usePalette() {
  const { colorScheme } = useColorScheme();
  return THEME[colorScheme === 'dark' ? 'dark' : 'light'];
}

/** ⚙︎ inside the search box (pass as SearchBar `trailing`). */
export function FilterSearchButton({ count, onPress, accent }: { count: number; onPress: () => void; accent: string }) {
  const C = usePalette();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={t('common.filter', 'Filter')}
      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
    >
      <SlidersHorizontal size={18} color={count > 0 ? accent : C.mutedForeground} />
      {count > 0 ? (
        <View style={{
          position: 'absolute', top: 0, right: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
          backgroundColor: accent, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 10, lineHeight: 13, fontWeight: '700', color: '#FFFFFF' }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The filters that are on, as chips with ✕ (nothing when no filter is on). */
export function ActiveFilterChips({
  groups, values, onRemove, accent,
}: { groups: FilterGroupDef[]; values: FilterValues; onRemove: (key: string) => void; accent: string }) {
  const on = groups
    .map((g) => ({ g, opt: values[g.key] === g.defaultValue ? undefined : g.options.find((o) => o.value === values[g.key]) }))
    .filter((x): x is { g: FilterGroupDef; opt: FilterOption } => !!x.opt);
  if (!on.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
      {on.map(({ g, opt }) => (
        <Pressable
          key={g.key}
          onPress={() => onRemove(g.key)}
          accessibilityRole="button"
          accessibilityLabel={`${opt.label} हटाएँ`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16,
            backgroundColor: accent,
          }}
        >
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', maxWidth: 200 }}>{opt.label}</Text>
          <X size={13} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Bottom sheet with the filter groups; changes apply only with "लागू करें". */
export function FilterSheet({
  visible, groups, values, onApply, onClose, accent, previewCount,
}: {
  visible: boolean;
  groups: FilterGroupDef[];
  values: FilterValues;
  onApply: (values: FilterValues) => void;
  onClose: () => void;
  accent: string;
  /** How many items the draft would show — for "लागू करें (n)". */
  previewCount?: (values: FilterValues) => number;
}) {
  const C = usePalette();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FilterValues>(values);
  useEffect(() => { if (visible) setDraft(values); }, [visible, values]);
  const n = useMemo(() => (previewCount ? previewCount(draft) : null), [previewCount, draft]);

  const chip = (selected: boolean) => ({
    height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' as const,
    borderWidth: 1, borderColor: selected ? accent : C.border, backgroundColor: selected ? accent : C.background,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} accessibilityLabel={t('common.close', 'बंद करें')} />
      <View style={{
        backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 + NAV_BAR_INSET, maxHeight: '80%',
      }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 10 }} />
        <Text style={{ fontSize: 17, fontWeight: '700', color: C.foreground, marginBottom: 4 }}>{t('common.filter', 'Filter')}</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {groups.map((g) => {
            const cur = draft[g.key] ?? null;
            return (
              <View key={g.key} style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.mutedForeground, marginBottom: 8 }}>{g.label}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {g.noAll ? null : (
                    <Pressable onPress={() => setDraft((d) => ({ ...d, [g.key]: null }))} style={chip(cur == null)}>
                      <Text style={{ fontSize: 13.5, fontWeight: cur == null ? '700' : '500', color: cur == null ? '#FFFFFF' : C.foreground }}>
                        {t('common.all', 'सभी')}
                      </Text>
                    </Pressable>
                  )}
                  {g.options.map((o) => {
                    const sel = cur === o.value;
                    return (
                      <Pressable key={o.value} onPress={() => setDraft((d) => ({ ...d, [g.key]: sel && !g.noAll ? null : o.value }))} style={chip(sel)}>
                        <Text style={{ fontSize: 13.5, fontWeight: sel ? '700' : '500', color: sel ? '#FFFFFF' : C.foreground }}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Pressable
            onPress={() => setDraft(Object.fromEntries(groups.filter((g) => g.defaultValue != null).map((g) => [g.key, g.defaultValue])))}
            style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.foreground }}>{t('filter.clearAll', 'सब हटाएँ')}</Text>
          </Pressable>
          <Pressable
            onPress={() => { onApply(draft); onClose(); }}
            style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
              {t('filter.apply', 'लागू करें')}{n != null && Number.isFinite(n) ? ` (${n})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
