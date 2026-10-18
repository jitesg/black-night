/**
 * add-case-diary-karyvahi.tsx — Add timeline entries to a Case Diary.
 *
 * Supports two entry types:
 *   - 'karyvahi': links to a FIRKaryvahi, creates an Execution record, and records vivran.
 *   - 'narrative': free-text observation with optional format template.
 *
 * Entries are added in user-defined order (sequence_order = index).
 * No forced narrative-before-karyvahi rule.
 * Route: /(app)/mukadma/[firId]/add-case-diary-karyvahi?diaryId=<uuid>
 */
import { resolveContextDefaults } from '@/lib/contextDefaultResolver';
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { logger } from '@/lib/logger';
import { stripHtmlTags } from '@/lib/stringUtils';
import {
  BackHandler, View, Text, ScrollView, Pressable, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { FormatKeyInput } from '@/components/ui/input';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Plus, X, ChevronDown, LayoutTemplate, Zap, AlertCircle, FileText, CheckSquare, ChevronRight, GripVertical, CheckCircle2, CalendarDays, Pencil } from 'lucide-react-native';
import {
  getCaseDiaryById, addEntry, updateEntry as updateEntryInDB, deleteEntry as deleteEntryInDB,
  getNextSequenceOrder, getEntriesByDiary,
  getCaseDiariesByFIR, type CaseDiary,
} from '@/lib/db/caseDiaryRepo';
import { getKaryvahiByFIR, addExecution, type FIRKaryvahi } from '@/lib/db/firKaryvahiRepo';
import { getFIRById, type FIR } from '@/lib/db/firRepo';
import { FirBasisHintsView } from '@/components/caseDiary/FirBasisHintsView';
import { FardCheckButton } from '@/components/fard/FardCheckButton';
import {
  getFormatKeys, type FormatWithMeta, type FormatKey,
} from '@/lib/db/predefinedFormatRepo';
import { getPublishedFormatsByType } from '@/lib/db/sysFormatRepo';
import { generateReport } from '@/lib/templateEngine';
import { filterDynamicKeys, resolveGlobalKeys } from '@/lib/globalKeyEngine';
import { validateRequiredFields, clearFieldError } from '@/lib/templateValidation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppHeader } from '@/components/ui/ds/AppHeader';

// ─── Design tokens ───────────────────────────────────────────────────────────
const INDIGO = '#6366F1';

// ── Types ─────────────────────────────────────────────────────────────────────

type EntryKind = 'karyvahi' | 'narrative';

interface DiaryEntry {
  uid: string;
  kind: EntryKind;
  isExpanded: boolean;
  isDone: boolean;       // green tick: user marks entry as finalized
  // karyvahi fields
  firKaryvahiId: string;
  karyvahiName: string;
  vivran: string;
  formatUsed: string;
  // narrative fields
  narrativeText: string;
  narrativeTemplate: string;
}

function mkEntry(kind: EntryKind = 'karyvahi'): DiaryEntry {
  return {
    uid: Math.random().toString(36).slice(2),
    kind,
    isExpanded: true,
    isDone: false,
    firKaryvahiId: '', karyvahiName: '', vivran: '', formatUsed: '',
    narrativeText: '', narrativeTemplate: '',
  };
}

// ── Inline Format Fill Panel ──────────────────────────────────────────────────

