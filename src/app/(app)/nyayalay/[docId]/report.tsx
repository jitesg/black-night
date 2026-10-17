/**
 * Nyayalay Report Screen  (v2 — fully redesigned)
 *
 * Changes vs v1:
 *   • Prompt 1 — Top summary card shows all 9 doc fields in a clean two-column
 *                grid: Court Name, Vad Sankhya, Apradh Sankhya, Sections,
 *                Accused Name, Father Name, Mobile, Address, Remarks.
 *   • Prompt 2 — Action Date replaced with tappable DatePickerField that opens
 *                the shared DatePickerModal (calendar bottom-sheet).
 *                Template selector upgraded to a prominent action card with icon,
 *                format-type badge and an amber accent stripe.
 *   • Prompt 3 — Report content already uses GeneratedReportView (kept as-is).
 *                Draft from fill-format auto-populates the editor on focus.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView,
  Pressable, ScrollView, Text, View,
} from 'react-native';
import { GeneratedReportView } from '@/components/common/GeneratedReportView';
import { FardCheckButton } from '@/components/fard/FardCheckButton';
import {
  DatePickerModal,
  dateStrToObj,
  dateObjToStr,
} from '@/components/common/DatePickerModal';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import {
  Calendar, ChevronRight, LayoutTemplate,
} from 'lucide-react-native';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getNyayalayDocWithDetails,
  getNyayalayReport,
  saveNyayalayReport,
  markNyayalayFinished,
  todayStr,
  DOC_TYPE_LABELS,
  type NyayalayDocWithDetails,
  type NyayalayPerson,
  type NyayalayReport,
} from '@/lib/db/nyayalayRepo';
import { nyayalayDraftStore } from '@/lib/nyayalayDraftStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';

const MODULE_COLOR = '#1D4ED8';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format "YYYY-MM-DD" → "DD MMM YYYY" for display */
function fmtDate(s: string): string {
  if (!s) return '—';
  const d = dateStrToObj(s);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Pick the first accused from persons array, fallback to appellant or null. */
function primaryPerson(persons: NyayalayPerson[]): NyayalayPerson | null {
  return (
    persons.find((p) => p.person_type === 'accused') ??
    persons.find((p) => p.person_type === 'appellant') ??
    null
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** One labelled cell for the summary grid. */
function InfoCell({ label, value }: { label: string; value?: string | null }) {
  const v = value?.trim() || '—';
  return (
    <View className="flex-1" style={{ minWidth: 0 }}>
      <Text className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">
        {label}
      </Text>
      <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

/** Horizontal rule inside the card. */
function Divider() {
  return <View className="h-px bg-border my-3" />;
}

/** Tappable date field that opens the shared DatePickerModal. */
function DatePickerField({
  label,
  value,
  accentColor = MODULE_COLOR,
  error,
  onConfirm,
}: {
  label: string;
  value: string;
  accentColor?: string;
  error?: string;
  onConfirm: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-2">
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center bg-card border border-border rounded-xl px-4 py-3.5 gap-3 active:opacity-70"
        style={{ borderCurve: 'continuous' }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${fmtDate(value)}`}
      >
        <Calendar size={16} color={accentColor} />
        <Text className="flex-1 text-sm text-foreground font-medium">
          {fmtDate(value)}
        </Text>
        <Text className="text-xs font-medium" style={{ color: accentColor }}>{t('common.edit')}</Text>
      </Pressable>
      {error ? (
        <Text className="text-xs text-destructive mt-1">{error}</Text>
      ) : null}
      <DatePickerModal
        visible={open}
        value={value}
        label={label}
        accentColor={accentColor}
        onConfirm={(v) => { onConfirm(v); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function NyayalayReportScreen() {
  const { docId } = useLocalSearchParams<{ docId: string }>();
  const { t } = useTranslation();

  const [doc, setDoc] = useState<NyayalayDocWithDetails | null>(null);
  const [existingReport, setExistingReport] = useState<NyayalayReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [actionDate, setActionDate] = useState(todayStr());
  const [reportContent, setReportContent] = useState('');
  const [formatTitle, setFormatTitle] = useState('');
  const [formatId, setFormatId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [backDialog, setBackDialog] = useState(false);
  const savedRef = useRef(false);
  const initialLoadDone = useRef(false);

  useFocusEffect(useCallback(() => {
    initialLoadDone.current = false;
    savedRef.current = false;

    const draft = nyayalayDraftStore.consume();

    (async () => {
      setLoading(true);
      try {
        const [d, r] = await Promise.all([
          docId ? getNyayalayDocWithDetails(docId) : null,
          docId ? getNyayalayReport(docId) : null,
        ]);
        setDoc(d);
        setExistingReport(r);

        if (draft) {
          setReportContent(draft.generatedText);
          setFormatTitle(draft.formatTitle);
          setFormatId(draft.formatId);
          setActionDate(todayStr());
        } else if (r) {
          setReportContent(r.report_content);
          setFormatTitle(r.format_title);
          setFormatId(r.format_id);
          setActionDate(r.report_date);
        }
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    })();
  }, [docId]));

  // Dirty tracking
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (!savedRef.current) setIsDirty(true);
  }, [actionDate, reportContent]);

  // Hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isDirty) { setBackDialog(true); return true; }
      return false;
    });
    return () => sub.remove();
  }, [isDirty]);

  const handleBack = () => {
    if (isDirty) setBackDialog(true);
    else router.back();
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!actionDate.trim()) e.actionDate = t('nyayalay.report.errorActionDateRequired');
    if (!reportContent.trim()) e.reportContent = t('nyayalay.report.errorReportEmpty');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFinalSave = async () => {
    if (!validate() || !docId) return;
    setSaving(true);
    try {
      await saveNyayalayReport(
        docId,
        reportContent.trim(),
        actionDate,
        formatTitle,
        formatId
      );
      await markNyayalayFinished(docId);
      savedRef.current = true;
      setIsDirty(false);
      router.back();
      router.back();
    } catch {
      setErrors({ general: t('nyayalay.form.errorSaveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTemplate = () => {
    if (!docId || !doc) return;
    const isAnya = doc.doc_type === 'Anya';
    if (isAnya) {
      router.push(`/(app)/nyayalay/select-format?docId=${docId}&mode=anya` as never);
    } else {
      router.push(`/(app)/nyayalay/select-format?docId=${docId}&tag=${doc.doc_type}` as never);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={MODULE_COLOR} />
      </View>
    );
  }

  const isAlreadyFinished = doc?.status === 'Finished' && !!existingReport;
  const accused = doc ? primaryPerson(doc.persons) : null;
  const allAccused = doc?.persons.filter((p) => p.person_type === 'accused') ?? [];

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'} className="flex-1">
      <View className="flex-1 bg-background">
        <AppHeader
          title={existingReport ? t('nyayalay.report.editReport') : t('nyayalay.report.generateReport')}
          subtitle={doc ? (DOC_TYPE_LABELS[doc.doc_type] ? t(`nyayalay.docType.${doc.doc_type}`) : doc.doc_type) : t('nyayalay.form.title')}
          onBack={handleBack}
          rightActions={
            <Pressable
              onPress={handleFinalSave}
              disabled={saving || isAlreadyFinished}
              className="rounded-xl px-4 py-2 active:opacity-70"
              style={{ backgroundColor: isAlreadyFinished ? '#9CA3AF' : MODULE_COLOR }}
            >
              <Text className="text-sm font-semibold text-white">
                {saving ? t('common.saving') : t('nyayalay.report.finalSave')}
              </Text>
            </Pressable>
          }
        />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 56 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Prompt 1: 9-field document summary card ──────────────── */}
          {doc && (
            <View
              className="bg-card border border-border rounded-2xl mt-4 mb-2 overflow-hidden"
              style={{ borderCurve: 'continuous' }}
            >
              {/* Coloured header stripe */}
              <View
                className="px-4 py-3 flex-row items-center gap-2"
                style={{ backgroundColor: `${MODULE_COLOR}0E` }}
              >
                <View
                  className="w-7 h-7 rounded-lg items-center justify-center"
                  style={{ backgroundColor: `${MODULE_COLOR}18` }}
                >
                  <LayoutTemplate size={14} color={MODULE_COLOR} />
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {doc.registration_number}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {DOC_TYPE_LABELS[doc.doc_type] ? t(`nyayalay.docType.${doc.doc_type}`) : doc.doc_type}{doc.sub_type ? ` · ${doc.sub_type}` : ''}
                  </Text>
                </View>
                {/* Status badge */}
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: doc.status === 'Finished' ? '#D1FAE5' : '#FEF9C3',
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{ color: doc.status === 'Finished' ? '#065F46' : '#92400E' }}
                  >
                    {doc.status === 'Finished' ? t('fir.list.filterFinished') : t('fir.list.filterPending')}
                  </Text>
                </View>
              </View>

              {/* ── Case fields ─────────────────────────────────────── */}
              <View className="px-4 pt-4 pb-2 gap-3">
                {/* Row 1: Court + Vad Sankhya */}
                <View className="flex-row gap-4">
                  <InfoCell label={t('nyayalay.detail.courtName')}    value={doc.court_name} />
                  <InfoCell label={t('nyayalay.detail.vadSankhya')}   value={doc.vad_sankhya} />
                </View>

                {/* Row 2: Apradh Sankhya + Sections */}
                <View className="flex-row gap-4">
                  <InfoCell label={t('nyayalay.detail.apradhSankhya')}  value={doc.apradh_sankhya} />
                  <InfoCell label={t('nyayalay.detail.applicableSections')}         value={doc.applicable_sections} />
                </View>

                <Divider />

                {/* ── Accused (primary person) ── */}
                {accused ? (
                  <>
                    <View className="flex-row gap-4">
                      <InfoCell label={t('nyayalay.form.nameRequired')} value={accused.name} />
                      <InfoCell label={t('nyayalay.form.fatherName')}  value={accused.father_name} />
                    </View>
                    <View className="flex-row gap-4">
                      <InfoCell label={t('nyayalay.form.mobile')}  value={accused.mobile} />
                      <InfoCell label={t('nyayalay.form.address')} value={accused.address} />
                    </View>
                    {accused.remarks ? (
                      <InfoCell label={t('nyayalay.form.remarks')} value={accused.remarks} />
                    ) : null}
                  </>
                ) : (
                  <Text className="text-xs text-muted-foreground italic">
                    {t('nyayalay.detail.noAccusedOnRecord')}
                  </Text>
                )}

                {/* If more than 1 accused — show count */}
                {allAccused.length > 1 && (
                  <View className="flex-row items-center gap-1 pb-1">
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${MODULE_COLOR}12` }}
                    >
                      <Text
                        className="text-[10px] font-semibold"
                        style={{ color: MODULE_COLOR }}
                      >
                        {t('nyayalay.detail.moreAccusedCount', { count: allAccused.length - 1 })}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {errors.general ? (
            <Text className="text-sm text-destructive mt-2">{errors.general}</Text>
          ) : null}

          {isAlreadyFinished && (
            <View
              className="rounded-xl px-4 py-3 mt-3"
              style={{ backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#6EE7B7' }}
            >
              <Text className="text-sm font-semibold" style={{ color: '#065F46' }}>
                {t('nyayalay.report.finishedBannerTitle')}
              </Text>
              <Text className="text-xs mt-1" style={{ color: '#047857' }}>
                {t('nyayalay.report.finishedBannerDesc')}
              </Text>
            </View>
          )}

          {/* ── Prompt 2a: Template selector — prominent action card ── */}
          <Text className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-5 mb-2">
            {t('nbw.templateLabel')}
          </Text>
          {(() => {
            // Use the NBW-specific label only for NBW; all other doc types (Summons,
            // Anya, …) get the generic "Add Template from Format" label.
            const addTemplatePlaceholder = doc?.doc_type === 'NBW'
              ? t('nbw.addNbwTemplate')
              : t('nbw.addTemplate');
            return (
              <Pressable
                onPress={handleSelectTemplate}
                className="bg-card border border-border rounded-2xl overflow-hidden active:opacity-70"
                style={{ borderCurve: 'continuous' }}
                accessibilityRole="button"
                accessibilityLabel={formatTitle || addTemplatePlaceholder}
              >
                {/* Amber accent left-stripe */}
                <View className="flex-row items-center">
                  <View
                    className="w-1 self-stretch"
                    style={{ backgroundColor: formatTitle ? '#D97706' : '#E5E7EB' }}
                  />
                  <View className="flex-1 flex-row items-center gap-3 px-4 py-4">
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center"
                      style={{ backgroundColor: formatTitle ? '#FEF3C7' : '#F3F4F6' }}
                    >
                      <LayoutTemplate
                        size={18}
                        color={formatTitle ? '#D97706' : '#9CA3AF'}
                      />
                    </View>
                    <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: formatTitle ? '#111827' : '#9CA3AF' }}
                        numberOfLines={1}
                      >
                        {formatTitle || addTemplatePlaceholder}
                      </Text>
                      {formatTitle ? (
                        <Text className="text-xs text-muted-foreground">
                          {t('nyayalay.report.tapToChangeTemplate')}
                        </Text>
                      ) : (
                        <Text className="text-xs" style={{ color: '#D97706' }}>
                          {t('nyayalay.report.selectNyayalayTemplate')}
                        </Text>
                      )}
                    </View>
                    <ChevronRight size={16} color="#9CA3AF" />
                  </View>
                </View>
              </Pressable>
            );
          })()}

          {/* ── Prompt 2b: Action Date — DatePickerField ─────────── */}
          <View className="mt-5">
            <DatePickerField
              label={t('nbw.actionDate')}
              value={actionDate}
              accentColor={MODULE_COLOR}
              error={errors.actionDate}
              onConfirm={(v) => setActionDate(v)}
            />
          </View>

          {/* ── Prompt 3: Report content — GeneratedReportView ──── */}
          <Text className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-5 mb-2">
            {t('nyayalay.report.reportContentLabel')}
          </Text>
          <GeneratedReportView
            content={reportContent}
            title={t('nyayalay.report.courtReportTitle')}
            onSave={async (v) => { setReportContent(v); setIsDirty(true); }}
            sharePrefix={
              doc
                ? `${doc.registration_number} · ${DOC_TYPE_LABELS[doc.doc_type]}`
                : undefined
            }
          />
          <FardCheckButton text={reportContent} title={formatTitle || doc?.registration_number} className="mt-2" />
          {errors.reportContent ? (
            <Text className="text-xs text-destructive mt-1">{errors.reportContent}</Text>
          ) : null}

          {/* Final Save note */}
          <View className="mt-4 bg-muted rounded-xl p-3" style={{ borderCurve: 'continuous' }}>
            <Text className="text-xs text-muted-foreground">
              {t('nyayalay.report.finalSaveNotePrefix')} <Text className="font-semibold">{t('fir.list.filterFinished')}</Text>.
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Back protection dialog */}
      <AlertDialog open={backDialog} onOpenChange={setBackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.unsavedDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setBackDialog(false)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { setBackDialog(false); setIsDirty(false); router.back(); }}
            >
              <Text>{t('common.discard')}</Text>
            </AlertDialogAction>
            <AlertDialogAction
              onPress={() => { setBackDialog(false); handleFinalSave(); }}
              className="bg-primary"
            >
              <Text className="text-primary-foreground font-semibold">{t('common.save')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </KeyboardAvoidingView>
  );
}
