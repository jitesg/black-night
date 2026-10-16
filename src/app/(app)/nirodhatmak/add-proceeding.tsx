/**
 * Nirodhatmak Karyvahi — Add / Edit Proceeding Screen
 *
 * Handles both create (no editId param) and edit (editId param) flows.
 *
 * Bridge consumer pattern (mirrors gd/add-gd.tsx exactly):
 *  • beginSession on mount, endSession on unmount
 *  • useFocusEffect consumes nirodhatmakFormatBridge on every focus
 *  • Insert mode: replace (default) or append — chosen via Replace/Append dialog
 *    when editor already has content
 *  • Back-button protection: unsaved-changes dialog guards back navigation
 *    on both header button and Android hardware back
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  BackHandler, KeyboardAvoidingView, Pressable, ScrollView,
  Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  FileWarning, Calendar, ChevronDown,
  LayoutTemplate, Save, AlertCircle,
} from 'lucide-react-native';
import { DatePickerModal, dateStrToObj, dateObjToStr } from '@/components/common/DatePickerModal';
import {
  createNirodhatmakKaryvahi, updateNirodhatmakKaryvahi,
  getNirodhatmakById, NIRODHATMAK_TYPES,
  type NirodhatmakType,
} from '@/lib/db/nirodhatmakRepo';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { nirodhatmakFormatBridge } from '@/lib/nirodhatmakFormatBridge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const MODULE_COLOR = '#DC2626';

// ─── Helpers ──────────────────────────────────────────────────────────────
function todayDateObj(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateToString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDate(str: string): string {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────
export default function AddProceedingScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = Boolean(editId);

  // Form state
  const [proceedingDate, setProceedingDate] = useState<Date>(todayDateObj());
  const [proceedingType, setProceedingType] = useState<NirodhatmakType>('बीट सूचना');
  const [editorContent, setEditorContent] = useState('');
  const [formatId, setFormatId] = useState<string | undefined>(undefined);
  const [formatTitle, setFormatTitle] = useState<string | undefined>(undefined);

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  // dateStr mirrors proceedingDate as "YYYY-MM-DD" for the modal
  const proceedingDateStr = dateToString(proceedingDate);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  // Refs
  const originalRef = useRef({
    proceedingDate: dateToString(todayDateObj()),
    proceedingType: 'बीट सूचना' as NirodhatmakType,
    editorContent: '',
  });
  const isDirty = useRef(false);
  const editorContentRef = useRef('');
  const insertModeRef = useRef<'replace' | 'append'>('replace');
  const isConsumingRef = useRef(false);
  const addFromFormatBusyRef = useRef(false);
  const sessionIdRef = useRef('');
  const isMountedRef = useRef(true);
  const latestLoadOpRef = useRef(0);
  const latestSaveOpRef = useRef(0);

  // Keep editorContentRef in sync
  useEffect(() => { editorContentRef.current = editorContent; }, [editorContent]);

  // ── Mount / unmount lifecycle ──────────────────────────────────────────
  useEffect(() => {
    const sid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    sessionIdRef.current = sid;
    isMountedRef.current = true;
    nirodhatmakFormatBridge.beginSession(sid);
    if (__DEV__) console.log('[AddProceeding] mounted — session:', sid, '| isEdit:', isEdit);

    return () => {
      isMountedRef.current = false;
      nirodhatmakFormatBridge.endSession(sessionIdRef.current);
      isConsumingRef.current = false;
      addFromFormatBusyRef.current = false;
      insertModeRef.current = 'replace';
      latestLoadOpRef.current = Number.MAX_SAFE_INTEGER;
      latestSaveOpRef.current = Number.MAX_SAFE_INTEGER;
      if (__DEV__) console.log('[AddProceeding] unmounted | session:', sessionIdRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── useFocusEffect: bridge consumption + Android hardware-back ─────────
  useFocusEffect(
    useCallback(() => {
      addFromFormatBusyRef.current = false;

      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isDirty.current) {
          setShowUnsavedDialog(true);
          return true;
        }
        return false;
      });

      (async () => {
        if (__DEV__) console.log('[AddProceeding] focused | session:', sessionIdRef.current);
        if (!isMountedRef.current) return;
        if (isConsumingRef.current) return;
        isConsumingRef.current = true;

        const loadOpId = ++latestLoadOpRef.current;

        try {
          const pending = nirodhatmakFormatBridge.consume(sessionIdRef.current);

          if (pending !== null) {
            if (__DEV__) console.log('[AddProceeding] bridge consumed — chars:', pending.text.length);
            if (typeof pending.text !== 'string' || pending.text.trim().length === 0) return;
            if (!isMountedRef.current) return;

            if (insertModeRef.current === 'append' && editorContentRef.current.trim().length > 0) {
              setEditorContent(editorContentRef.current.trimEnd() + '\n\n' + pending.text);
            } else {
              setEditorContent(pending.text);
            }
            if (pending.formatId) {
              setFormatId(pending.formatId);
              setFormatTitle(undefined); // formatTitle not carried by bridge; cleared on new format
            }
            insertModeRef.current = 'replace';
            isDirty.current = true;
            if (__DEV__) console.log('[AddProceeding] editor autofilled from bridge');
            return;
          }

          // No bridge payload — load from DB for edit mode only
          if (!editId) return;
          const entry = await getNirodhatmakById(editId);

          if (loadOpId !== latestLoadOpRef.current) return;
          if (!entry) return;
          if (!isMountedRef.current) return;

          setProceedingDate(new Date(entry.proceeding_date + 'T00:00:00'));
          setProceedingType((entry.proceeding_type as NirodhatmakType) ?? 'बीट सूचना');
          setEditorContent(entry.editor_content ?? entry.report_text ?? '');
          setFormatId(entry.format_id || undefined);
          setFormatTitle(entry.format_title || undefined);
          originalRef.current = {
            proceedingDate: entry.proceeding_date,
            proceedingType: (entry.proceeding_type as NirodhatmakType) ?? 'बीट सूचना',
            editorContent: entry.editor_content ?? entry.report_text ?? '',
          };
          if (__DEV__) console.log('[AddProceeding] loaded from DB for edit:', editId);
        } finally {
          isConsumingRef.current = false;
        }
      })();

      return () => {
        backSub.remove();
        addFromFormatBusyRef.current = false;
      };
    }, [editId])
  );

  // Dirty tracking
  useEffect(() => {
    const orig = originalRef.current;
    isDirty.current =
      dateToString(proceedingDate) !== orig.proceedingDate ||
      proceedingType !== orig.proceedingType ||
      editorContent !== orig.editorContent;
  }, [proceedingDate, proceedingType, editorContent]);

  const handleBack = () => {
    if (isDirty.current) {
      setShowUnsavedDialog(true);
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    setError('');
    if (!editorContent.trim()) {
      setError('Proceeding content (editor) is required.');
      return;
    }
    setSaving(true);

    const saveOpId = ++latestSaveOpRef.current;
    try {
      const data = {
        proceeding_date: dateToString(proceedingDate),
        village_id: '',
        village_name: '',
        proceeding_type: proceedingType,
        editor_content: editorContent.trim(),
        status: 'Active',
        format_id: formatId,
        format_title: formatTitle,
      };

      if (isEdit && editId) {
        await updateNirodhatmakKaryvahi(editId, data);
      } else {
        await createNirodhatmakKaryvahi(data);
      }

      if (saveOpId !== latestSaveOpRef.current) return;
      if (!isMountedRef.current) return;

      isDirty.current = false;
      insertModeRef.current = 'replace';
      addFromFormatBusyRef.current = false;
      isConsumingRef.current = false;

      // Rotate session after save
      nirodhatmakFormatBridge.endSession(sessionIdRef.current);
      const newSid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      sessionIdRef.current = newSid;
      nirodhatmakFormatBridge.beginSession(newSid);

      if (__DEV__) console.log('[AddProceeding] saved — navigating back');
      router.back();
    } catch (e) {
      setError('Failed to save. Please try again.');
      logger.warn('[AddProceeding] save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    isDirty.current = false;
    setShowUnsavedDialog(false);
    router.back();
  };

  const handleAddFromFormat = () => {
    if (addFromFormatBusyRef.current) return;
    addFromFormatBusyRef.current = true;
    const routeUrl = '/(app)/nirodhatmak/select-format?type=' + encodeURIComponent(proceedingType);
    if (editorContentRef.current.trim().length > 0) {
      setShowReplaceDialog(true);
    } else {
      insertModeRef.current = 'replace';
      router.push(routeUrl as never);
    }
  };

  const handleReplaceChoice = () => {
    setShowReplaceDialog(false);
    insertModeRef.current = 'replace';
    const routeUrl = '/(app)/nirodhatmak/select-format?type=' + encodeURIComponent(proceedingType);
    router.push(routeUrl as never);
  };

  const handleAppendChoice = () => {
    setShowReplaceDialog(false);
    insertModeRef.current = 'append';
    const routeUrl = '/(app)/nirodhatmak/select-format?type=' + encodeURIComponent(proceedingType);
    router.push(routeUrl as never);
  };

  const handleReplaceDialogCancel = () => {
    addFromFormatBusyRef.current = false;
    setShowReplaceDialog(false);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={isEdit ? 'Edit Proceeding' : 'New Proceeding'}
        subtitle="Nirodhatmak Karyvahi"
        onBack={handleBack}
        rightActions={
          <Pressable onPress={handleSave} disabled={saving} className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl active:opacity-70" style={{ backgroundColor: MODULE_COLOR, borderCurve: 'continuous', opacity: saving ? 0.6 : 1 }}>
            <Save size={15} color="#fff" />
            <Text className="text-sm font-bold text-white">{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >

        <ScrollView
          contentContainerClassName="px-6 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Proceeding Date ───────────────────────────────── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Proceeding Date <Text className="text-destructive">*</Text>
            </Text>
            <Pressable
              onPress={() => { setShowDatePicker(true); setShowTypeDropdown(false); }}
              className="flex-row items-center gap-3 border border-border rounded-xl px-4 py-3 bg-card active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <Calendar size={16} color={MODULE_COLOR} />
              <Text className="flex-1 text-base text-foreground">
                {fmtDate(proceedingDateStr)}
              </Text>
              <ChevronDown size={16} color="#9CA3AF" />
            </Pressable>
            <DatePickerModal
              visible={showDatePicker}
              value={proceedingDateStr}
              label="Proceeding Date"
              accentColor={MODULE_COLOR}
              onConfirm={(v) => {
                const [y, m, d] = v.split('-').map(Number);
                setProceedingDate(new Date(y, m - 1, d));
              }}
              onClose={() => setShowDatePicker(false)}
            />
          </View>

          {/* ── Type Dropdown ─────────────────────────────────── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Proceeding Type <Text className="text-destructive">*</Text>
            </Text>
            <Pressable
              onPress={() => { setShowTypeDropdown(!showTypeDropdown); setShowDatePicker(false); }}
              className="flex-row items-center gap-3 border border-border rounded-xl px-4 py-3 bg-card active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <FileWarning size={16} color={MODULE_COLOR} />
              <Text className="flex-1 text-base text-foreground">{proceedingType}</Text>
              <ChevronDown size={16} color="#9CA3AF" />
            </Pressable>
            {showTypeDropdown && (
              <View className="border border-border rounded-xl bg-card overflow-hidden"
                style={{ borderCurve: 'continuous' }}>
                {NIRODHATMAK_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => { setProceedingType(t); setShowTypeDropdown(false); }}
                    className="px-4 py-3 border-b border-border active:opacity-70"
                    style={{ backgroundColor: proceedingType === t ? `${MODULE_COLOR}08` : undefined }}
                  >
                    <Text className="text-sm text-foreground">{t}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* ── Editor ────────────────────────────────────────── */}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Proceeding Content <Text className="text-destructive">*</Text>
              </Text>
              {formatTitle && (
                <View className="flex-row items-center gap-1.5 bg-secondary rounded-full px-2.5 py-1">
                  <LayoutTemplate size={10} color={MODULE_COLOR} />
                  <Text className="text-xs text-muted-foreground" numberOfLines={1} style={{ maxWidth: 120 }}>
                    {formatTitle}
                  </Text>
                </View>
              )}
            </View>
            <DocumentEditor
              value={editorContent}
              onChangeText={(v) => { setEditorContent(v); setError(''); }}
              title="Nirodhatmak Karyvahi"
              placeholder="Enter proceeding details here…"
              accessibilityLabel="Proceeding content editor"
            />
          </View>

          {/* ── Add From Format Button ─────────────────────────── */}
          <Pressable
            onPress={handleAddFromFormat}
            className="flex-row items-center justify-center gap-2 py-3 rounded-xl border active:opacity-70"
            style={{ borderColor: MODULE_COLOR, borderCurve: 'continuous' }}
          >
            <LayoutTemplate size={16} color={MODULE_COLOR} />
            <Text className="text-sm font-semibold" style={{ color: MODULE_COLOR }}>
              Add From Format
            </Text>
          </Pressable>

          {/* ── Error ─────────────────────────────────────────── */}
          {error ? (
            <View className="bg-destructive/10 rounded-xl px-4 py-3">
              <View className="flex-row items-center gap-2">
                <AlertCircle size={14} color="#DC2626" />
                <Text className="text-sm text-destructive flex-1">{error}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Save Button (bottom) ───────────────────────────── */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl py-4 flex-row items-center justify-center gap-2 active:opacity-80 mt-2"
            style={{ backgroundColor: MODULE_COLOR, borderCurve: 'continuous', opacity: saving ? 0.6 : 1 }}
          >
            <Save size={18} color="#fff" />
            <Text className="text-white font-bold text-base">
              {saving ? 'Saving…' : isEdit ? 'Update Proceeding' : 'Save Proceeding'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Unsaved Changes Dialog ────────────────────────────── */}
      <AlertDialog
        open={showUnsavedDialog}
        onOpenChange={(v) => { if (!v) setShowUnsavedDialog(false); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowUnsavedDialog(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDiscard} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">Discard</Text>
            </AlertDialogAction>
            <AlertDialogAction
              onPress={() => { setShowUnsavedDialog(false); handleSave(); }}
              style={{ backgroundColor: MODULE_COLOR }}
            >
              <Text className="text-white font-semibold">Save</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Replace / Append Dialog ───────────────────────────── */}
      <AlertDialog
        open={showReplaceDialog}
        onOpenChange={(v) => { if (!v) handleReplaceDialogCancel(); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editor Already Has Content</AlertDialogTitle>
            <AlertDialogDescription>
              Replace the existing content with the new format, or append below it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={handleReplaceDialogCancel}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleAppendChoice} className="bg-secondary">
              <Text className="text-foreground font-semibold">Append</Text>
            </AlertDialogAction>
            <AlertDialogAction
              onPress={handleReplaceChoice}
              style={{ backgroundColor: MODULE_COLOR }}
            >
              <Text className="text-white font-semibold">Replace</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
