/**
 * Nyayalay Fill Format Screen
 *
 * Fills dynamic keys for a selected Predefine Format template, generates
 * report content, stores it in nyayalayDraftStore, and navigates back to
 * the report editor.
 *
 * Params:
 *   formatId  – the selected PredefinedFormat id
 *   docId     – the nyayalay document id (passed through for context)
 */
import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Pressable, ScrollView,
  Text, View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  AlertCircle, CheckCircle2, LayoutTemplate, Settings2,
} from 'lucide-react-native';
import {
  getFormatById,
  getFormatKeys,
  type PredefinedFormat,
  type FormatKey,
} from '@/lib/db/predefinedFormatRepo';
import { getNyayalayDocWithDetails } from '@/lib/db/nyayalayRepo';
import { generateReport } from '@/lib/templateEngine';
import { resolveGlobalKeys, filterDynamicKeys, GLOBAL_KEY_LABELS, resolveNyayalayKeys, NYAYALAY_KEY_LABELS } from '@/lib/globalKeyEngine';
import { validateRequiredFields, clearFieldError } from '@/lib/templateValidation';
import { FormatKeyInput } from '@/components/ui/input';
import { useWorkspace } from '@/context/WorkspaceContext';
import { nyayalayDraftStore } from '@/lib/nyayalayDraftStore';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const MODULE_COLOR = '#1D4ED8';

