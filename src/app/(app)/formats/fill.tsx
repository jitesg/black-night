import { resolveContextDefaults } from '@/lib/contextDefaultResolver';
import { formatPreviewBridge } from '@/lib/formatPreviewBridge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Zap, AlertCircle, Settings2, CheckCircle2, Pencil, Printer } from 'lucide-react-native';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFormatById, getFormatKeys, logUsage,
  type PredefinedFormat, type FormatKey,
  DEFAULT_LAYOUT_PROFILE,
} from '@/lib/db/predefinedFormatRepo';
import { generateReport } from '@/lib/templateEngine';
import { htmlToPlainText } from '@/lib/stringUtils';
import { splitIntoSubLetters, parseIntoDocumentModel, renderModelsForEditor } from '@/lib/formatParsingEngine';
import { renderDocumentModel, buildPrintHtml } from '@/components/common/DocumentEditor';
import { fixFormat } from '@/lib/formatFixingEngine';
import {
  resolveGlobalKeys, filterDynamicKeys,
  GLOBAL_KEY_LABELS,
} from '@/lib/globalKeyEngine';
import { validateRequiredFields, clearFieldError } from '@/lib/templateValidation';
import { FormatKeyInput } from '@/components/ui/input';
import { AccusedGroupInput, initAccusedGroup, parseAccusedGroup } from '@/components/ui/AccusedGroupInput';
import { PersonGroupInput, initPersonGroup, parsePersonGroup } from '@/components/ui/PersonGroupInput';
import { Button } from '@/components/ui/button';
// Button kept for other potential uses; generate CTA uses Pressable directly
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import {
  recordFieldValue, recordFieldValues, FIELD_KEYS,
} from '@/lib/db/fieldValueHistoryRepo';

const FORMAT_TYPE_COLORS: Record<string, string> = {
  'GD':              '#6366F1',
  'Case Diary':      '#7C3AED',
  'Nyayalay':        '#D97706',
  'Prarthna Patra':  '#059669',
  'BNSS Karyavahi':  '#DC2626',
  'Any':             '#6B7280',
};

function getFormatTypeLabel(type: string, t: (k: string) => string): string {
  switch (type) {
    case 'GD': return t('format.type.gd');
    case 'Case Diary': return t('format.type.caseDiary');
    case 'Narrative': return t('format.type.narrative');
    case 'Nyayalay': return t('format.type.nyayalay');
    case 'Prarthna Patra': return t('format.type.prarthnaPatra');
    case 'BNSS Karyavahi': return t('format.type.bnssKaryavahi');
    case 'Any': return t('format.type.any');
    default: return type;
  }
}

/** Draft key for AsyncStorage — scoped to formatId and firId so multiple formats/cases don't conflict. */
function _draftKey(formatId: string, firId?: string) {
  return firId
    ? `investsuite:fill_draft:${formatId}:${firId}`
    : `investsuite:fill_draft:${formatId}`;
}