function FormatFillPanel({
  format,
  firId,
  workspace,
  initialDraftValues,
  onGenerated,
  onSaveDraft,
  onClose,
}: {
  format: FormatWithMeta;
  firId: string | undefined;
  workspace: ReturnType<typeof useWorkspace>['workspace'];
  /** Pre-filled values from a previous draft save for this panel. */
  initialDraftValues?: Record<string, string>;
  onGenerated: (report: string, formatTitle: string) => void;
  /** Called when the user picks "ड्राफ्ट सेव करें" — passes current values up to parent. */
  onSaveDraft: (values: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [dynKeys, setDynKeys]       = useState<FormatKey[]>([]);
  const [values, setValues]         = useState<Record<string, string>>({});
  const [missingWs, setMissingWs]   = useState<string[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [genError, setGenError]     = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPanelDiscardDialog, setShowPanelDiscardDialog] = useState(false);

  // Phase 4: isMounted guard for FormatFillPanel key loading
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const allKeys = await getFormatKeys(format.id);
        const { autoValues: resolved, missingWorkspaceFields: missing } =
          resolveGlobalKeys(format.vivran, workspace);
        const dyn = filterDynamicKeys(allKeys);

        const defaults: Record<string, string> = {};
        for (const k of dyn) {
          if (
            k.default_value &&
            !k.default_value.startsWith('@') &&
            !(k.default_value.startsWith('__FROM_') && k.default_value.endsWith('__'))
          ) {
            defaults[k.key_name] = k.default_value;
          }
        }
        const contextDefaults = await resolveContextDefaults(dyn, firId);

        if (isMounted) {
          setMissingWs(missing);
          setDynKeys(dyn);
          // Draft values (if any) win over defaults — restores officer's prior input
          setValues({ ...defaults, ...contextDefaults, ...resolved, ...(initialDraftValues ?? {}) });
        }
      } catch (e) { logger.warn('[FormatFillPanel] load error:', e); }
      finally { if (isMounted) setLoadingKeys(false); }
    })();
    return () => { isMounted = false; };
  }, [format.id, format.vivran, workspace, firId, initialDraftValues]);

  /** True if the officer has typed anything beyond auto-filled defaults. */
  const isPanelDirty = Object.values(values).some((v) => v.trim() !== '');

  /** Handle the panel × close: if dirty, show 3-option dialog; else close immediately. */
  const handlePanelClose = () => {
    if (isPanelDirty) { setShowPanelDiscardDialog(true); } else { onClose(); }
  };

  const handleGenerate = () => {
    if (missingWs.length > 0) { setGenError(`Workspace incomplete — fill in: ${missingWs.join(', ')}`); return; }
    const { fieldErrors: errs, firstErrorKey, hasErrors } = validateRequiredFields(dynKeys, values);
    if (hasErrors) {
      setFieldErrors(errs);
      setGenError(firstErrorKey
        ? `"${dynKeys.find(k => k.key_name === firstErrorKey)?.label ?? firstErrorKey}" is required`
        : 'Please fill all mandatory fields.');
      return;
    }
    onGenerated(generateReport(format.vivran, values, dynKeys), format.title);
  };

  return (
    <View className="bg-card border border-border rounded-2xl mt-2 overflow-hidden" style={{ borderCurve: 'continuous' }}>
      {/* ── Panel-level 3-option discard dialog ────────────────────────── */}
      <AlertDialog open={showPanelDiscardDialog} onOpenChange={setShowPanelDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>अधूरा डेटा</AlertDialogTitle>
            <AlertDialogDescription>आपने कुछ फ़ील्ड भरे हैं। आप क्या करना चाहेंगे?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            <AlertDialogAction
              onPress={() => { setShowPanelDiscardDialog(false); onClose(); }}
              className="bg-destructive"
            >
              <Text className="text-white font-semibold text-sm">छोड़ें (Discard)</Text>
            </AlertDialogAction>
            <AlertDialogAction
              onPress={() => { onSaveDraft(values); setShowPanelDiscardDialog(false); onClose(); }}
              className="bg-primary"
            >
              <Text className="text-primary-foreground font-semibold text-sm">ड्राफ्ट सेव करें</Text>
            </AlertDialogAction>
            <AlertDialogCancel onPress={() => setShowPanelDiscardDialog(false)}>
              <Text className="font-semibold text-sm">वापस जाएं (Stay)</Text>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-row items-center gap-2">
          <LayoutTemplate size={14} color="#7C3AED" />
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>{format.title}</Text>
        </View>
        <Pressable onPress={handlePanelClose} className="p-1 active:opacity-60">
          <X size={15} color="#6B7280" />
        </Pressable>
      </View>
      {loadingKeys ? (
        <View className="py-8 items-center"><ActivityIndicator size="small" color="#7C3AED" /></View>
      ) : (
        <View className="px-4 py-4 gap-4">
          {dynKeys.length === 0 ? (
            <Text className="text-xs text-muted-foreground text-center py-2">No variable fields — tap Generate to use as-is.</Text>
          ) : (
            dynKeys.map((key) => (
              <FormatKeyInput
                key={key.id}
                keyDef={key}
                value={values[key.key_name] ?? ''}
                onChange={(kn, v) => {
                  setValues((p) => ({ ...p, [kn]: v }));
                  setFieldErrors((prev) => clearFieldError(prev, kn));
                  setGenError('');
                }}
                error={fieldErrors[key.key_name]}
              />
            ))
          )}
          {genError ? (
            <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={13} color="#DC2626" />
              <Text className="text-xs text-destructive flex-1">{genError}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={handleGenerate}
            className="flex-row items-center justify-center gap-2 rounded-xl py-3 active:opacity-80"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <Zap size={14} color="#fff" />
            <Text className="text-white text-sm font-bold">Generate &amp; Fill</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Format picker list ────────────────────────────────────────────────────────

function FormatPickerList({ formats, label, onSelect, onClose }: {
  formats: FormatWithMeta[];
  label: string;
  onSelect: (fmt: FormatWithMeta) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (formats.length === 0) {
    return (
      <View className="bg-card border border-border rounded-2xl mt-2 px-4 py-6 items-center gap-2" style={{ borderCurve: 'continuous' }}>
        <Text className="text-sm text-muted-foreground text-center">
          {t('fir.addCaseDiaryEntry.noFormat', { label })}{'\n'}{t('fir.addCaseDiaryEntry.noFormatSelected')}
        </Text>
        <Pressable onPress={onClose} className="mt-1">
          <Text className="text-xs text-muted-foreground underline">{t('fir.addCaseDiaryEntry.cancel') ?? 'Close'}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="bg-card border border-border rounded-2xl mt-2 overflow-hidden" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-sm font-bold text-foreground">{t('fir.addCaseDiaryEntry.formatPickerTitle')} — {label}</Text>
        <Pressable onPress={onClose} className="p-1 active:opacity-60"><X size={15} color="#6B7280" /></Pressable>
      </View>
      {formats.map((fmt, idx) => (
        <Pressable
          key={fmt.id}
          onPress={() => onSelect(fmt)}
          className="px-4 py-3 active:bg-secondary"
          style={{ borderBottomWidth: idx < formats.length - 1 ? 1 : 0, borderColor: '#E5E7EB' }}
        >
          <Text className="text-sm font-semibold text-foreground">{fmt.title}</Text>
          {fmt.tags.length > 0 && (
            <Text className="text-xs text-muted-foreground mt-0.5">{fmt.tags.join(' · ')}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ── Entry type toggle ─────────────────────────────────────────────────────────

function EntryTypeToggle({ kind, onChange }: { kind: EntryKind; onChange: (k: EntryKind) => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row bg-secondary rounded-xl p-1 gap-1">
      {(['karyvahi', 'narrative'] as EntryKind[]).map((k) => (
        <Pressable
          key={k}
          onPress={() => onChange(k)}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 active:opacity-80"
          style={{ backgroundColor: kind === k ? INDIGO : 'transparent' }}
        >
          {k === 'karyvahi'
            ? <CheckSquare size={13} color={kind === k ? '#fff' : '#6B7280'} />
            : <FileText size={13} color={kind === k ? '#fff' : '#6B7280'} />
          }
          <Text
            className="text-xs font-semibold capitalize"
            style={{ color: kind === k ? '#fff' : '#6B7280' }}
          >
            {k === 'karyvahi' ? t('fir.addCaseDiaryEntry.tabKaryvahi') : t('fir.addCaseDiaryEntry.tabNarrative')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Phase 2: Extracted & memoized diary entry card ────────────────────────────

interface DiaryEntryCardProps {
  entry: DiaryEntry;
  idx: number;
  totalEntries: number;
  firKaryvahi: ReturnType<typeof import('@/lib/db/firKaryvahiRepo').getKaryvahiByFIR> extends Promise<infer R> ? R : never[];
  caseDiaryFormats: FormatWithMeta[];
  narrativeFormats: FormatWithMeta[];
  showKaryvahiDropdown: string | null;
  showFormatList: string | null;
  activeFillPanel: { uid: string; fmt: FormatWithMeta; openedAt: number } | null;
  firId: string | undefined;
  fir?: Partial<FIR> | null;
  diaryDate?: string | null;
  workspace: ReturnType<typeof useWorkspace>['workspace'];
  /** Draft values keyed by "entryUid::formatId" — persisted across panel open/close. */
  draftFormats: Record<string, Record<string, string>>;
  updateEntry: (uid: string, patch: Partial<DiaryEntry>) => void;
  removeEntry: (uid: string) => void;
  setShowKaryvahiDropdown: (uid: string | null) => void;
  setShowFormatList: (uid: string | null) => void;
  setActiveFillPanel: (val: { uid: string; fmt: FormatWithMeta; openedAt: number } | null) => void;
  savePanelDraft: (entryUid: string, formatId: string, values: Record<string, string>) => void;
}

const DiaryEntryCard = memo(function DiaryEntryCard({
  entry,
  idx,
  totalEntries,
  firKaryvahi,
  caseDiaryFormats,
  narrativeFormats,
  showKaryvahiDropdown,
  showFormatList,
  activeFillPanel,
  firId,
  fir,
  diaryDate,
  workspace,
  draftFormats,
  updateEntry,
  removeEntry,
  setShowKaryvahiDropdown,
  setShowFormatList,
  setActiveFillPanel,
  savePanelDraft,
}: DiaryEntryCardProps) {
  const { t } = useTranslation();
  const formatPool  = entry.kind === 'narrative' ? narrativeFormats : caseDiaryFormats;
  const formatLabel = entry.kind === 'narrative' ? 'Narrative' : 'Case Diary';

  // ── Collapsed strip: 3-line summary view ──────────────────────────────
  if (!entry.isExpanded) {
    const entryTitle = entry.kind === 'karyvahi'
      ? (entry.karyvahiName || 'अनाम कार्यवाही')
      : 'Narrative Entry';
    const entryPreview = entry.kind === 'karyvahi'
      ? stripHtmlTags(entry.vivran || '...')
      : stripHtmlTags(entry.narrativeText || '...');
    const accentColor = entry.kind === 'karyvahi' ? '#6366F1' : '#6B7280';
    const bgColor     = entry.kind === 'karyvahi' ? '#EEF2FF' : '#F3F4F6';
    return (
      <View
        className="bg-card border border-border rounded-2xl flex-row items-stretch mb-0 overflow-hidden"
        style={{ borderCurve: 'continuous', borderColor: entry.isDone ? '#16A34A' : undefined }}
      >
        {/* Drag handle — left strip */}
        <Pressable
          className="w-9 items-center justify-center bg-secondary active:opacity-60"
          onPress={() => updateEntry(entry.uid, { isExpanded: true })}
          onLongPress={() => {/* reorder via long-press drag — visual affordance */}}
          delayLongPress={150}
        >
          <GripVertical size={16} color="#9CA3AF" />
        </Pressable>

        {/* Main tappable content */}
        <Pressable
          onPress={() => updateEntry(entry.uid, { isExpanded: true })}
          className="flex-1 p-4 flex-row items-start justify-between active:opacity-70"
        >
          <View className="flex-row items-start gap-3 flex-1">
            {/* index badge */}
            <View
              className="w-6 h-6 rounded-full items-center justify-center mt-0.5"
              style={{ backgroundColor: bgColor }}
            >
              <Text className="text-xs font-bold" style={{ color: accentColor }}>{idx + 1}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{entryTitle}</Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={2}>{entryPreview}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1 ml-2">
            <ChevronRight size={15} color="#9CA3AF" />
          </View>
        </Pressable>

        {/* Right action strip: done tick + delete */}
        <View className="items-center justify-around py-2 px-1 gap-1">
          <Pressable
            onPress={() => updateEntry(entry.uid, { isDone: !entry.isDone })}
            className="p-1.5 rounded-lg active:opacity-60"
            style={{ backgroundColor: entry.isDone ? '#DCFCE7' : '#F3F4F6' }}
          >
            <CheckCircle2 size={16} color={entry.isDone ? '#16A34A' : '#9CA3AF'} />
          </Pressable>
          {totalEntries > 1 && (
            <Pressable onPress={() => removeEntry(entry.uid)} className="p-1.5 active:opacity-60">
              <X size={14} color="#DC2626" />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // ── Expanded full form ────────────────────────────────────────────────
  return (
    <View
      key={entry.uid}
      className="bg-card border border-border rounded-2xl p-4 gap-4"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-foreground">Entry #{idx + 1}</Text>
        {totalEntries > 1 && (
          <Pressable onPress={() => removeEntry(entry.uid)} className="p-1 active:opacity-60">
            <X size={16} color="#DC2626" />
          </Pressable>
        )}
      </View>

      {/* Entry type toggle */}
      <EntryTypeToggle
        kind={entry.kind}
        onChange={(k) => updateEntry(entry.uid, { kind: k })}
      />

      {/* Karyvahi picker */}
      {entry.kind === 'karyvahi' && (
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('fir.addCaseDiaryEntry.tabKaryvahi')}
          </Text>
          <Pressable
            onPress={() => setShowKaryvahiDropdown(
              showKaryvahiDropdown === entry.uid ? null : entry.uid
            )}
            className="flex-row items-center justify-between bg-secondary rounded-xl px-4 py-3 active:opacity-70"
          >
            <Text
              className={`text-sm flex-1 ${entry.karyvahiName ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
              numberOfLines={1}
            >
              {entry.karyvahiName || t('fir.addCaseDiaryEntry.karyvahiPlaceholder')}
            </Text>
            <ChevronDown size={16} color="#6B7280" />
          </Pressable>

          {showKaryvahiDropdown === entry.uid && (
            <View className="bg-card border border-border rounded-2xl mt-1 overflow-hidden max-h-56" style={{ borderCurve: 'continuous' }}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {firKaryvahi.length === 0 ? (
                  <View className="px-4 py-4 items-center">
                    <Text className="text-sm text-muted-foreground">{t('fir.addCaseDiaryEntry.noKaryvahi')}</Text>
                  </View>
                ) : (
                  firKaryvahi.map((k) => (
                    <Pressable
                      key={k.id}
                      onPress={() => {
                        updateEntry(entry.uid, { firKaryvahiId: k.id, karyvahiName: k.name });
                        setShowKaryvahiDropdown(null);
                      }}
                      className="px-4 py-3 border-b border-border active:bg-secondary"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text
                          className="text-sm flex-1"
                          style={{
                            color: entry.firKaryvahiId === k.id ? INDIGO : '#111827',
                            fontWeight: entry.firKaryvahiId === k.id ? '700' : '400',
                          }}
                        >
                          {k.name}
                        </Text>
                        {(k.execution_count ?? 0) > 0 && (
                          <View className="bg-green-50 rounded-full ml-2 px-2.5 py-1 dark:bg-green-500/15">
                            <Text textBreakStrategy="simple" className="text-xs" style={{ color: '#15803D' }}>×{k.execution_count}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  ))
                )}
                <Pressable onPress={() => setShowKaryvahiDropdown(null)} className="px-4 py-3 active:bg-secondary">
                  <Text className="text-xs text-muted-foreground">{t('fir.addCaseDiaryEntry.cancel') ?? 'Cancel'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* Format picker */}
      <View className="gap-2">
        <Pressable
          onPress={() => { setActiveFillPanel(null); setShowFormatList(showFormatList === entry.uid ? null : entry.uid); }}
          className="flex-row items-center gap-2 border border-dashed border-border rounded-xl px-4 py-3 active:opacity-70"
        >
          <LayoutTemplate size={14} color="#7C3AED" />
          <Text className="text-sm font-semibold flex-1" style={{ color: '#7C3AED' }}>
            {entry.formatUsed || entry.narrativeTemplate
              ? `${t('fir.addCaseDiaryEntry.formatLabel')}: ${entry.formatUsed || entry.narrativeTemplate}`
              : t('fir.addCaseDiaryEntry.useFormat')}
          </Text>
          {(entry.formatUsed || entry.narrativeTemplate) ? (
            <Pressable
              onPress={() => updateEntry(entry.uid, { formatUsed: '', narrativeTemplate: '' })}
              className="p-0.5 active:opacity-60"
            >
              <X size={13} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </Pressable>

        {showFormatList === entry.uid && (
          <FormatPickerList
            formats={formatPool}
            label={formatLabel}
            onSelect={(fmt) => { setShowFormatList(null); setActiveFillPanel({ uid: entry.uid, fmt, openedAt: Date.now() }); }}
            onClose={() => setShowFormatList(null)}
          />
        )}

        {activeFillPanel?.uid === entry.uid && (
          <FormatFillPanel
            key={`${activeFillPanel.fmt.id}::${entry.uid}::${activeFillPanel.openedAt}`}
            format={activeFillPanel.fmt}
            firId={firId}
            workspace={workspace}
            initialDraftValues={draftFormats[`${entry.uid}::${activeFillPanel.fmt.id}`]}
            onGenerated={(report, title) => {
              updateEntry(entry.uid, entry.kind === 'karyvahi'
                ? { vivran: report, formatUsed: title }
                : { narrativeText: report, narrativeTemplate: title }
              );
              setActiveFillPanel(null);
            }}
            onSaveDraft={(vals) => savePanelDraft(entry.uid, activeFillPanel.fmt.id, vals)}
            onClose={() => setActiveFillPanel(null)}
          />
        )}
      </View>

      {/* Content editor */}
      <View className="gap-1.5">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {entry.kind === 'karyvahi' ? t('fir.addCaseDiaryEntry.fieldVivran') : t('fir.addCaseDiaryEntry.fieldNarrative')}
        </Text>
        <DocumentEditor
          value={entry.kind === 'karyvahi' ? entry.vivran : entry.narrativeText}
          onChangeText={(v) => updateEntry(
            entry.uid,
            entry.kind === 'karyvahi' ? { vivran: v } : { narrativeText: v }
          )}
          title={entry.kind === 'karyvahi' ? t('fir.addCaseDiaryEntry.vivranEditorTitle') : t('fir.addCaseDiaryEntry.narrativeEditorTitle')}
          placeholder={entry.kind === 'karyvahi'
            ? t('fir.addCaseDiaryEntry.vivranPlaceholder')
            : t('fir.addCaseDiaryEntry.narrativePlaceholder')
          }
          minHeight={96}
          accessibilityLabel={entry.kind === 'karyvahi' ? t('fir.addCaseDiaryEntry.vivranAccessibility') : t('fir.addCaseDiaryEntry.narrativeAccessibility')}
        />
        {/* FIR Basis Non-blocking Hints */}
        <FirBasisHintsView
          fir={fir}
          diaryDate={diaryDate}
          text={entry.kind === 'karyvahi' ? entry.vivran : entry.narrativeText}
          karyvahiKey={entry.kind === 'karyvahi' ? entry.karyvahiName : undefined}
          hasDiaries={true}
        />
        <FardCheckButton
          text={entry.kind === 'karyvahi' ? entry.vivran : entry.narrativeText}
          title={entry.kind === 'karyvahi' ? entry.karyvahiName : undefined}
          fir={fir}
          matchKeywords={true}
          className="mt-1"
        />
      </View>

      {/* Save / Minimize button */}
      <Pressable
        onPress={() => updateEntry(entry.uid, { isExpanded: false })}
        className="bg-secondary rounded-xl py-3 items-center justify-center active:opacity-70"
      >
        <Text className="text-sm font-semibold text-muted-foreground">सहेजें / छोटा करें</Text>
      </Pressable>
    </View>
  );
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AddCaseDiaryKaryvahiScreen() {
  const { firId, diaryId, karyvahiId } = useLocalSearchParams<{ firId: string; diaryId: string; karyvahiId?: string }>();
  const { workspace } = useWorkspace();
  const { t } = useTranslation();

  const [diary, setDiary]                 = useState<CaseDiary | null>(null);
  const [fir, setFir]                     = useState<FIR | null>(null);
  const [firKaryvahi, setFirKaryvahi]     = useState<FIRKaryvahi[]>([]);
  const [caseDiaryFormats, setCaseDiaryFormats] = useState<FormatWithMeta[]>([]);
  const [narrativeFormats, setNarrativeFormats] = useState<FormatWithMeta[]>([]);
  const [entries, setEntries]             = useState<DiaryEntry[]>([mkEntry('karyvahi')]);

  const [showKaryvahiDropdown, setShowKaryvahiDropdown] = useState<string | null>(null);
  const [showFormatList, setShowFormatList]             = useState<string | null>(null);
  const [activeFillPanel, setActiveFillPanel]           = useState<{ uid: string; fmt: FormatWithMeta; openedAt: number } | null>(null);

  // Draft values keyed by "entryUid::formatId" — survive panel open/close cycles
  const [draftFormats, setDraftFormats] = useState<Record<string, Record<string, string>>>({});

  const savePanelDraft = useCallback((entryUid: string, formatId: string, vals: Record<string, string>) => {
    setDraftFormats((prev) => ({ ...prev, [`${entryUid}::${formatId}`]: vals }));
  }, []);

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

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

  // Phase 4: isMounted guard prevents state updates on unmounted component
  useEffect(() => {
    if (!firId || !diaryId) return;
    let isMounted = true;
    (async () => {
      const [f, d, k, cdFmts, narFmts, existingEntries, allDiaries] = await Promise.all([
        getFIRById(firId),
        getCaseDiaryById(diaryId),
        getKaryvahiByFIR(firId),
        getPublishedFormatsByType('Case Diary'),
        getPublishedFormatsByType('Narrative'),
        getEntriesByDiary(diaryId),
        getCaseDiariesByFIR(firId),
      ]);
      if (isMounted) {
        setDiary(d);
        if (f) setFir(f);
        setFirKaryvahi(k);
        setCaseDiaryFormats(cdFmts);
        setNarrativeFormats(narFmts);

        if (existingEntries.length === 0) {
          // Sort oldest→newest to determine this diary's sequence number
          const sortedDiaries = [...allDiaries].sort((a, b) => a.created_at - b.created_at);
          const currentIndex  = sortedDiaries.findIndex((diary) => diary.id === diaryId);
          const cdNumber      = currentIndex >= 0 ? currentIndex + 1 : 1;

          let introText = '';
          if (cdNumber === 1) {
            introText =
              'श्रीमान जी मुकदमा उपरोक्त थाना स्थानीय पर पंजीकृत होकर विवेचना हस्वादेश प्रभारी निरीक्षक महोदय के मुझ उपनिरीक्षक को सुपुर्द हुई है। थाना कार्यालय से नकल चिक, नकल रपट प्राप्त हुई है । विवेचना ग्रहण कर मशरूफ विवेचना हुआ। प्राप्त प्रपत्रो का अवलोकन किया जा रहा है।';
          } else {
            const prevDiary  = sortedDiaries[currentIndex - 1];
            const prevCdNo   = String(currentIndex).padStart(2, '0');
            const prevCdDate = prevDiary?.preparation_date ?? 'अज्ञात तिथि';
            introText =
              `श्रीमान जी मुकदमा उपरोक्त मे पर्चा नं0 ${prevCdNo} दिनांक ${prevCdDate} को किता कर सेवा मे प्रेषित किया जा चुका है। आज मै विवेचक दीगर कार्यसरकार से फुरसत पाकर मुकदमा उपरोक्त की विवेचना मे मशरूफ हुआ।`;
          }

          const saransh  = f?.mukadma_saransh?.trim();
          const saranshText = saransh ? `मुकदमा सारांश:\n${saransh}` : '';
          const saranshEntry: DiaryEntry = {
            ...mkEntry('narrative'),
            narrativeText: saranshText,
            isExpanded: false,
          };

          // If a specific karyvahi was pre-selected (from Diary tab queue), inject it
          // as the focused entry instead of the generic blank karyvahi slot.
          if (karyvahiId) {
            const matched = k.find((x) => x.id === karyvahiId);
            const preFilledKaryvahi: DiaryEntry = matched
              ? { ...mkEntry('karyvahi'), firKaryvahiId: matched.id, karyvahiName: matched.name, isExpanded: true }
              : { ...mkEntry('karyvahi'), isExpanded: true };
            setEntries([
              ...(saranshText ? [saranshEntry] : []),
              { ...mkEntry('narrative'), narrativeText: introText, isExpanded: false },
              preFilledKaryvahi,
            ]);
          } else {
            setEntries([
              ...(saranshText ? [saranshEntry] : []),
              { ...mkEntry('narrative'), narrativeText: introText, isExpanded: false },
              { ...mkEntry('karyvahi'),  isExpanded: true },
            ]);
          }
        } else {
          // Load existing entries for editing — map DB rows into local DiaryEntry state
          const mappedEntries: DiaryEntry[] = existingEntries.map((e) => ({
            uid: e.id, // DB id used as uid so handleSave can distinguish UPDATE vs INSERT
            kind: (e.entry_type as EntryKind) || 'karyvahi',
            isExpanded: false, // start collapsed for a clean overview
            isDone: true,
            firKaryvahiId: e.fir_karyvahi_id || '',
            karyvahiName: e.karyvahi_name || '',
            vivran: e.vivran || '',
            formatUsed: e.format_used || '',
            narrativeText: e.narrative_text || '',
            narrativeTemplate: e.narrative_template || '',
          }));

          // If a specific karyvahi was pre-selected and isn't already in the diary,
          // append a pre-filled entry and focus it (collapse everything else).
          if (karyvahiId) {
            const alreadyPresent = mappedEntries.some((e) => e.firKaryvahiId === karyvahiId);
            if (alreadyPresent) {
              // Just expand the existing entry so the officer sees it
              setEntries(mappedEntries.map((e) =>
                e.firKaryvahiId === karyvahiId ? { ...e, isExpanded: true } : e
              ));
            } else {
              const matched = k.find((x) => x.id === karyvahiId);
              const preFilledKaryvahi: DiaryEntry = matched
                ? { ...mkEntry('karyvahi'), firKaryvahiId: matched.id, karyvahiName: matched.name, isExpanded: true }
                : { ...mkEntry('karyvahi'), isExpanded: true };
              setEntries([
                ...mappedEntries.map((e) => ({ ...e, isExpanded: false })),
                preFilledKaryvahi,
              ]);
            }
          } else {
            setEntries(mappedEntries);
          }
        }
      }
    })();
    return () => { isMounted = false; };
  }, [firId, diaryId]);

  const updateEntry = (uid: string, patch: Partial<DiaryEntry>) => {
    isDirty.current = true;
    setEntries((prev) => prev.map((e) => e.uid === uid ? { ...e, ...patch } : e));
  };

  const removeEntry = (uid: string) => {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
    if (showKaryvahiDropdown === uid) setShowKaryvahiDropdown(null);
    if (showFormatList === uid) setShowFormatList(null);
    if (activeFillPanel?.uid === uid) setActiveFillPanel(null);
  };

  const handleSave = async () => {
    // Validate entries — never silently discard filled-but-incomplete ones
    const valid: DiaryEntry[] = [];
    for (const e of entries) {
      if (e.kind === 'karyvahi') {
        const hasName   = e.karyvahiName.trim().length > 0;
        const hasVivran = e.vivran.trim().length > 0;
        // Vivran filled but no karyvahi selected → block save with clear error
        if (hasVivran && !hasName) {
          setError(t('fir.addCaseDiaryEntry.errorSelectKaryvahi'));
          return;
        }
        if (hasName || hasVivran) valid.push(e);
      } else {
        if (e.narrativeText.trim().length > 0) valid.push(e);
      }
    }
    if (!valid.length) { setError(t('fir.addCaseDiaryEntry.errorNoEntries')); return; }
    setError('');
    setSaving(true);

    // Collect the DB-originating ids so we know which entries to UPDATE vs INSERT
    const existingDbIds = new Set(
      entries
        .filter((e) => e.uid.length === 36 && e.uid.includes('-')) // UUID format = came from DB
        .map((e) => e.uid)
    );

    try {
      const baseSeq = await getNextSequenceOrder(diaryId!);

      // DELETE entries that were in the original DB set but the user removed
      const validUids = new Set(valid.map((e) => e.uid));
      for (const dbId of existingDbIds) {
        if (!validUids.has(dbId)) {
          await deleteEntryInDB(dbId);
        }
      }

      let insertSeq = baseSeq;
      for (const e of valid) {
        const isExisting = existingDbIds.has(e.uid);

        if (isExisting) {
          // UPDATE path — just patch the text/format fields
          if (e.kind === 'karyvahi') {
            await updateEntryInDB(e.uid, {
              karyvahi_name: e.karyvahiName.trim(),
              vivran: e.vivran.trim() || undefined,
              format_used: e.formatUsed || undefined,
            });
          } else {
            await updateEntryInDB(e.uid, {
              narrative_text: e.narrativeText.trim(),
              narrative_template: e.narrativeTemplate || undefined,
            });
          }
        } else {
          // INSERT path — new entry added during this edit session
          const seqOrder = insertSeq++;
          if (e.kind === 'karyvahi') {
            let executionId: string | undefined;
            if (e.firKaryvahiId) {
              const exec = await addExecution({
                fir_karyvahi_id: e.firKaryvahiId,
                case_diary_id: diaryId!,
                case_id: firId!,
                template_used: e.formatUsed || undefined,
                generated_text: e.vivran.trim() || undefined,
              });
              executionId = exec.id;
            }
            await addEntry({
              case_diary_id: diaryId!,
              entry_type: 'karyvahi',
              sequence_order: seqOrder,
              linked_execution_id: executionId,
              fir_karyvahi_id: e.firKaryvahiId || undefined,
              karyvahi_name: e.karyvahiName.trim(),
              vivran: e.vivran.trim() || undefined,
              format_used: e.formatUsed || undefined,
            });
          } else {
            await addEntry({
              case_diary_id: diaryId!,
              entry_type: 'narrative',
              sequence_order: seqOrder,
              narrative_text: e.narrativeText.trim(),
              narrative_template: e.narrativeTemplate || undefined,
            });
          }
        }
      }
      router.back();
    } catch (err) {
      logger.error('[AddCaseDiaryKaryvahi] save error:', err);
      setError(t('fir.addCaseDiaryEntry.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
      className="flex-1 bg-background"
    >
      {/* ── Discard-changes confirmation (3-option) ───────────────────── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fir.addCaseDiaryEntry.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('fir.addCaseDiaryEntry.discardDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            {/* Leave — discard all unsaved data */}
            <AlertDialogAction
              onPress={() => { setShowDiscardDialog(false); router.back(); }}
              className="bg-destructive"
            >
              <Text className="text-white font-semibold text-sm">छोड़ें (Discard)</Text>
            </AlertDialogAction>
            {/* Save as Draft — persist entries then go back */}
            <AlertDialogAction
              onPress={async () => {
                setShowDiscardDialog(false);
                await handleSave();
              }}
              className="bg-primary"
            >
              <Text className="text-primary-foreground font-semibold text-sm">ड्राफ्ट सेव करें</Text>
            </AlertDialogAction>
            {/* Stay — dismiss dialog, keep editing */}
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>
              <Text className="font-semibold text-sm">रुकें (Stay)</Text>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppHeader
        title={t('fir.addCaseDiaryEntry.title')}
        subtitle={diary ? diary.preparation_date : undefined}
        onBack={handleBackPress}
        rightActions={
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl px-4 py-2 active:opacity-70"
            style={{ backgroundColor: INDIGO }}
          >
            <Text className="text-white text-sm font-bold">{saving ? t('fir.addCaseDiaryEntry.saving') : t('fir.addCaseDiaryEntry.save')}</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="px-5 py-5 gap-4 pb-24"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        ) : null}

        {/* ── Diary metadata summary + quick-edit button ───────────────── */}
        {diary ? (
          <View
            className="flex-row items-center justify-between bg-secondary border border-border rounded-2xl px-4 py-3"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-row items-center gap-2 flex-1">
              <CalendarDays size={14} color="#6B7280" />
              <View className="flex-1 gap-0.5">
                <Text className="text-xs font-bold text-foreground">
                  {t('fir.addCaseDiaryEntry.metaDate')}: {diary.preparation_date ?? 'N/A'}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {t('fir.addCaseDiaryEntry.metaTime')}: {diary.start_time ?? '--'}{diary.end_time ? ` → ${diary.end_time}` : ''}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push({
                pathname: '/(app)/mukadma/[firId]/add-case-diary' as never,
                params: { firId, diaryId },
              })}
              className="flex-row items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 active:opacity-70 ml-3"
            >
              <Pencil size={12} color="#6366F1" />
              <Text className="text-xs font-bold" style={{ color: '#6366F1' }}>
                {t('fir.addCaseDiaryEntry.editMetadata')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {entries.map((entry, idx) => (
          <DiaryEntryCard
            key={entry.uid}
            entry={entry}
            idx={idx}
            totalEntries={entries.length}
            firKaryvahi={firKaryvahi}
            caseDiaryFormats={caseDiaryFormats}
            narrativeFormats={narrativeFormats}
            showKaryvahiDropdown={showKaryvahiDropdown}
            showFormatList={showFormatList}
            activeFillPanel={activeFillPanel}
            firId={firId}
            fir={fir}
            diaryDate={diary?.preparation_date}
            workspace={workspace}
            draftFormats={draftFormats}
            updateEntry={updateEntry}
            removeEntry={removeEntry}
            setShowKaryvahiDropdown={setShowKaryvahiDropdown}
            setShowFormatList={setShowFormatList}
            setActiveFillPanel={setActiveFillPanel}
            savePanelDraft={savePanelDraft}
          />
        ))}

        <Pressable
          onPress={() => setEntries((prev) => [
            ...prev.map((e) => ({ ...e, isExpanded: false })),
            mkEntry('karyvahi'),
          ])}
          className="flex-row items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl py-4 active:opacity-70"
        >
          <Plus size={16} color="#6B7280" />
          <Text className="text-sm text-muted-foreground font-medium">{t('fir.addCaseDiaryEntry.addAnotherEntry')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
