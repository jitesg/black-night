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
 *   • रिपोर्ट = DocumentEditor (owner, like the प्रार्थना पत्र आख्या); .doc in the header.
 *                Draft from fill-format auto-populates the editor on focus.
 */
import { markedToEditorHtml } from '@/lib/reportLayout';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView,
  Pressable, ScrollView, Text, View,
} from 'react-native';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { HeaderDocButton } from '@/components/common/ReportFormParts';
import { isHtml, markdownToHtml } from '@/lib/markdownToHtml';
import { htmlToPlainText } from '@/lib/stringUtils';
import { FardCheckButton } from '@/components/fard/FardCheckButton';
import { DatePickerModal, dateStrToObj } from '@/components/common/DatePickerModal';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, LayoutTemplate } from 'lucide-react-native';
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
import { AddFromFormatCard } from '@/components/ui/ds/AddFromFormatCard';

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

/** Any value → editor HTML (old plain-text report → paragraphs; HTML kept as is). Same as the प्रार्थना पत्र आख्या. */
function toEditorHtml(v: string): string {
  if (!v.trim()) return '';
  return isHtml(v) ? v : markdownToHtml(v);
}

export default function NyayalayReportScreen() {
  const { docId } = useLocalSearchParams<{ docId: string }>();
  const { t } = useTranslation();

  const [doc, setDoc] = useState<NyayalayDocWithDetails | null>(null);
  const [existingReport, setExistingReport] = useState<NyayalayReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [actionDate, setActionDate] = useState(todayStr());
  const [reportContent, setReportContent] = useState('');
  // the format's marked text (layout) — used for A4 / .doc / the editor while reportContent is unchanged (reportLayout.ts)
  const [reportMarked, setReportMarked] = useState('');
  const [formatTitle, setFormatTitle] = useState('');
  const [formatId, setFormatId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [backDialog, setBackDialog] = useState(false);
  const savedRef = useRef(false);
  const initialLoadDone = useRef(false);
  // what the screen opened with (the saved report, or nothing) — loading it is not a change (owner: the "बिना सहेजे" dialog
  // came up on back with nothing changed). Text compared as plain text, so the editor's own HTML tidy-up is not a change either.
  const baselineRef = useRef<{ text: string; date: string }>({ text: '', date: todayStr() });

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
        baselineRef.current = {
          text: r ? htmlToPlainText(r.report_marked ? markedToEditorHtml(r.report_marked) : toEditorHtml(r.report_content)).trim() : '',
          date: r ? r.report_date : todayStr(),
        };

        // रिपोर्ट box = the rich editor (owner): its value is editor HTML; a format's layout (marks) goes in as data-fmt
        if (draft) {
          setReportContent(draft.markedText?.trim() ? markedToEditorHtml(draft.markedText) : toEditorHtml(draft.generatedText));
          setReportMarked('');
          setFormatTitle(draft.formatTitle);
          setFormatId(draft.formatId);
          setActionDate(todayStr());
        } else if (r) {
          setReportContent(r.report_marked ? markedToEditorHtml(r.report_marked) : toEditorHtml(r.report_content));
          setReportMarked('');
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

  // Dirty tracking — only a real change from what the screen opened with (a format draft is one)
  useEffect(() => {
    if (!initialLoadDone.current || savedRef.current) return;
    const b = baselineRef.current;
    setIsDirty(htmlToPlainText(reportContent).trim() !== b.text || actionDate !== b.date);
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
    if (!htmlToPlainText(reportContent).trim()) e.reportContent = t('nyayalay.report.errorReportEmpty');
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
        formatId,
        // always '' now — the editor HTML itself carries the layout marks (data-fmt)
        reportMarked
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
          // owner: only .doc here (faded while empty); अंतिम सहेजें moved to the bottom, under the editor
          rightActions={<HeaderDocButton source={reportContent} title={formatTitle || t('nyayalay.report.courtReportTitle')} />}
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
                    {doc.court_name || doc.document_title || doc.vad_sankhya || (DOC_TYPE_LABELS[doc.doc_type] ? t(`nyayalay.docType.${doc.doc_type}`) : doc.doc_type)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {DOC_TYPE_LABELS[doc.doc_type] ? t(`nyayalay.docType.${doc.doc_type}`) : doc.doc_type}{doc.sub_type ? ` · ${doc.sub_type}` : ''}
                  </Text>
                </View>
                {/* Status badge */}
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{
                    backgroundColor: doc.status === 'Finished' ? '#D1FAE5' : '#FEF9C3',
                  }}
                >
                  <Text textBreakStrategy="simple"
                    className="text-[10px] font-semibold"
                    style={{ color: doc.status === 'Finished' ? '#065F46' : '#92400E' }}
                  >
                    {doc.status === 'Finished' ? t('nyayalay.status.nistarit') : t('fir.list.filterPending')}
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
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: `${MODULE_COLOR}12` }}
                    >
                      <Text textBreakStrategy="simple"
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
              <AddFromFormatCard
                title={formatTitle || addTemplatePlaceholder}
                subtitle={formatTitle ? t('nyayalay.report.tapToChangeTemplate') : t('nyayalay.report.selectNyayalayTemplate')}
                onPress={handleSelectTemplate}
                color={MODULE_COLOR}
              />
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

          {/* ── रिपोर्ट = the rich editor (owner; same DocumentEditor as the प्रार्थना पत्र आख्या) — compact card, tap → full
              screen; its पूर्वावलोकन = A4. The old copy / share / A4 / .doc / edit row is gone (.doc = header). ──── */}
          <Text className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-5 mb-2">
            {t('nyayalay.report.reportContentLabel')}
          </Text>
          <DocumentEditor
            value={reportContent}
            onChangeText={(v) => { setReportContent(v); setErrors((e) => ({ ...e, reportContent: '' })); }}
            title={formatTitle || t('nyayalay.report.courtReportTitle')}
            placeholder={t('nyayalay.report.editorPlaceholder')}
            minHeight={160}
            error={!!errors.reportContent}
            accessibilityLabel={t('nyayalay.report.reportContentLabel')}
          />
          <FardCheckButton text={htmlToPlainText(reportContent)} title={formatTitle || doc?.document_title || undefined} className="mt-2" />
          {errors.reportContent ? (
            <Text className="text-xs text-destructive mt-1">{errors.reportContent}</Text>
          ) : null}

          {/* Final Save note — above the button, read before pressing (owner) */}
          <View className="mt-4 bg-muted rounded-xl p-3" style={{ borderCurve: 'continuous' }}>
            <Text className="text-xs text-muted-foreground">
              ⓘ {t('nyayalay.report.finalSaveNotePrefix')} <Text className="font-semibold">{t('nyayalay.status.nistarit')}</Text>.
            </Text>
          </View>

          {/* अंतिम सहेजें — full width at the bottom (owner; was in the header) */}
          <Pressable
            onPress={handleFinalSave}
            disabled={saving || isAlreadyFinished}
            accessibilityRole="button"
            accessibilityLabel={t('nyayalay.report.finalSave')}
            style={{ marginTop: 12 }}
          >
            <View style={{
              backgroundColor: isAlreadyFinished ? '#9CA3AF' : MODULE_COLOR, borderRadius: 14, paddingVertical: 15,
              alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.7 : 1, borderCurve: 'continuous',
            }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                {saving ? t('common.saving') : `✓ ${t('nyayalay.report.finalSave')}`}
              </Text>
            </View>
          </Pressable>
        </ScrollView>
      </View>

      {/* Back protection dialog (owner, sample approved): ⚠️ + clear words; अंतिम सहेजें (module blue, says it marks निस्तारित;
          grey + off when the paper already is), बिना सहेजे बाहर जाएँ (red outline), रद्द करें — यहीं रहें.
          AlertDialogFooter is flex-col-reverse: written in REVERSE of the on-screen order. */}
      <AlertDialog open={backDialog} onOpenChange={setBackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
            </View>
            <AlertDialogTitle>{t('nyayalay.report.backTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('nyayalay.report.backDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setBackDialog(false)}>
              <Text>{t('nyayalay.report.backStay')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { setBackDialog(false); setIsDirty(false); router.back(); }}
              style={{ backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#DC2626' }}
            >
              <View><Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 15 }}>{t('nyayalay.report.backDiscard')}</Text></View>
            </AlertDialogAction>
            <AlertDialogAction
              disabled={isAlreadyFinished || saving}
              onPress={() => { if (isAlreadyFinished) return; setBackDialog(false); handleFinalSave(); }}
              style={{ backgroundColor: isAlreadyFinished ? '#D1D5DB' : MODULE_COLOR, height: undefined, minHeight: 52, paddingVertical: 8 }}
            >
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: isAlreadyFinished ? '#6B7280' : '#FFFFFF', fontWeight: '700', fontSize: 15 }}>✓ {t('nyayalay.report.finalSave')}</Text>
                <Text style={{ color: isAlreadyFinished ? '#6B7280' : '#FFFFFF', fontSize: 11.5, opacity: 0.9 }}>
                  {isAlreadyFinished ? t('nyayalay.report.backSaveDone') : t('nyayalay.report.backSaveSub')}
                </Text>
              </View>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </KeyboardAvoidingView>
  );
}
