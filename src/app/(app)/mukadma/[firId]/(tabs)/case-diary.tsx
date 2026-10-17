import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { logger } from '@/lib/logger';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/lib/typography';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Plus, BookOpen, Clock, Trash2, Eye, Pencil, Download, MapPin, CheckCircle2, Circle,
} from 'lucide-react-native';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  getCaseDiariesByFIR, getEntriesByDiary, deleteCaseDiary,
  deserializePlaces,
  type CaseDiary, type CaseDiaryEntry,
} from '@/lib/db/caseDiaryRepo';
import { exportCaseDiaryToDocx, exportAllCaseDiariesToDocx } from '@/lib/caseDiaryExport';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { useFIRContext } from '@/context/FIRContext';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const INDIGO = '#6366F1';

// ─── Diary Card ────────────────────────────────────────────────────────────────

function DiaryCard({
  diary, diaryNumber, karyvahiList, firId,
  onView, onEdit, onExport, onDelete,
}: {
  diary: CaseDiary;
  diaryNumber: number;
  karyvahiList: CaseDiaryEntry[];
  firId: string;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const places = deserializePlaces(diary.places_visited);
  const karyvahiCount  = karyvahiList.filter((e) => e.entry_type === 'karyvahi').length;
  const narrativeCount = karyvahiList.filter((e) => e.entry_type === 'narrative').length;
  const lastMod = new Date(diary.updated_at * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <View
      className="bg-card border border-border rounded-2xl overflow-hidden mb-3"
      style={{ borderCurve: 'continuous' }}
    >
      {/* ── Header row ── */}
      <Pressable
        onPress={() => onView(diary.id)}
        className="px-4 pt-4 pb-3 active:bg-secondary"
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-xs text-muted-foreground font-semibold tracking-widest uppercase">
              {t('fir.caseDiary.caseDiaryLabel')}
            </Text>
            <Text className="text-base font-bold text-foreground">
              {t('fir.caseDiary.diaryNo')} {String(diaryNumber).padStart(2, '0')}
            </Text>
            <Text className="text-xs text-muted-foreground">{diary.preparation_date}</Text>          </View>
          <View className="items-end gap-0.5">
            <View className="flex-row items-center gap-1">
              {karyvahiCount > 0 || narrativeCount > 0
                ? <CheckCircle2 size={13} color="#16a34a" />
                : <Circle size={13} color="#D1D5DB" />}
              <Text className="text-xs font-semibold" style={{ color: karyvahiCount > 0 ? '#16a34a' : '#9CA3AF' }}>
                {karyvahiCount > 0 ? t('fir.caseDiary.karyvahiCount', { count: karyvahiCount }) : ''}
                {karyvahiCount > 0 && narrativeCount > 0 ? ' · ' : ''}
                {narrativeCount > 0 ? t('fir.caseDiary.narrativeCount', { count: narrativeCount }) : ''}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">{t('fir.caseDiary.modifiedLabel')} {lastMod}</Text>          </View>
        </View>

        {/* ── Meta row ── */}
        <View className="mt-2 gap-1">
          {(diary.start_time || diary.end_time) ? (
            <View className="flex-row items-center gap-1.5">
              <Clock size={11} color="#9CA3AF" />
              <Text className="text-xs text-muted-foreground">
                {diary.start_time ?? '—'} → {diary.end_time ?? '—'}
              </Text>
            </View>
          ) : null}
          {places.length > 0 ? (
            <View className="flex-row items-center gap-1.5">
              <MapPin size={11} color="#9CA3AF" />
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>{places.join(', ')}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Karyvahi preview ── */}
        {karyvahiCount > 0 ? (
          <View className="mt-3 gap-1">
            {karyvahiList.filter(e => e.entry_type === 'karyvahi').slice(0, 3).map((k) => (
              <View key={k.id} className="flex-row items-start gap-2">
                <View className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5" />
                <Text className="text-xs font-medium text-foreground flex-1" numberOfLines={1}>
                  {k.karyvahi_name ?? '—'}
                </Text>
              </View>
            ))}
            {karyvahiList.filter(e => e.entry_type === 'karyvahi').length > 3 && (
              <Text className="text-xs text-muted-foreground pl-3.5">
                {t('fir.caseDiary.moreEntries', { count: karyvahiList.filter(e => e.entry_type === 'karyvahi').length - 3 })}
              </Text>
            )}
          </View>
        ) : (
          <Text className="text-xs text-muted-foreground mt-2">{t('fir.caseDiary.noEntriesYet')}</Text>
        )}
      </Pressable>

      {/* ── Action row ── */}
      <View
        className="flex-row items-center border-t border-border"
        style={{ borderTopColor: '#F3F4F6' }}
      >
        {([
          { icon: Eye,      label: t('fir.caseDiary.view'),   onPress: () => onView(diary.id),   color: '#374151' },
          { icon: Pencil,   label: t('fir.caseDiary.edit'),   onPress: () => onEdit(diary.id),   color: INDIGO },
          { icon: Download, label: t('fir.caseDiary.export'), onPress: () => onExport(diary.id), color: '#059669' },
          { icon: Trash2,   label: t('fir.caseDiary.delete'), onPress: () => onDelete(diary.id), color: '#DC2626' },
        ] as const).map(({ icon: Icon, label, onPress, color }) => (
          <Pressable
            key={label}
            onPress={onPress}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 active:bg-secondary"
          >
            <Icon size={13} color={color} />
            <Text style={{ ...T.caption2, color, fontWeight: T.weight.semibold }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Main Tab Screen ──────────────────────────────────────────────────────────

export default function CaseDiaryTab() {
  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom + 16, 24);
  const params = useLocalSearchParams<{ firId: string }>();
  const { activeFirId } = useFIRContext();
  const { t } = useTranslation();

  const stableFirId = useMemo((): string | undefined => {
    const fromParams  = params.firId?.trim();
    const fromContext = activeFirId?.trim();
    const paramsOk    = !!fromParams  && fromParams  !== 'undefined';
    const contextOk   = !!fromContext && fromContext !== 'undefined';
    const final       = paramsOk ? fromParams : contextOk ? fromContext : undefined;
    logger.warn(
      `[CASE_DIARY_ID_RESOLVE]` +
      ` params="${params.firId ?? 'undefined'}"` +
      ` context="${activeFirId ?? 'undefined'}"` +
      ` finalStable="${final ?? 'undefined'}" t=${Date.now()}`
    );
    return final;
  }, [params.firId, activeFirId]);

  const [diaries, setDiaries]         = useState<CaseDiary[]>([]);
  const [karyvahiMap, setKaryvahiMap] = useState<Record<string, CaseDiaryEntry[]>>({});
  const [loading, setLoading]         = useState(true);
  const [deleteTarget, setDeleteTarget]   = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const mountedRef       = useRef(true);
  const hasDataRef       = useRef(false);
  const loadedFirIdRef   = useRef<string | undefined>(undefined);
  const inFlightFirIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    const t0 = Date.now();
    if (!stableFirId) { if (mountedRef.current) setLoading(false); return; }
    if (inFlightFirIdRef.current === stableFirId) return;
    const requestedId = stableFirId;
    inFlightFirIdRef.current = requestedId;
    if (!hasDataRef.current && mountedRef.current) setLoading(true);
    try {
      const ds = await getCaseDiariesByFIR(requestedId);
      if (!mountedRef.current) return;
      const map: Record<string, CaseDiaryEntry[]> = {};
      await Promise.all(ds.map(async (d) => { map[d.id] = await getEntriesByDiary(d.id); }));
      if (!mountedRef.current) return;
      if (stableFirId === requestedId) {
        logger.warn(`[CASE_DIARY_LOAD] END firId="${requestedId}" entries=${ds.length} elapsed=${Date.now() - t0}ms`);
        setDiaries(ds);
        setKaryvahiMap(map);
        hasDataRef.current     = true;
        loadedFirIdRef.current = requestedId;
      }
    } catch (e) {
      logger.warn('[CASE_DIARY_LOAD] ERROR:', e);
    } finally {
      inFlightFirIdRef.current = undefined;
      if (mountedRef.current) setLoading(false);
    }
  }, [stableFirId]);

  useEffect(() => {
    if (!stableFirId) return;
    if (stableFirId !== loadedFirIdRef.current) {
      hasDataRef.current       = false;
      loadedFirIdRef.current   = undefined;
      inFlightFirIdRef.current = undefined; // clear stale in-flight for the previous firId
    }
    load();
  }, [stableFirId, load]);

  useFocusEffect(useCallback(() => {
    load();
    return () => {};
  }, [load]));

  const handleDelete = async (id: string) => {
    await deleteCaseDiary(id);
    setDeleteTarget(null);
    load();
  };

  const handleExport = async (id: string) => {
    if (exporting) return;
    setExporting(id);
    try {
      await exportCaseDiaryToDocx(id);
    } catch (e) {
      logger.error('[CaseDiary] Export failed', e);
      Alert.alert(t('fir.caseDiary.exportFailed'), e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  };

  // Merge every case diary of this mukadma into one .docx
  const handleExportAll = async () => {
    if (exporting || !stableFirId) return;
    setExporting('all');
    try {
      await exportAllCaseDiariesToDocx(stableFirId);
    } catch (e) {
      logger.error('[CaseDiary] Export all failed', e);
      Alert.alert(t('fir.caseDiary.exportFailed'), e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  };

  const handleView = (diaryId: string) => {
    router.push({ pathname: '/(app)/mukadma/[firId]/view-case-diary' as never, params: { firId: stableFirId, diaryId } });
  };

  const handleEdit = (diaryId: string) => {
    // Route directly to the Entries/Karyvahi screen so users edit actual content
    router.push({ pathname: '/(app)/mukadma/[firId]/add-case-diary-karyvahi' as never, params: { firId: stableFirId, diaryId } });
  };

  // Phase 1: pre-sort once with useMemo — O(N log N) total, not O(N²) per render
  const sortedDiaries = useMemo(
    () => [...diaries].sort((a, b) => a.created_at - b.created_at),
    [diaries],
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('fir.caseDiary.title')}
        countLabel={diaries.length > 0 ? t('fir.caseDiary.entryCount_other', { count: diaries.length }) : undefined}
        rightActions={
          <View className="flex-row items-center gap-2">
            {diaries.length > 0 && (
              <Pressable
                onPress={handleExportAll}
                disabled={!!exporting}
                accessibilityLabel={t('fir.caseDiary.exportAll')}
                className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-70"
                style={{ backgroundColor: '#059669' }}
              >
                <Download size={14} color="#fff" />
                <Text className="text-xs font-bold text-white">{t('fir.caseDiary.exportAll')}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push({ pathname: '/(app)/mukadma/[firId]/add-case-diary' as never, params: { firId: stableFirId } })}
              className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-70"
              style={{ backgroundColor: INDIGO }}
            >
              <Plus size={14} color="#fff" />
              <Text className="text-xs font-bold text-white">{t('fir.caseDiary.addDiary')}</Text>
            </Pressable>
          </View>
        }
      />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={INDIGO} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          data={sortedDiaries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: T.space.xl - 12, paddingTop: T.space.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={
            <View className="items-center justify-center py-20 gap-4">
              <View className="w-16 h-16 rounded-2xl bg-secondary items-center justify-center">
                <BookOpen size={28} color="#9CA3AF" />
              </View>
              <View className="items-center gap-1">
                <Text className="text-base font-bold text-foreground">{t('fir.caseDiary.noDiariesYet')}</Text>
                <Text className="text-sm text-muted-foreground text-center px-6">
                  {t('fir.caseDiary.noDiariesDesc')}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/(app)/mukadma/[firId]/add-case-diary' as never, params: { firId: stableFirId } })}
                className="flex-row items-center gap-2 rounded-2xl px-5 py-3 active:opacity-70"
                style={{ backgroundColor: INDIGO }}
              >
                <Plus size={15} color="#fff" />
                <Text className="text-sm font-bold text-white">{t('fir.caseDiary.addFirstDiary')}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item, index }) => (
            <DiaryCard
              diary={item}
              diaryNumber={index + 1}
              karyvahiList={karyvahiMap[item.id] ?? []}
              firId={stableFirId ?? ''}
              onView={handleView}
              onEdit={handleEdit}
              onExport={handleExport}
              onDelete={(id) => setDeleteTarget(id)}
            />
          )}
        />
      )}
      {/* FAB */}
      <View
        className="absolute right-5"
        style={{ bottom: fabBottom, pointerEvents: 'box-none' } as never}
      >

      </View>
      {/* Export loading overlay */}
      {exporting && (
        <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
          <View className="bg-card rounded-2xl px-6 py-5 gap-3 items-center">
            <ActivityIndicator size="small" color="#059669" />
            <Text className="text-sm font-medium text-foreground">Exporting Document...</Text>
          </View>
        </View>
      )}
      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fir.caseDiary.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('fir.caseDiary.deleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}><Text>{t('fir.caseDiary.cancel')}</Text></AlertDialogCancel>
            <AlertDialogAction onPress={() => deleteTarget && handleDelete(deleteTarget)}>
              <Text>{t('fir.caseDiary.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
