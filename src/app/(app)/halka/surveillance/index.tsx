import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, ScrollView,
  Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Search, Eye, User, X } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import {
  getSurveillanceTargets, searchSurveillanceTargets,
  CRIMINAL_ACTIVITIES, type SurveillanceTarget,
} from '@/lib/db/halkaSurveillanceRepo';

const NAVY = '#1E3A5F';

function TargetCard({ target }: { target: SurveillanceTarget }) {
  const { t } = useTranslation();
  return (
    <View
      className="bg-card border border-border rounded-2xl overflow-hidden flex-row gap-3 px-4 py-3"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Photo or fallback */}
      <View className="w-12 h-12 rounded-xl overflow-hidden bg-secondary items-center justify-center flex-shrink-0">
        {target.photo_uri ? (
          <Image
            source={{ uri: target.photo_uri }}
            style={{ width: 48, height: 48 }}
            contentFit="cover"
          />
        ) : (
          <User size={22} color="#9CA3AF" />
        )}
      </View>

      {/* Info */}
      <View className="flex-1 justify-center gap-0.5">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {target.name}
        </Text>
        {target.father_name ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {t('halka.surveillance.sonOf', { name: target.father_name })}
          </Text>
        ) : null}
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {target.gp_name}
        </Text>
      </View>

      {/* Activity badge */}
      <View className="justify-center">
        <View className="rounded-full px-2 py-1" style={{ backgroundColor: '#FEE2E2' }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: '#B91C1C' }} numberOfLines={2}>
            {target.criminal_activity}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function SurveillanceListScreen() {
  const { t } = useTranslation();
  const [targets, setTargets]         = useState<SurveillanceTarget[]>([]);
  const [loading, setLoading]         = useState(true);
  const [query, setQuery]             = useState('');
  const [activityFilter, setActivity] = useState<string | null>(null);
  const [searchExpanded, setSearchExp] = useState(false);

  const load = useCallback(async (q: string, act: string | null) => {
    setLoading(true);
    try {
      const results = (q.trim() || act)
        ? await searchSurveillanceTargets(q, act ?? undefined)
        : await getSurveillanceTargets();
      setTargets(results);
    } catch (e) {
      logger.warn('[Surveillance] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(query, activityFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const handleQueryChange = (v: string) => {
    setQuery(v);
    load(v, activityFilter);
  };

  const handleActivityFilter = (act: string) => {
    const next = activityFilter === act ? null : act;
    setActivity(next);
    load(query, next);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('halka.surveillance.title')}
        subtitle={t('halka.surveillance.subtitle')}
        showBack
        actions={
          <Pressable
            onPress={() => router.push('/(app)/halka/surveillance/add' as never)}
            className="flex-row items-center gap-1 rounded-lg px-3 py-1.5 active:opacity-70"
            style={{ backgroundColor: '#E11D4818', borderWidth: 1, borderColor: '#E11D4830' }}
          >
            <Plus size={14} color="#E11D48" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#E11D48' }}>{t('common.add')}</Text>
          </Pressable>
        }
      />

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
        style={{ width: '100%' }}
      >
        <View className="px-4 pt-2 pb-1.5 border-b border-border bg-background gap-1.5">
          {/* Search row */}
          {searchExpanded ? (
            <View className="flex-row items-center gap-2">
              <View className="flex-1 flex-row items-center bg-secondary rounded-lg px-3 h-8 gap-2">
                <Search size={13} color="#9CA3AF" />
                <TextInput
                  value={query}
                  onChangeText={handleQueryChange}
                  placeholder={t('halka.surveillance.searchPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                  className="flex-1 text-xs text-foreground"
                  style={{ height: 32 }}
                />
              </View>
              <Pressable
                onPress={() => { setSearchExp(false); handleQueryChange(''); }}
                hitSlop={8}
                className="active:opacity-60"
              >
                <X size={16} color="#6B7280" />
              </Pressable>
            </View>
          ) : (
            <View className="flex-row items-center justify-between">
              <Text style={{ fontSize: 11, fontWeight: '700', color: NAVY }}>
                {t('halka.surveillance.targetCount', { count: targets.length })}
              </Text>
              <Pressable onPress={() => setSearchExp(true)} hitSlop={8} className="active:opacity-60">
                <Search size={18} color="#6B7280" />
              </Pressable>
            </View>
          )}

          {/* Activity filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
            <View className="flex-row gap-1.5 px-1">
              {CRIMINAL_ACTIVITIES.map((act) => {
                const active = activityFilter === act;
                return (
                  <Pressable
                    key={act}
                    onPress={() => handleActivityFilter(act)}
                    className="rounded-full px-2.5 py-1 active:opacity-70"
                    style={{ backgroundColor: active ? '#E11D48' : '#F3F4F6' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#fff' : '#6B7280' }}>
                      {act}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <FlatList
          data={targets}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 10 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <TargetCard target={item} />}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 gap-3">
              <View className="w-14 h-14 rounded-2xl items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <Eye size={24} color="#E11D48" />
              </View>
              <Text className="text-sm font-semibold text-foreground">{t('halka.surveillance.emptyTitle')}</Text>
              <Text className="text-xs text-muted-foreground text-center px-10 leading-5">
                {t('halka.surveillance.emptySubtitle')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
