import { useCallback, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, FlatList, Pressable, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  Edit2, Trash2,
  BookOpen, Rows3, Church, Building2, ShoppingBag, Users, FileWarning,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';

import { getAllGramPanchayats, type GramPanchayat } from '@/lib/db/gramPanchayatRepo';
import { getAllHamlets, type HamletWithGP } from '@/lib/db/hamletRepo';
import { getAllReligiousPlaces, type ReligiousPlaceWithGP, deleteReligiousPlace } from '@/lib/db/religiousRepo';
import { getAllInstitutions, type SocialInstitutionWithGP, deleteInstitution } from '@/lib/db/institutionRepo';
import { getAllShops, type LiquorShopWithGP, deleteShop } from '@/lib/db/liquorShopRepo';
import {
  getAllImportantPersons, getAllHistorySheeters, type PersonWithGP, deletePerson,
} from '@/lib/db/personRepo';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─── unified list item shape ───────────────────────────────────────────────
interface ListItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  gpId?: string;
  personType?: string;
  extra?: string; // hamlet/majra, hs number etc.
}

// ─── category config ────────────────────────────────────────────────────────
type Category =
  | 'gramPanchayats'
  | 'hamlets'
  | 'religiousPlaces'
  | 'socialInstitutions'
  | 'liquorShops'
  | 'importantPersons'
  | 'historySheeters';

const CATEGORY_META: Record<Category, {
  title: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  emptyMsg: string;
}> = {
  gramPanchayats:    { title: 'Gram Panchayats',    icon: BookOpen,    color: '#2D52B8', emptyMsg: 'No Gram Panchayats added yet'   },
  hamlets:           { title: 'Hamlets / Majre',    icon: Rows3,       color: '#7C3AED', emptyMsg: 'No Hamlets added yet'           },
  religiousPlaces:   { title: 'Religious Places',   icon: Church,      color: '#D97706', emptyMsg: 'No Religious Places added yet'  },
  socialInstitutions:{ title: 'Social Institutions',icon: Building2,   color: '#059669', emptyMsg: 'No Institutions added yet'      },
  liquorShops:       { title: 'Liquor / Beer Shops',icon: ShoppingBag, color: '#DC2626', emptyMsg: 'No Shops added yet'             },
  importantPersons:  { title: 'Important Persons',  icon: Users,       color: '#0891B2', emptyMsg: 'No Important Persons added yet' },
  historySheeters:   { title: 'History Sheeters',   icon: FileWarning, color: '#B91C1C', emptyMsg: 'No History Sheeters added yet'  },
};

// ─── data loaders ─────────────────────────────────────────────────────────
async function loadItems(category: Category): Promise<ListItem[]> {
  switch (category) {
    case 'gramPanchayats': {
      const rows: GramPanchayat[] = await getAllGramPanchayats();
      return rows.map((r) => ({
        id: r.id, title: r.name,
        subtitle: [r.tehsil, r.district].filter(Boolean).join(' · '),
        gpId: r.id,
      }));
    }
    case 'hamlets': {
      const rows: HamletWithGP[] = await getAllHamlets();
      return rows.map((r) => ({
        id: r.id, title: r.name, subtitle: r.gp_name,
        badge: r.population ? `Pop. ${r.population}` : undefined,
        badgeColor: '#7C3AED', gpId: r.gp_id,
      }));
    }
    case 'religiousPlaces': {
      const rows: ReligiousPlaceWithGP[] = await getAllReligiousPlaces();
      return rows.map((r) => ({
        id: r.id, title: r.name, subtitle: r.gp_name,
        badge: r.category, badgeColor: '#D97706', gpId: r.gp_id,
      }));
    }
    case 'socialInstitutions': {
      const rows: SocialInstitutionWithGP[] = await getAllInstitutions();
      return rows.map((r) => ({
        id: r.id, title: r.name, subtitle: r.gp_name,
        badge: r.category, badgeColor: '#059669', gpId: r.gp_id,
      }));
    }
    case 'liquorShops': {
      const rows: LiquorShopWithGP[] = await getAllShops();
      return rows.map((r) => ({
        id: r.id, title: r.shop_name,
        subtitle: `${r.owner_name} · ${r.gp_name}`,
        badge: r.shop_type, badgeColor: '#DC2626', gpId: r.gp_id,
      }));
    }
    case 'importantPersons': {
      const rows: PersonWithGP[] = await getAllImportantPersons();
      return rows.map((r) => ({
        id: r.id, title: r.name, subtitle: r.gp_name,
        badge: r.person_type.replace(/_/g, ' '), badgeColor: '#0891B2',
        gpId: r.gp_id, personType: r.person_type,
      }));
    }
    case 'historySheeters': {
      const rows: PersonWithGP[] = await getAllHistorySheeters();
      return rows.map((r) => ({
        id: r.id, title: r.name,
        subtitle: r.gp_name,
        badge: r.category ? `HS# ${r.category}` : undefined,
        badgeColor: '#B91C1C',
        gpId: r.gp_id,
        personType: r.person_type,
        extra: r.designation ?? undefined,
      }));
    }
  }
}

// ─── categories that support delete ───────────────────────────────────────
const DELETABLE_CATEGORIES = new Set<Category>([
  'religiousPlaces', 'socialInstitutions', 'liquorShops', 'importantPersons', 'historySheeters',
]);

