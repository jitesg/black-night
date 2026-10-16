/**
 * Report screen — Feature 3
 *
 * For petition types in REPORT_PETITION_TYPES ("RL", "जनता दर्शन", "CO पेशी", "SDM", "DM"):
 *   - Shows full selectable petition details at top
 *   - "रिपोर्ट लगाएं" button reveals inline editor + "Add from Format" button
 *   - Format picker navigates to select-format filtered to "Prarthna Patra"
 *   - Generated format text is injected via ppReportDraftStore
 *   - Auto-growing inline TextInput (no full-screen editor)
 *   - Save stores to saveReport() and navigates back
 *
 * For all other types: unchanged original report-editor behaviour.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, KeyboardAvoidingView,
  BackHandler, ActivityIndicator, TextInput, type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
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
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { FileText, Plus } from 'lucide-react-native';

/** Petition types that use the inline report-attach flow */
const REPORT_PETITION_TYPES = new Set(['RL', 'जनता दर्शन', 'CO पेशी', 'SDM', 'DM']);

// ── Selectable field row ──────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 5, gap: 8 }}>
      <Text style={{ fontSize: 12, color: '#6B7280', width: 110, flexShrink: 0 }}>{label}</Text>
      <Text selectable style={{ fontSize: 12, color: '#111827', flex: 1, lineHeight: 18 }}>{value}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ReportScreen() {
  const { ppId } = useLocalSearchParams<{ ppId: string }>();
  const [pp, setPP] = useState<PPWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [reportDate, setReportDate] = useState(_todayString());
  const [reportContent, setReportContent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [backDialogOpen, setBackDialogOpen] = useState(false);
  const savedRef = useRef(false);

  // Feature 3: inline-editor reveal state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorHeight, setEditorHeight] = useState(120);
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
            // Strict assignment — no `prev ||` fallback so users can clear the field
            setReportContent(data.report.report_content);
            setEditorVisible(true);
          }
        } finally {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }

      // 2. Consume draft — runs on initial load AND when returning from format screen
      const draft = ppReportDraftStore.consume();
      if (draft) {
        setReportContent((prev) => prev.trim() ? `${prev}\n\n${draft.generatedText}` : draft.generatedText);
        setEditorVisible(true);
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
    if (!reportDate.trim()) e.reportDate = 'Report date is required';
    if (!reportContent.trim()) e.reportContent = 'Report content is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !ppId) return;
    setSaving(true);
    try {
      await saveReport(ppId, reportDate, reportContent.trim());
      savedRef.current = true;
      setIsDirty(false);
      router.back();
    } catch {
      setErrors({ general: 'Failed to save report. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddFromFormat = () => {
    router.push(
      `/(app)/prarthna-patra/select-format?mode=report&ppId=${ppId}` as RelativePathString
    );
  };

  const handleRevealEditor = () => {
    setEditorVisible(true);
    // Give layout time then scroll to bottom
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const handleContentSizeChange = useCallback((
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
  ) => {
    const h = e.nativeEvent.contentSize.height;
    const newHeight = Math.max(120, h + 24);
    setEditorHeight((prevHeight) => {
      if (prevHeight === newHeight) return prevHeight; // bail out — no re-render
      return newHeight;
    });
  }, []);

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
    return (
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
        <View className="flex-1 bg-background">
          <AppHeader
            title={pp?.report ? 'Edit Report' : 'Add Report'}
            subtitle={pp?.registration_number ?? ''}
            onBack={handleBack}
            rightActions={
              editorVisible ? (
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className="bg-primary rounded-xl px-4 py-2 active:opacity-70"
                >
                  <Text className="text-sm font-semibold text-primary-foreground">
                    {saving ? 'Saving…' : 'सेव'}
                  </Text>
                </Pressable>
              ) : null
            }
          />

          <ScrollView
            ref={scrollRef}
            contentContainerClassName="px-5 pb-16"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Selectable petition details ── */}
            <View className="bg-card border border-border rounded-2xl p-4 mt-4"
              style={{ borderCurve: 'continuous' }}>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                Petition Details
              </Text>
              <DetailRow label="Reg. No." value={pp?.registration_number} />
              <DetailRow label="Type" value={pp?.petition_type ? PETITION_TYPE_LABELS[pp.petition_type] : undefined} />
              <DetailRow label="Date of Receipt" value={pp?.date_of_receipt} />
              <DetailRow label="Deadline" value={pp?.deadline_date} />
              <DetailRow label="Investigator" value={pp?.investigator_name} />
              <DetailRow label="Matter" value={pp?.matter} />
              {pp?.complainants.map((c, i) => (
                <DetailRow key={c.id} label={`Complainant ${i + 1}`}
                  value={[c.name, c.mobile, c.full_address].filter(Boolean).join(' · ')} />
              ))}
              {pp?.accused.map((a, i) => (
                <DetailRow key={a.id} label={`Accused ${i + 1}`}
                  value={[a.name, a.mobile, a.full_address].filter(Boolean).join(' · ')} />
              ))}
            </View>

            {errors.general ? (
              <Text className="text-sm text-destructive mt-3">{errors.general}</Text>
            ) : null}

            {/* ── "रिपोर्ट लगाएं" trigger button ── */}
            {!editorVisible && (
              <Pressable
                onPress={handleRevealEditor}
                className="mt-5 bg-primary rounded-xl py-4 items-center justify-center flex-row gap-2 active:opacity-70"
                style={{ borderCurve: 'continuous' }}
              >
                <FileText size={16} color="#fff" />
                <Text className="text-base font-bold text-primary-foreground">रिपोर्ट लगाएं</Text>
              </Pressable>
            )}

            {/* ── Inline editor ── */}
            {editorVisible && (
              <View className="mt-5 gap-3">
                {/* Report date */}
                <Input
                  type="date"
                  label="Report Preparation Date"
                  placeholder="YYYY-MM-DD"
                  value={reportDate}
                  onChangeText={setReportDate}
                  errorText={errors.reportDate}
                />

                {/* Add from Format button */}
                <Pressable
                  onPress={handleAddFromFormat}
                  className="flex-row items-center gap-2 border border-border rounded-xl px-4 py-3 bg-card active:opacity-70"
                  style={{ borderCurve: 'continuous' }}
                >
                  <Plus size={15} color="#6B7280" />
                  <Text className="text-sm text-muted-foreground font-medium">
                    Add from Format (Prarthna Patra)
                  </Text>
                </Pressable>

                {/* Auto-growing inline textarea */}
                <View
                  className="border border-border rounded-xl bg-card overflow-hidden"
                  style={{ borderCurve: 'continuous' }}
                >
                  <TextInput
                    value={reportContent}
                    onChangeText={(v) => { setReportContent(v); setIsDirty(true); }}
                    multiline
                    scrollEnabled={false}
                    onContentSizeChange={handleContentSizeChange}
                    placeholder="रिपोर्ट का विवरण यहाँ लिखें…"
                    placeholderTextColor="#9CA3AF"
                    style={{
                      fontSize: 14, color: '#111827', lineHeight: 21,
                      paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
                      height: editorHeight,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>
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
                    {saving ? 'Saving…' : 'सेव'}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Back protection dialog */}
        <AlertDialog open={backDialogOpen} onOpenChange={setBackDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Discard them?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onPress={() => setBackDialogOpen(false)}>
                <Text>Cancel</Text>
              </AlertDialogCancel>
              <AlertDialogAction onPress={() => { setBackDialogOpen(false); setIsDirty(false); router.back(); }}>
                <Text>Discard</Text>
              </AlertDialogAction>
              <AlertDialogAction onPress={() => { setBackDialogOpen(false); handleSave(); }}>
                <Text>Save</Text>
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
      behavior="padding"
      className="flex-1"
    >
      <View className="flex-1 bg-background">
        <AppHeader
          title={pp?.report ? 'Edit Report' : 'Add Report'}
          subtitle={pp?.registration_number ?? ''}
          onBack={handleBack}
          rightActions={
            <Pressable onPress={handleSave} disabled={saving} className="bg-primary rounded-xl px-4 py-2 active:opacity-70">
              <Text className="text-sm font-semibold text-primary-foreground">{saving ? 'Saving…' : 'Save'}</Text>
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
                {pp.registration_number} · {PETITION_TYPE_LABELS[pp.petition_type]}
              </Text>
              {pp.complainants[0]?.name ? (
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Complainant: {pp.complainants[0].name}
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
              label="Report Preparation Date"
              placeholder="YYYY-MM-DD"
              value={reportDate}
              onChangeText={setReportDate}
              errorText={errors.reportDate}
            />
          </View>

          {/* Report Editor */}
          <Text className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-5 mb-2">
            Report (जांच / निस्तारी रिपोर्ट)
          </Text>
          <GeneratedReportView
            content={reportContent}
            title="Prarthna Patra Report"
            onSave={async (v) => { setReportContent(v); setIsDirty(true); }}
          />
          {errors.reportContent ? (
            <Text className="text-xs text-destructive mt-1">{errors.reportContent}</Text>
          ) : null}

          <View className="mt-4 bg-muted rounded-xl p-3">
            <Text className="text-xs text-muted-foreground">
              Saving this report will automatically set the petition status to{' '}
              <Text className="font-semibold">Nistarit</Text> and record the report
              preparation date as the disposal date.
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Back protection dialog */}
      <AlertDialog open={backDialogOpen} onOpenChange={setBackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save this report before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setBackDialogOpen(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => { setBackDialogOpen(false); setIsDirty(false); router.back(); }}>
              <Text>Discard</Text>
            </AlertDialogAction>
            <AlertDialogAction onPress={() => { setBackDialogOpen(false); handleSave(); }}>
              <Text>Save</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </KeyboardAvoidingView>
  );
}
