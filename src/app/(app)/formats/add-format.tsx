import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, View,
} from 'react-native';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { FardCheckButton } from '@/components/fard/FardCheckButton';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  Save, Plus, Trash2, ChevronDown, ChevronUp,
  Zap, Tag, Key, FileText, Lock, BookOpen, CheckCircle2,
  AlertTriangle, ExternalLink,
} from 'lucide-react-native';
import {
  createFormat, updateFormat, getFormatById, getFormatKeys, getFormatTags,
  checkTitleExists, getFormatByTitle,
  type FormatInput, type FormatKeyInput, type FormatType,
} from '@/lib/db/predefinedFormatRepo';
import { detectKeys, keyToLabel } from '@/lib/templateEngine';
import { GLOBAL_KEY_REGISTRY, GLOBAL_KEY_LABELS, isGlobalKey } from '@/lib/globalKeyEngine';
import {
  PREDEFINED_USER_KEYS, toFormatKeyInput, type PredefinedUserKey,
} from '@/lib/predefinedUserKeys';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader } from '@/components/ui/ds/AppHeader';

// ─── Design tokens ────────────────────────────────────────────────────────────
const INDIGO        = '#6366F1';
const INDIGO_BG     = '#6366F118';
const SUCCESS       = '#059669';
const SUCCESS_BG    = '#05966918';
const DESTRUCTIVE   = '#DC2626';
const MUTED         = '#6B7280';
const FIELD_BG      = 'rgba(0,0,0,0.06)';
const FIELD_TEXT    = '#374151';

// ─── Constants ────────────────────────────────────────────────────────────
const FORMAT_TYPES: FormatType[] = [
  'GD', 'Case Diary', 'Narrative', 'Nyayalay', 'Prarthna Patra', 'BNSS Karyavahi', 'Any',
];

const AVAILABLE_TAGS = [
  'GD', 'FIR', 'Arrest', 'NBW', 'Notice', 'Witness',
  'BNSS', 'Court', 'Panchayat', 'Beat', 'Investigation',
];

const FIELD_TYPES = ['text', 'multiline', 'number', 'date', 'dropdown', 'accused_group', 'person_group'] as const;
// FIELD_TYPE_LABELS is now built dynamically via t() inside components that need it.

// The four default Global System Keys — always pre-populated, auto-filled from Workspace.
const SYSTEM_KEY_NAMES = Object.keys(GLOBAL_KEY_REGISTRY); // ['State','District','PoliceStation','OfficerName']

type KeyDef = FormatKeyInput & { _id: string; isSystem: boolean };

function makeDefaultSystemKeys(): KeyDef[] {
  return SYSTEM_KEY_NAMES.map((kn, i) => ({
    _id: `sys_${kn}`,
    isSystem: true,
    key_name: kn,
    label: GLOBAL_KEY_LABELS[kn] ?? kn,
    field_type: 'text' as const,
    is_required: 0,
    sort_order: i,
  }));
}

// ─── System Key Row (read-only, non-deletable) ────────────────────────────
function SystemKeyRow({ keyDef, index }: { keyDef: KeyDef; index: number }) {
  const { t } = useTranslation();
  return (
    <View
      className="border border-border rounded-xl px-4 py-3 flex-row items-center gap-3 bg-card"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: SUCCESS_BG }}>
        <Lock size={12} color={SUCCESS} />
      </View>
      <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
        <Text className="text-sm font-medium text-foreground">
          {`{{${keyDef.key_name}}}`}
          {keyDef.label ? ` — ${keyDef.label}` : ''}
        </Text>
        <Text className="text-xs text-muted-foreground">{t('format.addFormat.systemKeyNote')}</Text>
      </View>
      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: SUCCESS_BG }}>
        <Text className="text-xs font-semibold" style={{ color: SUCCESS }}>{t('format.addFormat.systemKeyBadge')}</Text>
      </View>
    </View>
  );
}

