import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import {
  BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  BookMarked, Calendar, ChevronDown,
  LayoutTemplate, Save, AlertCircle, Sparkles,
} from 'lucide-react-native';
import { OcrScanModal } from '@/components/common/OcrScanModal';
import { DatePickerModal, dateStrToObj, dateObjToStr } from '@/components/common/DatePickerModal';
import {
  createGdEntry, updateGdEntry, getGdById, GD_TYPES, type GdType,
} from '@/lib/db/gdRepo';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { gdFormatBridge } from '@/lib/gdFormatBridge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const GD_COLOR = '#D97706';

const TYPE_COLORS: Record<string, string> = {
  'रवानगी': '#6366F1',
  'वापसी':  '#059669',
  'तस्करा': '#DC2626',
  'अन्य':   '#6B7280',
};

const GD_TYPE_KEYS: Record<string, string> = {
  'रवानगी': 'departure',
  'वापसी':  'return',
  'तस्करा': 'taskara',
  'अन्य':   'other',
};

const GD_OCR_FIELDS = [
  { key: 'gd_type', label: 'जीडी प्रकार (रवानगी / वापसी / तस्करा / अन्य)' },
  { key: 'vivran', label: 'जीडी विवरण (GD Content / Details)' },
];

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

export default function AddGdScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = Boolean(editId);
  const { t } = useTranslation();

  // Form state
  const [prepDate, setPrepDate] = useState<Date>(todayDateObj());
  const [taDaFlag, setTaDaFlag] = useState(false);
  const [gdType, setGdType] = useState<GdType>('रवानगी');
  const [vivran, setVivran] = useState('');
  const [formatId, setFormatId] = useState<string | undefined>(undefined);
  const [ocrModalVisible, setOcrModalVisible] = useState(false);

  const handleOcrApply = (extracted: Record<string, string>) => {
    isDirty.current = true;
    if (extracted.gd_type) {
      const match = GD_TYPES.find((t) => t.toLowerCase() === extracted.gd_type.trim().toLowerCase() || extracted.gd_type.includes(t));
      if (match) {
        setGdType(match);
      }
    }
    if (extracted.vivran && extracted.vivran.trim()) {
      setVivran((prev) => (prev ? `${prev}\n${extracted.vivran}` : extracted.vivran));
    }
  };

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  // dateStr mirrors prepDate as "YYYY-MM-DD" for the modal
  const prepDateStr = dateToString(prepDate);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  // Shown when "Add From Format" is tapped while Vivran already has content.
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  // Track original values for dirty check
  const originalRef = useRef({ prepDate: dateToString(todayDateObj()), taDaFlag: false, gdType: 'रवानगी' as GdType, vivran: '' });
  const isDirty = useRef(false);
  // Ref that always holds the latest vivran value — avoids stale closure in useFocusEffect.
  const vivranRef = useRef('');
  // Decides how the bridge report is inserted: 'replace' overwrites Vivran; 'append' adds below.
  const insertModeRef = useRef<'replace' | 'append'>('replace');
  // Guards against concurrent async consumption (e.g. two rapid focus events).
  const isConsumingRef = useRef(false);
  // Prevents double-tap on "Add From Format" while a dialog/navigation is in flight.
  const addFromFormatBusyRef = useRef(false);
  // Unique session ID for this screen instance — used to validate bridge ownership.
  // Initialised lazily on mount; rotated after each successful save.
  const sessionIdRef = useRef('');
  // Set to false on unmount — guards against async setState after navigation.
  const isMountedRef = useRef(true);
  /**
   * Last-write-wins tokens (separate counters to avoid cross-contamination):
   *  - latestLoadOpRef  governs DB loads triggered from useFocusEffect.
   *  - latestSaveOpRef  governs the handleSave DB write.
   *
   * Pattern: each async op increments its counter and captures `opId` before
   * the first `await`.  After every await it checks `opId === ref.current`; if
   * not, the result is from a superseded operation and is silently discarded.
   *
   * Using two separate counters ensures a save can never cancel a pending load
   * and vice versa — operations in different workflows are fully independent.
   */
  const latestLoadOpRef = useRef(0);
  const latestSaveOpRef = useRef(0);

  // Keep vivranRef in sync so useFocusEffect can read the current value without
  // stale-closure issues (vivran is NOT in useFocusEffect's dependency array).
  useEffect(() => { vivranRef.current = vivran; }, [vivran]);

  // ── Mount / unmount lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    // Generate a unique session ID and register bridge ownership.
    const sid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    sessionIdRef.current = sid;
    isMountedRef.current = true;
    gdFormatBridge.beginSession(sid);
    if (__DEV__) console.log('[AddGD] mounted — session:', sid, '| isEdit:', isEdit);

    return () => {
      // Release bridge ownership and reset all temporary refs so that no
      // stale state can bleed into a future instance of this screen.
      isMountedRef.current = false;
      gdFormatBridge.endSession(sessionIdRef.current);
      isConsumingRef.current = false;
      addFromFormatBusyRef.current = false;
      insertModeRef.current = 'replace';
      // Advance both op counters to their maximum value: any in-flight async
      // operation that completes after unmount will find its captured opId ≠ the
      // current counter and will be silently discarded.
      latestLoadOpRef.current = Number.MAX_SAFE_INTEGER;
      latestSaveOpRef.current = Number.MAX_SAFE_INTEGER;
      if (__DEV__) console.log('[AddGD] unmounted — cleanup complete | session:', sessionIdRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── useFocusEffect: bridge consumption + Android hardware-back guard ──────
  useFocusEffect(
    useCallback(() => {
      // Reset the Add-From-Format busy flag every time this screen regains focus
      // so the button is always usable after returning from any sub-screen.
      addFromFormatBusyRef.current = false;

      // Android hardware back button — show unsaved-changes dialog instead of raw pop.
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isDirty.current) {
          setShowUnsavedDialog(true);
          return true; // event consumed; suppress default navigation
        }
        return false; // let the OS handle it normally
      });

      (async () => {
        if (__DEV__) console.log('[AddGD] screen focused | session:', sessionIdRef.current, '| isEdit:', isEdit);

        // Navigation-safety guard: bail out if the screen has already unmounted.
        // This covers the edge case where the async work completes after router.back().
        if (!isMountedRef.current) {
          if (__DEV__) console.log('[AddGD] focus callback — navigation ignored, screen no longer mounted');
          return;
        }

        // Single-consumption guard: if a previous focus event is still running its
        // async work, skip — the bridge will never be double-consumed.
        if (isConsumingRef.current) {
          if (__DEV__) console.log('[AddGD] useFocusEffect skipped — consumption already in progress');
          return;
        }
        isConsumingRef.current = true;

        // Capture a load operation token before any await.  If a newer focus
        // event starts a load while this one is awaiting, our token will be stale
        // and we silently discard the result — last-write-wins.
        const loadOpId = ++latestLoadOpRef.current;
        if (__DEV__) console.log('[AddGD] load op started — opId:', loadOpId);

        try {
          // consume(sessionId) is transactional:
          //  • validates _expectedSessionId === sessionId (ownership, not payload origin)
          //  • on success: clears _pending and returns payload
          //  • on failure: preserves _pending (for the correct owner) and returns null
          // This survives unmount/remount — the payload persists across session rotations.
          if (__DEV__) {
            console.log('[AddGD] bridge check — has pending:', gdFormatBridge.has(),
              '| session:', sessionIdRef.current);
          }
          const pending = gdFormatBridge.consume(sessionIdRef.current);

          if (pending !== null) {
            if (__DEV__) console.log('[AddGD] bridge detected — chars:', pending.text.length);

            // Final content validation before touching the editor.
            if (typeof pending.text !== 'string' || pending.text.trim().length === 0) {
              if (__DEV__) console.log('[AddGD] bridge payload rejected — empty or non-string text');
              return;
            }

            // Guard: one last isMounted check after the await-free validation above.
            if (!isMountedRef.current) {
              if (__DEV__) console.log('[AddGD] navigation ignored — screen unmounted before insert');
              return;
            }

            if (insertModeRef.current === 'append' && vivranRef.current.trim().length > 0) {
              if (__DEV__) console.log('[AddGD] append mode — inserting', pending.text.length, 'chars');
              setVivran(vivranRef.current.trimEnd() + '\n\n' + pending.text);
            } else {
              if (__DEV__) console.log('[AddGD] replace mode — inserting', pending.text.length, 'chars');
              setVivran(pending.text);
            }
            if (__DEV__) console.log('[AddGD] Vivran updated — bridge cleared');
            if (__DEV__) console.log('[AddGD] insert workflow completed — report inserted, bridge consumed');
            if (__DEV__) console.log('[AddGD] nav stack after returning to Add GD:',
              '(app)[home, gd(index, add-gd)]',
              '— Format flow fully terminated, Preview+Fill removed from (app) Stack');

            // Reset to default for the next "Add From Format" cycle.
            insertModeRef.current = 'replace';
            if (pending.formatId) setFormatId(pending.formatId);
            isDirty.current = true;
            if (__DEV__) console.log('[AddGD] load op completed (bridge) — opId:', loadOpId);
            return; // don't reload from DB — preserve all other field values
          }

          if (__DEV__) console.log('[AddGD] No pending GD report.');

          // No bridge payload — load from DB only for edit mode.
          if (!editId) return;
          const entry = await getGdById(editId);

          // Last-write-wins: discard this result if a newer load operation started
          // while we were awaiting the DB (e.g. rapid navigation back and forth).
          if (loadOpId !== latestLoadOpRef.current) {
            if (__DEV__) console.log('[AddGD] load op stale — discarding DB result | opId:', loadOpId, '| latest:', latestLoadOpRef.current);
            return;
          }

          if (!entry) return;

          // isMounted check after the DB await — navigation may have occurred.
          if (!isMountedRef.current) {
            if (__DEV__) console.log('[AddGD] navigation ignored — screen unmounted after DB load');
            return;
          }

          const d = new Date(entry.preparation_date + 'T00:00:00');
          setPrepDate(d);
          setTaDaFlag(entry.ta_da_flag === 1);
          setGdType(entry.gd_type);
          setVivran(entry.vivran_content);
          setFormatId(entry.format_id);
          originalRef.current = {
            prepDate: entry.preparation_date,
            taDaFlag: entry.ta_da_flag === 1,
            gdType: entry.gd_type,
            vivran: entry.vivran_content,
          };
          if (__DEV__) console.log('[AddGD] load op completed (DB) — opId:', loadOpId);
        } finally {
          isConsumingRef.current = false;
        }
      })();

      return () => {
        backSub.remove();
        // Reset busy flag on blur so it can never get permanently stuck.
        addFromFormatBusyRef.current = false;
      };
    }, [editId])
  );

  // Mark dirty whenever user changes anything
  useEffect(() => {
    const orig = originalRef.current;
    const changed =
      dateToString(prepDate) !== orig.prepDate ||
      taDaFlag !== orig.taDaFlag ||
      gdType !== orig.gdType ||
      vivran !== orig.vivran;
    isDirty.current = changed;
  }, [prepDate, taDaFlag, gdType, vivran]);

  const handleBack = () => {
    if (isDirty.current) {
      setShowUnsavedDialog(true);
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    // `saving` state is the double-tap guard — the Save button is disabled while true.
    setError('');
    if (!vivran.trim()) {
      setError(t('gd.form.errorVivranRequired'));
      return;
    }
    setSaving(true);

    // Capture a save operation token before the first await.  If the screen
    // unmounts or another save somehow starts (theoretically impossible while
    // `saving` is true, but guarded for completeness), the stale result is
    // discarded automatically — only the newest save may commit its post-save work.
    const saveOpId = ++latestSaveOpRef.current;
    if (__DEV__) console.log('[AddGD] save op started — opId:', saveOpId, '| isEdit:', isEdit, '| session:', sessionIdRef.current);

    try {
      const data = {
        preparation_date: dateToString(prepDate),
        ta_da_flag: taDaFlag ? 1 : 0,
        gd_type: gdType,
        vivran_content: vivran.trim(),
        format_id: formatId,
      };
      if (isEdit && editId) {
        await updateGdEntry(editId, data);
      } else {
        await createGdEntry(data);
      }

      // Post-await validation — three independent guards in order of cheapness:
      //  1. Last-write-wins: ensure no newer save op was started since this one.
      //  2. Session: ensure this screen instance still owns the bridge session.
      //  3. Mounted: ensure the screen hasn't navigated away.
      if (saveOpId !== latestSaveOpRef.current) {
        if (__DEV__) console.log('[AddGD] save op stale — ignoring result | opId:', saveOpId, '| latest:', latestSaveOpRef.current);
        return;
      }
      if (!isMountedRef.current) {
        if (__DEV__) console.log('[AddGD] save op — screen unmounted, skipping post-save cleanup');
        return;
      }

      if (__DEV__) console.log('[AddGD] save op completed — opId:', saveOpId, '| isEdit:', isEdit);

      // ── Reset all temporary state after a successful save ─────────────────
      // Dirty flags, busy flags, insert mode, and session are all cleared so
      // a future mount of this screen (or continued use in edit mode) starts clean.
      isDirty.current = false;
      insertModeRef.current = 'replace';
      addFromFormatBusyRef.current = false;
      isConsumingRef.current = false;
      // Rotate session ID: end the current session and begin a fresh one so any
      // stale bridge payload that arrives after save is silently rejected.
      gdFormatBridge.endSession(sessionIdRef.current);
      const newSid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      sessionIdRef.current = newSid;
      gdFormatBridge.beginSession(newSid);
      if (__DEV__) console.log('[AddGD] session rotated after save — new session:', newSid);
      if (__DEV__) console.log('[AddGD] temporary navigation state cleared — all flags reset, session rotated');

      if (__DEV__) console.log('[AddGD] nav stack before save: (app)[home, gd(index, add-gd)] | vivran chars:', vivran.trim().length);
      if (__DEV__) console.log('[AddGD] nav stack after save (expected): (app)[home, gd(index)] — add-gd popped by router.back()');
      if (__DEV__) console.log('[AddGD] navigation after save — router.back() | source: handleSave | session:', newSid);
      router.back();
    } catch (e) {
      setError(t('gd.form.errorSaveFailed'));
      if (__DEV__) console.log('[AddGD] save op failed — opId:', saveOpId, '| error:', e);
      logger.warn('[GD] Save error:', e);
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
    // Double-tap guard: ignore subsequent taps while dialog is open or navigation is in flight.
    if (addFromFormatBusyRef.current) {
      if (__DEV__) console.log('[AddGD] duplicate tap on Add From Format prevented');
      return;
    }
    addFromFormatBusyRef.current = true;
    // If Vivran already has content, ask the user whether to replace or append.
    // For an empty editor just navigate straight through (replace is the default).
    if (vivranRef.current.trim().length > 0) {
      setShowReplaceDialog(true);
    } else {
      insertModeRef.current = 'replace';
      router.push('/(app)/gd/select-format' as never);
    }
  };

  // User chose to overwrite the existing Vivran content with the new report.
  const handleReplaceChoice = () => {
    setShowReplaceDialog(false);
    insertModeRef.current = 'replace';
    if (__DEV__) console.log('[AddGD] replace mode selected');
    router.push('/(app)/gd/select-format' as never);
  };

  // User chose to append the new report below the existing Vivran content.
  const handleAppendChoice = () => {
    setShowReplaceDialog(false);
    insertModeRef.current = 'append';
    if (__DEV__) console.log('[AddGD] append mode selected');
    router.push('/(app)/gd/select-format' as never);
  };

  // User cancelled the Replace/Append dialog — reset busy flag so button works again.
  const handleReplaceDialogCancel = () => {
    addFromFormatBusyRef.current = false;
    setShowReplaceDialog(false);
  };

  const typeColor = TYPE_COLORS[gdType] ?? '#6B7280';

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={isEdit ? t('gd.form.editTitle') : t('gd.form.newTitle')}
        onBack={handleBack}
        rightActions={
          <Pressable onPress={handleSave} disabled={saving} className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl active:opacity-70" style={{ backgroundColor: GD_COLOR, borderCurve: 'continuous' }}>
            <Save size={15} color="#fff" />
            <Text className="text-sm font-bold text-white">{saving ? t('common.saving') : t('common.save')}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
        keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? 56 : 0}
        className="flex-1"
      >

        <ScrollView
          contentContainerClassName="px-6 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── OCR Auto-fill Action ── */}
          <Pressable
            onPress={() => setOcrModalVisible(true)}
            className="flex-row items-center justify-between p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 active:opacity-75"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 items-center justify-center">
                <Sparkles size={18} color={GD_COLOR} />
              </View>
              <View>
                <Text className="text-xs font-bold text-foreground">{t('gd.form.ocrBannerTitle')}</Text>
                <Text className="text-[11px] text-muted-foreground">{t('gd.form.ocrBannerSubtitle')}</Text>
              </View>
            </View>
            <View className="px-3 py-1.5 rounded-xl" style={{ backgroundColor: GD_COLOR }}>
              <Text className="text-xs font-semibold text-white">{t('gd.form.scanBtn')}</Text>
            </View>
          </Pressable>

          {/* ── Preparation Date ─────────────────────────────────── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('gd.form.prepDate')} <Text className="text-destructive">*</Text>
            </Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center gap-3 border border-border rounded-xl px-4 py-3 bg-card active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <Calendar size={16} color={GD_COLOR} />
              <Text className="flex-1 text-base text-foreground">
                {fmtDate(prepDateStr)}
              </Text>
              <ChevronDown size={16} color="#9CA3AF" />
            </Pressable>
            <DatePickerModal
              visible={showDatePicker}
              value={prepDateStr}
              label={t('gd.form.prepDate')}
              accentColor={GD_COLOR}
              onConfirm={(v) => setPrepDate(dateStrToObj(v))}
              onClose={() => setShowDatePicker(false)}
            />
          </View>

          {/* ── TA/DA Checkbox ───────────────────────────────────── */}
          <Pressable
            onPress={() => setTaDaFlag(!taDaFlag)}
            className="flex-row items-center gap-3 border border-border rounded-xl px-4 py-3 bg-card active:opacity-70"
            style={{ borderCurve: 'continuous' }}
          >
            <View
              className="w-5 h-5 rounded items-center justify-center border"
              style={{
                backgroundColor: taDaFlag ? GD_COLOR : 'transparent',
                borderColor: taDaFlag ? GD_COLOR : '#D1D5DB',
              }}
            >
              {taDaFlag && <Text className="text-white text-xs font-bold">✓</Text>}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">{t('gd.form.useForTaDa')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {t('gd.form.useForTaDaHint')}
              </Text>
            </View>
          </Pressable>

          {/* ── GD Type ──────────────────────────────────────────── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('gd.form.gdType')} <Text className="text-destructive">*</Text>
            </Text>
            <Pressable
              onPress={() => setShowTypeDropdown(!showTypeDropdown)}
              className="flex-row items-center gap-3 border border-border rounded-xl px-4 py-3 bg-card active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <View
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: typeColor }}
              />
              <Text className="flex-1 text-base text-foreground">
                {GD_TYPE_KEYS[gdType] ? t('gd.type.' + GD_TYPE_KEYS[gdType]) : gdType}
              </Text>
              <ChevronDown size={16} color="#9CA3AF" />
            </Pressable>
            {showTypeDropdown && (
              <View
                className="border border-border rounded-xl overflow-hidden bg-card mt-1"
                style={{ borderCurve: 'continuous' }}
              >
                {GD_TYPES.map((type, idx) => (
                  <Pressable
                    key={type}
                    onPress={() => { setGdType(type); setShowTypeDropdown(false); }}
                    className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
                    style={{
                      borderTopWidth: idx > 0 ? 1 : 0,
                      borderTopColor: '#F3F4F6',
                      backgroundColor: gdType === type ? `${TYPE_COLORS[type]}10` : 'transparent',
                    }}
                  >
                    <View
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[type] ?? '#6B7280' }}
                    />
                    <Text
                      className="text-base font-medium"
                      style={{ color: gdType === type ? (TYPE_COLORS[type] ?? '#111827') : '#374151' }}
                    >
                      {GD_TYPE_KEYS[type] ? t('gd.type.' + GD_TYPE_KEYS[type]) : type}
                    </Text>
                    {gdType === type && (
                      <Text className="ml-auto text-xs font-bold" style={{ color: TYPE_COLORS[type] }}>✓</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* ── Add From Format ──────────────────────────────────── */}
          <Pressable
            onPress={handleAddFromFormat}
            className="flex-row items-center gap-3 border border-dashed rounded-xl px-4 py-3 active:opacity-70"
            style={{ borderColor: GD_COLOR, borderCurve: 'continuous', backgroundColor: `${GD_COLOR}08` }}
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center"
              style={{ backgroundColor: `${GD_COLOR}20` }}
            >
              <LayoutTemplate size={16} color={GD_COLOR} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold" style={{ color: GD_COLOR }}>
                {t('gd.form.addFromFormat')}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {t('gd.form.addFromFormatHint')}
              </Text>
            </View>
          </Pressable>

          {/* ── Vivran Editor ────────────────────────────────────── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('gd.form.vivranLabel')} <Text className="text-destructive">*</Text>
            </Text>
            <DocumentEditor
              value={vivran}
              onChangeText={(v) => { setVivran(v); setError(''); }}
              title={t('gd.form.vivranEditorTitle')}
              placeholder={t('gd.form.vivranPlaceholder')}
              accessibilityLabel={t('gd.form.vivranAccessibility')}
            />
          </View>

          {/* ── Error ────────────────────────────────────────────── */}
          {error.length > 0 && (
            <View className="flex-row items-center gap-2 bg-destructive/10 rounded-xl px-4 py-3">
              <AlertCircle size={14} color="#DC2626" />
              <Text className="text-sm text-destructive flex-1">{error}</Text>
            </View>
          )}

          {/* ── Save Button ──────────────────────────────────────── */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl py-4 items-center justify-center active:opacity-80 mt-2"
            style={{ backgroundColor: GD_COLOR, borderCurve: 'continuous' }}
          >
            <Text className="text-base font-bold text-white">
              {saving ? t('common.saving') : isEdit ? t('gd.form.updateBtn') : t('gd.form.saveBtn')}
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Unsaved Changes Dialog ───────────────────────────────────────── */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gd.dialog.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('gd.dialog.unsavedDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowUnsavedDialog(false)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <Pressable
              onPress={handleDiscard}
              className="px-4 py-2 rounded-xl border border-border active:opacity-70"
            >
              <Text className="text-sm font-medium text-foreground">{t('common.discard')}</Text>
            </Pressable>
            <AlertDialogAction
              onPress={async () => { setShowUnsavedDialog(false); await handleSave(); }}
              style={{ backgroundColor: GD_COLOR }}
            >
              <Text className="text-white font-semibold">{t('common.save')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Replace / Append / Cancel Dialog ────────────────────────────── */}
      {/* Shown when "Add From Format" is tapped and Vivran already has content. */}
      <AlertDialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gd.dialog.replaceTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('gd.dialog.replaceDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={handleReplaceDialogCancel}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <Pressable
              onPress={handleAppendChoice}
              className="px-4 py-2 rounded-xl border border-border active:opacity-70"
            >
              <Text className="text-sm font-medium text-foreground">{t('gd.dialog.append')}</Text>
            </Pressable>
            <AlertDialogAction
              onPress={handleReplaceChoice}
              style={{ backgroundColor: GD_COLOR }}
            >
              <Text className="text-white font-semibold">{t('gd.dialog.replace')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OcrScanModal
        visible={ocrModalVisible}
        onClose={() => setOcrModalVisible(false)}
        fields={GD_OCR_FIELDS}
        onApply={handleOcrApply}
        title={t('gd.form.ocrModalTitle')}
      />
    </View>
  );
}