export default function NyayalayFillFormatScreen() {
  const { formatId, docId } = useLocalSearchParams<{ formatId: string; docId: string }>();
  const { workspace } = useWorkspace();

  const [format, setFormat] = useState<PredefinedFormat | null>(null);
  const [dynamicKeys, setDynamicKeys] = useState<FormatKey[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [autoValues, setAutoValues] = useState<Record<string, string>>({});
  const [nyayalayAutoValues, setNyayalayAutoValues] = useState<Record<string, string>>({});
  const [missingWorkspaceFields, setMissingWorkspaceFields] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const fieldRefs = useRef<Record<string, View | null>>({});

  // Snapshot workspace scalars once so the object reference never changes
  // between renders — prevents useFocusEffect from re-firing on every keystroke.
  const wsStateRef = useRef(workspace.state);
  const wsDistrictRef = useRef(workspace.district);
  const wsPoliceStationRef = useRef(workspace.police_station);
  const wsOfficerNameRef = useRef(workspace.officer_name);
  // Keep refs in sync with the latest workspace values
  wsStateRef.current = workspace.state;
  wsDistrictRef.current = workspace.district;
  wsPoliceStationRef.current = workspace.police_station;
  wsOfficerNameRef.current = workspace.officer_name;

  useFocusEffect(useCallback(() => {
    if (!formatId) return;
    (async () => {
      const [f, k, d] = await Promise.all([
        getFormatById(formatId),
        getFormatKeys(formatId),
        docId ? getNyayalayDocWithDetails(docId) : Promise.resolve(null),
      ]);
      if (!f) return;
      setFormat(f);

      // Step 1a: Workspace global keys — read from refs to avoid stale closure
      const wsSnapshot = {
        state: wsStateRef.current,
        district: wsDistrictRef.current,
        police_station: wsPoliceStationRef.current,
        officer_name: wsOfficerNameRef.current,
      } as typeof workspace;
      const { autoValues: wsResolved, missingWorkspaceFields: missing } =
        resolveGlobalKeys(f.vivran, wsSnapshot);
      setAutoValues(wsResolved);
      setMissingWorkspaceFields(missing);

      // Step 1b: Nyayalay document auto-fill keys
      const nylResolved = d ? resolveNyayalayKeys(f.vivran, d) : {};
      setNyayalayAutoValues(nylResolved);

      // Step 2: dynamic keys (excludes both global and nyayalay keys)
      const dynKeys = filterDynamicKeys(k) as FormatKey[];
      setDynamicKeys(dynKeys);

      const defaults: Record<string, string> = {};
      for (const key of dynKeys) {
        if (key.default_value) defaults[key.key_name] = key.default_value;
      }
      // Merge order: defaults < workspace < nyayalay (most specific wins)
      const merged = { ...defaults, ...wsResolved, ...nylResolved };
      setValues(merged);
      setInitialValues(merged);
      setFieldErrors({});
      setBannerError('');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId, docId]));

  const isDirty = dynamicKeys.some(
    (k) => (values[k.key_name] ?? '') !== (initialValues[k.key_name] ?? '')
  );

  const setValue = (keyName: string, val: string) => {
    setValues((prev) => ({ ...prev, [keyName]: val }));
    setFieldErrors((prev) => clearFieldError(prev, keyName));
    setBannerError('');
  };

  const handleBackPress = () => {
    if (isDirty) setShowDiscardDialog(true);
    else router.back();
  };

  const handleGenerate = async () => {
    if (!format) return;
    if (missingWorkspaceFields.length > 0) {
      setBannerError(`Workspace incomplete — fill in: ${missingWorkspaceFields.join(', ')}`);
      return;
    }
    const { fieldErrors: errs, firstErrorKey, hasErrors } = validateRequiredFields(dynamicKeys, values);
    if (hasErrors) {
      setFieldErrors(errs);
      setBannerError('Please fill all mandatory fields before generating the report.');
      if (firstErrorKey && fieldRefs.current[firstErrorKey]) {
        fieldRefs.current[firstErrorKey]?.measureLayout(
          scrollRef.current as never,
          (_x, y) => scrollRef.current?.scrollTo({ y: y - 24, animated: true }),
          () => {}
        );
      }
      return;
    }
    setSaving(true);
    try {
      const generatedText = generateReport(format.vivran, values, dynamicKeys);
      nyayalayDraftStore.set({
        generatedText,
        formatTitle: format.title,
        formatId: format.id,
      });
      // Two backs: skip select-format.tsx and land directly on report.tsx,
      // which reads nyayalayDraftStore.consume() in its useFocusEffect.
      // (Same "skip-intermediate" pattern used in report.tsx handleFinalSave.)
      router.back();
      router.back();
    } catch {
      setBannerError('Failed to generate. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!format) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground text-sm">Loading template…</Text>
      </View>
    );
  }

  const allAutoFilled = { ...autoValues, ...nyayalayAutoValues };
  const allAutoFilledKeys = Object.keys(allAutoFilled);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={format.title}
        subtitle="Fill Template"
        onBack={handleBackPress}
        rightActions={
          <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${MODULE_COLOR}12` }}>
            <LayoutTemplate size={17} color={MODULE_COLOR} />
          </View>
        }
      />
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, gap: 20, paddingBottom: 64 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Missing workspace banner */}
          {missingWorkspaceFields.length > 0 && (
            <View className="rounded-xl px-4 py-3 gap-2"
              style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' }}>
              <View className="flex-row items-center gap-2">
                <Settings2 size={14} color="#92400E" />
                <Text className="text-xs font-semibold text-amber-900 flex-1">
                  Station Workspace Incomplete
                </Text>
              </View>
              <Text className="text-xs text-amber-800 leading-4">
                Auto-fill needs:{' '}
                <Text className="font-semibold">{missingWorkspaceFields.join(', ')}</Text>
              </Text>
              <Pressable
                onPress={() => router.push('/(app)/workspace-setup' as never)}
                className="self-start mt-0.5 active:opacity-70"
              >
                <Text className="text-xs font-bold text-amber-900 underline">
                  Go to Workspace Setup →
                </Text>
              </Pressable>
            </View>
          )}

          {/* Auto-filled keys (workspace + nyayalay document combined) */}
          {allAutoFilledKeys.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Auto-filled from document
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {allAutoFilledKeys.map((k) => (
                  <View key={k}
                    className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 bg-secondary">
                    <CheckCircle2 size={11} color="#059669" />
                    <Text className="text-xs text-foreground font-medium">
                      {NYAYALAY_KEY_LABELS[k] ?? GLOBAL_KEY_LABELS[k] ?? k}:
                    </Text>
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {allAutoFilled[k]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Dynamic fields */}
          {dynamicKeys.length === 0 && allAutoFilledKeys.length === 0 ? (
            <View className="items-center py-10 gap-3">
              <AlertCircle size={28} color="#9CA3AF" />
              <Text className="text-sm text-muted-foreground text-center">
                No variable fields — tap Generate to use this template.
              </Text>
            </View>
          ) : dynamicKeys.length > 0 ? (
            <>
              <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Fill in required details
              </Text>
              {dynamicKeys.map((key) => (
                <FormatKeyInput
                  key={key.id}
                  ref={(r) => { fieldRefs.current[key.key_name] = r; }}
                  keyDef={key}
                  value={values[key.key_name] ?? ''}
                  onChange={setValue}
                  error={fieldErrors[key.key_name]}
                />
              ))}
            </>
          ) : null}

          {/* Validation banner */}
          {bannerError ? (
            <View className="bg-destructive/10 rounded-xl px-4 py-3">
              <View className="flex-row items-center gap-2">
                <AlertCircle size={14} color="#DC2626" />
                <Text className="text-sm text-destructive flex-1">{bannerError}</Text>
              </View>
            </View>
          ) : null}

          {/* Generate button */}
          <Pressable
            onPress={handleGenerate}
            disabled={saving}
            className="rounded-xl py-4 items-center justify-center active:opacity-80 mt-2"
            style={{ backgroundColor: MODULE_COLOR, borderCurve: 'continuous', opacity: saving ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {saving ? 'Generating…' : 'Generate Report'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <AlertDialog open={showDiscardDialog} onOpenChange={(v) => { if (!v) setShowDiscardDialog(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>Your changes have not been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>
              <Text>Continue Editing</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { setShowDiscardDialog(false); router.back(); }}
              className="bg-destructive"
            >
              <Text className="text-destructive-foreground font-semibold">Discard</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
