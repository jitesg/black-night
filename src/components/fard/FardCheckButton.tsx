/**
 * FardCheckButton.tsx
 *
 * Always-visible button 'फर्द जाँचें' across all document and proceeding editors.
 * Non-blocking hints only, never blocks saving, zero network calls.
 *
 * Behavior:
 * - Rendered immediately on mount without any delay.
 * - On tap:
 *     • If a Fard type is detected: opens FardCheckSheet immediately.
 *     • If no type is detected: opens FardTypePickerSheet ('फर्द का प्रकार चुनें')
 *       with all 11 Fard types, then runs checkFard with the chosen type.
 * - Auto hints (600ms debounce in background):
 *     • Continuously calculates score and quality indicator in the background
 *       without delaying or hiding the button.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react-native';
import {
  detectFardType,
  checkFard,
  normalizeTextForMatching,
  type FardCheckResult,
} from '@/ai/fard/fardChecker';
import type { FIR } from '@/lib/db/firRepo';
import { FardCheckSheet } from './FardCheckSheet';
import { FardTypePickerSheet } from './FardTypePickerSheet';

export interface FardCheckButtonProps {
  text: string;
  title?: string;
  fir?: Partial<FIR> | null;
  /**
   * If true, also triggers when text mentions फर्द/बरामदगी/जब्ती/तलाशी
   * (specifically for case-diary karyvahi vivran).
   */
  matchKeywords?: boolean;
  className?: string;
}

export function FardCheckButton({
  text,
  title,
  fir,
  matchKeywords = false,
  className = '',
}: FardCheckButtonProps) {
  const { t } = useTranslation();

  // Background auto-hint state (debounced 600ms)
  const [autoResult, setAutoResult] = useState<FardCheckResult | null>(null);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  // Manual inspection / sheet state
  const [activeResult, setActiveResult] = useState<FardCheckResult | null>(null);
  const [checkSheetVisible, setCheckSheetVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);

  // Background auto-hint calculation with 600ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const clean = normalizeTextForMatching(text || '');
      let code = detectFardType(clean, title);

      if (!code && matchKeywords) {
        if (/फर्द|बरामदगी|जब्ती|तलाशी/i.test(clean)) {
          code = detectFardType(clean) || 'BARAMADGI';
        }
      }

      setDetectedCode(code);

      if (code) {
        const checkRes = checkFard({ text: text || '', typeCode: code, fir });
        if (checkRes.type) {
          setAutoResult(checkRes);
          return;
        }
      }
      setAutoResult(null);
    }, 600);

    return () => clearTimeout(timer);
  }, [text, title, fir, matchKeywords]);

  // Immediate tap handler — no delay!
  const handlePress = useCallback(() => {
    const rawText = text || '';
    const clean = normalizeTextForMatching(rawText);

    // Try already-detected code or compute on the fly
    let code = detectedCode || detectFardType(clean, title);
    if (!code && matchKeywords) {
      if (/फर्द|बरामदगी|जब्ती|तलाशी/i.test(clean)) {
        code = detectFardType(clean) || 'BARAMADGI';
      }
    }

    if (code) {
      const res = checkFard({ text: rawText, typeCode: code, fir });
      if (res.type) {
        setActiveResult(res);
        setCheckSheetVisible(true);
        return;
      }
    }

    // No type detected -> show 'फर्द का प्रकार चुनें' with 11 Fard types
    setTypePickerVisible(true);
  }, [text, title, fir, detectedCode, matchKeywords]);

  // When officer chooses a type from the 11 Fard types
  const handleSelectType = useCallback((chosenCode: string) => {
    setTypePickerVisible(false);
    const rawText = text || '';
    const res = checkFard({ text: rawText, typeCode: chosenCode, fir });
    setActiveResult(res);
    setCheckSheetVisible(true);
  }, [text, fir]);

  // Switch type from within the check sheet
  const handleChangeType = useCallback(() => {
    setCheckSheetVisible(false);
    setTypePickerVisible(true);
  }, []);

  // Visual cues from auto hints
  const hasAutoResult = !!(autoResult && autoResult.type);
  const isHighQuality = hasAutoResult && autoResult.score.ratio >= 0.8 && autoResult.warnings.length === 0;
  const hasWarnings = hasAutoResult && autoResult.warnings.length > 0;
  const scoreBadge = hasAutoResult ? ` (${autoResult.score.found}/${autoResult.score.total})` : '';

  return (
    <>
      <Pressable
        onPress={handlePress}
        className={`flex-row items-center gap-1.5 self-start px-3 py-1.5 rounded-full border active:opacity-70 ${
          isHighQuality
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : hasWarnings
            ? 'bg-amber-500/10 border-amber-500/30'
            : hasAutoResult
            ? 'bg-primary/10 border-primary/25'
            : 'bg-muted/30 border-border'
        } ${className}`}
        accessibilityLabel={t('fard.checkButton', 'फर्द जाँचें')}
        accessibilityRole="button"
      >
        <ShieldCheck
          size={14}
          color={
            isHighQuality
              ? '#10B981'
              : hasWarnings
              ? '#D97706'
              : hasAutoResult
              ? '#2563EB'
              : '#64748B'
          }
        />
        <Text
          className={`text-xs font-semibold ${
            isHighQuality
              ? 'text-emerald-700 dark:text-emerald-300'
              : hasWarnings
              ? 'text-amber-700 dark:text-amber-300'
              : hasAutoResult
              ? 'text-primary'
              : 'text-foreground'
          }`}
        >
          {t('fard.checkButton', 'फर्द जाँचें')}{scoreBadge}
        </Text>
      </Pressable>

      {/* Result Bottom Sheet */}
      <FardCheckSheet
        visible={checkSheetVisible}
        onClose={() => setCheckSheetVisible(false)}
        result={activeResult}
        onChangeType={handleChangeType}
      />

      {/* Type Picker Bottom Sheet (11 Fard types) */}
      <FardTypePickerSheet
        visible={typePickerVisible}
        onClose={() => setTypePickerVisible(false)}
        onSelectType={handleSelectType}
        selectedCode={activeResult?.type?.code || detectedCode}
      />
    </>
  );
}
