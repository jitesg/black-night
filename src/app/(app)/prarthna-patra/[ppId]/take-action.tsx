/**
 * Take Action Screen — shared for बीट सूचना and NCR petition types.
 *
 * Beat Information: no action-type dropdown; action editor + BNSS format picker.
 * NCR: adds action-type dropdown (सुलह-समझौता | BNSS Karyavahi).
 *
 * On save:
 *   is_complete=true  → status becomes Finished
 *   is_complete=false → status stays Pending (draft)
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable,
  KeyboardAvoidingView, BackHandler, ActivityIndicator,
} from 'react-native';
import { Input } from '@/components/ui/input';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LayoutTemplate, ChevronDown } from 'lucide-react-native';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getPPWithDetails, saveAction,
  PETITION_TYPE_LABELS, NCR_ACTION_TYPES,
  _todayString,
  type PPWithDetails, type NCRActionType,
} from '@/lib/db/prarthnaPatraRepo';
import { ppActionDraftStore } from '@/lib/ppActionDraftStore';
import { getPublishedFormatsByType } from '@/lib/db/sysFormatRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';

const MODULE_COLOR = '#7C3AED';

// ── Helpers ──────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mt-5 mb-2">
      {title}
    </Text>
  );
}

function ActionTypePicker({
  value, onChange, error,
}: { value: NCRActionType | ''; onChange: (v: NCRActionType) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="border rounded-xl px-3 py-3 flex-row items-center justify-between bg-card active:opacity-70"
        style={{ borderColor: error ? '#DC2626' : '#E5E7EB', borderCurve: 'continuous' }}
      >
        <Text className="text-sm" style={{ color: value ? '#111827' : '#9CA3AF' }}>
          {value || 'Select action type…'}
        </Text>
        <ChevronDown size={16} color="#9CA3AF" />
      </Pressable>
      {error ? <Text className="text-xs text-destructive mt-1">{error}</Text> : null}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Action Type</AlertDialogTitle>
          </AlertDialogHeader>
          {NCR_ACTION_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => { onChange(t); setOpen(false); }}
              className="py-3 px-4 border-b border-border active:bg-muted flex-row items-center justify-between"
            >
              <Text className="text-sm text-foreground">{t}</Text>
              {value === t && <Text style={{ color: MODULE_COLOR }}>✓</Text>}
            </Pressable>
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setOpen(false)}><Text>Cancel</Text></AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function TakeActionScreen() {
  const { ppId } = useLocalSearchParams<{ ppId: string }>();

  const [pp, setPP] = useState<PPWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasFormats, setHasFormats] = useState(false);

  // Form state
  const [actionType, setActionType] = useState<NCRActionType | ''>('');
  const [actionDate, setActionDate] = useState(_todayString());
  const [actionContent, setActionContent] = useState('');
  const [usedFormatTitle, setUsedFormatTitle] = useState<string | null>(null);
  const [usedFormatId, setUsedFormatId] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [backDialogOpen, setBackDialogOpen] = useState(false);
  // Bug 4 fix: useRef maintains the same mutable object across all renders.
  // useState({ current: false }) returned a NEW object on every render, so
  // mutations to savedRef.current were silently lost on the next re-render.
  const savedRef = useRef(false);
  const initialLoadDone = useRef(false);

  const isNCR = pp?.petition_type === 'NCR';

  // Load petition + latest action
  useFocusEffect(useCallback(() => {
    (async () => {
      // Consume any format draft first (returned from fill-format)
      const draft = ppActionDraftStore.consume();

      if (!initialLoadDone.current) {
        setLoading(true);
        try {
          const [data, formats] = await Promise.all([
            ppId ? getPPWithDetails(ppId) : null,
            getPublishedFormatsByType('BNSS Karyavahi'),
          ]);
          setPP(data);
          setHasFormats(formats.length > 0);

          // Pre-fill from existing action if present
          const existing = data?.actions?.[0] ?? null;
          if (existing) {
            setActionType((existing.action_type as NCRActionType) || '');
            setActionDate(existing.action_date);
            setActionContent(existing.action_content);
            setUsedFormatTitle(existing.format_title);
            setUsedFormatId(existing.format_id);
          }
        } finally {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }

      // Insert format draft if returned from fill-format screen
      if (draft) {
        setActionContent((prev) =>
          prev.trim() ? `${prev}\n\n${draft.generatedText}` : draft.generatedText
        );
        setUsedFormatTitle(draft.formatTitle);
        setUsedFormatId(draft.formatId);
        setIsDirty(true);
      }
    })();
  }, [ppId]));

  // Dirty tracking (after initial load)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (!savedRef.current) setIsDirty(true);
  }, [actionType, actionDate, actionContent]); // savedRef is a ref — excluded intentionally

  // Hardware back
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

  const validate = (isComplete: boolean): boolean => {
    const e: Record<string, string> = {};
    if (isNCR && !actionType) e.actionType = 'Please select an action type';
    if (!actionDate.trim()) e.actionDate = 'Action date is required';
    if (!actionContent.trim()) e.actionContent = 'Action content is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async (isComplete: boolean) => {
    if (!validate(isComplete) || !ppId) return;
    setSaving(true);
    try {
      await saveAction({
        prarthna_patra_id: ppId,
        action_type: isNCR ? actionType : 'BNSS Karyavahi',
        action_date: actionDate,
        action_content: actionContent.trim(),
        is_complete: isComplete,
        format_id: usedFormatId,
        format_title: usedFormatTitle,
      });
      savedRef.current = true;
      setIsDirty(false);
      router.back();
    } catch {
      setErrors({ general: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1"
    >
      <View className="flex-1 bg-background">
        <AppHeader title="Take Action" subtitle={pp?.registration_number ?? ''}
          onBack={handleBack}
        />

        <ScrollView
          contentContainerClassName="px-5 pb-12"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Petition context */}
          {pp && (
            <View className="bg-muted rounded-xl px-3 py-2.5 mt-4">
              <Text className="text-xs text-muted-foreground">
                {PETITION_TYPE_LABELS[pp.petition_type]} · {pp.registration_number}
              </Text>
              {pp.complainants[0]?.name ? (
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {pp.complainants[0].name}
                </Text>
              ) : null}
            </View>
          )}

          {errors.general ? (
            <Text className="text-sm text-destructive mt-3">{errors.general}</Text>
          ) : null}

          {/* ── NCR: Action Type dropdown ── */}
          {isNCR && (
            <>
              <SectionLabel title="Action Type" />
              <ActionTypePicker
                value={actionType}
                onChange={setActionType}
                error={errors.actionType}
              />
            </>
          )}

          {/* ── Action Date ── */}
          <SectionLabel title="Action Date" />
          <Input
            type="date"
            placeholder="YYYY-MM-DD"
            value={actionDate}
            onChangeText={setActionDate}
            errorText={errors.actionDate}
          />

          {/* ── Add From Format ── */}
          <SectionLabel title="Add From Format" />
          <Pressable
            onPress={() => router.push({ pathname: '/(app)/prarthna-patra/select-format' as never, params: { mode: 'action', ppId } })}
            className="border border-border rounded-xl px-4 py-3 flex-row items-center gap-3 active:opacity-70 bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center"
              style={{ backgroundColor: `${MODULE_COLOR}12` }}
            >
              <LayoutTemplate size={16} color={MODULE_COLOR} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">Add From Format</Text>
              {usedFormatTitle ? (
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  Last used: {usedFormatTitle}
                </Text>
              ) : (
                <Text className="text-xs text-muted-foreground">
                  {hasFormats ? 'Select a BNSS Karyavahi format' : 'No BNSS Karyavahi formats found'}
                </Text>
              )}
            </View>
          </Pressable>

          {/* ── Action Editor ── */}
          <SectionLabel title="Action (कार्यवाही)" />
          <DocumentEditor
            value={actionContent}
            onChangeText={(v) => { setActionContent(v); setErrors((e) => ({ ...e, actionContent: '' })); }}
            title="Action (Karyvahi)"
            placeholder="Type the action here, or use Add From Format above to insert a BNSS Karyavahi document…"
            minHeight={280}
            error={!!errors.actionContent}
            accessibilityLabel="Action content editor"
          />
          {errors.actionContent ? (
            <Text className="text-xs text-destructive mt-1">{errors.actionContent}</Text>
          ) : null}

          {/* ── Info note ── */}
          <View className="mt-4 bg-muted rounded-xl p-3">
            <Text className="text-xs text-muted-foreground">
              <Text className="font-semibold">Save as Complete</Text> → Status becomes{' '}
              <Text className="font-semibold">Finished</Text>.{' '}
              <Text className="font-semibold">Save as Draft</Text> → Status stays{' '}
              <Text className="font-semibold">Pending</Text>.
            </Text>
          </View>

          {/* ── Action buttons ── */}
          <View className="mt-5 gap-3">
            <Pressable
              onPress={() => handleSave(true)}
              disabled={saving}
              className="rounded-xl py-3.5 items-center active:opacity-70"
              style={{ backgroundColor: MODULE_COLOR }}
            >
              <Text className="text-sm font-semibold text-white">
                {saving ? 'Saving…' : 'Save as Complete (Finished)'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleSave(false)}
              disabled={saving}
              className="rounded-xl py-3.5 items-center border border-border active:opacity-70 bg-card"
            >
              <Text className="text-sm font-semibold text-foreground">
                Save as Draft (Pending)
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      {/* Back protection */}
      <AlertDialog open={backDialogOpen} onOpenChange={setBackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setBackDialogOpen(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { setBackDialogOpen(false); setIsDirty(false); router.back(); }}
            >
              <Text>Discard</Text>
            </AlertDialogAction>
            <AlertDialogAction
              onPress={() => { setBackDialogOpen(false); handleSave(false); }}
            >
              <Text>Save Draft</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </KeyboardAvoidingView>
  );
}
