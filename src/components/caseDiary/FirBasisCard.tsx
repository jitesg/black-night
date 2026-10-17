/**
 * FirBasisCard.tsx — Collapsible "FIR आधार" summary card.
 * Collapsed by default.
 * Shows sections, occurrence date/time, report date/time, place, complainant,
 * and status chips for Nakal Chik (✓/✗) and Nakal Rapat (✓/✗).
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronDown, ChevronUp, Check, X, ShieldAlert } from 'lucide-react-native';
import type { FIR } from '@/lib/db/firRepo';
import { getFirBasis } from '@/lib/firBasis';

interface FirBasisCardProps {
  fir?: Partial<FIR> | null;
  defaultExpanded?: boolean;
}

export function FirBasisCard({ fir, defaultExpanded = false }: FirBasisCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { t, i18n } = useTranslation();
  const isEn = (i18n.language || '').toLowerCase().startsWith('en');

  if (!fir) return null;

  const basis = getFirBasis(fir);

  const formatDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr && !timeStr) return '—';
    if (dateStr && timeStr) return `${dateStr} ${timeStr}`;
    return dateStr || timeStr;
  };

  return (
    <View
      className="bg-card border border-border rounded-2xl overflow-hidden mb-4 shadow-sm"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Header bar / toggle button */}
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse FIR Basis' : 'Expand FIR Basis'}
        className="flex-row items-center justify-between px-4 py-3 bg-secondary/40 active:opacity-70"
      >
        <View className="flex-row items-center gap-2 flex-1">
          <View className="w-7 h-7 rounded-lg bg-primary/10 items-center justify-center">
            <BookOpen size={15} className="text-primary" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-foreground">
              {t('fir.firBasis.title', isEn ? 'FIR Basis' : 'FIR आधार')}
            </Text>
            {!expanded && (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {basis.sections ? `Sec: ${basis.sections}` : ''}
                {basis.complainant ? ` • ${basis.complainant}` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Quick status chips on header when collapsed */}
        {!expanded && (
          <View className="flex-row items-center gap-1.5 mr-2">
            <View
              className={`px-2 py-0.5 rounded-full flex-row items-center gap-1 ${
                basis.hasChick ? 'bg-emerald-500/10' : 'bg-amber-500/10'
              }`}
            >
              <Text
                className={`text-[10px] font-semibold ${
                  basis.hasChick ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {t('fir.firBasis.nakalChick', isEn ? 'Chik' : 'चिक')} {basis.hasChick ? '✓' : '✗'}
              </Text>
            </View>
            <View
              className={`px-2 py-0.5 rounded-full flex-row items-center gap-1 ${
                basis.hasRapat ? 'bg-emerald-500/10' : 'bg-amber-500/10'
              }`}
            >
              <Text
                className={`text-[10px] font-semibold ${
                  basis.hasRapat ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {t('fir.firBasis.nakalRapat', isEn ? 'Rapat' : 'रपट')} {basis.hasRapat ? '✓' : '✗'}
              </Text>
            </View>
          </View>
        )}

        <View className="w-6 h-6 items-center justify-center">
          {expanded ? (
            <ChevronUp size={16} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground" />
          )}
        </View>
      </Pressable>

      {/* Expanded Details */}
      {expanded && (
        <View className="p-4 gap-3 border-t border-border/60">
          {/* Key basis grid */}
          <View className="grid grid-cols-2 gap-2.5">
            {/* Sections */}
            <View className="bg-secondary/20 p-2.5 rounded-xl">
              <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('fir.firBasis.sections', isEn ? 'Sections' : 'धाराएँ')}
              </Text>
              <Text className="text-xs font-bold text-foreground mt-0.5" numberOfLines={2}>
                {basis.sections || '—'}
              </Text>
            </View>

            {/* Complainant */}
            <View className="bg-secondary/20 p-2.5 rounded-xl">
              <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('fir.firBasis.complainant', isEn ? 'Complainant' : 'वादी')}
              </Text>
              <Text className="text-xs font-bold text-foreground mt-0.5" numberOfLines={1}>
                {basis.complainant || '—'}
              </Text>
            </View>

            {/* Occurrence */}
            <View className="bg-secondary/20 p-2.5 rounded-xl">
              <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('fir.firBasis.occurrenceDateTime', isEn ? 'Occurrence Date/Time' : 'घटना तारीख/समय')}
              </Text>
              <Text className="text-xs font-medium text-foreground mt-0.5" numberOfLines={1}>
                {formatDateTime(basis.occDate, basis.occTime)}
              </Text>
            </View>

            {/* Reporting Information */}
            <View className="bg-secondary/20 p-2.5 rounded-xl">
              <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('fir.firBasis.informationDateTime', isEn ? 'Report Date/Time' : 'सूचना तारीख/समय')}
              </Text>
              <Text className="text-xs font-medium text-foreground mt-0.5" numberOfLines={1}>
                {formatDateTime(basis.infoDate, basis.infoTime)}
              </Text>
            </View>
          </View>

          {/* Place of occurrence */}
          <View className="bg-secondary/20 p-2.5 rounded-xl">
            <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('fir.firBasis.place', isEn ? 'Place of Occurrence' : 'स्थान')}
            </Text>
            <Text className="text-xs font-medium text-foreground mt-0.5">
              {basis.place || '—'}
            </Text>
          </View>

          {/* Two Status Chips */}
          <View className="flex-row gap-2 pt-1">
            <View
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-xl border ${
                basis.hasChick
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              {basis.hasChick ? (
                <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <X size={14} className="text-amber-600 dark:text-amber-400" />
              )}
              <Text
                className={`text-xs font-semibold ${
                  basis.hasChick
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {t('fir.firBasis.nakalChick', isEn ? 'Nakal Chik' : 'नकल चिक')}
              </Text>
            </View>

            <View
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-xl border ${
                basis.hasRapat
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              {basis.hasRapat ? (
                <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <X size={14} className="text-amber-600 dark:text-amber-400" />
              )}
              <Text
                className={`text-xs font-semibold ${
                  basis.hasRapat
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {t('fir.firBasis.nakalRapat', isEn ? 'Nakal Rapat' : 'नकल रपट')}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