// ─── Dynamic Key editor row ────────────────────────────────────────────────
function KeyRow({
  keyDef, index, onUpdate, onDelete,
}: {
  keyDef: KeyDef;
  index: number;
  onUpdate: (field: keyof FormatKeyInput, value: string | number) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const fieldTypeLabels: Record<string, string> = {
    text: t('format.addFormat.fieldTypeText'),
    multiline: t('format.addFormat.fieldTypeMultiline'),
    number: t('format.addFormat.fieldTypeNumber'),
    date: t('format.addFormat.fieldTypeDate'),
    dropdown: t('format.addFormat.fieldTypeDropdown'),
    accused_group: t('format.addFormat.fieldTypeAccusedGroup'),
    person_group: t('format.addFormat.fieldTypePersonGroup'),
  };
  return (
    <View className="border border-border rounded-xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="px-4 py-3 flex-row items-center gap-3 bg-card active:opacity-70"
      >
        <View className="w-7 h-7 rounded-lg bg-secondary items-center justify-center">
          <Text className="text-xs font-bold text-muted-foreground">{index + 1}</Text>
        </View>
        <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
          {`{{${keyDef.key_name || 'New Key'}}}`}
          {keyDef.label ? ` — ${keyDef.label}` : ''}
        </Text>
        <View className="flex-row items-center gap-2">
          {keyDef.is_required ? (
            <View className="rounded-full px-2 py-0.5 bg-destructive/10">
              <Text className="text-xs text-destructive font-medium">{t('format.addFormat.requiredBadge')}</Text>
            </View>
          ) : null}
          <Pressable onPress={onDelete} className="p-1 active:opacity-60">
            <Trash2 size={14} color={DESTRUCTIVE} />
          </Pressable>
          {expanded ? <ChevronUp size={14} color={MUTED} /> : <ChevronDown size={14} color={MUTED} />}
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 pt-2 gap-3 bg-background">
          {/* Key name */}
          <Input
            label={t('format.addFormat.keyNameLabel')}
            placeholder={t('format.addFormat.keyNamePlaceholder')}
            value={keyDef.key_name}
            onChangeText={(v) => onUpdate('key_name', v.replace(/\s/g, ''))}
            autoCapitalize="none"
          />
          <Input
            label={t('format.addFormat.keyDisplayLabel')}
            placeholder={t('format.addFormat.keyDisplayPlaceholder')}
            value={keyDef.label}
            onChangeText={(v) => onUpdate('label', v)}
          />
          <View className="gap-1">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('format.addFormat.fieldTypeLabel')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-0.5">
              {FIELD_TYPES.map((ft) => (
                <Pressable
                  key={ft}
                  onPress={() => onUpdate('field_type', ft)}
                  className="mx-0.5 rounded-full px-3 py-1.5 active:opacity-70"
                  style={{ backgroundColor: keyDef.field_type === ft ? INDIGO : FIELD_BG }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: keyDef.field_type === ft ? '#fff' : FIELD_TEXT }}
                  >
                    {fieldTypeLabels[ft]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Pressable
            onPress={() => onUpdate('is_required', keyDef.is_required ? 0 : 1)}
            className="flex-row items-center gap-3 active:opacity-70"
          >
            <View
              className="w-11 h-6 rounded-full items-center justify-center"
              style={{ backgroundColor: keyDef.is_required ? INDIGO : '#E5E7EB' }}
            >
              <View
                className="w-4 h-4 rounded-full bg-white absolute"
                style={{ left: keyDef.is_required ? 26 : 2 }}
              />
            </View>
            <Text className="text-sm text-foreground">{t('format.addFormat.requiredField')}</Text>
          </Pressable>
          <Input
            label={t('format.addFormat.defaultValueLabel')}
            placeholder={t('format.addFormat.defaultValuePlaceholder')}
            value={keyDef.default_value ?? ''}
            onChangeText={(v) => onUpdate('default_value', v)}
          />
        </View>
      )}
    </View>
  );
}

// ─── Predefined User Key Picker row ───────────────────────────────────────
function PredefinedKeyPickerRow({
  pkey,
  inserted,
  onInsert,
}: {
  pkey: PredefinedUserKey;
  inserted: boolean;
  onInsert: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={inserted ? undefined : onInsert}
      className="flex-row items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl active:opacity-70"
      style={{ borderCurve: 'continuous', opacity: inserted ? 0.5 : 1 }}
    >
      <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
        <Text className="text-sm font-medium text-foreground">{`{{${pkey.key_name}}}`}</Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>{pkey.label}</Text>
      </View>
      {inserted ? (
        <View className="flex-row items-center gap-1">
          <CheckCircle2 size={13} color={SUCCESS} />
          <Text className="text-xs text-muted-foreground">{t('format.addFormat.addedBadge')}</Text>
        </View>
      ) : (
        <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: INDIGO_BG }}>
          <Plus size={11} color={INDIGO} />
          <Text className="text-xs font-semibold" style={{ color: INDIGO }}>{t('format.addFormat.insertBtn')}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Add/Edit Form ─────────────────────────────────────────────────────────

/** Snapshot for dirty-check — excludes transient _id + isSystem fields. */
function snapshot(
  title: string,
  formatType: FormatType,
  vivran: string,
  keys: KeyDef[],
  tags: string[],
): string {
  return JSON.stringify({
    title, formatType, vivran, tags: [...tags].sort(),
    keys: keys.map(({ key_name, label, field_type, is_required, default_value, sort_order }) => ({
      key_name, label, field_type, is_required, default_value: default_value ?? '', sort_order,
    })),
  });
}

export default function AddFormatScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;
  const { t } = useTranslation();

  const keyIdRef = useRef(0);
  const makeKeyId = useCallback(
    () => `key_${++keyIdRef.current}_${Date.now()}`,
    []
  );

  const [title, setTitle] = useState('');
  const [formatType, setFormatType] = useState<FormatType>('Any');
  const [vivran, setVivran] = useState('');
  const [keys, setKeys] = useState<KeyDef[]>(makeDefaultSystemKeys);
  const [tags, setTags] = useState<string[]>([]);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showUserKeyLibrary, setShowUserKeyLibrary] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  // Duplicate-title dialog state
  const [dupTitle, setDupTitle] = useState('');
  const [dupFormatId, setDupFormatId] = useState<string | null>(null);
  const [showDupDialog, setShowDupDialog] = useState(false);
  // Inline title-uniqueness hint (debounced, fires 600 ms after typing stops)
  const [titleHint, setTitleHint] = useState<'checking' | 'taken' | 'ok' | null>(null);
  const titleHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dirty-check baseline — set once after initial data is ready.
  const initialSnapshotRef = useRef('');
  const isDirty = () =>
    initialSnapshotRef.current !== '' &&
    snapshot(title, formatType, vivran, keys, tags) !== initialSnapshotRef.current;

  // ── Load existing format (Edit mode) ────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (isEdit && editId) {
        (async () => {
          try {
            const format = await getFormatById(editId);
            if (!active || !format) return;
            const fKeys = await getFormatKeys(editId);
            const fTags = await getFormatTags(editId);
            if (!active) return;

            // Build KeyDef list: mark loaded keys that match global registry as system.
            const loadedKeyDefs: KeyDef[] = fKeys.map((k) => ({
              ...k,
              _id: makeKeyId(),
              isSystem: isGlobalKey(k.key_name),
            }));

            // Inject any missing default system keys at the front (backward compat).
            const existingNames = new Set(loadedKeyDefs.map((k) => k.key_name));
            const missing = makeDefaultSystemKeys().filter((sk) => !existingNames.has(sk.key_name));
            const merged = [...missing, ...loadedKeyDefs];

            setTitle(format.title);
            setFormatType(format.format_type);
            setVivran(format.vivran);
            setKeys(merged);
            setTags(fTags);

            // Capture baseline AFTER state is set (use values directly, not stale state).
            initialSnapshotRef.current = snapshot(
              format.title, format.format_type, format.vivran, merged, fTags
            );
          } catch {
            // load error — leave form empty
          }
        })();
      } else {
        // Add mode: baseline = empty form + default system keys.
        const sysKeys = makeDefaultSystemKeys();
        setKeys(sysKeys);
        initialSnapshotRef.current = snapshot('', 'Any', '', sysKeys, []);
      }
      return () => { active = false; };
    }, [isEdit, editId, makeKeyId])
  );

  // ── Back navigation with unsaved-changes guard ───────────────────────────
  const handleBackPress = () => {
    if (isDirty()) {
      setShowDiscardDialog(true);
    } else {
      router.back();
    }
  };

  // ── Android hardware-back interceptor ────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isDirty()) {
          setShowDiscardDialog(true);
          return true; // consumed — suppress default pop
        }
        return false;
      });
      return () => sub.remove();
    }, [isDirty])
  );

  // ── Auto-detect keys from vivran ─────────────────────────────────────────
  const handleAutoDetect = () => {
    const detected = detectKeys(vivran);
    const existingNames = new Set(keys.map((k) => k.key_name));
    const newKeys = detected
      .filter((kn) => !existingNames.has(kn))
      .map((kn): KeyDef => ({
        _id: makeKeyId(),
        isSystem: isGlobalKey(kn),
        key_name: kn,
        label: keyToLabel(kn),
        field_type: 'text',
        is_required: 0,
        sort_order: keys.length,
      }));
    setKeys((prev) => [...prev, ...newKeys]);
  };

  const addKey = () => {
    setKeys((prev) => [
      ...prev,
      {
        _id: makeKeyId(), isSystem: false, key_name: '', label: '',
        field_type: 'text', is_required: 0, sort_order: prev.length,
      },
    ]);
  };

  const updateKey = (id: string, field: keyof FormatKeyInput, value: string | number) => {
    setKeys((prev) => prev.map((k) => k._id === id ? { ...k, [field]: value } : k));
    setError('');
  };

  // System keys cannot be removed.
  const removeKey = (id: string) => {
    setKeys((prev) =>
      prev.filter((k) => {
        if (k.isSystem) return true;
        return k._id !== id;
      })
    );
  };

  // ── Insert a Predefined User Key from the library ─────────────────────────
  const insertPredefinedKey = (pkey: PredefinedUserKey) => {
    // Deduplicate: skip if already present in keys.
    if (keys.some((k) => k.key_name === pkey.key_name)) return;
    const keyInput = toFormatKeyInput(pkey, keys.length);
    setKeys((prev) => [
      ...prev,
      { ...keyInput, _id: makeKeyId(), isSystem: false },
    ]);
    setError('');
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // ── Debounced inline title-uniqueness check ────────────────────────────
  useEffect(() => {
    const trimmed = title.trim();
    if (!trimmed) { setTitleHint(null); return; }
    setTitleHint('checking');
    if (titleHintTimerRef.current) clearTimeout(titleHintTimerRef.current);
    titleHintTimerRef.current = setTimeout(async () => {
      try {
        const exists = await checkTitleExists(trimmed, isEdit ? editId : undefined);
        setTitleHint(exists ? 'taken' : 'ok');
      } catch {
        setTitleHint(null);
      }
    }, 600);
    return () => { if (titleHintTimerRef.current) clearTimeout(titleHintTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    // Guard must be the very first check — prevents double-fire from rapid taps
    // racing through the async checkTitleExists call that follows.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');

    try {
      if (!title.trim()) { setError(t('format.addFormat.errorTitleRequired')); return; }
      if (!vivran.trim()) { setError(t('format.addFormat.errorVivranRequired')); return; }

      const emptyKey = keys.find((k) => !k.key_name.trim());
      if (emptyKey) { setError(t('format.addFormat.errorKeyNameRequired')); return; }

      // Template keys must all be defined in the keys section.
      const keyNames = keys.map((k) => k.key_name);
      const usedInTemplate = detectKeys(vivran);
      const undefined_ = usedInTemplate.filter((k) => !keyNames.includes(k));
      if (undefined_.length > 0) {
        setError(t('format.addFormat.errorUndefinedKeys', { keys: undefined_.join(', ') }));
        return;
      }

      // Check for duplicate title — fetch the conflicting row so we can offer
      // an actionable "View existing" option instead of a dead-end error.
      const existing = await getFormatByTitle(title, isEdit ? editId : undefined);
      const isSelf = isEdit && editId && existing?.id === editId;
      if (existing && !isSelf) {
        setDupTitle(existing.title);
        setDupFormatId(existing.id);
        setShowDupDialog(true);
        return;
      }

      const input: FormatInput = {
        title: title.trim(), format_type: formatType, vivran,
        keys: keys.map((k) => ({
          key_name: k.key_name, label: k.label, field_type: k.field_type,
          is_required: k.is_required, default_value: k.default_value,
          dropdown_options: k.dropdown_options, sort_order: k.sort_order,
        })),
        tags,
      };
      if (isEdit && editId) {
        await updateFormat(editId, input);
      } else {
        await createFormat(input);
      }
      router.back();
    } catch {
      setError(t('format.addFormat.errorSaveFailed'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // ── Derived lists ─────────────────────────────────────────────────────────
  const systemKeys = keys.filter((k) => k.isSystem);
  const dynamicKeys = keys.filter((k) => !k.isSystem);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={isEdit ? t('format.addFormat.titleEdit') : t('format.addFormat.titleNew')}
        onBack={handleBackPress}
        rightActions={
          <Button onPress={handleSave} disabled={saving} size="sm" className="gap-1.5 rounded-xl px-4">
            <Save size={15} color="#fff" />
            <Text className="text-sm font-semibold text-primary-foreground">{saving ? t('format.addFormat.saving') : t('format.addFormat.save')}</Text>
          </Button>
        }
      />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
        className="flex-1"
      >

        <ScrollView
          contentContainerClassName="px-6 py-5 gap-6 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Format Type */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('format.addFormat.fieldFormatType')} <Text className="text-destructive">*</Text>
            </Text>
            <Pressable
              onPress={() => setShowTypeDropdown((v) => !v)}
              className="border border-border rounded-xl px-4 py-3 flex-row items-center justify-between bg-card active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <Text className="text-base text-foreground">{formatType}</Text>
              <ChevronDown size={16} color={MUTED} />
            </Pressable>
            {showTypeDropdown && (
              <View className="border border-border rounded-xl bg-card overflow-hidden" style={{ borderCurve: 'continuous' }}>
                {FORMAT_TYPES.map((ft) => (
                  <Pressable
                    key={ft}
                    onPress={() => { setFormatType(ft); setShowTypeDropdown(false); setError(''); }}
                    className="px-4 py-3 border-b border-border active:bg-secondary"
                  >
                    <Text className={`text-base ${formatType === ft ? 'text-primary font-semibold' : 'text-foreground'}`}>
                      {ft}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Title */}
          <View className="gap-1">
            <Input
              label={t('format.addFormat.fieldTitle')}
              placeholder={t('format.addFormat.titlePlaceholder')}
              value={title}
              onChangeText={(v) => { setTitle(v); setError(''); setTitleHint(null); }}
            />
            {titleHint === 'taken' && (
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <AlertTriangle size={12} color="#F59E0B" />
                <Text className="text-xs" style={{ color: '#F59E0B' }}>
                  {t('format.addFormat.titleTakenHint')}
                </Text>
              </View>
            )}
            {titleHint === 'ok' && (
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <CheckCircle2 size={12} color="#10B981" />
                <Text className="text-xs" style={{ color: '#10B981' }}>
                  {t('format.addFormat.titleAvailableHint')}
                </Text>
              </View>
            )}
          </View>

          {/* Vivran */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <FileText size={14} color="#6B7280" />
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('format.addFormat.fieldVivran')} <Text className="text-destructive">*</Text>
                </Text>
              </View>
              <Pressable
                onPress={handleAutoDetect}
                className="flex-row items-center gap-1 active:opacity-60"
              >
                <Zap size={13} color={INDIGO} />
                <Text className="text-xs font-medium" style={{ color: INDIGO }}>{t('format.addFormat.autoDetectKeys')}</Text>
              </Pressable>
            </View>
            <DocumentEditor
              value={vivran}
              onChangeText={(v) => { setVivran(v); setError(''); }}
              title={t('format.addFormat.vivranEditorTitle')}
              placeholder={t('format.addFormat.vivranPlaceholder')}
              accessibilityLabel={t('format.addFormat.vivranAccessibility')}
            />
            <FardCheckButton text={vivran} title={title} className="mt-1" />
            <Text className="text-xs text-muted-foreground">
              {t('format.addFormat.vivranHint')}
            </Text>
          </View>

          {/* ── System Keys Section ──────────────────────────────── */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Lock size={13} color={SUCCESS} />
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('format.addFormat.systemKeysLabel', { count: systemKeys.length })}
              </Text>
            </View>
            <View className="gap-2">
              {systemKeys.map((k, i) => (
                <SystemKeyRow key={k._id} keyDef={k} index={i} />
              ))}
            </View>
            <Text className="text-xs text-muted-foreground leading-4">
              {t('format.addFormat.systemKeysNote')}
            </Text>
          </View>

          {/* ── Predefined User Key Library ──────────────────────── */}
          <View className="gap-3">
            <Pressable
              onPress={() => setShowUserKeyLibrary((v) => !v)}
              className="flex-row items-center justify-between active:opacity-70"
            >
              <View className="flex-row items-center gap-2">
                <BookOpen size={13} color="#7C3AED" />
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('format.addFormat.predefinedKeysLabel')}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs text-muted-foreground">
                  {t('format.addFormat.predefinedKeysCount', {
                    added: keys.filter((k) => PREDEFINED_USER_KEYS.some((p) => p.key_name === k.key_name)).length,
                    total: PREDEFINED_USER_KEYS.length,
                  })}
                </Text>
                {showUserKeyLibrary
                  ? <ChevronUp size={13} color={MUTED} />
                  : <ChevronDown size={13} color={MUTED} />}
              </View>
            </Pressable>

            {showUserKeyLibrary && (
              <View className="gap-2">
                <Text className="text-xs text-muted-foreground leading-4">
                  {t('format.addFormat.predefinedKeysNote')}
                </Text>
                {PREDEFINED_USER_KEYS.map((pkey) => {
                  const inserted = keys.some((k) => k.key_name === pkey.key_name);
                  return (
                    <PredefinedKeyPickerRow
                      key={pkey.key_name}
                      pkey={pkey}
                      inserted={inserted}
                      onInsert={() => insertPredefinedKey(pkey)}
                    />
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Dynamic Keys Section ─────────────────────────────── */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Key size={14} color="#6B7280" />
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('format.addFormat.dynamicKeysLabel', { count: dynamicKeys.length })}
                </Text>
              </View>
              <Pressable onPress={addKey} className="flex-row items-center gap-1 active:opacity-60">
                <Plus size={14} color={INDIGO} />
                <Text className="text-xs text-primary font-medium">{t('format.addFormat.addKey')}</Text>
              </Pressable>
            </View>

            {dynamicKeys.length === 0 ? (
              <View className="border border-dashed border-border rounded-xl py-6 items-center gap-2">
                <Key size={22} color="#D1D5DB" />
                <Text className="text-sm text-muted-foreground">{t('format.addFormat.noDynamicKeys')}</Text>
                <Text className="text-xs text-muted-foreground text-center px-8">
                  {t('format.addFormat.noDynamicKeysNote')}
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {dynamicKeys.map((k, i) => (
                  <KeyRow
                    key={k._id}
                    keyDef={k}
                    index={i}
                    onUpdate={(field, value) => updateKey(k._id, field, value)}
                    onDelete={() => removeKey(k._id)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Tags */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Tag size={14} color="#6B7280" />
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('format.addFormat.tagsLabel')}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag, idx) => (
                <Pressable
                  key={`${idx}-${tag}`}
                  onPress={() => toggleTag(tag)}
                  className="rounded-full px-3 py-1.5 active:opacity-70"
                  style={{ backgroundColor: tags.includes(tag) ? INDIGO : FIELD_BG }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: tags.includes(tag) ? '#fff' : FIELD_TEXT }}
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {error ? (
            <View className="bg-destructive/10 rounded-xl px-4 py-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Unsaved Changes Dialog */}
      <AlertDialog
        open={showDiscardDialog}
        onOpenChange={(v) => { if (!v) setShowDiscardDialog(false); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('format.addFormat.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('format.addFormat.unsavedDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>
              <Text>{t('format.addFormat.continueEditing')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { setShowDiscardDialog(false); router.back(); }}
              className="bg-destructive"
            >
              <Text className="text-destructive-foreground font-semibold">{t('format.addFormat.discardChanges')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Title Dialog */}
      <AlertDialog
        open={showDupDialog}
        onOpenChange={(v) => { if (!v) setShowDupDialog(false); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={18} color="#F59E0B" />
                <Text className="text-base font-semibold text-foreground">
                  {t('format.addFormat.dupTitleDialogTitle')}
                </Text>
              </View>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('format.addFormat.dupTitleDialogDesc', { title: dupTitle })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDupDialog(false)}>
              <Text>{t('format.addFormat.dupCancel')}</Text>
            </AlertDialogCancel>
            {dupFormatId && (
              <AlertDialogAction
                onPress={() => {
                  setShowDupDialog(false);
                  router.push(`/(app)/formats/add-format?editId=${dupFormatId}` as never);
                }}
                className="flex-row items-center gap-1.5"
              >
                <ExternalLink size={14} color="#fff" />
                <Text className="text-primary-foreground font-semibold text-sm">
                  {t('format.addFormat.dupViewExisting')}
                </Text>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
          {/* Rename option — inline action below the buttons */}
          <Pressable
            onPress={() => {
              setShowDupDialog(false);
              // Focus the title field by appending a space so officer can rename immediately
              setTitle((prev) => prev.trimEnd() + ' ');
            }}
            className="mt-1 py-2 items-center active:opacity-70"
          >
            <Text className="text-sm text-primary font-medium">
              {t('format.addFormat.dupRenameThis')}
            </Text>
          </Pressable>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
