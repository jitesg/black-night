/**
 * Report screen — Feature 3
 *
 * For petition types in REPORT_PETITION_TYPES ("RL", "जनता दर्शन", "CO पेशी", "SDM", "DM"):
 *   - Header subtitle = प्रकार · first आवेदक
 *   - Opens straight on the आख्या form (owner: no details card / "रिपोर्ट लगाएं" step) + "Add from Format" button
 *   - Format picker navigates to select-format filtered to "Prarthna Patra"
 *   - Generated format text is injected via ppReportDraftStore
 *   - आख्या box = DocumentEditor (owner): compact card + full-screen rich editor; its पूर्वावलोकन = A4 sheet.
 *     A format comes in as editor HTML with hidden data-fmt marks, so A4 / .doc keep its layout even after edits.
 *   - ".doc" button at the top right of the header (owner), faded while the आख्या is empty
 *   - Save stores to saveReport() and navigates back
 *
 * For all other types: unchanged original report-editor behaviour.
 */
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { markedToEditorHtml } from '@/lib/reportLayout';
import { isHtml, markdownToHtml } from '@/lib/markdownToHtml';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, Pressable, KeyboardAvoidingView,
  BackHandler, ActivityIndicator, Alert,
} from 'react-native';
import { Input } from '@/components/ui/input';
import { GeneratedReportView } from '@/components/common/GeneratedReportView';
import { router, useLocalSearchParams, type RelativePathString } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  getPPWithDetails,
  saveReport,
  _todayString,
  PETITION_TYPE_LABELS,
  type PPWithDetails,
} from '@/lib/db/prarthnaPatraRepo';
import { ppReportDraftStore } from '@/lib/ppReportDraftStore';
import { htmlToPlainText } from '@/lib/stringUtils';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { AddFromFormatCard } from '@/components/ui/ds/AddFromFormatCard';
import { CalendarDays, Download } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { DatePickerModal } from '@/components/common/DatePickerModal';

/** Petition types that use the inline report-attach flow */
// थाना प्रार्थना पत्र / RTI / अन्य added (owner): same screen with "प्रारूप से जोड़ें" for every petition except बीट सूचना / NCR.
const REPORT_PETITION_TYPES = new Set(['RL', 'जनता दर्शन', 'CO पेशी', 'SDM', 'DM', 'थाना प्रार्थना पत्र', 'RTI', 'अन्य']);

