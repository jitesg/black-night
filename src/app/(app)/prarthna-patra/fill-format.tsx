/**
 * PP Fill Format Screen
 *
 * Adapted from nirodhatmak/fill.tsx. Supports two modes:
 *   - mode=action (default): generates text → ppActionDraftStore → back to take-action
 *   - mode=report: generates text → ppReportDraftStore → back to report screen
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
  getFormatById, getFormatKeys,
  type PredefinedFormat, type FormatKey,
} from '@/lib/db/predefinedFormatRepo';
import { generateReport } from '@/lib/templateEngine';
import { resolveGlobalKeys, filterDynamicKeys, GLOBAL_KEY_LABELS } from '@/lib/globalKeyEngine';
import { validateRequiredFields, clearFieldError } from '@/lib/templateValidation';
import { FormatKeyInput } from '@/components/ui/input';
import { AccusedGroupInput, initAccusedGroup } from '@/components/ui/AccusedGroupInput';
import { PersonGroupInput, initPersonGroup } from '@/components/ui/PersonGroupInput';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ppActionDraftStore } from '@/lib/ppActionDraftStore';
import { ppReportDraftStore } from '@/lib/ppReportDraftStore';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader } from '@/components/ui/ds/AppHeader';

const MODULE_COLOR = '#7C3AED';

export default function PPFillFormatScreen() {
  const { formatId, mode } = useLocalSearchParams<{ formatId: string; mode?: string }>();
  const isReportMode = mode === 'report';
  const { workspace } = useWorkspace();

  const [format, setFormat] = useState<PredefinedFormat | null>(null);
  const [dynamicKeys, setDynamicKeys] = useState<FormatKey[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [autoValues, setAutoValues] = useState<Record<string, string>>({});
  const [missingWorkspaceFields, setMissingWorkspaceFields] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [groupValid, setGroupValid] = useState<Record<string, boolean>>({});
  const [bannerError, setBannerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const fieldRefs = useRef<Record<string, View | null>>({});

  useFocusEffect(useCallback(() => {
    if (!formatId) return;
    (async () => {
      const f = await getFormatById(formatId);
      const k = await getFormatKeys(formatId);
      if (!f) return;
      setFormat(f);
      const { autoValues: resolved, missingWorkspaceFields: missing } =
        resolveGlobalKeys(f.vivran, workspace);
      setAutoValues(resolved);
      setMissingWorkspaceFields(missing);
      const dynKeys = filterDynamicKeys(k);
      setDynamicKeys(dynKeys);
      const defaults: Record<string, string> = {};
      for (const key of dynKeys) {
        if (key.field_type === 'accused_group') {
          defaults[key.key_name] = initAccusedGroup();
        } else if (key.field_type === 'person_group') {
          defaults[key.key_name] = initPersonGroup();
        } else if (key.default_value) {
          defaults[key.key_name] = key.default_value;
        }
      }
      const merged = { ...defaults, ...resolved };
      setValues(merged);
      setInitialValues(merged);
      setFieldErrors({});
      setGroupValid({});
      setBannerError('');
    })();
  }, [formatId, workspace]));

  const isDirty = dynamicKeys.some(
    (k) => (values[k.key_name] ?? '') !== (initialValues[k.key_name] ?? '')
  );

  const setValue = (keyName: string, val: string) => {
    setValues((prev) => ({ ...prev, [keyName]: val }));
    setFieldErrors((prev) => clearFieldError(prev, keyName));
    setBannerError('');
  };

  const handleGroupValidChange = (keyName: string, isValid: boolean) => {
    setGroupValid((prev) => ({ ...prev, [keyName]: isValid }));
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
    // Block save if any group card has validation errors
    const invalidGroups = Object.entries(groupValid).filter(([, valid]) => !valid);
    if (invalidGroups.length > 0) {
      setBannerError('Please fix all errors in the highlighted cards before generating.');
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
      if (isReportMode) {
        ppReportDraftStore.set({
          generatedText,
          formatTitle: format.title,
          formatId: format.id,
        });
      } else {
        ppActionDraftStore.set({
          generatedText,
          formatTitle: format.title,
          formatId: format.id,
        });
      }
      // Dismiss both fill-format and select-format in one go, landing back
      // on the originating report or take-action screen.
      if (router.canDismiss()) {
        router.dismiss(2);
      } else {
        router.back();
      }
    } catch {
      setBannerError('Failed to generate. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!format) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground text-sm">Loading format…</Text>
      </View>
    );
  }

  const autoFilledKeyNames = Object.keys(autoValues);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={format.title}
        subtitle={isReportMode ? 'Prarthna Patra Report' : 'Prarthna Patra Format'}
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
          contentContainerClassName="px-5 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Missing workspace banner */}
          {missingWorkspaceFields.length > 0 && (
            <View
              className="rounded-xl px-4 py-3 gap-2"
              style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' }}
            >
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

          {/* Auto-filled global keys */}
          {autoFilledKeyNames.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Auto-filled from Workspace
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {autoFilledKeyNames.map((k) => (
                  <View
                    key={k}
                    className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 bg-secondary"
                  >
                    <CheckCircle2 size={11} color="#059669" />
                    <Text className="text-xs text-foreground font-medium">
                      {GLOBAL_KEY_LABELS[k] ?? k}:
                    </Text>
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {autoValues[k]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Dynamic user-input fields */}
          {dynamicKeys.length === 0 && autoFilledKeyNames.length === 0 ? (
            <View className="items-center py-10 gap-3">
              <AlertCircle size={28} color="#9CA3AF" />
              <Text className="text-sm text-muted-foreground text-center">
                No variable fields — tap Insert to add this format.
              </Text>
            </View>
          ) : dynamicKeys.length > 0 ? (
            <>
              <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Fill in the required details
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

          {/* Validation banner */}
          {bannerError ? (
            <View className="bg-destructive/10 rounded-xl px-4 py-3">
              <View className="flex-row items-center gap-2">
                <AlertCircle size={14} color="#DC2626" />
                <Text className="text-sm text-destructive flex-1">{bannerError}</Text>
              </View>
            </View>
          ) : null}

          {/* Insert button */}
          <Pressable
            onPress={handleGenerate}
            disabled={saving}
            className="rounded-xl py-4 items-center justify-center active:opacity-80 mt-2"
            style={{
              backgroundColor: MODULE_COLOR,
              borderCurve: 'continuous',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text className="text-white font-bold text-base">
              {saving ? 'Generating…' : isReportMode ? 'Insert into Report' : 'Insert into Action'}
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
