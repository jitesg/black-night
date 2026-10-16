/**
 * Phase 5 — Pending Actions Screen
 *
 * Shows all PENDING + IN_PROGRESS MANDATORY karyvahi for a FIR,
 * sorted by due_date (overdue first, then by due_date asc, then undated).
 * Tapping a row navigates to karyvahi-detail for quick status update.
 */
import { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Clock, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import {
  getKaryvahiByFIR,
  type FIRKaryvahi,
  type KaryvahiStatus,
  type KaryvahiPriority,
} from '@/lib/db/firKaryvahiRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { useFIRContext } from '@/context/FIRContext';
import { logger } from '@/lib/logger';

const NAVY = '#6366F1';

const STATUS_COLOR: Record<string, string> = {
  PENDING:     '#6B7280',
  IN_PROGRESS: '#3B82F6',
};
const STATUS_BG: Record<string, string> = {
  PENDING:     '#F3F4F6',
  IN_PROGRESS: '#EFF6FF',
};

function isOverdue(due_date?: string): boolean {
  if (!due_date) return false;
  return new Date(due_date) < new Date();
}

function PendingRow({ item, firId }: { item: FIRKaryvahi; firId: string }) {
  const { t } = useTranslation();
  const status  = (item.status as KaryvahiStatus) ?? 'PENDING';
  const overdue = isOverdue(item.due_date);

  return (
    <Pressable
      onPress={() => router.push(`/(app)/mukadma/${firId}/karyvahi-detail?karyvahiId=${item.id}` as never)}
      className="flex-row items-start gap-3 py-3.5 border-b border-border active:opacity-70"
    >
      {/* Icon */}
      <View className="mt-0.5">
        {overdue
          ? <AlertTriangle size={20} color="#DC2626" />
          : <Clock size={20} color={STATUS_COLOR[status] ?? '#6B7280'} />}
      </View>

      {/* Content */}
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
          {item.name}
        </Text>
        <View className="flex-row items-center gap-2 flex-wrap">
          {/* Status chip */}
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: STATUS_BG[status] ?? '#F3F4F6' }}>
            <Text className="text-xs font-medium" style={{ color: STATUS_COLOR[status] ?? '#6B7280' }}>
              {t(`fir.karyvahi.status.${status}`, status)}
            </Text>
          </View>
          {/* Due date */}
          {item.due_date && (
            <Text className={`text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
              {overdue ? '⚠ ' : ''}{item.due_date}
            </Text>
          )}
        </View>
      </View>

      <ChevronRight size={15} color="#D1D5DB" className="mt-0.5" />
    </Pressable>
  );
}

export default function PendingActionsScreen() {
  const { firId: paramFirId } = useLocalSearchParams<{ firId: string }>();
  const { activeFirId } = useFIRContext();
  const { t } = useTranslation();

  const firId = (paramFirId?.trim() && paramFirId !== 'undefined')
    ? paramFirId
    : activeFirId ?? '';

  const [items, setItems]   = useState<FIRKaryvahi[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!firId) { setLoading(false); return; }
    try {
      setLoading(true);
      const all = await getKaryvahiByFIR(firId, 'PendingActions');
      // Filter: MANDATORY + not COMPLETED (execution_count=0 AND status ≠ COMPLETED)
      const pending = all.filter(i => {
        const pri    = ((i.priority as KaryvahiPriority) ?? 'MANDATORY') === 'MANDATORY';
        const done   = (i.execution_count ?? 0) > 0 || (i.status as KaryvahiStatus) === 'COMPLETED';
        return pri && !done;
      });
      // Sort: overdue first → has due_date asc → no due_date last
      pending.sort((a, b) => {
        const aOver = isOverdue(a.due_date);
        const bOver = isOverdue(b.due_date);
        if (aOver !== bOver) return aOver ? -1 : 1;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
      setItems(pending);
    } catch (e) {
      logger.warn('[PendingActions] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [firId]);

  useFocusEffect(useCallback(() => { load(); return () => {}; }, [load]));

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('fir.pendingActions.title')}
        subtitle={t('fir.pendingActions.subtitle')}
        showBack
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <CheckCircle2 size={40} color="#16A34A" />
          <Text className="text-base font-semibold text-foreground text-center">
            {t('fir.pendingActions.allDone')}
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            {t('fir.pendingActions.allDoneDesc')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          ListHeaderComponent={
            <View className="py-3">
              <Text className="text-xs text-muted-foreground">
                {t('fir.pendingActions.count', { count: items.length })}
              </Text>
            </View>
          }
          renderItem={({ item }) => <PendingRow item={item} firId={firId} />}
        />
      )}
    </View>
  );
}