export default function FillScreen() {
  const { formatId, callingModule, firId } = useLocalSearchParams<{
    formatId: string; callingModule?: string; firId?: string;
  }>();
  const { workspace } = useWorkspace();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;

  const [format, setFormat] = useState<PredefinedFormat | null>(null);
  const [dynamicKeys, setDynamicKeys] = useState<FormatKey[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [autoValues, setAutoValues] = useState<Record<string, string>>({});
  const [missingWorkspaceFields, setMissingWorkspaceFields] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [groupValid, setGroupValid] = useState<Record<string, boolean>>({});
  const [bannerError, setBannerError] = useState('');
  const [generating, setGenerating] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const fieldRefs = useRef<Record<string, View | null>>({});

  // Track whether we've already loaded for this formatId — prevents
  // useFocusEffect from wiping officer-entered data on Back navigation.
  const loadedFormatIdRef = useRef<string | null>(null);

  // Debounce timer for draft autosave
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Unsaved-changes protection ───────────────────────────────────────────
  // Note: fill.tsx has autosave drafts, so dialog text explains draft is kept.
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

  /** Persist current form values to AsyncStorage (debounced 500 ms). */
  const saveDraft = useCallback((nextValues: Record<string, string>, fmtId: string) => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(_draftKey(fmtId, firId), JSON.stringify(nextValues)).catch(() => null);
    }, 500);
  }, [firId]);

  useFocusEffect(
    useCallback(() => {
      if (!formatId) return;
      // Already loaded for this exact formatId+firId combination — officer returned via Back, don't reset.
      const loadKey = `${formatId}::${firId ?? ''}`;
      if (loadedFormatIdRef.current === loadKey) return;
      let active = true;
      (async () => {
        try {
          const f = await getFormatById(formatId);
          const k = await getFormatKeys(formatId);
          if (!active) return;
          if (f) {
            setFormat(f);
            const { autoValues: resolved, missingWorkspaceFields: missing } =
              resolveGlobalKeys(f.vivran, workspace);
            setAutoValues(resolved);
            setMissingWorkspaceFields(missing);
            const dynKeys = filterDynamicKeys(k);
            setDynamicKeys(dynKeys);

            // Build format defaults — static strings first, then context markers
            const defaults: Record<string, string> = {};
            for (const key of dynKeys) {
              if (key.field_type === 'accused_group') {
                defaults[key.key_name] = initAccusedGroup();
              } else if (key.field_type === 'person_group') {
                defaults[key.key_name] = initPersonGroup();
              } else if (
                key.default_value &&
                !key.default_value.startsWith('@') &&
                !(key.default_value.startsWith('__FROM_') && key.default_value.endsWith('__'))
              ) {
                // Static default — use literally
                defaults[key.key_name] = key.default_value;
              }
              // "@..." and "__FROM_*__" markers are resolved below via resolveContextDefaults
            }

            // Resolve context-aware "@MARKER.field" defaults (DB queries, scoped to firId)
            const contextDefaults = await resolveContextDefaults(dynKeys, firId);

            // Restore draft if it exists — draft wins over bare defaults
            let draft: Record<string, string> = {};
            try {
              const raw = await AsyncStorage.getItem(_draftKey(formatId, firId));
              if (raw) draft = JSON.parse(raw) as Record<string, string>;
            } catch { /* non-critical — start fresh */ }

            // Merge order: static defaults < context defaults < workspace auto < draft
            setValues({ ...defaults, ...contextDefaults, ...resolved, ...draft });
            setFieldErrors({});
            setGroupValid({});
            setBannerError('');
            loadedFormatIdRef.current = loadKey;
          } else {
            setBannerError(t('format.fill.errorLoadFailed'));
          }
        } catch {
          if (active) setBannerError(t('format.fill.errorLoadFailed'));
        }
      })();
      return () => { active = false; };
    }, [formatId, firId, workspace, t])
  );

  const setValue = (keyName: string, val: string) => {
    isDirty.current = true;
    setValues((prev) => {
      const next = { ...prev, [keyName]: val };
      if (formatId) saveDraft(next, formatId);
      return next;
    });
    setFieldErrors((prev) => clearFieldError(prev, keyName));
    setBannerError('');
  };

  const handleGroupValidChange = (keyName: string, isValid: boolean) => {
    setGroupValid((prev) => ({ ...prev, [keyName]: isValid }));
  };

  const handleGenerate = async () => {
    if (!format || generating) return;
    setGenerating(true);
    setBannerError('');
    try {
      if (missingWorkspaceFields.length > 0) {
        setBannerError(t('format.fill.errorWorkspace', { fields: missingWorkspaceFields.join(', ') }));
        return;
      }
      // Block save if any group card has validation errors
      const invalidGroups = Object.entries(groupValid).filter(([, valid]) => !valid);
      if (invalidGroups.length > 0) {
        setBannerError(t('format.fill.errorGroupInvalid'));
        return;
      }
      const { fieldErrors: errs, firstErrorKey, hasErrors } = validateRequiredFields(dynamicKeys, values);
      if (__DEV__) {
        if (hasErrors) console.log('[Fill] validation failed — missing fields:', Object.keys(errs));
        else console.log('[Fill] validation passed — proceeding to generate');
      }
      if (hasErrors) {
        setFieldErrors(errs);
        setBannerError(t('format.fill.errorRequiredFields'));
        // Scroll to first missing field
        if (firstErrorKey && fieldRefs.current[firstErrorKey]) {
          try {
            fieldRefs.current[firstErrorKey]
              ?.measureLayout(
                scrollRef.current as never,
                (_x, y) =>
                  scrollRef.current?.scrollTo({ y: y - 24, animated: true }),
                () => {}
              );
          } catch {}
        }
        return;
      }
      const mergedValues = {
        ...autoValues,
        ...values,
      };
      // User formats are saved as editor HTML — convert to plain text first.
      const resolvedText = htmlToPlainText(generateReport(format.vivran, mergedValues, dynamicKeys));
      if (__DEV__) console.log('[Fill] resolvedText — chars:', resolvedText.length);

      // ── Parsing + rendering pipeline (Steps 2–4 from master-ai-builder-prompt) ──
      const profile = format.layout_profile ?? DEFAULT_LAYOUT_PROFILE;
      const subLetters = splitIntoSubLetters(resolvedText);
      const models = subLetters.map(parseIntoDocumentModel);
      const PAGE_BREAK = '<div style="page-break-after:always"></div>';
      const combinedHtml = models
        .map((m) => renderDocumentModel(m, profile))
        .join(PAGE_BREAK);
      const fullHtml = buildPrintHtml(combinedHtml, format.title);
      const { html: fixedHtml } = fixFormat(fullHtml, profile, format.title);

      // v257: Editor HTML — inline-styled, pell-compatible, no external stylesheet needed
      const editorHtml = renderModelsForEditor(models);

      await logUsage(format.id, callingModule, resolvedText);

      // ── Record field values for autocomplete history ────────────────────
      // Fire-and-forget — never block or throw on the generate CTA.
      (async () => {
        try {
          // Simple text fields: scan all dynamic keys for known canonical mappings
          const FORMAT_FIELD_TO_KEY: Record<string, string> = {
            Section: FIELD_KEYS.section,        section: FIELD_KEYS.section,
            Dhara: FIELD_KEYS.section,
            FIRNumber: FIELD_KEYS.fir_number,   FirNumber: FIELD_KEYS.fir_number,
            PoliceStation: FIELD_KEYS.police_station,
          };
          for (const key of dynamicKeys) {
            const canonical = FORMAT_FIELD_TO_KEY[key.key_name];
            if (canonical) {
              const v = mergedValues[key.key_name];
              if (v) await recordFieldValue(canonical as never, v);
            }
          }

          // Group fields: accused_group and person_group
          for (const key of dynamicKeys) {
            if (key.field_type === 'accused_group') {
              const entries = parseAccusedGroup(mergedValues[key.key_name] ?? '');
              for (const e of entries) {
                await recordFieldValue(FIELD_KEYS.person_name,         e.name);
                await recordFieldValue(FIELD_KEYS.father_husband_name, e.fatherOrHusbandName);
                await recordFieldValue(FIELD_KEYS.address,             e.fullAddress || e.address || '');
                await recordFieldValue(FIELD_KEYS.caste,               e.caste);
              }
            } else if (key.field_type === 'person_group') {
              const entries = parsePersonGroup(mergedValues[key.key_name] ?? '');
              for (const e of entries) {
                await recordFieldValue(FIELD_KEYS.person_name,         e.name);
                await recordFieldValue(FIELD_KEYS.father_husband_name, e.fatherOrHusbandName);
                await recordFieldValue(FIELD_KEYS.address,             e.fullAddress);
                await recordFieldValue(FIELD_KEYS.caste,               e.caste);
              }
            }
          }
        } catch { /* non-critical — never surface autocomplete errors to the user */ }
      })();

      // ── Phase 1: Use memory bridge instead of URL params for large strings ──
      formatPreviewBridge.set({ reportText: resolvedText, formatHtml: fixedHtml, formatEditorHtml: editorHtml });
      const callingParam = callingModule ? `&callingModule=${encodeURIComponent(callingModule)}` : '';
      router.push(
        `/(app)/formats/preview?formatId=${encodeURIComponent(format.id)}&formatTitle=${encodeURIComponent(format.title)}${callingParam}` as never
      );
    } catch (err: unknown) {
      // Surface any pipeline error visibly — never fail silently on the generate button
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Fill] generate pipeline error:', err);
      setBannerError(t('format.fill.errorReportGeneration', { msg }));
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintBlank = async () => {
    if (!format) return;
    // Build a version of the template where workspace-known fields
    // (Police Station, District, Officer Name — already in autoValues)
    // stay filled in as usual, but every OTHER dynamic field the
    // officer would normally type becomes a blank line instead of its
    // {{key}} marker, so the printed page has ready-to-hand-write blanks.
    const blankValues: Record<string, string> = { ...autoValues };
    for (const key of dynamicKeys) {
      if (!(key.key_name in blankValues)) {
        blankValues[key.key_name] = '…………………………………';
      }
    }
    const blankedText = htmlToPlainText(generateReport(format.vivran, blankValues, dynamicKeys));
    const profile = format.layout_profile ?? DEFAULT_LAYOUT_PROFILE;
    const subLetters = splitIntoSubLetters(blankedText);
    const models = subLetters.map(parseIntoDocumentModel);
    const PAGE_BREAK = '';
    const combinedHtml = models.map((m) => renderDocumentModel(m, profile)).join(PAGE_BREAK);
    const fullHtml = buildPrintHtml(combinedHtml, format.title);
    const { html: fixedHtml } = fixFormat(fullHtml, profile, format.title);
    const editorHtml = renderModelsForEditor(models);
    formatPreviewBridge.set({ reportText: blankedText, formatHtml: fixedHtml, formatEditorHtml: editorHtml });
    const callingParam = callingModule ? `&callingModule=${encodeURIComponent(callingModule)}` : '';
    router.push(
      `/(app)/formats/preview?formatId=${encodeURIComponent(format.id)}&formatTitle=${encodeURIComponent(format.title)}&isBlankPrint=true${callingParam}` as never
    );
  };

  if (!format) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">{t('format.fill.loading')}</Text>
      </View>
    );
  }

  const typeColor = FORMAT_TYPE_COLORS[format.format_type] ?? '#6B7280';
  // Auto-filled global keys present in this template
  const autoFilledKeyNames = Object.keys(autoValues);

  return (
    <View className="flex-1 bg-background">
      {/* ── Discard-changes confirmation (3-option) ───────────────────── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('format.fill.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('format.fill.discardDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            {/* Leave — discard draft and exit */}
            <AlertDialogAction
              onPress={() => {
                setShowDiscardDialog(false);
                if (formatId) AsyncStorage.removeItem(_draftKey(formatId, firId)).catch(() => null);
                router.back();
              }}
              className="bg-destructive"
            >
              <Text className="text-white font-semibold text-sm">{t('format.fill.discardConfirm')}</Text>
            </AlertDialogAction>
            {/* Save as Draft — flush current values to AsyncStorage then exit */}
            <AlertDialogAction
              onPress={() => {
                setShowDiscardDialog(false);
                if (formatId) AsyncStorage.setItem(_draftKey(formatId, firId), JSON.stringify(values)).catch(() => null);
                router.back();
              }}
              className="bg-primary"
            >
              <Text className="text-primary-foreground font-semibold text-sm">{t('format.fill.discardDraft')}</Text>
            </AlertDialogAction>
            {/* Stay — dismiss dialog, keep editing */}
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>
              <Text className="font-semibold text-sm">{t('format.fill.discardCancel')}</Text>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppHeader
        title={format.title}
        subtitle={getFormatTypeLabel(format.format_type, t)}
        onBack={handleBackPress}
        rightActions={
          <Pressable
            onPress={handlePrintBlank}
            accessibilityRole="button"
            accessibilityLabel={t('format.fill.printBlank')}
            hitSlop={6}
            className="w-10 h-10 rounded-xl items-center justify-center active:opacity-70"
            style={{ backgroundColor: `${typeColor}15` }}
          >
            <Printer size={18} color={typeColor} />
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
        keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? 56 : 0}
        className="flex-1"
      >

        <ScrollView
          ref={scrollRef}
          contentContainerClassName="px-6 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Missing Workspace Banner ─────────────────────────── */}
          {missingWorkspaceFields.length > 0 && (
            <View
              className="rounded-xl px-4 py-3 gap-2"
              style={{ backgroundColor: `${C.primary}15`, borderWidth: 0.5, borderColor: `${C.primary}35` }}
            >
              <View className="flex-row items-center gap-2">
                <Settings2 size={14} color={C.primary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.primary, flex: 1 }}>
                  {t('format.fill.workspaceIncomplete')}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: C.mutedForeground, lineHeight: 17 }}>
                {t('format.fill.workspaceNeeds', { fields: missingWorkspaceFields.join(', ') })}
              </Text>
              <Pressable
                onPress={() => router.push('/(app)/workspace-setup' as never)}
                className="self-start mt-0.5 active:opacity-70"
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary, textDecorationLine: 'underline' }}>
                  {t('format.fill.workspaceSetup')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── Auto-filled Global Keys pill row ─────────────────── */}
          {autoFilledKeyNames.length > 0 && (
            <View className="gap-2">
              <Text style={{ fontSize: 11, color: C.mutedForeground, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {t('format.fill.autoFilledLabel')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {autoFilledKeyNames.map((k) => (
                  <View
                    key={k}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
                      backgroundColor: C.secondary,
                      borderWidth: 0.5, borderColor: C.border,
                    }}
                  >
                    <CheckCircle2 size={11} color="#4ADE80" />
                    <Text style={{ fontSize: 12, color: C.foreground, fontWeight: '500' }}>
                      {GLOBAL_KEY_LABELS[k] ?? k}:
                    </Text>
                    <TextInput
                      value={autoValues[k]}
                      onChangeText={(v) => setAutoValues((prev) => ({ ...prev, [k]: v }))}
                      style={[
                        {
                          fontSize: 12,
                          color: C.foreground,
                          minWidth: 60,
                          // Hindi needs vertical room: zero padding clipped the
                          // lower part of letters (e.g. बछरावा, रायबरेली) on Android.
                          paddingHorizontal: 0,
                          paddingTop: 2,
                          paddingBottom: 3,
                          minHeight: 26,
                          textAlignVertical: 'center',
                          includeFontPadding: true,
                          borderBottomWidth: 1,
                          borderBottomColor: C.border,
                        },
                        Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } as never : {},
                      ]}
                    />
                    <Pencil size={10} color={C.mutedForeground} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Dynamic Key Engine — user-input fields ────────────── */}
          {dynamicKeys.length === 0 && autoFilledKeyNames.length === 0 ? (
            <View className="items-center py-10 gap-3">
              <AlertCircle size={28} color="#5C5C60" />
              <Text style={{ fontSize: 14, color: '#5C5C60', textAlign: 'center' }}>
                {t('format.fill.noKeysNote')}
              </Text>
            </View>
          ) : dynamicKeys.length > 0 ? (
            <>
              <Text style={{ fontSize: 11, color: '#5C5C60', fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {t('format.fill.fillFieldsLabel')}
              </Text>
              {dynamicKeys.map((key) =>
                key.field_type === 'accused_group' ? (
                  <View key={key.id} ref={(r) => { fieldRefs.current[key.key_name] = r; }}>
                    <AccusedGroupInput
                      keyName={key.key_name}
                      label={key.label || key.key_name}
                      value={values[key.key_name] ?? initAccusedGroup()}
                      onChange={setValue}
                      onValidChange={handleGroupValidChange}
                      error={fieldErrors[key.key_name]}
                    />
                  </View>
                ) : key.field_type === 'person_group' ? (
                  <View key={key.id} ref={(r) => { fieldRefs.current[key.key_name] = r; }}>
                    <PersonGroupInput
                      keyName={key.key_name}
                      label={key.label || key.key_name}
                      value={values[key.key_name] ?? initPersonGroup()}
                      onChange={setValue}
                      onValidChange={handleGroupValidChange}
                      error={fieldErrors[key.key_name]}
                    />
                  </View>
                ) : (
                  <FormatKeyInput
                    key={key.id}
                    ref={(r) => { fieldRefs.current[key.key_name] = r; }}
                    keyDef={key}
                    value={values[key.key_name] ?? ''}
                    onChange={setValue}
                    error={fieldErrors[key.key_name]}
                  />
                )
              )}
            </>
          ) : null}

          {/* ── Validation banner ────────────────────────────────── */}
          {bannerError ? (
            <View style={{ backgroundColor: 'rgba(248,113,113,0.10)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 6, borderWidth: 0.5, borderColor: 'rgba(248,113,113,0.30)' }}>
              <View className="flex-row items-center gap-2">
                <AlertCircle size={14} color="#F87171" />
                <Text style={{ fontSize: 14, color: '#F87171', flex: 1 }}>{bannerError}</Text>
              </View>
              {missingWorkspaceFields.length > 0 && (
                <Pressable
                  onPress={() => router.push('/(app)/workspace-setup' as never)}
                  className="self-start active:opacity-70"
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#F87171', textDecorationLine: 'underline' }}>
                    {t('format.fill.errorOpenWorkspace')}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {/* ── Generate button — gold CTA ───────────────────────── */}
          <Pressable
            onPress={handleGenerate}
            disabled={generating}
            className="active:opacity-80"
            style={{
              borderRadius: 12, paddingVertical: 15, marginTop: 8,
              backgroundColor: generating ? 'rgba(201,162,39,0.40)' : '#C9A227',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Zap size={18} color="#0D0D0D" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0D0D0D' }}>
              {generating ? t('format.fill.generating') : t('format.fill.generate')}
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
