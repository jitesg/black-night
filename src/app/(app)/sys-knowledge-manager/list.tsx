/**
 * System Knowledge Manager — Article List
 *
 * Full CRUD: search / category filter / status filter / sort.
 * Actions: publish, unpublish, archive, restore, duplicate, delete, view versions.
 * Supports bulk export / import mode via route params.
 */
import { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus, Search, X, Filter, ChevronDown, MoreVertical,
  Edit2, Copy, Archive, RotateCcw, Trash2, CheckCircle2,
  FileEdit, History, Download, Upload, ChevronRight,
} from 'lucide-react-native';
import {
  getSysKnowledgeList, publishSysKnowledge, unpublishSysKnowledge,
  archiveSysKnowledge, restoreSysKnowledge, deleteSysKnowledge,
  duplicateSysKnowledge, exportSysKnowledgeJSON, importSysKnowledgeJSON,
  type SysKnowledgeArticle, type KnowledgeStatus,
} from '@/lib/db/sysKnowledgeRepo';
import { isDevSessionActive } from '@/lib/devOptionsAuth';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledgeConstants';
import { HighlightText } from '@/components/HighlightText';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const GREEN   = '#059669';
const RED     = '#DC2626';
const MUTED   = '#6B7280';

type SortOption  = 'title' | 'updated' | 'version' | 'status';
type StatusFilter = 'all' | KnowledgeStatus;

