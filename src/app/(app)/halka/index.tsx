import { useCallback, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, BackHandler, FlatList, Pressable, Text, View, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Plus, Search, BookOpen, Users, ChevronRight,
  MapPin, Building2, ShoppingBag, Church, Rows3, FileWarning, Eye,
} from 'lucide-react-native';
import { getAnalytics, getAllGramPanchayats, type GramPanchayat } from '@/lib/db/gramPanchayatRepo';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';

const STAT_CONFIG = [
  { key: 'totalGP',               label: 'Gram\nPanchayats',    icon: BookOpen,     color: '#2D52B8', category: 'gramPanchayats'    },
  { key: 'totalHamlets',          label: 'Hamlets /\nMajre',    icon: Rows3,        color: '#7C3AED', category: 'hamlets'           },
  { key: 'totalReligiousPlaces',  label: 'Religious\nPlaces',   icon: Church,       color: '#D97706', category: 'religiousPlaces'   },
  { key: 'totalInstitutions',     label: 'Social\nInstitutions',icon: Building2,    color: '#059669', category: 'socialInstitutions'},
  { key: 'totalLiquorShops',      label: 'Liquor /\nBeer Shops',icon: ShoppingBag,  color: '#DC2626', category: 'liquorShops'       },
  { key: 'totalImportantPersons', label: 'Important\nPersons',  icon: Users,        color: '#0891B2', category: 'importantPersons'  },
  { key: 'totalHistorySheeters',  label: 'History\nSheeters',   icon: FileWarning,  color: '#B91C1C', category: 'historySheeters'   },
  { key: 'totalSurveillance',     label: 'Surveillance',        icon: Eye,          color: '#E11D48', category: 'surveillance'      },
] as const;

type Analytics = Record<typeof STAT_CONFIG[number]['key'], number>;

function AnalyticsCard({ item, value, width }: { item: (typeof STAT_CONFIG)[number]; value: number; width: number }) {
  const Icon = item.icon;
  return (
    <Pressable
      onPress={() =>
        item.category === 'surveillance'
          ? router.push('/(app)/halka/surveillance' as never)
          : router.push(`/(app)/halka/analytics?category=${item.category}` as never)
      }
      className="bg-card border border-border rounded-xl p-2 items-center gap-1 active:opacity-70"
      style={{ borderCurve: 'continuous', width }}
    >
      <View className="w-6 h-6 rounded-md items-center justify-center" style={{ backgroundColor: `${item.color}18` }}>
        <Icon size={13} color={item.color} />
      </View>
      <Text className="text-lg font-bold text-foreground">{value}</Text>
      <Text className="text-[10px] text-muted-foreground text-center leading-3">{item.label}</Text>
    </Pressable>
  );
}

function GPCard({ gp }: { gp: GramPanchayat }) {
  return (
    <Pressable
      onPress={() => router.push(`/(app)/halka/${gp.id}` as never)}
      className="bg-card border border-border rounded-2xl px-5 py-4 flex-row items-center gap-4 active:opacity-70"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="w-10 h-10 rounded-xl bg-accent items-center justify-center">
        <BookOpen size={18} color="#2D52B8" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">{gp.name}</Text>
        <Text className="text-sm text-muted-foreground mt-0.5 flex-row items-center">
          <Text>{gp.tehsil}</Text>
          {gp.district ? <Text> · {gp.district}</Text> : null}
        </Text>
      </View>
      <ChevronRight size={16} color="#9CA3AF" />
    </Pressable>
  );
}

export default function HalkaHomeScreen() {
  const { workspace } = useWorkspace();
  const { width: screenWidth } = useWindowDimensions();
  // GRID_HORIZONTAL_PADDING matches px-6 (24px * 2) on the FlatList's contentContainerClassName; update if padding changes
  const GRID_HORIZONTAL_PADDING = 24 * 2;
  const GRID_GAP = 12; // matches gap-3 on the grid row
  const cardWidth = Math.floor((screenWidth - GRID_HORIZONTAL_PADDING - GRID_GAP) / 2);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalGP: 0, totalHamlets: 0, totalReligiousPlaces: 0,
    totalInstitutions: 0, totalLiquorShops: 0, totalImportantPersons: 0,
    totalHistorySheeters: 0, totalSurveillance: 0,
  });
  const [gps, setGps] = useState<GramPanchayat[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const [a, list] = await Promise.all([getAnalytics(), getAllGramPanchayats()]);
          if (!cancelled) {
            setAnalytics(a);
            setGps(list);
          }
        } catch (e) {
          logger.warn('[Halka] Failed to load data:', e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  // Back → Dashboard: module root screens always return to home, never exit app.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(app)/home' as never);
      return true;
    });
    return () => sub.remove();
  }, []));

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AppHeader
        title="My Halka"
        subtitle="Beat Book"
        countLabel={workspace.halka ? `${workspace.halka}${workspace.beat ? ` · Beat: ${workspace.beat}` : ''}` : undefined}
        variant="navy"
        onMenuPress={() => setDrawerOpen(true)}
        rightActions={
          <>
            <Pressable
              onPress={() => router.push('/(app)/halka/search' as never)}
              className="w-9 h-9 rounded-xl items-center justify-center active:opacity-60"
              style={{ backgroundColor: '#ffffff18' }}
            >
              <Search size={17} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/halka/add-gp' as never)}
              className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-70"
              style={{ backgroundColor: '#2563EB' }}
            >
              <Plus size={15} color="#fff" />
              <Text className="text-xs font-bold text-white">Add GP</Text>
            </Pressable>
          </>
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={'#1E3A5F'} />
        </View>
      ) : (
        <FlatList
          data={gps}
          keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          removeClippedSubviews
          contentContainerClassName="px-6 py-5 gap-4"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={
            <View className="gap-4">
              {/* Station info */}
              {workspace.police_station ? (
                <View className="flex-row items-center gap-2 mb-1">
                  <MapPin size={13} color="#9CA3AF" />
                  <Text className="text-xs text-muted-foreground">
                    {workspace.police_station} · {workspace.district} · {workspace.state}
                  </Text>
                </View>
              ) : null}

              {/* Analytics grid */}
              <Text className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B7280' }}>Analytics</Text>
              <View className="flex-row flex-wrap gap-3">
                {STAT_CONFIG.map((item) => (
                  <AnalyticsCard key={item.key} item={item} value={analytics[item.key]} width={cardWidth} />
                ))}
              </View>

              <View className="h-px bg-border my-1" />
              <Text className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B7280' }}>
                Gram Panchayats ({gps.length})
              </Text>
            </View>
          }
          renderItem={({ item }) => <GPCard gp={item} />}
          ListEmptyComponent={
            <View className="items-center justify-center py-16 gap-4">
              <View className="w-16 h-16 rounded-2xl bg-accent items-center justify-center">
                <BookOpen size={28} color="#2D52B8" />
              </View>
              <Text className="text-base font-semibold text-foreground">No Gram Panchayats yet</Text>
              <Text className="text-sm text-muted-foreground text-center leading-6 px-8">
                Tap "Add GP" to start building your digital beat book
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
