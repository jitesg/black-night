/**
 * add-karyvahi-checklist.tsx
 *
 * Screen allowing officers to pick from the 34 standard investigation checklist
 * items and add them in batch as Karyvahi for the current FIR.
 *
 * Route: /(app)/mukadma/[firId]/add-karyvahi-checklist
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Check, CheckCircle2, Search, X, ListChecks } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { THEME } from '@/lib/theme';
import { logger } from '@/lib/logger';
import {
  getKaryvahiByFIR,
  createKaryvahi,
  getNextKaryvahiSortOrder,
  COMMON_INVESTIGATION_CHECKLIST,
} from '@/lib/db/firKaryvahiRepo';
import { matchesQuery } from '@/lib/searchUtils';

export default function AddKaryvahiChecklistScreen() {
  const { firId } = useLocalSearchParams<{ firId: string }>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [query, setQuery]             = useState('');

  // ── Fetch existing Karyvahi names for this FIR ──────────────────────────────
  const loadExisting = useCallback(async () => {
    if (!firId) return;
    setLoading(true);
    setError('');
    try {
      const existingList = await getKaryvahiByFIR(firId, 'AddKaryvahiChecklist');
      const names = new Set(
        existingList
          .filter((k) => !k.deleted_at)
          .map((k) => k.name.toLowerCase().trim())
      );
      setExistingNames(names);
    } catch (e) {
      logger.error('[AddKaryvahiChecklist] Failed to load existing karyvahi:', e);
      setError(t('fir.loadError', 'डेटा लोड करने में त्रुटि हुई।'));
    } finally {
      setLoading(false);
    }
  }, [firId, t]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  // ── Toggle an available item ────────────────────────────────────────────────
  const toggleItem = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // ── Available items (not already in FIR) ────────────────────────────────────
  const availableItems = useMemo(() => {
    return COMMON_INVESTIGATION_CHECKLIST.filter(
      (item) => !existingNames.has(item.name.toLowerCase().trim())
    );
  }, [existingNames]);

  // ── Filtered items based on search query ───────────────────────────────────
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMON_INVESTIGATION_CHECKLIST;
    return COMMON_INVESTIGATION_CHECKLIST.filter((item) => matchesQuery(q, item.name, item.precautions));
  }, [query]);

  // ── Batch select / deselect available items ─────────────────────────────────
  const handleSelectAll = () => {
    const next = new Set<string>();
    for (const item of availableItems) {
      next.add(item.name);
    }
    setSelectedNames(next);
  };

  const handleDeselectAll = () => {
    setSelectedNames(new Set());
  };

  // ── Save action ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!firId || selectedNames.size === 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      let sortOrder = await getNextKaryvahiSortOrder(firId);
      const itemsToAdd = COMMON_INVESTIGATION_CHECKLIST.filter(
        (item) =>
          selectedNames.has(item.name) &&
          !existingNames.has(item.name.toLowerCase().trim())
      );

      for (const item of itemsToAdd) {
        await createKaryvahi({
          fir_id: firId,
          name: item.name.trim(),
          precautions: item.precautions.trim() || undefined,
          is_completed: 0,
          execution_count: 0,
          sort_order: sortOrder++,
          source: 'user',
        });
      }

      logger.warn(
        `[AddKaryvahiChecklist] Successfully added ${itemsToAdd.length} karyvahi items for FIR: ${firId}`
      );
      router.back();
    } catch (e) {
      logger.error('[AddKaryvahiChecklist] Failed to save karyvahi items:', e);
      setError(t('fir.saveError', 'सुरक्षित करने में त्रुटि हुई।'));
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedNames.size;
  const alreadyAddedCount = existingNames.size;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('fir.karyvahi.commonChecklistTitle', 'सामान्य विवेचना चेकलिस्ट')}
        subtitle={t('fir.karyvahi.commonChecklistSubtitle', 'मानक विवेचना चेकलिस्ट')}
        showBack
        rightActions={
          <Pressable
            onPress={handleSave}
            disabled={selectedCount === 0 || saving}
            className="rounded-xl px-4 py-2 active:opacity-70"
            style={{
              backgroundColor: selectedCount > 0 && !saving ? '#6366F1' : '#9CA3AF',
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white text-sm font-bold">
                {selectedCount > 0 ? `${t('common.save')} (${selectedCount})` : t('common.save')}
              </Text>
            )}
          </Pressable>
        }
      />

      {/* ── Search and Quick Actions Bar ──────────────────────────────────── */}
      <View className="px-4 pt-3 pb-2 bg-background border-b border-border/60 gap-2.5">
        <View className="flex-row items-center bg-card border border-border rounded-xl px-3 h-10 gap-2">
          <Search size={16} color={c.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('fir.karyvahi.searchPlaceholder', 'कार्य नाम खोजें…')}
            placeholderTextColor={c.mutedForeground}
            className="flex-1 text-sm text-foreground py-0"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={12}>
              <X size={15} color={c.mutedForeground} />
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <ListChecks size={14} color={c.primary} />
            <Text className="text-xs text-muted-foreground">
              {COMMON_INVESTIGATION_CHECKLIST.length} कार्य · {alreadyAddedCount} जोड़े गए · {selectedCount} चयनित
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            {availableItems.length > 0 && (
              selectedCount < availableItems.length ? (
                <Pressable onPress={handleSelectAll} hitSlop={8}>
                  <Text className="text-xs font-semibold" style={{ color: c.primary }}>
                    {t('fir.karyvahi.selectAll', 'सभी चुनें')}
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleDeselectAll} hitSlop={8}>
                  <Text className="text-xs font-semibold text-muted-foreground">
                    {t('fir.karyvahi.deselectAll', 'चयन हटाएं')}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </View>
      </View>

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {error ? (
        <View className="mx-4 mt-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
          <Text className="text-xs text-destructive font-medium">{error}</Text>
        </View>
      ) : null}

      {/* ── Main Checklist Content ────────────────────────────────────────── */}
      {loading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            className="bg-card border border-border rounded-2xl overflow-hidden"
            style={{ borderCurve: 'continuous' }}
          >
            {filteredItems.map((item, index) => {
              const isAlreadyAdded = existingNames.has(item.name.toLowerCase().trim());
              const isSelected = selectedNames.has(item.name);
              const isLast = index === filteredItems.length - 1;

              if (isAlreadyAdded) {
                // Disabled row for items already added to this FIR
                return (
                  <View
                    key={item.name}
                    className={`flex-row items-start gap-3 px-4 py-3.5 bg-secondary/30 ${
                      isLast ? '' : 'border-b border-border/60'
                    }`}
                  >
                    <View
                      className="w-5 h-5 rounded items-center justify-center mt-0.5 opacity-60"
                      style={{
                        backgroundColor: `${c.primary}20`,
                        borderWidth: 1.5,
                        borderColor: c.primary,
                      }}
                    >
                      <Check size={12} color={c.primary} strokeWidth={3} />
                    </View>

                    <View className="flex-1 gap-1">
                      <View className="flex-row items-center justify-between gap-2 flex-wrap">
                        <Text className="text-sm font-semibold text-foreground/80 leading-5">
                          {item.name}
                        </Text>
                        <View className="flex-row items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2.5 py-1">
                          <CheckCircle2 size={11} color="#059669" />
                          <Text textBreakStrategy="simple" className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            {t('fir.karyvahi.alreadyAdded', 'पहले से जुड़ा हुआ')}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-xs text-muted-foreground leading-4">
                        {item.precautions}
                      </Text>
                    </View>
                  </View>
                );
              }

              // Interactive selectable row
              return (
                <Pressable
                  key={item.name}
                  onPress={() => toggleItem(item.name)}
                  className={`flex-row items-start gap-3 px-4 py-3.5 active:bg-secondary/50 ${
                    isSelected ? 'bg-primary/5' : ''
                  } ${isLast ? '' : 'border-b border-border/60'}`}
                >
                  <View
                    className="w-5 h-5 rounded items-center justify-center mt-0.5"
                    style={{
                      backgroundColor: isSelected ? c.primary : c.card,
                      borderWidth: 1.5,
                      borderColor: isSelected ? c.primary : c.border,
                    }}
                  >
                    {isSelected && (
                      <Check size={12} color={c.primaryForeground} strokeWidth={3} />
                    )}
                  </View>

                  <View className="flex-1 gap-1">
                    <Text
                      className={`text-sm leading-5 ${
                        isSelected ? 'font-bold text-foreground' : 'font-semibold text-foreground'
                      }`}
                    >
                      {item.name}
                    </Text>
                    <Text className="text-xs text-muted-foreground leading-4">
                      {item.precautions}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {filteredItems.length === 0 && (
              <View className="items-center justify-center py-12 gap-2">
                <Text className="text-sm text-muted-foreground">
                  {t('fir.karyvahi.noTasksFilter', 'कोई कार्य फ़िल्टर से मेल नहीं खाता')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
