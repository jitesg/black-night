/**
 * FardCheckSheet.tsx
 *
 * Dismissible Bottom Sheet displaying Fard inspection results:
 * - Type name
 * - Score (found/total)
 * - List of missing elements with actionable tip
 * - Warnings (FIR cross-checks FR1-FR5)
 * - Mistakes to avoid ('बचने योग्य गलतियाँ')
 * - Link 'फर्द ज्ञान में पढ़ें' to that entry's detail screen
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import type { FardCheckResult } from '@/ai/fard/fardChecker';

export interface FardCheckSheetProps {
  visible: boolean;
  onClose: () => void;
  result: FardCheckResult | null;
  onChangeType?: () => void;
}

export function FardCheckSheet({ visible, onClose, result, onChangeType }: FardCheckSheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showFound, setShowFound] = useState(false);

  if (!visible || !result || !result.type) {
    return null;
  }

  const { type, found, missing, score, warnings, avoid } = result;

  const handleOpenDetail = () => {
    onClose();
    if (type?.code) {
      router.push(`/(app)/knowledge/fard/${type.code}` as never);
    }
  };

  const isPerfect = missing.length === 0 && warnings.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        {/* Dismiss backdrop */}
        <Pressable
          className="flex-1"
          onPress={onClose}
          accessibilityLabel={t('common.close', 'बंद करें')}
          accessibilityRole="button"
        />

        {/* Sheet Content */}
        <View
          className="bg-card rounded-t-3xl border-t border-border shadow-xl max-h-[85%]"
          style={{ borderCurve: 'continuous' }}
        >
          {/* Grab Handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-border/60">
            <View className="flex-1 pr-2">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={18} color="#2563EB" />
                <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                  {type.name}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                {t('fard.scoreLabel', 'पूर्णता स्कोर')}: {score.found}/{score.total} ({Math.round(score.ratio * 100)}%)
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              {onChangeType ? (
                <Pressable
                  onPress={onChangeType}
                  className="flex-row items-center gap-1 rounded-full bg-secondary active:opacity-70 px-3 py-1.5"
                  accessibilityRole="button"
                  accessibilityLabel={t('fard.changeType', 'प्रकार बदलें')}
                >
                  <RefreshCw size={11} className="text-muted-foreground" />
                  <Text textBreakStrategy="simple" className="text-xs font-semibold text-foreground">
                    {t('fard.changeType', 'प्रकार बदलें')}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-secondary items-center justify-center active:opacity-70"
                accessibilityLabel={t('common.close', 'बंद करें')}
                accessibilityRole="button"
              >
                <X size={18} className="text-foreground" />
              </Pressable>
            </View>
          </View>

          {/* Body */}
          <ScrollView
            className="px-5 py-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 28 }}
          >
            {/* Score progress bar */}
            <View className="mb-4">
              <View className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(5, Math.round(score.ratio * 100)))}%`,
                    backgroundColor: score.ratio >= 0.8 ? '#10B981' : score.ratio >= 0.5 ? '#F59E0B' : '#EF4444',
                  }}
                />
              </View>
            </View>

            {/* Warnings Section (FR1-FR5) */}
            {warnings.length > 0 && (
              <View className="mb-4 gap-2">
                <Text className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex-row items-center gap-1">
                  {t('fard.warningsTitle', 'चेतावनी व मिलान सुझाव')}
                </Text>
                {warnings.map((w, idx) => (
                  <View
                    key={`${w.code}-${idx}`}
                    className={`p-3 rounded-xl border flex-row items-start gap-2.5 ${
                      w.type === 'warn'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-blue-500/10 border-blue-500/30'
                    }`}
                  >
                    {w.type === 'warn' ? (
                      <AlertTriangle size={16} color="#D97706" style={{ marginTop: 2 }} />
                    ) : (
                      <Info size={16} color="#2563EB" style={{ marginTop: 2 }} />
                    )}
                    <View className="flex-1">
                      <Text
                        className={`text-xs font-semibold ${
                          w.type === 'warn' ? 'text-amber-800 dark:text-amber-200' : 'text-blue-800 dark:text-blue-200'
                        }`}
                      >
                        {w.message}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Missing Elements Section */}
            {missing.length > 0 ? (
              <View className="mb-4 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-destructive uppercase tracking-wider">
                    {t('fard.missingElements', 'छूटे हुए आवश्यक तत्व')} ({missing.length})
                  </Text>
                </View>

                <View className="gap-2">
                  {missing.map((item, idx) => (
                    <View
                      key={`missing-${idx}`}
                      className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 gap-1"
                    >
                      <View className="flex-row items-center gap-2">
                        <View className="w-2 h-2 rounded-full bg-destructive" />
                        <Text className="text-sm font-semibold text-foreground">
                          {item.label}
                        </Text>
                      </View>
                      {item.tip ? (
                        <Text className="text-xs text-muted-foreground ml-4 leading-4">
                          {item.tip}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-row items-center gap-2">
                <CheckCircle2 size={16} color="#10B981" />
                <Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  {t('fard.allElementsFound', 'सभी आवश्यक प्रमुख तत्व फर्द में मौजूद हैं।')}
                </Text>
              </View>
            )}

            {/* Found Elements Section (Collapsible) */}
            {found.length > 0 && (
              <View className="mb-4">
                <Pressable
                  onPress={() => setShowFound((prev) => !prev)}
                  className="flex-row items-center justify-between py-1.5 active:opacity-70"
                >
                  <Text className="text-xs font-semibold text-muted-foreground">
                    {t('fard.foundElements', 'मौजूद तत्व')} ({found.length})
                  </Text>
                  {showFound ? <ChevronDown size={14} color="#6B7280" /> : <ChevronRight size={14} color="#6B7280" />}
                </Pressable>

                {showFound && (
                  <View className="flex-row flex-wrap gap-1.5 mt-2">
                    {found.map((f, idx) => (
                      <View
                        key={`found-${idx}`}
                        className="flex-row items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1"
                      >
                        <CheckCircle2 size={12} color="#10B981" />
                        <Text textBreakStrategy="simple" className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                          {f.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Mistakes to Avoid ('बचने योग्य गलतियाँ') */}
            {avoid.length > 0 && (
              <View className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 gap-2">
                <View className="flex-row items-center gap-2">
                  <AlertTriangle size={15} color="#D97706" />
                  <Text className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    {t('fard.mistakesToAvoid', 'बचने योग्य गलतियाँ')}
                  </Text>
                </View>
                <View className="gap-1.5 ml-1">
                  {avoid.map((m, idx) => (
                    <Text
                      key={`avoid-${idx}`}
                      className="text-xs text-amber-900 dark:text-amber-200 leading-4"
                    >
                      • {m}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Read in Knowledge Link */}
            <Pressable
              onPress={handleOpenDetail}
              className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary active:opacity-80"
              style={{ borderCurve: 'continuous' }}
            >
              <BookOpen size={16} color="#FFFFFF" />
              <Text className="text-sm font-bold text-primary-foreground">
                {t('fard.readInKnowledge', 'फर्द ज्ञान में पढ़ें')}
              </Text>
              <ChevronRight size={16} color="#FFFFFF" />
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
