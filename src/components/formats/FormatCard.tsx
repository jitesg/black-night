/**
 * FormatCard — the format card of the Predefined Formats screen, shared with the
 * "प्रारूप से जोड़ें" pickers (GD / निरोधात्मक / न्यायालय / प्रार्थना पत्र) so both look the same.
 */
import { memo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Star, Eye, Clock, Edit2, Trash2, Shield, User } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import { HighlightText } from '@/components/HighlightText';
import { Pill } from '@/components/ui/ds/Pill';
import type { FormatWithMeta } from '@/lib/db/predefinedFormatRepo';

const INDIGO = '#6366F1';
// One colour per format type (7 types), light + dark shade so the pill reads on both themes.
// Kept apart from the System (blue) and User (green) pills in the same footer.
export const FORMAT_TYPE_COLORS: Record<string, { light: string; dark: string }> = {
  'GD':              { light: '#4F46E5', dark: '#A5B4FC' }, // indigo
  'Case Diary':      { light: '#9333EA', dark: '#D8B4FE' }, // purple
  'Narrative':       { light: '#0F766E', dark: '#5EEAD4' }, // teal
  'Nyayalay':        { light: '#B45309', dark: '#FCD34D' }, // amber
  'Prarthna Patra':  { light: '#BE185D', dark: '#F9A8D4' }, // pink
  'BNSS Karyavahi':  { light: '#DC2626', dark: '#FCA5A5' }, // red
  'Any':             { light: '#475569', dark: '#CBD5E1' }, // slate
};

export function formatTypeColor(type: string, isDark: boolean): string {
  const c = FORMAT_TYPE_COLORS[type] ?? FORMAT_TYPE_COLORS.Any;
  return isDark ? c.dark : c.light;
}

function formatDate(ts?: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getFormatTypeLabel(type: string, t: (k: string) => string): string {
  switch (type) {
    case 'GD': return t('format.type.gd');
    case 'Case Diary': return t('format.type.caseDiary');
    case 'Narrative': return t('format.type.narrative');
    case 'Nyayalay': return t('format.type.nyayalay');
    case 'Prarthna Patra': return t('format.type.prarthnaPatra');
    case 'BNSS Karyavahi': return t('format.type.bnssKaryavahi');
    case 'Any': return t('format.type.any');
    default: return type;
  }
}

// ─── Format Card ──────────────────────────────────────────────────────────
export const FormatCard = memo(function FormatCard({
  format, query, onPress, onFavorite, onPreview, onEdit, onDelete,
}: {
  format: FormatWithMeta;
  query: string;
  onPress: () => void;
  /** Without it the star is only shown (filled) for favourites. */
  onFavorite?: () => void;
  onPreview?: () => void;
  /** Edit/Delete appear only on user formats when both are given. */
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const isSystem = format.source === 'system';
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const isDark = colorScheme === 'dark';
  const palette = colorScheme === 'dark' ? THEME.dark : THEME.light;

  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-2xl p-4 gap-3 active:opacity-75"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Top row */}
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
          <HighlightText
            text={format.title}
            query={query}
            numberOfLines={2}
            style={{ fontSize: 14, fontWeight: '600', lineHeight: 20, flexShrink: 1 }}
          />
        </View>
        {/* Eye preview — 44dp touch target via padding + hitSlop */}
        {onPreview ? <Pressable
          onPress={onPreview}
          className="items-center justify-center active:opacity-60"
          style={{ width: 36, height: 36 }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityLabel={t('format.list.previewAccessibility')}
          accessibilityRole="button"
        >
          <Eye size={18} color={INDIGO} />
        </Pressable> : null}
        {/* Favorite star — 44dp touch target */}
        {onFavorite || format.is_favorite ? <Pressable
          onPress={onFavorite}
          disabled={!onFavorite}
          className="items-center justify-center active:opacity-60"
          style={{ width: 36, height: 36 }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityLabel={format.is_favorite ? t('format.list.removeFromFavorites') : t('format.list.addToFavorites')}
          accessibilityRole="button"
        >
          <Star
            size={18}
            color={format.is_favorite ? '#D97706' : palette.mutedForeground}
            fill={format.is_favorite ? '#D97706' : 'none'}
          />
        </Pressable> : null}
      </View>
      {/* Tags */}
      {format.tags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {format.tags.slice(0, 6).map((tag, idx) => (
            <Pill key={`${idx}-${tag}`} label={tag} />
          ))}
        </ScrollView>
      )}
      {/* Footer — date + source badge; user cards add edit/delete actions */}
      <View className="flex-row items-center justify-start gap-2">
        <View className="flex-row items-center gap-1.5" style={{ flex: 1, minWidth: 0 }}>
          <Clock size={11} color={palette.mutedForeground} />
          {/* muted-foreground: #6B7280 light / #94A3B8 dark — both ≥4.5:1 on their card bg ✓ */}
          <Text className="text-xs text-muted-foreground">
            {format.last_used_at ? t('format.list.usedDate', { date: formatDate(format.last_used_at) }) : t('format.list.addedDate', { date: formatDate(format.created_at) })}
          </Text>
          {/* System/User + type: same compact pill look, only the colour differs */}
          <Pill
            size="xs"
            label={isSystem ? t('header.system') : t('header.user')}
            color={isSystem ? (isDark ? '#93C5FD' : '#1D4ED8') : (isDark ? '#6EE7B7' : '#059669')}
            icon={isSystem
              ? <Shield size={10} color={isDark ? '#93C5FD' : '#1D4ED8'} />
              : <User size={10} color={isDark ? '#6EE7B7' : '#059669'} />}
          />
          <Pill size="xs" label={getFormatTypeLabel(format.format_type, t)} color={formatTypeColor(format.format_type, isDark)} style={{ flexShrink: 1 }} />
        </View>
        {/* User templates only: Edit + Delete — 44dp touch targets */}
        {!isSystem && onEdit && onDelete && (
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={onEdit}
              className="items-center justify-center active:opacity-60"
              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${INDIGO}18` }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityLabel={t('format.list.editAccessibility')}
              accessibilityRole="button"
            >
              <Edit2 size={14} color={INDIGO} />
            </Pressable>
            <Pressable
              onPress={onDelete}
              className="items-center justify-center active:opacity-60"
              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#DC262610' }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityLabel={t('format.list.deleteAccessibility')}
              accessibilityRole="button"
            >
              <Trash2 size={14} color="#DC2626" />
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
});