const STATUS_COLORS: Record<string, string> = {
  published: GREEN, draft: '#F59E0B', archived: MUTED,
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Action Menu ──────────────────────────────────────────────────────────────
function ActionMenu({
  article, visible, onClose, onAction,
}: {
  article: SysKnowledgeArticle;
  visible: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  if (!visible) return null;
  const actions = [
    { id: 'edit',      label: 'Edit',             icon: Edit2,       color: '#1E3A5F'    },
    { id: 'duplicate', label: 'Duplicate',         icon: Copy,        color: '#7C3AED' },
    { id: 'versions',  label: 'Version History',   icon: History,     color: '#0891B2' },
    article.status === 'published'
      ? { id: 'unpublish', label: 'Move to Draft', icon: FileEdit,  color: '#2563EB' }
      : { id: 'publish',   label: 'Publish',        icon: CheckCircle2, color: GREEN },
    article.status !== 'archived'
      ? { id: 'archive',  label: 'Archive',         icon: Archive,     color: MUTED  }
      : { id: 'restore',  label: 'Restore',         icon: RotateCcw,   color: GREEN  },
    { id: 'delete',    label: 'Delete',             icon: Trash2,      color: RED    },
  ];
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <View className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl overflow-hidden" style={{ paddingBottom: 24 }}>
          <View className="h-1 w-12 rounded-full bg-border self-center mt-3 mb-4" />
          <Text className="text-base font-semibold text-foreground px-5 pb-3" numberOfLines={1}>{article.title}</Text>
          {actions.map(({ id, label, icon: Icon, color }) => (
            <Pressable key={id} onPress={() => { onClose(); onAction(id); }}
              className="flex-row items-center gap-4 px-5 py-4 active:opacity-60">
              <Icon size={18} color={color} />
              <Text className="text-sm font-medium" style={{ color }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Article card ─────────────────────────────────────────────────────────────
function ArticleCard({
  article, query, onMenuPress, onPress,
}: {
  article: SysKnowledgeArticle;
  query: string;
  onMenuPress: () => void;
  onPress: () => void;
}) {
  const statusColor = STATUS_COLORS[article.status] ?? MUTED;
  return (
    <Pressable onPress={onPress} className="bg-card border border-border rounded-2xl p-4 gap-2 active:opacity-70" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-1">
          <HighlightText text={article.title} query={query} style={{ fontSize: 14, fontWeight: '600', lineHeight: 20 }} numberOfLines={2} />
          {!!article.subtitle && (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>{article.subtitle}</Text>
          )}
        </View>
        <Pressable onPress={onMenuPress} className="w-8 h-8 items-center justify-center active:opacity-60">
          <MoreVertical size={18} color={MUTED} />
        </Pressable>
      </View>
      <View className="flex-row items-center gap-2 flex-wrap">
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${statusColor}18` }}>
          <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: statusColor }}>{article.status}</Text>
        </View>
        <Text className="text-xs text-muted-foreground">{article.category}</Text>
        {!!article.subcategory && <Text className="text-xs text-muted-foreground">· {article.subcategory}</Text>}
        <Text className="text-xs text-muted-foreground ml-auto">v{article.version}</Text>
      </View>
      <Text className="text-xs text-muted-foreground">Updated {formatDate(article.updated_at)}</Text>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SysKnowledgeList() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ status?: string; category?: string; mode?: string }>();

  const [articles, setArticles]     = useState<SysKnowledgeArticle[]>([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState('');
  const [statusFilter, setStatus]   = useState<StatusFilter>((params.status as StatusFilter) ?? 'all');
  const [categoryFilter, setCategory] = useState(params.category ?? 'all');
  const [sortBy, setSortBy]         = useState<SortOption>('updated');
  const [filterModal, setFilterModal] = useState(false);
  const [menuArticle, setMenuArticle] = useState<SysKnowledgeArticle | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SysKnowledgeArticle | null>(null);
  const [exportResult, setExportResult]   = useState('');
  const [importResult, setImportResult]   = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSysKnowledgeList({ status: statusFilter, category: categoryFilter, query });
      const sorted = [...data].sort((a, b) => {
        if (sortBy === 'title')   return a.title.localeCompare(b.title);
        if (sortBy === 'version') return b.version - a.version;
        if (sortBy === 'status')  return a.status.localeCompare(b.status);
        return b.updated_at - a.updated_at;
      });
      setArticles(sorted);
    } finally { setLoading(false); }
  }, [statusFilter, categoryFilter, query, sortBy]);

  useFocusEffect(useCallback(() => {
    if (!isDevSessionActive()) { router.replace('/(app)/dev-options/pin-entry' as never); return; }
    load();
  }, [load]));

  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 300);
  };

  const handleAction = async (action: string, article: SysKnowledgeArticle) => {
    try {
      switch (action) {
        case 'edit':
          router.push({ pathname: '/(app)/sys-knowledge-manager/editor' as never, params: { articleId: article.id } });
          break;
        case 'publish':    await publishSysKnowledge(article.id);    await load(); break;
        case 'unpublish':  await unpublishSysKnowledge(article.id);  await load(); break;
        case 'archive':    await archiveSysKnowledge(article.id);    await load(); break;
        case 'restore':    await restoreSysKnowledge(article.id);    await load(); break;
        case 'duplicate':  await duplicateSysKnowledge(article.id);  await load(); break;
        case 'delete':     setConfirmDelete(article); break;
        case 'versions':
          router.push({ pathname: '/(app)/sys-knowledge-manager/[articleId]/versions' as never, params: { articleId: article.id } });
          break;
      }
    } catch { /* handled silently */ }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteSysKnowledge(confirmDelete.id);
    setConfirmDelete(null);
    await load();
  };

  const handleExport = async () => {
    const json = await exportSysKnowledgeJSON();
    setExportResult(`Export ready (${json.length} chars). Copy below:\n\n${json.slice(0, 500)}…`);
  };

  const allCategories = ['all', ...KNOWLEDGE_CATEGORIES.map(c => c.id)];
  const statusOptions: StatusFilter[] = ['all', 'published', 'draft', 'archived'];

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Articles"
        subtitle={`System Knowledge · ${articles.length} items`}
        variant="navy"
        onBack={() => router.back()}
        rightActions={
          <Pressable
            onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/editor' as never, params: { articleId: '' } })}
            className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          >
            <Plus size={20} color="#fff" />
          </Pressable>
        }
      />

      {/* Search + filter bar */}
      <View className="px-4 py-3 gap-2">
        <View className="flex-row items-center gap-2 bg-card border border-border rounded-xl px-3 py-2" style={{ borderCurve: 'continuous' }}>
          <Search size={16} color={MUTED} />
          <Input
            type="search"
            value={query}
            onChangeText={handleSearch}
            placeholder="Search articles, tags, keywords…"
          />
        </View>

        <View className="flex-row gap-2">
          {/* Status filter */}
          <Pressable onPress={() => setFilterModal(true)}
            className="flex-row items-center gap-1 bg-card border border-border rounded-xl px-3 py-2 active:opacity-60"
            style={{ borderCurve: 'continuous' }}>
            <Filter size={13} color={MUTED} />
            <Text className="text-xs text-muted-foreground capitalize">{statusFilter}</Text>
            <ChevronDown size={12} color={MUTED} />
          </Pressable>
          {/* Category filter */}
          <Pressable onPress={() => setFilterModal(true)}
            className="flex-1 flex-row items-center gap-1 bg-card border border-border rounded-xl px-3 py-2 active:opacity-60"
            style={{ borderCurve: 'continuous' }}>
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
            </Text>
            <ChevronDown size={12} color={MUTED} />
          </Pressable>
          {/* Export */}
          <Pressable onPress={handleExport}
            className="bg-card border border-border rounded-xl px-3 py-2 items-center justify-center active:opacity-60"
            style={{ borderCurve: 'continuous' }}>
            <Download size={15} color={MUTED} />
          </Pressable>
        </View>
      </View>

      {/* Filter modal */}
      <Modal visible={filterModal} transparent animationType="slide" onRequestClose={() => setFilterModal(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setFilterModal(false)}>
          <View className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl overflow-hidden" style={{ paddingBottom: 32 }}>
            <View className="h-1 w-12 rounded-full bg-border self-center mt-3 mb-4" />
            <Text className="text-base font-semibold text-foreground px-5 pb-2">Filter</Text>

            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-5 mb-2">Status</Text>
            <View className="flex-row flex-wrap gap-2 px-5 mb-4">
              {statusOptions.map(s => (
                <Pressable key={s} onPress={() => { setStatus(s); setFilterModal(false); load(); }}
                  className="rounded-full border active:opacity-70 px-3 py-1.5"
                  style={{ borderColor: statusFilter === s ? '#1E3A5F' : '#E5E7EB', backgroundColor: statusFilter === s ? '#1E3A5F' : 'transparent' }}>
                  <Text textBreakStrategy="simple" className="text-xs capitalize" style={{ color: statusFilter === s ? '#fff' : MUTED }}>{s}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-5 mb-2">Category</Text>
            <View className="flex-row flex-wrap gap-2 px-5 pb-4">
              {allCategories.map(c => (
                <Pressable key={c} onPress={() => { setCategory(c); setFilterModal(false); load(); }}
                  className="rounded-full border active:opacity-70 px-3 py-1.5"
                  style={{ borderColor: categoryFilter === c ? '#1E3A5F' : '#E5E7EB', backgroundColor: categoryFilter === c ? '#1E3A5F' : 'transparent' }}>
                  <Text textBreakStrategy="simple" className="text-xs capitalize" style={{ color: categoryFilter === c ? '#fff' : MUTED }}>
                    {c === 'all' ? 'All' : c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Article list */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color='#1E3A5F' />
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          data={articles}
          keyExtractor={a => a.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}
          ListEmptyComponent={
            <View className="items-center py-16 gap-3">
              <Text className="text-base font-semibold text-foreground">No articles found</Text>
              <Text className="text-sm text-muted-foreground text-center">
                {query ? 'Try a different search.' : 'Create your first system knowledge article.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ArticleCard
              article={item}
              query={query}
              onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/editor' as never, params: { articleId: item.id } })}
              onMenuPress={() => setMenuArticle(item)}
            />
          )}
        />
      )}

      {/* Action menu */}
      {menuArticle && (
        <ActionMenu
          article={menuArticle}
          visible
          onClose={() => setMenuArticle(null)}
          onAction={(a) => handleAction(a, menuArticle)}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setConfirmDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onPress={handleDelete} style={{ backgroundColor: RED }}>
              <Text className="text-white text-sm font-semibold">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export result */}
      <Modal visible={!!exportResult} transparent animationType="fade" onRequestClose={() => setExportResult('')}>
        <View className="flex-1 bg-black/50 items-center justify-center px-5">
          <View className="bg-card rounded-2xl p-5 gap-4 w-full" style={{ maxHeight: 400 }}>
            <Text className="text-base font-semibold text-foreground">Export Preview</Text>
            <Text className="text-xs text-muted-foreground">{exportResult}</Text>
            <Pressable onPress={() => setExportResult('')}
              className="bg-primary rounded-xl py-3 items-center active:opacity-70">
              <Text className="text-primary-foreground text-sm font-semibold">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
