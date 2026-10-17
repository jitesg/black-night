/**
 * edit-case-diary-entry.tsx — Edit an existing Case Diary timeline entry.
 *
 * Supports both entry types:
 *   - 'karyvahi': edits vivran (and optionally karyvahi_name / format_used)
 *   - 'narrative': edits narrative_text (and optionally narrative_template)
 *
 * Route: /(app)/mukadma/[firId]/edit-case-diary-entry?entryId=<uuid>&diaryId=<uuid>
 * Returns to view-case-diary via router.back(); useFocusEffect on that screen
 * will automatically reload entries to reflect the update.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import {
  BackHandler, View, Text, ScrollView, Pressable, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { BookOpen, FileText, CheckSquare } from 'lucide-react-native';
import {
  getEntriesByDiary, updateEntry,
  type CaseDiaryEntry,
  getCaseDiaryById,
  type CaseDiary,
} from '@/lib/db/caseDiaryRepo';
import { getFIRById, type FIR } from '@/lib/db/firRepo';
import { FirBasisHintsView } from '@/components/caseDiary/FirBasisHintsView';
import { FardCheckButton } from '@/components/fard/FardCheckButton';
import { AppHeader } from '@/components/ui/ds/AppHeader';

// ─── Design tokens ──────────────────────────────────────────────────────────
const INDIGO = '#6366F1';

// ── Main screen ───────────────────────────────────────────────────────────────

export default function EditCaseDiaryEntryScreen() {
  const { firId, diaryId, entryId } = useLocalSearchParams<{
    firId: string; diaryId: string; entryId: string;
  }>();
  const { t } = useTranslation();

  const [entry, setEntry]       = useState<CaseDiaryEntry | null>(null);
  const [diary, setDiary]       = useState<CaseDiary | null>(null);
  const [fir, setFir]           = useState<FIR | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [vivran, setVivran]     = useState('');
  const [narrativeText, setNarrativeText] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState('');

  // Unsaved-changes protection
  const isDirty = useRef(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const handleBackPress = useCallback(() => {
    if (isDirty.current) { setShowDiscardDialog(true); } else { router.back(); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isDirty.current) { setShowDiscardDialog(true); return true; }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  // Load the specific entry from the diary's entry list
  useEffect(() => {
    if (!diaryId || !entryId) { setLoading(false); setLoadError('Missing parameters'); return; }
    let isMounted = true;
    (async () => {
      try {
        const [allEntries, d, f] = await Promise.all([
          getEntriesByDiary(diaryId),
          getCaseDiaryById(diaryId),
          firId ? getFIRById(firId) : Promise.resolve(null),
        ]);
        const found = allEntries.find((e) => e.id === entryId) ?? null;
        if (isMounted) {
          if (d) setDiary(d);
          if (f) setFir(f);
          if (found) {
            setEntry(found);
            setVivran(found.vivran ?? '');
            setNarrativeText(found.narrative_text ?? '');
          } else {
            setLoadError(t('fir.editCaseDiaryEntry.errorLoadFailed'));
          }
        }
      } catch (err) {
        logger.error('[EditCaseDiaryEntry] load error:', err);
        if (isMounted) setLoadError(t('fir.editCaseDiaryEntry.errorLoadFailed'));
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [diaryId, entryId, t]);

  const handleSave = async () => {
    if (!entry) return;
    setSaveError('');
    setSaving(true);
    try {
      if (entry.entry_type === 'karyvahi') {
        await updateEntry(entry.id, { vivran: vivran.trim() || undefined });
      } else {
        await updateEntry(entry.id, { narrative_text: narrativeText.trim() || undefined });
      }
      isDirty.current = false;
      router.back();
    } catch (err) {
      logger.error('[EditCaseDiaryEntry] save error:', err);
      setSaveError(t('fir.editCaseDiaryEntry.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={INDIGO} />
      </View>
    );
  }

  // ── Load error state ─────────────────────────────────────────────────────
  if (loadError || !entry) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader
          title={t('fir.editCaseDiaryEntry.title')}
          subtitle={t('fir.editCaseDiaryEntry.subtitle')}
          onBack={() => router.back()}
        />
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <BookOpen size={32} color="#9CA3AF" />
          <Text className="text-base font-bold text-foreground text-center">
            {loadError || t('fir.editCaseDiaryEntry.errorLoadFailed')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="rounded-xl px-5 py-3 mt-2 active:opacity-70"
            style={{ backgroundColor: INDIGO }}
          >
            <Text className="text-white text-sm font-bold">{t('fir.viewCaseDiary.goBack')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const isKaryvahi = entry.entry_type === 'karyvahi';

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
      className="flex-1 bg-background"
    >
      {/* ── Discard-changes confirmation ──────────────────────────────────── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fir.editCaseDiaryEntry.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('fir.editCaseDiaryEntry.discardDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>
              {t('fir.editCaseDiaryEntry.discardCancel')}
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => { setShowDiscardDialog(false); router.back(); }}>
              {t('fir.editCaseDiaryEntry.discardConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppHeader
        title={t('fir.editCaseDiaryEntry.title')}
        subtitle={t('fir.editCaseDiaryEntry.subtitle')}
        onBack={handleBackPress}
        rightActions={
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl px-4 py-2 active:opacity-70"
            style={{ backgroundColor: INDIGO }}
          >
            <Text className="text-white text-sm font-bold">
              {saving ? t('fir.editCaseDiaryEntry.saving') : t('fir.editCaseDiaryEntry.save')}
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="px-5 py-5 gap-4 pb-24"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Entry type badge */}
        <View
          className="bg-card border border-border rounded-2xl p-4 gap-3"
          style={{ borderCurve: 'continuous' }}
        >
          <View className="flex-row items-center gap-2">
            {isKaryvahi
              ? <CheckSquare size={14} color={INDIGO} />
              : <FileText size={14} color="#6B7280" />}
            <Text className="text-sm font-bold text-foreground">
              {isKaryvahi ? entry.karyvahi_name ?? '—' : t('fir.viewCaseDiary.narrativeLabel')}
            </Text>
          </View>
          {(entry.format_used || entry.narrative_template) ? (
            <View className="bg-purple-50 rounded-xl px-3 py-2">
              <Text className="text-xs font-semibold" style={{ color: '#7C3AED' }}>
                {t('fir.viewCaseDiary.formatLabel', {
                  title: entry.format_used ?? entry.narrative_template ?? '',
                })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Save error */}
        {saveError ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="text-sm text-destructive">{saveError}</Text>
          </View>
        ) : null}

        {/* Content editor */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {isKaryvahi ? t('fir.editCaseDiaryEntry.fieldVivran') : t('fir.editCaseDiaryEntry.fieldNarrative')}
          </Text>
          {isKaryvahi ? (
            <DocumentEditor
              value={vivran}
              onChangeText={(v) => { setVivran(v); isDirty.current = true; }}
              title={t('fir.editCaseDiaryEntry.vivranEditorTitle')}
              placeholder={t('fir.editCaseDiaryEntry.vivranPlaceholder')}
              accessibilityLabel={t('fir.editCaseDiaryEntry.vivranAccessibility')}
            />
          ) : (
            <DocumentEditor
              value={narrativeText}
              onChangeText={(v) => { setNarrativeText(v); isDirty.current = true; }}
              title={t('fir.editCaseDiaryEntry.narrativeEditorTitle')}
              placeholder={t('fir.editCaseDiaryEntry.narrativePlaceholder')}
              accessibilityLabel={t('fir.editCaseDiaryEntry.narrativeAccessibility')}
            />
          )}

          {/* FIR Basis Non-blocking Hints */}
          <FirBasisHintsView
            fir={fir}
            diaryDate={diary?.preparation_date}
            text={isKaryvahi ? vivran : narrativeText}
            karyvahiKey={isKaryvahi ? entry?.karyvahi_name : undefined}
            hasDiaries={true}
          />
          <FardCheckButton
            text={isKaryvahi ? vivran : narrativeText}
            title={isKaryvahi ? entry?.karyvahi_name : undefined}
            fir={fir}
            matchKeywords={true}
            className="mt-1"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
