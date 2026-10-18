/**
 * add-case-diary.tsx — Case Diary header creation / edit screen.
 *
 * Flow:
 *   1. Fill basic info: Preparation Date, Start/End Time, Places Visited
 *   2. Tap "Save Case Diary"
 *        Create mode → creates diary, navigates to view-case-diary where
 *                       "Add Entry" (Karyvahi / Narrative) is immediately visible.
 *        Edit mode   → updates header, navigates back.
 *
 * Karyvahi / Narrative entries are added exclusively via the "Add Entry"
 * button in view-case-diary.tsx → add-case-diary-karyvahi.tsx, which
 * correctly calls addExecution() and updates execution_count.
 * The old inline "Add Karyvahi" draft flow is removed (v250).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BackHandler, View, Text, ScrollView, Pressable, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, X, AlertCircle, MapPin, Clock } from 'lucide-react-native';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import {
  createCaseDiary, updateCaseDiary, getCaseDiaryById, getCaseDiariesByFIR,
  serializePlaces, deserializePlaces,
  type CaseDiary,
} from '@/lib/db/caseDiaryRepo';
import { Input } from '@/components/ui/input';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useFIRContext } from '@/context/FIRContext';
import { recordFieldValues, FIELD_KEYS } from '@/lib/db/fieldValueHistoryRepo';
import { getFIRById, type FIR } from '@/lib/db/firRepo';
import { FirBasisCard } from '@/components/caseDiary/FirBasisCard';

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </Text>
      {children}
    </View>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { i18n } = useTranslation();
  const isHi = i18n.language === 'hi';
  const [show, setShow] = useState(false);
  const cleanLabel = label.replace(/\s*\*+\s*$/, '');
  const placeholder = isHi ? 'तारीख चुनें' : 'Select date';
  return (
    <Field label={label}>
      <Pressable
        onPress={() => setShow(true)}
        className="bg-secondary rounded-xl px-4 py-3 active:opacity-70 flex-row items-center justify-between"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value || placeholder}
        </Text>
      </Pressable>
      <DatePickerModal
        visible={show}
        value={value}
        label={cleanLabel}
        onConfirm={(v) => { onChange(v); setShow(false); }}
        onClose={() => setShow(false)}
      />
    </Field>
  );
}

// ─── Places Visited ───────────────────────────────────────────────────────────

function PlacesField({ places, onChange }: { places: string[]; onChange: (p: string[]) => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const addPlace = () => {
    const v = input.trim();
    if (v && !places.includes(v)) onChange([...places, v]);
    setInput('');
  };
  return (
    <Field label={t('fir.addCaseDiary.fieldPlaces')}>
      <View className="flex-row gap-2">
        <Input
          placeholder={t('fir.addCaseDiary.addPlacePlaceholder')}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={addPlace}
          returnKeyType="done"
          containerStyle={{ flex: 1 }}
        />
        <Pressable
          onPress={addPlace}
          className="rounded-xl px-4 py-3 items-center justify-center active:opacity-70"
          style={{ backgroundColor: '#6366F1' }}
        >
          <Plus size={16} color="#fff" />
        </Pressable>
      </View>
      {places.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mt-1">
          {places.map((p) => (
            <View
              key={p}
              className="flex-row items-center gap-1 bg-secondary rounded-full px-3 py-1.5"
            >
              <MapPin size={11} color="#6B7280" />
              <Text textBreakStrategy="simple" className="text-xs text-foreground">{p}</Text>
              <Pressable onPress={() => onChange(places.filter((x) => x !== p))} className="ml-0.5 active:opacity-60">
                <X size={11} color="#9CA3AF" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Field>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddCaseDiaryScreen() {
  const { firId: paramFirId, diaryId: paramDiaryId } =
    useLocalSearchParams<{ firId: string; diaryId?: string }>();
  const { activeFirId } = useFIRContext();

  const firId  = paramFirId?.trim() || activeFirId?.trim() || '';
  const isEdit = !!paramDiaryId;
  const { t } = useTranslation();

  const [prepDate, setPrepDate]   = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [places, setPlaces]       = useState<string[]>([]);
  const [diaryNumber, setDiaryNumber] = useState<number | null>(null);
  const [fir, setFir] = useState<FIR | null>(null);

  const [diary, setDiary]   = useState<CaseDiary | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  // ── Unsaved-changes protection ───────────────────────────────────────────
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

  // Load existing diary header (edit mode) or compute next diary number (create mode)
  useEffect(() => {
    if (!firId) return;
    (async () => {
      try {
        const [firRecord, allDiaries] = await Promise.all([
          getFIRById(firId),
          getCaseDiariesByFIR(firId),
        ]);
        if (firRecord) setFir(firRecord);
        if (isEdit && paramDiaryId) {
          const sorted = [...allDiaries].sort((a, b) => a.created_at - b.created_at);
          const pos = sorted.findIndex((d) => d.id === paramDiaryId);
          setDiaryNumber(pos >= 0 ? pos + 1 : allDiaries.length);
          const d = await getCaseDiaryById(paramDiaryId);
          if (d) {
            setDiary(d);
            setPrepDate(d.preparation_date ?? '');
            setStartTime(d.start_time ?? '');
            setEndTime(d.end_time ?? '');
            setPlaces(deserializePlaces(d.places_visited));
          }
        } else {
          setDiaryNumber(allDiaries.length + 1);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firId]);

  // Save: create or update header, then navigate directly to view-case-diary
  // so "Add Entry" is immediately visible without any re-open.
  const handleSave = async () => {
    if (!prepDate) { setError(t('fir.addCaseDiary.errorPrepDate')); return; }

    // ── Chronology validation ────────────────────────────────────────────────
    setSaving(true);
    try {
      const [fir, allDiaries] = await Promise.all([
        getFIRById(firId),
        getCaseDiariesByFIR(firId),
      ]);
      const sorted = [...allDiaries].sort((a, b) => a.created_at - b.created_at);
      const newPrepDate = new Date(prepDate);

      // Check 1: CD date must be >= FIR date_of_information
      if (fir?.date_of_information) {
        if (newPrepDate < new Date(fir.date_of_information)) {
          setError(`केस डायरी की तारीख एफआईआर दर्ज तारीख (${fir.date_of_information}) से पहले नहीं हो सकती।`);
          setSaving(false);
          return;
        }
      }

      // Check 2: new CD must be >= last existing CD
      if (!isEdit && sorted.length > 0) {
        const lastDiary = sorted[sorted.length - 1];
        if (lastDiary.preparation_date && newPrepDate < new Date(lastDiary.preparation_date)) {
          setError(`तारीख पिछली केस डायरी (${lastDiary.preparation_date}) की तारीख से पहले नहीं हो सकती।`);
          setSaving(false);
          return;
        }
      } else if (isEdit && diary?.id) {
        // Edit: must not be earlier than previous CD in sorted sequence
        const currentIndex = sorted.findIndex((d) => d.id === diary.id);
        if (currentIndex > 0) {
          const prevDiary = sorted[currentIndex - 1];
          if (prevDiary.preparation_date && newPrepDate < new Date(prevDiary.preparation_date)) {
            setError(`तारीख CD-${currentIndex} (${prevDiary.preparation_date}) से पहले नहीं हो सकती।`);
            setSaving(false);
            return;
          }
        }
      }
    } catch {
      // Non-critical: if fetch fails, skip chronology check and allow save
    }
    // ── End chronology validation ────────────────────────────────────────────

    setError('');
    // setSaving(true) already called above; keep it set through the save
    try {
      let activeDiaryId: string;
      if (isEdit && diary?.id) {
        await updateCaseDiary(diary.id, {
          preparation_date: prepDate,
          start_time: startTime || undefined,
          end_time: endTime || undefined,
          places_visited: places.length ? serializePlaces(places) : undefined,
        });
        activeDiaryId = diary.id;
      } else {
        const newDiary = await createCaseDiary({
          fir_id: firId,
          preparation_date: prepDate,
          start_time: startTime || undefined,
          end_time: endTime || undefined,
          places_visited: places.length ? serializePlaces(places) : undefined,
        });
        activeDiaryId = newDiary.id;
      }
      if (isEdit) {
        // Edit mode: simply pop back to view-case-diary (already in stack below us).
        router.back();
      } else {
        // Create mode: replace so pressing Back from view-case-diary goes to
        // the case-diary list, not back to an empty creation form.
        router.replace({
          pathname: '/(app)/mukadma/[firId]/view-case-diary' as never,
          params: { firId, diaryId: activeDiaryId },
        });
      }

      // ── Record place names for autocomplete (fire-and-forget) ───────────
      if (places.length > 0) {
        (async () => {
          try {
            await recordFieldValues(FIELD_KEYS.address, places);
          } catch { /* non-critical */ }
        })();
      }
    } catch {
      setError(t('fir.addCaseDiary.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
      className="flex-1 bg-background"
    >
      {/* ── Discard-changes confirmation ──────────────────────────────────── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fir.addCaseDiary.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('fir.addCaseDiary.discardDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>
              {t('fir.addCaseDiary.discardCancel')}
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => { setShowDiscardDialog(false); router.back(); }}>
              {t('fir.addCaseDiary.discardConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppHeader
        title={isEdit ? t('fir.addCaseDiary.titleEdit') : t('fir.addCaseDiary.titleNew')}
        subtitle={t('fir.addCaseDiary.subtitle')}
        onBack={handleBackPress}
        rightActions={
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl px-4 py-2 active:opacity-70"
            style={{ backgroundColor: '#6366F1' }}
          >
            <Text className="text-white text-sm font-bold">{saving ? t('fir.addCaseDiary.saving') : t('fir.addCaseDiary.save')}</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="px-5 py-5 gap-5 pb-28"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── FIR आधार Collapsible Card ────────────────────────────────────── */}
        <FirBasisCard fir={fir} />

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex-row items-center gap-2">
            <AlertCircle size={14} color="#DC2626" />
            <Text className="text-sm text-destructive flex-1">{error}</Text>
          </View>
        ) : null}

        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {t('fir.addCaseDiary.sectionBasicInfo')}
            </Text>
            {diaryNumber !== null && (
              <View className="bg-secondary rounded-full px-2.5 py-1">
                <Text textBreakStrategy="simple" className="text-xs font-bold text-foreground">
                  {t('fir.addCaseDiary.diaryNoLabel', { n: String(diaryNumber).padStart(2, '0') })}
                </Text>
              </View>
            )}
          </View>

          <DateField label={t('fir.addCaseDiary.fieldPrepDate')} value={prepDate} onChange={(v) => { isDirty.current = true; setPrepDate(v); }} />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label={t('fir.addCaseDiary.fieldStartTime')}>
                <Input type="time" value={startTime} onChangeText={(v) => { isDirty.current = true; setStartTime(v); }} />
              </Field>
            </View>
            <View className="flex-1">
              <Field label={t('fir.addCaseDiary.fieldEndTime')}>
                <Input type="time" value={endTime} onChangeText={(v) => { isDirty.current = true; setEndTime(v); }} />
              </Field>
            </View>
          </View>

          <PlacesField places={places} onChange={(p) => { isDirty.current = true; setPlaces(p); }} />
        </View>

        {/* Guidance note: entries are added in view-case-diary */}
        <View className="bg-secondary rounded-2xl px-4 py-4 gap-1" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs font-semibold text-foreground">{t('fir.addCaseDiary.nextStepTitle')}</Text>
          <Text className="text-xs text-muted-foreground leading-5">
            {t('fir.addCaseDiary.nextStepDesc')}{' '}
            <Text className="font-semibold text-foreground">{t('fir.addCaseDiary.nextStepHighlight')}</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
