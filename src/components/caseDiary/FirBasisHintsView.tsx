/**
 * FirBasisHintsView.tsx — Non-blocking AI hints for Case Diary vivran editing.
 * Debounced by 600ms, dismissible, amber for warn, grey for info.
 * Text displayed in the app's current language.
 * Never blocks saving.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, X } from 'lucide-react-native';
import type { FIR } from '@/lib/db/firRepo';
import { evaluateFirBasis, type FirBasisHint } from '@/lib/firBasis';

interface FirBasisHintsViewProps {
  fir?: Partial<FIR> | null;
  diaryDate?: string | null;
  text?: string | null;
  karyvahiKey?: string | null;
  hasDiaries?: boolean;
}

export function FirBasisHintsView({
  fir,
  diaryDate,
  text,
  karyvahiKey,
  hasDiaries,
}: FirBasisHintsViewProps) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || '').toLowerCase().startsWith('en');

  const [hints, setHints] = useState<FirBasisHint[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // 600ms debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fir) {
        setHints([]);
        return;
      }
      const rawHints = evaluateFirBasis({
        fir,
        diaryDate,
        text,
        karyvahiKey,
        hasDiaries,
      });
      setHints(rawHints);
    }, 600);

    return () => clearTimeout(timer);
  }, [fir, diaryDate, text, karyvahiKey, hasDiaries]);

  const visibleHints = hints.filter((h) => !dismissedIds.has(h.id));
  if (visibleHints.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <View className="mt-2.5 gap-2">
      {visibleHints.map((hint) => {
        const isWarn = hint.level === 'warn';
        const title = isEn ? hint.titleEn : hint.titleHi;
        const detail = isEn ? hint.detailEn : hint.detailHi;

        return (
          <View
            key={hint.id}
            className={`rounded-xl p-3 border flex-row items-start gap-2.5 ${
              isWarn
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-muted/60 border-border'
            }`}
            style={{ borderCurve: 'continuous' }}
          >
            <View className="mt-0.5">
              {isWarn ? (
                <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" />
              ) : (
                <Info size={15} className="text-muted-foreground" />
              )}
            </View>

            <View className="flex-1">
              <Text
                className={`text-xs font-semibold ${
                  isWarn
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-foreground'
                }`}
              >
                {title}
              </Text>
              <Text
                className={`text-[11px] leading-4 mt-0.5 ${
                  isWarn
                    ? 'text-amber-700/90 dark:text-amber-400/90'
                    : 'text-muted-foreground'
                }`}
              >
                {detail}
              </Text>
            </View>

            <Pressable
              onPress={() => handleDismiss(hint.id)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss hint"
              className="p-1 -mr-1 -mt-1 active:opacity-60"
            >
              <X size={14} className="text-muted-foreground" />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