// ─── row component ─────────────────────────────────────────────────────────
function ItemRow({ item, Icon, color, onPress, onEdit, onDelete }: {
  item: ListItem;
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  onPress: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-2xl px-4 py-3.5 flex-row items-center gap-3 active:opacity-70"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon size={16} color={color} />
      </View>

      <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{item.title}</Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>{item.subtitle}</Text>
        {item.extra ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>{item.extra}</Text>
        ) : null}
      </View>

      {item.badge ? (
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${item.badgeColor ?? color}18` }}>
          <Text className="text-xs font-medium capitalize" style={{ color: item.badgeColor ?? color }} numberOfLines={1}>
            {item.badge}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={(e) => { e.stopPropagation?.(); onEdit(); }}
        className="w-8 h-8 rounded-lg items-center justify-center active:opacity-60"
        style={{ backgroundColor: '#2D52B810' }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Edit2 size={13} color="#2D52B8" />
      </Pressable>

      {onDelete ? (
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
          className="w-8 h-8 rounded-lg items-center justify-center active:opacity-60"
          style={{ backgroundColor: '#DC262610' }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Trash2 size={13} color="#DC2626" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// ─── main screen ───────────────────────────────────────────────────────────
export default function AnalyticsListScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = (category as Category) ?? 'gramPanchayats';
  const meta = CATEGORY_META[cat] ?? CATEGORY_META.gramPanchayats;
  const Icon = meta.icon;

  const [allItems, setAllItems] = useState<ListItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // True after the first successful load for this category.
  // Re-focus reloads run silently so the FlatList stays mounted and the
  // user's scroll position is preserved during inter-module navigation.
  const hasDataRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        // Spinner only on first load — subsequent re-focus fetches are silent
        // so the FlatList is never unmounted and scroll position is kept.
        if (!hasDataRef.current) setLoading(true);
        try {
          const items = await loadItems(cat);
          if (cancelled) return;   // discard stale response if screen lost focus
          setAllItems(items);
          hasDataRef.current = true;
        } catch (e) {
          if (!cancelled) logger.warn('[AnalyticsList] Failed to load data:', e);
        } finally {
          // Only update spinner/refresh flags while screen still has focus.
          if (!cancelled) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      })();
      return () => { cancelled = true; };
    }, [cat])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadItems(cat)
      .then((items) => { setAllItems(items); })
      .catch((e) => logger.warn('[AnalyticsList] Refresh failed:', e))
      .finally(() => setRefreshing(false));
  };

  // ── delete state ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<ListItem | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      switch (cat) {
        case 'religiousPlaces':    await deleteReligiousPlace(deleteTarget.id); break;
        case 'socialInstitutions': await deleteInstitution(deleteTarget.id); break;
        case 'liquorShops':        await deleteShop(deleteTarget.id); break;
        case 'importantPersons':   await deletePerson(deleteTarget.id); break;
        case 'historySheeters':    await deletePerson(deleteTarget.id); break;
        default: break;
      }
      setAllItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    } catch (e) {
      logger.warn('[AnalyticsList] Delete failed:', e);
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── filtered list ─────────────────────────────────────────────────────────
  const filtered = query.trim()
    ? allItems.filter(
        (i) =>
          i.title.toLowerCase().includes(query.toLowerCase()) ||
          i.subtitle.toLowerCase().includes(query.toLowerCase()) ||
          (i.badge ?? '').toLowerCase().includes(query.toLowerCase()) ||
          (i.extra ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  // ── row tap → view/edit ───────────────────────────────────────────────────
  const handleRowPress = (item: ListItem) => {
    const gpId = item.gpId;
    switch (cat) {
      case 'gramPanchayats':
        router.push(`/(app)/halka/add-gp?editId=${item.id}` as never); break;
      case 'hamlets':
        if (gpId) router.push(`/(app)/halka/${gpId}/add-hamlet?editId=${item.id}` as never); break;
      case 'religiousPlaces':
        if (gpId) router.push(`/(app)/halka/${gpId}/add-religious?editId=${item.id}` as never); break;
      case 'socialInstitutions':
        if (gpId) router.push(`/(app)/halka/${gpId}/add-institution?editId=${item.id}` as never); break;
      case 'liquorShops':
        if (gpId) router.push(`/(app)/halka/${gpId}/add-shop?editId=${item.id}` as never); break;
      case 'importantPersons':
        if (gpId) router.push(`/(app)/halka/${gpId}/add-person?editId=${item.id}&type=${item.personType ?? 'important'}` as never); break;
      case 'historySheeters':
        if (gpId) router.push(`/(app)/halka/${gpId}/add-person?type=history_sheeter&editId=${item.id}` as never); break;
    }
  };

  // ── edit button ───────────────────────────────────────────────────────────
  const handleEditPress = (item: ListItem) => {
    handleRowPress(item);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={meta.title} subtitle="My Halka"
        showBack
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Search */}
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${meta.title.toLowerCase()}…`}
          variant="navy"
          accessibilityLabel={`Search ${meta.title}`}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={meta.color} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-6 py-4 gap-2.5 pb-10"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <ItemRow
              item={item} Icon={Icon} color={meta.color}
              onPress={() => handleRowPress(item)}
              onEdit={() => handleEditPress(item)}
              onDelete={DELETABLE_CATEGORIES.has(cat) ? () => setDeleteTarget(item) : undefined}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 gap-3">
              <View className="w-14 h-14 rounded-2xl items-center justify-center" style={{ backgroundColor: `${meta.color}12` }}>
                <Icon size={26} color={meta.color} />
              </View>
              <Text className="text-base font-semibold text-foreground">
                {query.trim() ? 'No results found' : meta.emptyMsg}
              </Text>
              {query.trim() ? (
                <Text className="text-sm text-muted-foreground text-center px-8">Try a different search term</Text>
              ) : null}
            </View>
          }
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <Text className="font-semibold text-foreground">{deleteTarget?.title ?? 'this record'}</Text>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

