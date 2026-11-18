/**
 * Shared parts of the "प्रारूप चुनें" screens (owner, sample approved — GD / प्रार्थना पत्र / न्यायालय / निरोधात्मक):
 *  • `useFormatPickFilter` — the ⚙︎ button for the SearchBar, the chosen-filter chips and the FilterSheet (design C, same
 *    FilterSheet as the प्रारूप list), groups / filtering from src/lib/formatPickFilter.ts;
 *  • `FormatPreviewSheet` — 👁 पूरा प्रारूप (blanks as "....") with "प्रारूप भरें →" (the screen's own select action).
 * THEME colours; accent = the module colour.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { BottomSheet } from '@/components/ui/ds/BottomSheet';
import { ActiveFilterChips, FilterSearchButton, FilterSheet, activeFilterCount, type FilterGroupDef, type FilterValues } from '@/components/common/FilterSheet';
import { getFormatTypeLabel } from '@/components/formats/FormatCard';
import { applyPickFilters, pickFilterGroups, type PickFirst, type PickFormat, type PickValues } from '@/lib/formatPickFilter';
import { stripFormatMarkers } from '@/lib/formatMarkers';
import { stripHtmlTags } from '@/lib/stringUtils';

/** Side padding of every format list (owner: one value everywhere). */
export const FORMAT_LIST_PADDING = 20;

export function useFormatPickFilter<T extends PickFormat>(list: readonly T[], accent: string, first?: PickFirst) {
  const { t } = useTranslation();
  const [values, setValues] = useState<FilterValues>({});
  const [open, setOpen] = useState(false);
  const groups = useMemo<FilterGroupDef[]>(
    () => pickFilterGroups(list, (type) => getFormatTypeLabel(type, t), first),
    [list, t, first],
  );
  const filtered = useMemo(() => applyPickFilters(list, values as PickValues, first), [list, values, first]);
  const remove = useCallback((key: string) => setValues((v) => ({ ...v, [key]: null })), []);
  const count = activeFilterCount(values, groups);

  const button = <FilterSearchButton count={count} onPress={() => setOpen(true)} accent={accent} />;
  const chips = <ActiveFilterChips groups={groups} values={values} onRemove={remove} accent={accent} />;
  const sheet = (
    <FilterSheet
      visible={open}
      groups={groups}
      values={values}
      onApply={(v) => { setValues(v); setOpen(false); }}
      onClose={() => setOpen(false)}
      accent={accent}
      previewCount={(v) => applyPickFilters(list, v as PickValues, first).length}
    />
  );
  return { filtered, button, chips, sheet, count };
}

/** 👁 preview of a format: its text with the blanks shown as "....", and "प्रारूप भरें →". */
export function FormatPreviewSheet({ format, onClose, onFill, accent }: {
  format: { title: string; vivran?: string | null } | null;
  onClose: () => void;
  onFill: () => void;
  accent: string;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const text = format?.vivran
    ? stripFormatMarkers(stripHtmlTags(format.vivran)).replace(/\{\{.*?\}\}|<<.*?>>|\[\[.*?\]\]/g, '....')
    : '';
  return (
    <BottomSheet
      visible={!!format}
      onClose={onClose}
      title={format ? t('formatPicker.previewTitleWithFormat', { title: format.title }) : t('formatPicker.previewTitle')}
      snapHeight={520}
    >
      {/* the sheet scrolls by itself — the fill button sits on top so it never needs a long scroll */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
        <Pressable onPress={onFill} accessibilityRole="button" accessibilityLabel="प्रारूप भरें">
          <View style={{ backgroundColor: accent, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>प्रारूप भरें →</Text>
          </View>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 }}>
        <Text style={{ fontSize: 14, lineHeight: 24, color: C.foreground }} selectable>{text}</Text>
      </View>
    </BottomSheet>
  );
}
