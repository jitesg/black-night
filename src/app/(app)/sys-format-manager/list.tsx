/**
 * System Format Manager — Format List
 * Full CRUD with search / filter / sort + status actions.
 * Visual redesign: Minimal template — airy whitespace, clear hierarchy, restrained palette.
 */
import { useCallback, useState, useRef } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, SlidersHorizontal, MoreVertical,
  Edit2, Eye, Copy, Archive, RotateCcw, Trash2, CheckCircle2,
  FileEdit, History, ClipboardList, Download, X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  getSysFormats, publishFormat, unpublishFormat, archiveFormat,
  restoreFormat, softDeleteSysFormat, type SysFormatExtended, type FormatStatus,
  SYS_CATEGORIES,
} from '@/lib/db/sysFormatRepo';
import { duplicateFormat } from '@/lib/db/predefinedFormatRepo';
import { isSessionActive, touchSession } from '@/lib/sysFormatAuth';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import * as Clipboard from 'expo-clipboard';
import { exportFormatsAsSeedJSON } from '@/lib/db/seedManager';
import { HighlightText } from '@/components/HighlightText';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

type SortOption = 'title' | 'updated' | 'version' | 'status';
type StatusFilter = 'all' | FormatStatus;

// ── Design tokens (scoped to this screen) ────────────────────────────────────
const ACCENT = '#1C2B4A';          // dark navy — primary accent
const ACCENT_LIGHT = '#EEF1F6';    // very light navy tint for selected backgrounds
const STATUS_DOT: Record<string, string> = {
  published: '#16A34A',
  draft:     '#D97706',
  archived:  '#9CA3AF',
};
const STATUS_BG: Record<string, string> = {
  published: '#F0FDF4',
  draft:     '#FFFBEB',
  archived:  '#F9FAFB',
};
const STATUS_TEXT: Record<string, string> = {
  published: '#15803D',
  draft:     '#B45309',
  archived:  '#6B7280',
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Action Menu ─────────────────────────────────────────────────────────────
function ActionMenu({
  format, visible, onClose, onAction,
}: {
  format: SysFormatExtended | null;
  visible: boolean;
  onClose: () => void;
  onAction: (action: string, format: SysFormatExtended) => void;
}) {
  const { t } = useTranslation();
  if (!format) return null;
  const status = format.status ?? 'published';

  const actions: { id: string; label: string; icon: typeof Edit2; danger?: boolean }[] = [
    { id: 'edit',      label: t('sysFormat.list.actionEdit'),      icon: Edit2 },
    { id: 'preview',   label: t('sysFormat.list.actionPreview'),   icon: Eye },
    { id: 'versions',  label: t('sysFormat.list.actionVersions'),  icon: History },
    { id: 'audit',     label: t('sysFormat.list.actionAudit'),     icon: ClipboardList },
    { id: 'duplicate', label: t('sysFormat.list.actionDuplicate'), icon: Copy },
    ...(status !== 'published' ? [{ id: 'publish',   label: t('sysFormat.list.actionPublish'),   icon: CheckCircle2 }] : []),
    ...(status === 'published' ? [{ id: 'unpublish', label: t('sysFormat.list.actionUnpublish'), icon: FileEdit }] : []),
    ...(status !== 'archived'  ? [{ id: 'archive',   label: t('sysFormat.list.actionArchive'),   icon: Archive }] : []),
    ...(status === 'archived'  ? [{ id: 'restore',   label: t('sysFormat.list.actionRestore'),   icon: RotateCcw }] : []),
    { id: 'delete', label: t('sysFormat.list.actionDelete'), icon: Trash2, danger: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ paddingBottom: NAV_BAR_INSET, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose}>
        <View
          className="absolute bottom-0 left-0 right-0 bg-card overflow-hidden"
          style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
        >
          {/* Sheet handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-9 h-1 rounded-full bg-border" />
          </View>

          {/* Format identity */}
          <View className="px-5 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text
                  className="text-base font-semibold text-foreground"
                  numberOfLines={2}
                  style={{ color: '#111827', lineHeight: 22 }}
                >
                  {format.title}
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  {format.format_type} · v{format.version}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="w-7 h-7 rounded-full items-center justify-center active:opacity-60"
                style={{ backgroundColor: '#F3F4F6', marginTop: 2 }}
              >
                <X size={14} color="#6B7280" />
              </Pressable>
            </View>
          </View>

          {/* Actions — two groups separated by a thin rule before delete */}
          <View className="py-1">
            {actions.map((a, i) => {
              const Icon = a.icon;
              const isDelete = a.danger;
              const prevWasNotDanger = i > 0 && !actions[i - 1].danger;
              return (
                <View key={a.id}>
                  {isDelete && prevWasNotDanger && (
                    <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 }} />
                  )}
                  <Pressable
                    onPress={() => { onAction(a.id, format); onClose(); }}
                    className="flex-row items-center gap-3.5 px-5 active:bg-muted"
                    style={{ paddingVertical: 13 }}
                  >
                    <View
                      className="w-8 h-8 rounded-lg items-center justify-center"
                      style={{ backgroundColor: isDelete ? '#FEF2F2' : '#F9FAFB' }}
                    >
                      <Icon size={15} color={isDelete ? '#DC2626' : ACCENT} />
                    </View>
                    <Text
                      className="text-sm font-medium"
                      style={{ color: isDelete ? '#DC2626' : '#111827' }}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          {/* Bottom safe-area pad */}
          <View style={{ height: 28 }} />
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Format Row ───────────────────────────────────────────────────────────────
function FormatRow({
  format, query, onPress, onMenu,
}: {
  format: SysFormatExtended;
  query: string;
  onPress: () => void;
  onMenu: () => void;
}) {
  const status = format.status ?? 'published';
  const dotColor  = STATUS_DOT[status]  ?? '#9CA3AF';
  const bgColor   = STATUS_BG[status]   ?? '#F9FAFB';
  const textColor = STATUS_TEXT[status] ?? '#6B7280';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 bg-card active:bg-muted"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
      }}
    >
      {/* Status indicator strip */}
      <View
        className="w-1 rounded-full self-stretch"
        style={{ backgroundColor: dotColor, minHeight: 38 }}
      />

      {/* Main content */}
      <View className="flex-1 gap-1.5">
        {/* Title row */}
        <View className="flex-row items-center gap-2">
          <HighlightText
            text={format.title}
            query={query}
            style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}
            numberOfLines={1}
          />
          {/* Status badge */}
          <View
            className="px-2 py-0.5 rounded"
            style={{ backgroundColor: bgColor }}
          >
            <Text className="text-xs font-medium capitalize" style={{ color: textColor }}>
              {status}
            </Text>
          </View>
        </View>

        {/* Meta row */}
        <View className="flex-row items-center gap-1.5 flex-wrap">
          <Text className="text-xs" style={{ color: '#9CA3AF' }}>{format.format_type}</Text>
          {format.sys_category ? (
            <>
              <Text className="text-xs" style={{ color: '#D1D5DB' }}>·</Text>
              <Text className="text-xs" style={{ color: '#9CA3AF' }}>{format.sys_category}</Text>
            </>
          ) : null}
          <Text className="text-xs" style={{ color: '#D1D5DB' }}>·</Text>
          <Text className="text-xs" style={{ color: '#9CA3AF' }}>v{format.version}</Text>
          <Text className="text-xs" style={{ color: '#D1D5DB' }}>·</Text>
          <Text className="text-xs" style={{ color: '#9CA3AF' }}>{formatDate(format.updated_at)}</Text>
        </View>

        {/* Tags */}
        {format.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1">
            {format.tags.slice(0, 4).map((tag, idx) => (
              <View
                key={`${idx}-${tag}`}
                className="px-2 py-0.5 rounded"
                style={{ backgroundColor: '#F3F4F6' }}
              >
                <Text className="text-xs" style={{ color: '#6B7280' }}>{tag}</Text>
              </View>
            ))}
            {format.tags.length > 4 && (
              <Text className="text-xs self-center" style={{ color: '#9CA3AF' }}>
                +{format.tags.length - 4}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Menu trigger */}
      <Pressable
        onPress={onMenu}
        hitSlop={8}
        className="w-8 h-8 items-center justify-center rounded-lg active:bg-gray-100"
      >
        <MoreVertical size={17} color="#9CA3AF" />
      </Pressable>
    </Pressable>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────
function FilterPanel({
  categoryFilter, setCat, sortBy, setSortBy,
}: {
  categoryFilter: string;
  setCat: (c: string) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
}) {
  const { t } = useTranslation();
  return (
    <View
      className="mx-4 mb-3"
      style={{
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 14,
        gap: 12,
      }}
    >
      {/* Category */}
      <View className="gap-2">
        <Text
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: '#9CA3AF', letterSpacing: 0.8 }}
        >
          {t('sysFormat.list.filterCategory')}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {['', ...SYS_CATEGORIES].map((cat) => {
            const active = categoryFilter === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCat(cat)}
                className="rounded-md px-2.5 py-1 active:opacity-70"
                style={{
                  backgroundColor: active ? ACCENT : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: active ? ACCENT : 'transparent',
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: active ? '#fff' : '#374151' }}
                >
                  {cat || t('sysFormat.list.filterAll')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#E5E7EB' }} />

      {/* Sort */}
      <View className="gap-2">
        <Text
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: '#9CA3AF', letterSpacing: 0.8 }}
        >
          {t('sysFormat.list.filterSortBy')}
        </Text>
        <View className="flex-row gap-1.5 flex-wrap">
          {(['updated', 'title', 'version', 'status'] as SortOption[]).map((s) => {
            const active = sortBy === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSortBy(s)}
                className="rounded-md px-2.5 py-1 active:opacity-70"
                style={{
                  backgroundColor: active ? ACCENT_LIGHT : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: active ? ACCENT : 'transparent',
                }}
              >
                <Text
                  className="text-xs font-medium capitalize"
                  style={{ color: active ? ACCENT : '#374151' }}
                >
                  {s}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SysFormatListScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ status?: string }>();

  const [formats, setFormats]         = useState<SysFormatExtended[]>([]);
  const [loading, setLoading]         = useState(true);
  const [query, setQuery]             = useState('');
  const [statusFilter, setStatus]     = useState<StatusFilter>((params.status as StatusFilter) ?? 'all');
  const [categoryFilter, setCat]      = useState('');
  const [sortBy, setSortBy]           = useState<SortOption>('updated');
  const [showFilters, setShowFilters] = useState(false);

  const [menuFormat, setMenuFormat]       = useState<SysFormatExtended | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<SysFormatExtended | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exporting, setExporting]         = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(useCallback(() => {
    if (!isSessionActive()) {
      router.replace('/(app)/sys-format-manager' as never);
      return;
    }
    touchSession();
    loadFormats();
  }, [statusFilter, categoryFilter, sortBy]));

  async function loadFormats(q = query) {
    setLoading(true);
    try {
      const data = await getSysFormats({
        status: statusFilter,
        category: categoryFilter || undefined,
        query: q || undefined,
        sortBy,
      });
      setFormats(data);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(text: string) {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadFormats(text), 300);
  }

  async function handleAction(action: string, format: SysFormatExtended) {
    touchSession();
    if (action === 'edit') {
      router.push({ pathname: '/(app)/sys-format-manager/editor' as never, params: { editId: format.id } });
      return;
    }
    if (action === 'preview') {
      router.push({ pathname: '/(app)/sys-format-manager/preview' as never, params: { id: format.id } });
      return;
    }
    if (action === 'versions') {
      router.push({ pathname: `/(app)/sys-format-manager/${format.id}/versions` as never });
      return;
    }
    if (action === 'audit') {
      router.push({ pathname: `/(app)/sys-format-manager/${format.id}/audit` as never });
      return;
    }
    if (action === 'delete') { setDeleteTarget(format); return; }

    setActionLoading(format.id);
    try {
      if (action === 'publish')   await publishFormat(format.id);
      if (action === 'unpublish') await unpublishFormat(format.id);
      if (action === 'archive')   await archiveFormat(format.id);
      if (action === 'restore')   await restoreFormat(format.id);
      if (action === 'duplicate') await duplicateFormat(format.id);
      await loadFormats();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id);
    try {
      await softDeleteSysFormat(deleteTarget.id);
      setDeleteTarget(null);
      await loadFormats();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExportSeedJSON() {
    if (!__DEV__) return;
    setExporting(true);
    try {
      const json = await exportFormatsAsSeedJSON();
      await Clipboard.setStringAsync(json);
      console.log('[SysFormatList] Seed JSON copied to clipboard ✓');
    } catch (e) {
      console.error('[SysFormatList] Export failed:', e);
    } finally {
      setExporting(false);
    }
  }

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all',       label: t('sysFormat.list.statusAll')       },
    { key: 'published', label: t('sysFormat.list.statusPublished') },
    { key: 'draft',     label: t('sysFormat.list.statusDraft')     },
    { key: 'archived',  label: t('sysFormat.list.statusArchived')  },
  ];

  return (
    <View className="flex-1 bg-background">

      {/* Header */}
      <AppHeader
        title={t('sysFormat.list.title')}
        subtitle={t('sysFormat.list.subtitle')}
        showBack
        actions={
          <>
            {__DEV__ && (
              <HeaderIconBtn
                icon={Download}
                onPress={handleExportSeedJSON}
                label={t('sysFormat.list.exportSeed')}
                color={exporting ? '#9CA3AF' : '#059669'}
              />
            )}
            <HeaderIconBtn
              icon={SlidersHorizontal}
              onPress={() => setShowFilters((v) => !v)}
              label={t('sysFormat.list.filterToggle')}
              color={showFilters ? ACCENT : '#6B7280'}
            />
          </>
        }
      />

      {/* Search bar */}
      <View
        className="px-4 py-2.5"
        style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
      >
        <View
          className="flex-row items-center gap-2 px-3"
          style={{
            height: 38,
            backgroundColor: '#F9FAFB',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
        >
          <Search size={14} color="#9CA3AF" />
          <Input
            type="search"
            value={query}
            onChangeText={handleSearch}
            placeholder={t('sysFormat.list.searchPlaceholder')}
          />
        </View>
      </View>

      {/* Status tabs — underline style */}
      <View
        className="flex-row px-4"
        style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
      >
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setStatus(tab.key)}
              className="mr-1 py-2.5 px-1 active:opacity-70"
              style={{
                borderBottomWidth: 2,
                borderBottomColor: active ? ACCENT : 'transparent',
                marginBottom: -1,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: active ? ACCENT : '#9CA3AF' }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* DEV export banner */}
      {__DEV__ && (
        <Pressable
          onPress={handleExportSeedJSON}
          disabled={exporting}
          className="mx-4 mt-2 flex-row items-center gap-2 px-3 py-2 rounded-lg active:opacity-70"
          style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}
        >
          <Download size={13} color="#16A34A" />
          <Text className="text-xs font-medium flex-1" style={{ color: '#15803D' }}>
            {exporting ? t('sysFormat.list.devExporting') : t('sysFormat.list.devExportBanner')}
          </Text>
        </Pressable>
      )}

      {/* Filter panel */}
      {showFilters && (
        <View className="mt-2">
          <FilterPanel
            categoryFilter={categoryFilter}
            setCat={setCat}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : formats.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-10">
          <View
            className="w-16 h-16 rounded-2xl items-center justify-center"
            style={{ backgroundColor: '#F9FAFB' }}
          >
            <FileEdit size={28} color="#D1D5DB" />
          </View>
          <Text
            className="text-sm font-semibold text-center"
            style={{ color: '#374151' }}
          >
            {t('sysFormat.list.noFormatsFound')}
          </Text>
          <Text className="text-xs text-center" style={{ color: '#9CA3AF' }}>
            {query ? t('sysFormat.list.noFormatsHint') : t('sysFormat.list.noFormatsHintCreate')}
          </Text>
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          data={formats}
          keyExtractor={(f) => f.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: 96 }}
          renderItem={({ item }) => (
            <View style={{ opacity: actionLoading === item.id ? 0.45 : 1 }}>
              <FormatRow
                format={item}
                query={query}
                onPress={() => {
                  touchSession();
                  router.push({ pathname: '/(app)/sys-format-manager/editor' as never, params: { editId: item.id } });
                }}
                onMenu={() => setMenuFormat(item)}
              />
            </View>
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => { touchSession(); router.push('/(app)/sys-format-manager/editor' as never); }}
        className="absolute bottom-7 right-5 items-center justify-center active:opacity-75 shadow-md shadow-black/25"
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: ACCENT,
        }}
      >
        <Plus size={22} color="#fff" strokeWidth={2.5} />
      </Pressable>

      {/* Action menu */}
      <ActionMenu
        format={menuFormat}
        visible={!!menuFormat}
        onClose={() => setMenuFormat(null)}
        onAction={handleAction}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sysFormat.list.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sysFormat.list.deleteDesc', { title: deleteTarget?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Text>{t('sysFormat.list.cancel')}</Text></AlertDialogCancel>
            <AlertDialogAction onPress={handleDelete}><Text>{t('sysFormat.list.delete')}</Text></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