// ── Main screen ───────────────────────────────────────────────────────────────
/** "2026-11-17" → "17/11/2026" (owner: dates as dd/mm/yyyy everywhere); anything else unchanged. */
function showDate(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Date box that opens the app's calendar (DatePickerModal) — same look as the other form boxes. */
function ReportDateField({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, color: C.mutedForeground, fontWeight: '500' }}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel={`${label} चुनें`}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderWidth: 1, borderColor: error ? C.destructive : C.border, borderRadius: 12,
          paddingHorizontal: 14, minHeight: 48, backgroundColor: C.card,
        }}>
          <Text style={{ fontSize: 15, color: value ? C.foreground : C.mutedForeground }}>
            {value ? showDate(value) : 'तारीख चुनें (dd/mm/yyyy)'}
          </Text>
          <CalendarDays size={18} color={C.mutedForeground} />
        </View>
      </Pressable>
      {error ? <Text style={{ fontSize: 12, color: C.destructive }}>{error}</Text> : null}
      <DatePickerModal
        visible={open}
        value={value}
        label={label}
        onConfirm={(v) => { onChange(v); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/** Any value → editor HTML (old plain-text आख्या → paragraphs; HTML kept as is). */
function toEditorHtml(v: string): string {
  if (!v.trim()) return '';
  return isHtml(v) ? v : markdownToHtml(v);
}

/** Header ".doc" button (owner: top right) — faded and not pressable while the आख्या is empty. */
function HeaderDocButton({ source, title }: { source: string; title: string }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const [busy, setBusy] = useState(false);
  const empty = !htmlToPlainText(source).trim();
  const exportWord = async () => {
    if (busy || empty) return;
    setBusy(true);
    try {
      // loaded on tap only — keeps the docx library out of the screen's first render
      const { exportReportToDocx } = await import('@/lib/reportDocxExport');
      await exportReportToDocx(source, title);
    } catch (e) {
      Alert.alert('Word फ़ाइल नहीं बनी', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const fg = empty ? C.mutedForeground : C.primaryForeground;
  return (
    <Pressable onPress={exportWord} disabled={busy || empty} accessibilityLabel="Word फ़ाइल (.doc)" style={{ marginLeft: 4 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
        backgroundColor: empty ? C.muted : C.primary, opacity: busy ? 0.7 : 1,
      }}>
        {busy ? <ActivityIndicator size={14} color={fg} /> : <Download size={14} color={fg} />}
        <Text numberOfLines={1} textBreakStrategy="simple" style={{ fontSize: 14, fontWeight: '700', color: fg }}>.doc</Text>
      </View>
    </Pressable>
  );
}

export default function ReportScreen() {
  const { t } = useTranslation();
  const { ppId } = useLocalSearchParams<{ ppId: string }>();
  const [pp, setPP] = useState<PPWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [reportDate, setReportDate] = useState(_todayString());
  // inline flow: editor HTML (formats keep their layout as hidden data-fmt marks)
  const [reportContent, setReportContent] = useState('');
  // latest value for the focus callback (it is created once per ppId)
  const contentRef = useRef('');
  contentRef.current = reportContent;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [backDialogOpen, setBackDialogOpen] = useState(false);
  const savedRef = useRef(false);

  // keeps the ScrollView ref (scroll position)
  const scrollRef = useRef<ScrollView>(null);

  const initialLoadDone = useRef(false);

  // Load petition + existing report; consume format draft on every focus
  useFocusEffect(useCallback(() => {
    (async () => {
      // 1. Initial DB load — runs only once to avoid overwriting user edits
      //    when returning from the format selector screen
      if (!initialLoadDone.current) {
        setLoading(true);
        try {
          const data = ppId ? await getPPWithDetails(ppId) : null;
          setPP(data);
          if (data?.report) {
            setReportDate(data.report.report_preparation_date);
            // Strict assignment — no `prev ||` fallback so users can clear the field.
            // Inline flow = editor HTML. A report saved from the old plain box with its format's layout (report_marked)
            // opens as that layout; other plain text becomes paragraphs.
            const rc = data.report.report_content ?? '';
            const inline = REPORT_PETITION_TYPES.has(data.petition_type);
            const shown = !inline ? rc
              : data.report.report_marked ? markedToEditorHtml(data.report.report_marked)
              : toEditorHtml(rc);
            setReportContent(shown);
            contentRef.current = shown; // a draft consumed below in this same run appends to it
          }
        } finally {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }

      // 2. Consume draft — runs on initial load AND when returning from format screen
      const draft = ppReportDraftStore.consume();
      if (draft) {
        // the format as editor HTML with its layout marks (plain text when it has none), after any text already there
        const prev = contentRef.current;
        const added = draft.markedText?.trim() ? markedToEditorHtml(draft.markedText) : toEditorHtml(draft.generatedText);
        const next = htmlToPlainText(prev).trim() ? `${toEditorHtml(prev)}<p><br></p>${added}` : added;
        setReportContent(next);
        contentRef.current = next;
        setIsDirty(true);
      }
    })();
  }, [ppId]));

  // Track dirty state after initial load
  const initialLoadRef = useRef(true);
  useEffect(() => {
    if (loading) { initialLoadRef.current = true; return; }
    if (initialLoadRef.current) { initialLoadRef.current = false; return; }
    if (!savedRef.current) setIsDirty(true);
  }, [reportDate, reportContent, loading]);

  // Hardware back handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isDirty) { setBackDialogOpen(true); return true; }
      return false;
    });
    return () => sub.remove();
  }, [isDirty]);

  const handleBack = () => {
    if (isDirty) setBackDialogOpen(true);
    else router.back();
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!reportDate.trim()) e.reportDate = t('prarthnaPatra.report.errorReportDate');
    if (!htmlToPlainText(reportContent).trim()) e.reportContent = t('prarthnaPatra.report.errorReportContent');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !ppId) return;
    setSaving(true);
    try {
      // the editor HTML carries the layout itself → no separate marked text
      await saveReport(ppId, reportDate, reportContent.trim(), '');
      savedRef.current = true;
      setIsDirty(false);
      router.back();
    } catch {
      setErrors({ general: t('prarthnaPatra.report.errorSaveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleAddFromFormat = () => {
    router.push(
      `/(app)/prarthna-patra/select-format?mode=report&ppId=${ppId}` as RelativePathString
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const useInlineFlow = pp?.petition_type ? REPORT_PETITION_TYPES.has(pp.petition_type) : false;

  // ── Inline report-attach flow (Feature 3) ──────────────────────────────────
  if (useInlineFlow) {
    const reportTitle = pp?.petition_type ? `${PETITION_TYPE_LABELS[pp.petition_type]} आख्या` : 'आख्या';
    return (
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-background">
          <AppHeader
            title={pp?.report ? t('prarthnaPatra.report.editTitle') : t('prarthnaPatra.report.addTitle')}
            subtitle={[pp?.petition_type ? PETITION_TYPE_LABELS[pp.petition_type] : '', pp?.complainants[0]?.name ?? ''].filter(Boolean).join(' · ')}
            onBack={handleBack}
            // owner: one सहेजें only — the big button under the आख्या box (the header one was a second copy).
            // .doc at the top right (after 🤖 / 🔔, which AppHeader adds itself).
            rightActions={<HeaderDocButton source={reportContent} title={reportTitle} />}
          />

          <ScrollView
            ref={scrollRef}
            contentContainerClassName="px-5 pb-16"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* owner: no "प्रार्थना पत्र विवरण" card and no "रिपोर्ट लगाएं" step — the detail screen already shows all of it;
                the header's small line says whose आख्या it is (प्रकार · first आवेदक) */}
            {errors.general ? (
              <Text className="text-sm text-destructive mt-3">{errors.general}</Text>
            ) : null}

            {/* ── Inline editor ── */}
              <View className="mt-5 gap-3">
                {/* आख्या की तिथि — calendar picker (owner), shown dd/mm/yyyy, stored YYYY-MM-DD as before */}
                <ReportDateField
                  label={t('prarthnaPatra.report.fieldReportDate')}
                  value={reportDate}
                  onChange={setReportDate}
                  error={errors.reportDate}
                />

                {/* Add from Format button */}
                <AddFromFormatCard
                  title={t('prarthnaPatra.report.btnAddFromFormat')}
                  onPress={handleAddFromFormat}
                />

                {/* आख्या box = the rich editor (owner) — compact card, tap → full screen; पूर्वावलोकन = A4 sheet */}
                <DocumentEditor
                  value={reportContent}
                  onChangeText={(v) => { setReportContent(v); setErrors((e) => ({ ...e, reportContent: '' })); }}
                  title={reportTitle}
                  placeholder={t('prarthnaPatra.report.contentPlaceholder')}
                  minHeight={160}
                  error={!!errors.reportContent}
                  accessibilityLabel={reportTitle}
                />
                {errors.reportContent ? (
                  <Text className="text-xs text-destructive">{errors.reportContent}</Text>
                ) : null}

                {/* Save button */}
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className="bg-primary rounded-xl py-4 items-center justify-center active:opacity-70"
                  style={{ borderCurve: 'continuous', opacity: saving ? 0.6 : 1 }}
                >
                  <Text className="text-base font-bold text-primary-foreground">
                    {saving ? t('common.saving') : t('prarthnaPatra.report.btnSave')}
                  </Text>
                </Pressable>
              </View>
          </ScrollView>
        </View>

        {/* Back protection dialog */}
        <AlertDialog open={backDialogOpen} onOpenChange={setBackDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('prarthnaPatra.report.unsavedTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('prarthnaPatra.report.unsavedDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onPress={() => setBackDialogOpen(false)}>
                <Text>{t('common.cancel')}</Text>
              </AlertDialogCancel>
              <AlertDialogAction onPress={() => { setBackDialogOpen(false); setIsDirty(false); router.back(); }}>
                <Text>{t('common.discard')}</Text>
              </AlertDialogAction>
              <AlertDialogAction onPress={() => { setBackDialogOpen(false); handleSave(); }}>
                <Text>{t('common.save')}</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </KeyboardAvoidingView>
    );
  }

  // ── Original report editor (all other petition types) ─────────────────────
  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
      className="flex-1"
    >
      <View className="flex-1 bg-background">
        <AppHeader
          title={pp?.report ? t('prarthnaPatra.report.editTitle') : t('prarthnaPatra.report.addTitle')}
          subtitle={pp?.petition_type ? PETITION_TYPE_LABELS[pp.petition_type] : ''}
          onBack={handleBack}
          rightActions={
            <Pressable onPress={handleSave} disabled={saving} className="bg-primary rounded-xl px-4 py-2 active:opacity-70">
              <Text className="text-sm font-semibold text-primary-foreground">{saving ? t('common.saving') : t('common.save')}</Text>
            </Pressable>
          }
        />

        <ScrollView
          contentContainerClassName="px-5 pb-10"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Petition context */}
          {pp && (
            <View
              className="bg-muted rounded-xl p-3 mt-4 mb-2"
              style={{ borderCurve: 'continuous' }}
            >
              <Text className="text-xs text-muted-foreground">
                {PETITION_TYPE_LABELS[pp.petition_type]}
              </Text>
              {pp.complainants[0]?.name ? (
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {t('prarthnaPatra.report.complainantName', { name: pp.complainants[0].name })}
                </Text>
              ) : null}
            </View>
          )}

          {errors.general ? (
            <Text className="text-sm text-destructive mt-2">{errors.general}</Text>
          ) : null}

          {/* Report Preparation Date */}
          <View className="mt-5">
            <Input
              type="date"
              label={t('prarthnaPatra.report.fieldReportDate')}
              placeholder="YYYY-MM-DD"
              value={reportDate}
              onChangeText={setReportDate}
              errorText={errors.reportDate}
            />
          </View>

          {/* Report Editor */}
          <Text className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-5 mb-2">
            {t('prarthnaPatra.report.sectionReportEditor')}
          </Text>
          <GeneratedReportView
            content={reportContent}
            title={t('prarthnaPatra.report.editorTitle')}
            onSave={async (v) => { setReportContent(v); setIsDirty(true); }}
          />
          {errors.reportContent ? (
            <Text className="text-xs text-destructive mt-1">{errors.reportContent}</Text>
          ) : null}

          <View className="mt-4 bg-muted rounded-xl p-3">
            <Text className="text-xs text-muted-foreground">
              {t('prarthnaPatra.report.statusNote')}
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Back protection dialog */}
      <AlertDialog open={backDialogOpen} onOpenChange={setBackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('prarthnaPatra.report.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('prarthnaPatra.report.unsavedDescWithSave')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setBackDialogOpen(false)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => { setBackDialogOpen(false); setIsDirty(false); router.back(); }}>
              <Text>{t('common.discard')}</Text>
            </AlertDialogAction>
            <AlertDialogAction onPress={() => { setBackDialogOpen(false); handleSave(); }}>
              <Text>{t('common.save')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </KeyboardAvoidingView>
  );
}
