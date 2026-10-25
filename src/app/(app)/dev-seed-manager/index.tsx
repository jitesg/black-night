/**
 * Developer System Content Manager
 *
 * DEV-ONLY screen — completely absent in production builds.
 * Manages the working copy of bundled seed JSON (Formats + Knowledge).
 * Changes are persisted to AsyncStorage and exportable as JSON.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, Pressable, FlatList, ScrollView,
  ActivityIndicator, Share, Modal, TextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  Plus, Download, Trash2, Edit2,
  FileText, BookOpen, AlertTriangle, Copy, Check, RotateCcw,
  Search, SlidersHorizontal, ArrowUpDown, Shield, Tag,
  Eye, Upload, RefreshCw,
} from 'lucide-react-native';
import { useDevSeedStore, type SeedFormat, type SeedKnowledge } from '@/lib/devSeedStore';
import { isDevSessionActive } from '@/lib/devOptionsAuth';
import { getPerSeedFileStatus, type SeedFileStatus } from '@/lib/db/seedManager';
import { runKnowledgeDiagnostics } from '@/lib/diagnostics/knowledgeDiagnostics';
import { getKnowledgeAnalytics, type KnowledgeAnalytics } from '@/lib/db/knowledgeRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

// ─── Production gate ──────────────────────────────────────────────────────────
// `__DEV__` is false in production builds — the component renders nothing,
// so normal users see a blank screen even if they somehow navigate to this route.
// The route itself is only registered in the Stack when __DEV__ is true (see _layout.tsx).

// ─── Types ────────────────────────────────────────────────────────────────────
type FilterType = 'all' | 'formats' | 'knowledge' | 'sop' | 'checklist' | 'guide';
type SortType   = 'name' | 'version' | 'updated';
type UnifiedItem =
  | (SeedFormat   & { _kind: 'format'   })
  | (SeedKnowledge & { _kind: 'knowledge' });

// ─── Constants ────────────────────────────────────────────────────────────────
const CONTENT_TYPE_LABEL: Record<string, string> = {
  format: 'Format', sop: 'SOP', guide: 'Guide', checklist: 'Checklist',
  court: 'Court', circular: 'Circular', template: 'Template', law: 'Law',
};

const CONTENT_TYPE_COLOR: Record<string, string> = {
  format: '#1E3A5F', sop: '#7C3AED', guide: '#059669',
  checklist: '#D97706', court: '#DC2626', circular: '#0891B2',
  template: '#6B7280', law: '#92400E',
};

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All', formats: 'Formats', knowledge: 'Knowledge',
  sop: 'SOPs', checklist: 'Checklists', guide: 'Guides',
};

const SORT_LABELS: Record<SortType, string> = {
  name: 'Name', version: 'Version', updated: 'Last Updated',
};

// ─── Dashboard stat card ──────────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <View
      className="flex-1 bg-card border border-border rounded-2xl px-3 py-3 gap-0.5 items-center"
      style={{ borderCurve: 'continuous' }}
    >
      <Text className="text-2xl font-bold" style={{ color: accent }}>{value}</Text>
      <Text className="text-xs text-muted-foreground text-center" numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── Export modal ─────────────────────────────────────────────────────────────
function ExportModal({
  visible, onClose, formatsJson, knowledgeJson,
}: {
  visible: boolean;
  onClose: () => void;
  formatsJson: string;
  knowledgeJson: string;
}) {
  const [tab, setTab]     = useState<'formats' | 'knowledge'>('formats');
  const [copied, setCopied] = useState(false);
  const content = tab === 'formats' ? formatsJson : knowledgeJson;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const filename = tab === 'formats' ? 'formats_seed.json' : 'knowledge_seed.json';
    await Share.share({ message: content, title: filename }).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ paddingBottom: NAV_BAR_INSET }} className="flex-1 bg-background">
        <AppHeader
          title="Export Seed JSON"
          actions={
            <>
              <HeaderIconBtn icon={Copy} onPress={handleCopy} label={copied ? 'Copied' : 'Copy'} />
              <HeaderIconBtn icon={Download} onPress={handleShare} label="Share" />
            </>
          }
        />

        <View className="flex-row px-5 pt-4 gap-2">
          {(['formats', 'knowledge'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className="rounded-xl px-4 py-2 active:opacity-70"
              style={{ backgroundColor: tab === t ? '#1E3A5F' : '#F3F4F6' }}
            >
              <Text className="text-sm font-semibold" style={{ color: tab === t ? '#fff' : '#374151' }}>
                {t === 'formats' ? 'formats_seed.json' : 'knowledge_seed.json'}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator>
          <Text selectable className="text-xs text-muted-foreground font-mono leading-5 pb-8">
            {content}
          </Text>
        </ScrollView>

        <View className="px-5 pb-8 pt-3 border-t border-border">
          <Text className="text-xs text-muted-foreground leading-5">
            Copy or share the JSON above, then paste it into{'\n'}
            <Text className="font-semibold text-foreground">
              assets/seed/{tab === 'formats' ? 'formats_seed.json' : 'knowledge_seed.json'}
            </Text>
            {'\n'}before building the next APK / AAB.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ─── Unified item row ─────────────────────────────────────────────────────────
function ItemRow({ item, onEdit, onDelete, onPreview }: {
  item: UnifiedItem;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const isFormat   = item._kind === 'format';
  const ctColor    = CONTENT_TYPE_COLOR[item.content_type] ?? '#6B7280';
  const ctLabel    = CONTENT_TYPE_LABEL[item.content_type] ?? item.content_type;
  const subtitle   = isFormat
    ? `${(item as SeedFormat).format_type} · ${(item as SeedFormat).keys.length} keys`
    : `${(item as SeedKnowledge).category}${(item as SeedKnowledge).subcategory ? ' / ' + (item as SeedKnowledge).subcategory : ''}`;

  return (
    <View
      className="bg-card border border-border rounded-2xl px-4 py-4 mb-2.5 gap-2.5"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Top row */}
      <View className="flex-row items-start gap-3">
        <View
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${ctColor}15` }}
        >
          {isFormat
            ? <FileText size={15} color={ctColor} />
            : <BookOpen size={15} color={ctColor} />}
        </View>
        <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-xs text-muted-foreground">{subtitle}</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable onPress={onPreview} className="p-2 rounded-xl bg-secondary active:opacity-60">
            <Eye size={13} color="#374151" />
          </Pressable>
          <Pressable onPress={onEdit} className="p-2 rounded-xl bg-secondary active:opacity-60">
            <Edit2 size={13} color="#374151" />
          </Pressable>
          <Pressable
            onPress={onDelete}
            className="p-2 rounded-xl active:opacity-60"
            style={{ backgroundColor: '#FEF2F2' }}
          >
            <Trash2 size={13} color="#DC2626" />
          </Pressable>
        </View>
      </View>

      {/* Badge row */}
      <View className="flex-row items-center gap-1.5 flex-wrap">
        {/* Content-type badge */}
        <View className="rounded-full flex-row items-center gap-1 px-2.5 py-1" style={{ backgroundColor: `${ctColor}15` }}>
          <Tag size={9} color={ctColor} />
          <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: ctColor }}>{ctLabel}</Text>
        </View>
        {/* System badge */}
        <View className="rounded-full flex-row items-center gap-1 px-2.5 py-1" style={{ backgroundColor: '#05966910' }}>
          <Shield size={9} color="#059669" />
          <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: '#059669' }}>System</Text>
        </View>
        {/* Version badge */}
        <View className="rounded-full bg-secondary px-2.5 py-1">
          <Text textBreakStrategy="simple" className="text-xs font-medium text-muted-foreground">v{item.seed_version}</Text>
        </View>
        {/* Last updated */}
        <Text className="text-xs text-muted-foreground ml-auto">{item.last_updated}</Text>
      </View>

      {/* UUID */}
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>{item.id}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function DevSeedManagerScreen() {
  useFocusEffect(
    useCallback(() => {
      if (!isDevSessionActive()) {
        router.replace(
          '/(app)/dev-options/pin-entry?returnTo=' +
          encodeURIComponent('/(app)/dev-seed-manager') as never
        );
      }
    }, [])
  );

  const store = useDevSeedStore();

  // UI state
  const [query,        setQuery       ] = useState('');
  const [filter,       setFilter      ] = useState<FilterType>('all');
  const [sort,         setSort        ] = useState<SortType>('name');
  const [showSort,     setShowSort    ] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: 'format' | 'knowledge'; title: string } | null>(null);
  const [showExport,   setShowExport  ] = useState(false);
  const [exportData,   setExportData  ] = useState({ formatsJson: '', knowledgeJson: '' });

  // ── Knowledge Diagnostics (Task L18D) ───────────────────────────────────────
  const [diagReport,   setDiagReport  ] = useState<string>('');
  const [diagLoading,  setDiagLoading ] = useState(false);
  const [diagCopied,   setDiagCopied  ] = useState(false);
  const [mergedCounts, setMergedCounts] = useState<KnowledgeAnalytics>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__runKnowledgeDiagnostics = runKnowledgeDiagnostics;
    }
  }, []);

  const runDiag = useCallback(async () => {
    setDiagLoading(true);
    try {
      const rep = await runKnowledgeDiagnostics();
      setDiagReport(rep);
      const counts = await getKnowledgeAnalytics();
      setMergedCounts(counts);
    } catch (err: any) {
      setDiagReport(`Error running diagnostics: ${err?.message || String(err)}`);
    } finally {
      setDiagLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      runDiag();
    }, [runDiag])
  );

  const handleCopyReport = async () => {
    if (!diagReport) return;
    await Clipboard.setStringAsync(diagReport);
    setDiagCopied(true);
    setTimeout(() => setDiagCopied(false), 2000);
  };

  // Refresh on focus
  useFocusEffect(useCallback(() => {}, []));

  // ── Unified + filtered + sorted list ────────────────────────────────────────
  const filteredItems = useMemo<UnifiedItem[]>(() => {
    const allFormats:   UnifiedItem[] = store.formats.map((f) => ({ ...f, _kind: 'format'    as const }));
    const allKnowledge: UnifiedItem[] = store.knowledge.map((k) => ({ ...k, _kind: 'knowledge' as const }));
    let pool: UnifiedItem[];

    switch (filter) {
      case 'formats':   pool = allFormats;   break;
      case 'knowledge': pool = allKnowledge; break;
      case 'sop':       pool = [...allFormats, ...allKnowledge].filter((i) => i.content_type === 'sop');       break;
      case 'checklist': pool = [...allFormats, ...allKnowledge].filter((i) => i.content_type === 'checklist'); break;
      case 'guide':     pool = [...allFormats, ...allKnowledge].filter((i) => i.content_type === 'guide');     break;
      default:          pool = [...allFormats, ...allKnowledge];
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      pool = pool.filter((i) => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }

    return [...pool].sort((a, b) => {
      if (sort === 'name')    return a.title.localeCompare(b.title);
      if (sort === 'version') return (b.seed_version ?? 1) - (a.seed_version ?? 1);
      // updated — descending
      return (b.last_updated ?? '').localeCompare(a.last_updated ?? '');
    });
  }, [store.formats, store.knowledge, filter, query, sort]);

  const handleExport = () => {
    const data = store.exportSeedJson();
    setExportData(data);
    setShowExport(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'format') store.deleteFormat(deleteTarget.id);
    else store.deleteKnowledge(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (store.loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Seed Manager"
        subtitle={store.stats.lastExportTime ? `Last export: ${store.stats.lastExportTime}` : undefined}
        showBack
        actions={
          <>
            <HeaderIconBtn icon={Upload} onPress={() => router.push('/(app)/dev-seed-manager/import' as never)} label="Import" />
            <HeaderIconBtn icon={Download} onPress={handleExport} label="Export" color="#2563EB" />
          </>
        }
      />

      {/* Dev warning */}
      <View className="flex-row items-center gap-2 mx-4 mt-3 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FEF3C7' }}>
        <AlertTriangle size={11} color="#92400E" />
        <Text className="text-xs leading-4 flex-1" style={{ color: '#92400E' }}>
          Changes saved locally. Export → paste into assets/seed/ before building.
        </Text>
        <Pressable
          onPress={() => setDeleteTarget({ id: '__RESET__', kind: 'format', title: '__RESET__' })}
          className="p-1 active:opacity-60"
        >
          <RotateCcw size={12} color="#92400E" />
        </Pressable>
      </View>

      {/* ── Dashboard stats ───────────────────────────────────────────────── */}
      <View className="px-5 pt-4 pb-1">
        <View className="flex-row gap-2 mb-2">
          <StatCard label="Formats"   value={store.stats.totalFormats}   accent="#1E3A5F" />
          <StatCard label="Knowledge" value={store.stats.totalKnowledge} accent="#7C3AED" />
          <StatCard label="SOPs"      value={store.stats.totalSops}      accent="#059669" />
          <StatCard label="Guides"    value={store.stats.totalGuides}    accent="#D97706" />
        </View>
      </View>

      {/* ── Per-seed-file Loader Status ───────────────────────────────────── */}
      {(() => {
        const seedStatuses = getPerSeedFileStatus();
        if (seedStatuses.length === 0) return null;
        return (
          <View className="px-5 pb-3">
            <View className="bg-card border border-border rounded-xl p-3" style={{ borderCurve: 'continuous' }}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-semibold text-foreground">Seed Loader Engine Status</Text>
                <Text className="text-[10px] text-muted-foreground">{seedStatuses.length} files tracked</Text>
              </View>
              <View className="gap-1.5">
                {seedStatuses.map((st) => (
                  <View key={st.fileName} className="flex-row items-center justify-between py-1 border-b border-border/40">
                    <View className="flex-1 mr-2">
                      <Text className="text-xs font-medium text-foreground" numberOfLines={1}>{st.fileName}</Text>
                      <Text className="text-[10px] text-muted-foreground">
                        Read: {st.entriesRead} • +{st.inserted} ins • ~{st.updated} upd • {st.skipped} skip
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: st.errors > 0 ? '#FEE2E2' : '#DCFCE7',
                          color: st.errors > 0 ? '#DC2626' : '#16A34A',
                        }}
                      >
                        {st.errors > 0 ? `${st.errors} err` : 'OK'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Merged Active Category Counts (Read-Through Layer) */}
              <View className="mt-3 pt-2.5 border-t border-border/50">
                <Text className="text-[11px] font-semibold text-foreground mb-1.5">
                  Merged Category Counts (DB + Bundled)
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {Object.entries(mergedCounts).map(([catName, cnt]) => (
                    <View
                      key={catName}
                      className="flex-row items-center gap-1 bg-secondary rounded-full px-2.5 py-1"
                    >
                      <Text textBreakStrategy="simple" className="text-[10px] text-muted-foreground">{catName}:</Text>
                      <Text textBreakStrategy="simple" className="text-[10px] font-bold text-foreground">{cnt}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        );
      })()}

      {/* ── Knowledge Diagnostics Section (Task L18D) ────────────────────── */}
      <View className="px-5 pb-3">
        <View className="bg-card border border-border rounded-xl p-3" style={{ borderCurve: 'continuous' }}>
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-1.5">
              <Shield size={14} color="#0F766E" />
              <Text className="text-xs font-semibold text-foreground">Knowledge Diagnostics</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={runDiag}
                disabled={diagLoading}
                className="flex-row items-center gap-1 px-2 py-1 rounded bg-secondary active:opacity-70"
              >
                {diagLoading ? (
                  <ActivityIndicator size={10} color="#0F766E" />
                ) : (
                  <RefreshCw size={10} color="#0F766E" />
                )}
                <Text className="text-[10px] font-semibold text-foreground">Refresh</Text>
              </Pressable>
              <Pressable
                onPress={handleCopyReport}
                disabled={!diagReport}
                className="flex-row items-center gap-1 px-2 py-1 rounded active:opacity-70"
                style={{ backgroundColor: diagCopied ? '#DCFCE7' : '#0F766E' }}
              >
                {diagCopied ? (
                  <Check size={10} color="#16A34A" />
                ) : (
                  <Copy size={10} color="#FFFFFF" />
                )}
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: diagCopied ? '#16A34A' : '#FFFFFF' }}
                >
                  {diagCopied ? 'Copied' : 'Copy report'}
                </Text>
              </Pressable>
            </View>
          </View>

          {diagLoading && !diagReport ? (
            <View className="py-4 items-center justify-center">
              <ActivityIndicator size="small" color="#0F766E" />
              <Text className="text-[10px] text-muted-foreground mt-1">Collecting live diagnostics…</Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 220 }}
              nestedScrollEnabled
              className="bg-muted/40 p-2 rounded-lg border border-border/50"
            >
              <Text
                selectable
                className="text-[11px] font-mono text-foreground leading-4"
              >
                {diagReport || 'No diagnostic data collected yet.'}
              </Text>
            </ScrollView>
          )}
        </View>
      </View>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <View className="px-5 pb-2">
        <View
          className="flex-row items-center gap-2 border border-border rounded-xl px-3 py-2.5 bg-card"
          style={{ borderCurve: 'continuous' }}
        >
          <Search size={15} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by title or ID…"
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-sm text-foreground"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* ── Filter + Sort row ─────────────────────────────────────────────── */}
      <View className="pb-2 gap-2">
        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-5 gap-2"
        >
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className="rounded-full active:opacity-70 px-3 py-1.5"
              style={{ backgroundColor: filter === f ? '#1E3A5F' : '#F3F4F6' }}
            >
              <Text textBreakStrategy="simple"
                className="text-xs font-medium"
                style={{ color: filter === f ? '#fff' : '#374151' }}
              >
                {FILTER_LABELS[f]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Sort row */}
        <View className="flex-row items-center px-5 gap-2">
          <SlidersHorizontal size={12} color="#9CA3AF" />
          <Text className="text-xs text-muted-foreground mr-1">Sort:</Text>
          {(Object.keys(SORT_LABELS) as SortType[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSort(s)}
              className="flex-row items-center gap-1 rounded-full active:opacity-70 px-2.5 py-1"
              style={{ backgroundColor: sort === s ? '#374151' : '#F3F4F6' }}
            >
              {sort === s && <ArrowUpDown size={9} color="#fff" />}
              <Text textBreakStrategy="simple"
                className="text-xs font-medium"
                style={{ color: sort === s ? '#fff' : '#374151' }}
              >
                {SORT_LABELS[s]}
              </Text>
            </Pressable>
          ))}
          {/* Result count */}
          <Text className="text-xs text-muted-foreground ml-auto">{filteredItems.length} items</Text>
        </View>
      </View>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <FlatList
          removeClippedSubviews={true}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pb-28 pt-1"
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            onPreview={() => {
              router.push(
                `/(app)/dev-seed-manager/preview?itemId=${item.id}&kind=${item._kind}` as never
              );
            }}
            onEdit={() => {
              if (item._kind === 'format') {
                router.push(`/(app)/dev-seed-manager/edit-format?editId=${item.id}` as never);
              } else {
                router.push(`/(app)/dev-seed-manager/edit-knowledge?editId=${item.id}` as never);
              }
            }}
            onDelete={() => setDeleteTarget({ id: item.id, kind: item._kind, title: item.title })}
          />
        )}
        ListEmptyComponent={
          <View className="items-center py-16 gap-2">
            <FileText size={32} color="#D1D5DB" />
            <Text className="text-muted-foreground text-sm">
              {query ? 'No results for that search' : 'No items'}
            </Text>
          </View>
        }
      />

      {/* ── FAB ───────────────────────────────────────────────────────────── */}
      <View className="absolute bottom-8 right-5 flex-col gap-3 items-end">
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push('/(app)/dev-seed-manager/edit-knowledge' as never)}
            className="flex-row items-center gap-1.5 px-4 py-3 rounded-2xl shadow-md active:opacity-70"
            style={{ backgroundColor: '#92400E' }}
          >
            <BookOpen size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">+ Knowledge</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/dev-seed-manager/edit-format' as never)}
            className="flex-row items-center gap-1.5 px-4 py-3 rounded-2xl shadow-md active:opacity-70"
            style={{ backgroundColor: '#1E3A5F' }}
          >
            <FileText size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">+ Format</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Delete / Reset confirmation ────────────────────────────────────── */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.id === '__RESET__' ? 'Reset to Bundle?' : 'Delete System Content?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.id === '__RESET__'
                ? 'Discard all local changes and reload bundled seed data. This cannot be undone.'
                : `"${deleteTarget?.title}" will be removed from the working copy. Export to apply to the next build.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => {
                if (deleteTarget?.id === '__RESET__') {
                  store.resetToBundle();
                  setDeleteTarget(null);
                } else {
                  confirmDelete();
                }
              }}
              style={{ backgroundColor: '#DC2626' }}
            >
              <Text className="text-white font-semibold">
                {deleteTarget?.id === '__RESET__' ? 'Reset' : 'Delete'}
              </Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Export modal ──────────────────────────────────────────────────── */}
      <ExportModal
        visible={showExport}
        onClose={() => setShowExport(false)}
        formatsJson={exportData.formatsJson}
        knowledgeJson={exportData.knowledgeJson}
      />
    </View>
  );
}
