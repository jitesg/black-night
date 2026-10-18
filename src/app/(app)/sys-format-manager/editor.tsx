/**
 * System Format Manager — Format Editor
 *
 * Create or edit a system format.
 * Reuses the same field/tag/template infrastructure as the user-facing add-format screen.
 * Every save creates a version snapshot + audit entry via sysFormatRepo.
 */
import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Pressable, ScrollView, Text,
  TextInput, View, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Input } from '@/components/ui/input';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  Save, Plus, Trash2, ChevronDown, ChevronUp,
  Zap, Tag, Key, FileText, Lock, CheckCircle2,
  BookOpen, X, Eye,
} from 'lucide-react-native';
import {
  getFormatById, getFormatKeys, getFormatTags, checkTitleExists,
  type FormatKeyInput, type FormatType,
} from '@/lib/db/predefinedFormatRepo';
import { createSysFormat, updateSysFormat, SYS_CATEGORIES, type FormatStatus } from '@/lib/db/sysFormatRepo';
import { detectKeys, keyToLabel } from '@/lib/templateEngine';
import { GLOBAL_KEY_REGISTRY, GLOBAL_KEY_LABELS, isGlobalKey } from '@/lib/globalKeyEngine';
import { PREDEFINED_USER_KEYS, toFormatKeyInput } from '@/lib/predefinedUserKeys';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';
import { isSessionActive, touchSession } from '@/lib/sysFormatAuth';

const FORMAT_TYPES: FormatType[] = [
  'GD', 'Case Diary', 'Nyayalay', 'Prarthna Patra', 'BNSS Karyavahi', 'Any',
];

const AVAILABLE_TAGS = [
  'GD', 'FIR', 'Arrest', 'NBW', 'Notice', 'Witness',
  'BNSS', 'Court', 'Panchayat', 'Beat', 'Investigation',
  'Report', 'Summons', 'Warrant', 'Template', 'Knowledge',
];

const FIELD_TYPES = ['text', 'multiline', 'number', 'date', 'dropdown'] as const;
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text', multiline: 'Multi-line', number: 'Number', date: 'Date', dropdown: 'Dropdown',
};

const SYSTEM_KEY_NAMES = Object.keys(GLOBAL_KEY_REGISTRY);

type KeyDef = FormatKeyInput & { _id: string; isSystem: boolean };

function makeDefaultSystemKeys(): KeyDef[] {
  return SYSTEM_KEY_NAMES.map((kn, i) => ({
    _id: `sys_${kn}`, isSystem: true,
    key_name: kn, label: GLOBAL_KEY_LABELS[kn] ?? kn,
    field_type: 'text' as const, is_required: 0, sort_order: i,
  }));
}

// ─── System Key Row ───────────────────────────────────────────────────────────
function SystemKeyRow({ keyDef }: { keyDef: KeyDef }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 bg-muted/60 border border-border rounded-xl px-3 py-2.5"
      style={{ borderCurve: 'continuous' }}>
      <Lock size={13} color="#9CA3AF" />
      <Text className="text-xs text-muted-foreground flex-1">
        {keyDef.label} <Text className="opacity-50">({keyDef.key_name})</Text>
      </Text>
      <Text className="text-xs text-muted-foreground">{t('sysFormat.editor.systemBadge')}</Text>
    </View>
  );
}

// ─── User Key Row ─────────────────────────────────────────────────────────────
function UserKeyRow({
  keyDef, onChange, onDelete,
}: {
  keyDef: KeyDef;
  onChange: (updated: Partial<KeyDef>) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View className="border border-border rounded-xl overflow-hidden bg-card"
      style={{ borderCurve: 'continuous' }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-2 px-3 py-2.5 active:opacity-70"
      >
        <Key size={13} color='#1E3A5F' />
        <Text className="flex-1 text-xs font-medium text-foreground"
          numberOfLines={1}>
          {keyDef.label || keyDef.key_name || t('sysFormat.editor.newFieldLabel')}
        </Text>
        <View className="rounded-full bg-muted px-2.5 py-1">
          <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">
            {FIELD_TYPE_LABELS[keyDef.field_type] ?? keyDef.field_type}
          </Text>
        </View>
        {keyDef.is_required === 1 && (
          <View className="w-1.5 h-1.5 rounded-full bg-destructive" />
        )}
        {open ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
        <Pressable onPress={onDelete} className="pl-1 active:opacity-60">
          <Trash2 size={14} color="#DC2626" />
        </Pressable>
      </Pressable>
      {open && (
        <View className="border-t border-border px-3 py-3 gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-1">{t('sysFormat.editor.fieldKeyName')}</Text>
              <TextInput
                value={keyDef.key_name}
                onChangeText={(v) => onChange({ key_name: v.replace(/[^A-Za-z0-9_]/g, '') })}
                placeholder={t('sysFormat.editor.keyPlaceholder')}
                className="border border-border rounded-lg px-2 py-1.5 text-xs text-foreground bg-background"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-1">{t('sysFormat.editor.fieldLabel')}</Text>
              <TextInput
                value={keyDef.label}
                onChangeText={(v) => onChange({ label: v })}
                placeholder={t('sysFormat.editor.labelPlaceholder')}
                className="border border-border rounded-lg px-2 py-1.5 text-xs text-foreground bg-background"
              />
            </View>
          </View>
          <View>
            <Text className="text-xs text-muted-foreground mb-1">{t('sysFormat.editor.fieldType')}</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {FIELD_TYPES.map((ft) => (
                <Pressable
                  key={ft}
                  onPress={() => onChange({ field_type: ft })}
                  className="rounded-full active:opacity-70 px-2.5 py-1"
                  style={{
                    backgroundColor: keyDef.field_type === ft ? '#1E3A5F' : '#F3F4F6',
                    borderWidth: 1, borderColor: keyDef.field_type === ft ? '#1E3A5F' : 'transparent',
                  }}
                >
                  <Text textBreakStrategy="simple" className="text-xs font-medium"
                    style={{ color: keyDef.field_type === ft ? '#fff' : '#374151' }}>
                    {FIELD_TYPE_LABELS[ft]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => onChange({ is_required: keyDef.is_required === 1 ? 0 : 1 })}
              className="flex-row items-center gap-2"
            >
              <View
                className="w-4 h-4 rounded border items-center justify-center"
                style={{ borderColor: keyDef.is_required === 1 ? '#1E3A5F' : '#D1D5DB',
                  backgroundColor: keyDef.is_required === 1 ? '#1E3A5F' : 'transparent' }}
              >
                {keyDef.is_required === 1 && <CheckCircle2 size={10} color="#fff" />}
              </View>
              <Text className="text-xs text-foreground">{t('sysFormat.editor.fieldRequired')}</Text>
            </Pressable>
          </View>
          {keyDef.field_type === 'dropdown' && (
            <View>
              <Text className="text-xs text-muted-foreground mb-1">
                {t('sysFormat.editor.fieldOptions')}
              </Text>
              <TextInput
                value={(() => {
                  try { return JSON.parse(keyDef.dropdown_options ?? '[]').join(', '); } catch { return ''; }
                })()}
                onChangeText={(v) =>
                  onChange({ dropdown_options: JSON.stringify(v.split(',').map((s) => s.trim()).filter(Boolean)) })
                }
                placeholder={t('sysFormat.editor.fieldOptionsPlaceholder')}
                className="border border-border rounded-lg px-2 py-1.5 text-xs text-foreground bg-background"
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SysFormatEditorScreen() {
  const { t } = useTranslation();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;

  const [title, setTitle]               = useState('');
  const [formatType, setFormatType]     = useState<FormatType>('Any');
  const [vivran, setVivran]             = useState('');
  const [sysCategory, setSysCategory]   = useState('');
  const [sysSubCategory, setSub]        = useState('');
  const [changeNotes, setChangeNotes]   = useState('');
  const [status, setStatus]             = useState<FormatStatus>('draft');
  const [keys, setKeys]                 = useState<KeyDef[]>(makeDefaultSystemKeys);
  const [tags, setTags]                 = useState<string[]>([]);
  const [newTag, setNewTag]             = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [saved, setSaved]               = useState(false);
  const [discardDialog, setDiscard]     = useState(false);
  const [keySuggest, setKeySuggest]     = useState<string[]>([]);

  const vivranRef = useRef<TextInput>(null);

  useFocusEffect(useCallback(() => {
    if (!isSessionActive()) { router.replace('/(app)/sys-format-manager' as never); return; }
    touchSession();
    if (!isEdit) { setKeys(makeDefaultSystemKeys()); return; }
    (async () => {
      const [fmt, fKeys, fTags] = await Promise.all([
        getFormatById(editId),
        getFormatKeys(editId),
        getFormatTags(editId),
      ]);
      if (!fmt) return;
      setTitle(fmt.title);
      setFormatType(fmt.format_type);
      setVivran(fmt.vivran);
      const r = fmt as unknown as Record<string, string>;
      setSysCategory(r.sys_category ?? '');
      setSub(r.sys_sub_category ?? '');
      setStatus((r.status as FormatStatus) ?? 'draft');
      setTags(fTags);
      const loadedDefs: KeyDef[] = fKeys.map((k) => ({
        ...k, _id: k.id, isSystem: isGlobalKey(k.key_name),
      }));
      const existingNames = new Set(loadedDefs.map((k) => k.key_name));
      const missingSys = makeDefaultSystemKeys().filter((sk) => !existingNames.has(sk.key_name));
      setKeys([...missingSys, ...loadedDefs]);
    })();
  }, [editId]));

  // Auto-detect keys from vivran template
  function handleVivranChange(text: string) {
    setVivran(text);
    const detected = detectKeys(text);
    const existingNames = new Set(keys.map((k) => k.key_name));
    const suggestions = detected.filter(
      (k) => !existingNames.has(k) && !SYSTEM_KEY_NAMES.includes(k)
    );
    setKeySuggest(suggestions);
  }

  function addDetectedKey(keyName: string) {
    setKeys((prev) => [
      ...prev,
      {
        _id: `new_${Date.now()}_${keyName}`,
        isSystem: false,
        key_name: keyName,
        label: keyToLabel(keyName),
        field_type: 'text',
        is_required: 0,
        sort_order: prev.length,
      },
    ]);
    setKeySuggest((s) => s.filter((k) => k !== keyName));
  }

  function addUserKey() {
    setKeys((prev) => [
      ...prev,
      {
        _id: `new_${Date.now()}`,
        isSystem: false,
        key_name: '',
        label: '',
        field_type: 'text',
        is_required: 0,
        sort_order: prev.length,
      },
    ]);
  }

  function addPresetKey(preset: (typeof PREDEFINED_USER_KEYS)[number]) {
    const exists = keys.some((k) => k.key_name === preset.key_name);
    if (exists) return;
    setKeys((prev) => [
      ...prev,
      { ...toFormatKeyInput(preset, prev.length), _id: `preset_${preset.key_name}`, isSystem: false },
    ]);
  }

  function updateKey(id: string, patch: Partial<KeyDef>) {
    setKeys((prev) => prev.map((k) => k._id === id ? { ...k, ...patch } : k));
  }

  function removeKey(id: string) {
    setKeys((prev) => prev.filter((k) => k._id !== id));
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setNewTag('');
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSave() {
    touchSession();
    if (!title.trim()) { setError(t('sysFormat.editor.errorTitleRequired')); return; }
    if (!vivran.trim()) { setError(t('sysFormat.editor.errorTemplateRequired')); return; }
    setSaving(true); setError('');
    try {
      const titleExists = await checkTitleExists(title.trim(), isEdit ? editId : undefined);
      if (titleExists) { setError(t('sysFormat.editor.errorTitleExists')); return; }

      const userKeys = keys.filter((k) => !k.isSystem);
      const invalidKey = userKeys.find((k) => !k.key_name.trim());
      if (invalidKey) { setError(t('sysFormat.editor.errorKeyNameRequired')); return; }

      const input = {
        title: title.trim(),
        format_type: formatType,
        vivran: vivran.trim(),
        sys_category: sysCategory,
        sys_sub_category: sysSubCategory,
        change_notes: changeNotes.trim() || (isEdit ? 'Updated' : 'Initial creation'),
        status,
        keys: keys.map((k, i) => ({
          key_name: k.key_name, label: k.label, field_type: k.field_type,
          is_required: k.is_required, default_value: k.default_value,
          dropdown_options: k.dropdown_options, sort_order: i,
        })),
        tags,
      };

      if (isEdit) {
        await updateSysFormat(editId, input);
      } else {
        await createSysFormat(input);
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); router.back(); }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('sysFormat.editor.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-background">

      {/* Header */}
      <AppHeader
        title={title || t('sysFormat.editor.titleNew')}
        subtitle={isEdit ? t('sysFormat.editor.subtitleEdit') : t('sysFormat.editor.subtitleCreate')}
        showBack
        actions={
          saved ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1.5">
              <CheckCircle2 size={13} color="#4ADE80" />
              <Text textBreakStrategy="simple" className="text-xs font-semibold text-green-400">{t('sysFormat.editor.savedBadge')}</Text>
            </View>
          ) : (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="flex-row items-center gap-1.5 rounded-full active:opacity-60 px-3 py-1.5"
              style={{ backgroundColor: saving ? 'rgba(0,0,0,0.06)' : '#F59E0B' }}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Save size={13} color="#fff" />}
              <Text textBreakStrategy="simple" className="text-xs font-semibold text-white">
                {saving ? t('sysFormat.editor.saving') : t('sysFormat.editor.save')}
              </Text>
            </Pressable>
          )
        }
      />

      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="px-4 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!!error && (
            <View className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2.5">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          )}

          {/* Title */}
          <View className="gap-1.5">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('sysFormat.editor.fieldTitle')} <Text className="text-destructive">*</Text>
            </Text>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder={t('sysFormat.editor.titlePlaceholder')}
              returnKeyType="next"
              onSubmitEditing={() => vivranRef.current?.focus()}
            />
          </View>

          {/* Format Type */}
          <View className="gap-1.5">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('sysFormat.editor.fieldFormatType')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {FORMAT_TYPES.map((ft) => (
                <Pressable
                  key={ft}
                  onPress={() => setFormatType(ft)}
                  className="rounded-full active:opacity-70 px-3 py-1.5"
                  style={{
                    backgroundColor: formatType === ft ? '#1E3A5F' : '#F3F4F6',
                    borderWidth: 1, borderColor: formatType === ft ? '#1E3A5F' : 'transparent',
                  }}
                >
                  <Text textBreakStrategy="simple" className="text-xs font-medium"
                    style={{ color: formatType === ft ? '#fff' : '#374151' }}>{ft}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Category */}
          <View className="gap-1.5">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('sysFormat.editor.fieldCategory')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {SYS_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setSysCategory(sysCategory === cat ? '' : cat)}
                  className="rounded-full active:opacity-70 px-3 py-1.5"
                  style={{
                    backgroundColor: sysCategory === cat ? '#F59E0B' : '#F3F4F6',
                    borderWidth: 1, borderColor: sysCategory === cat ? '#F59E0B' : 'transparent',
                  }}
                >
                  <Text textBreakStrategy="simple" className="text-xs font-medium"
                    style={{ color: sysCategory === cat ? '#fff' : '#374151' }}>{cat}</Text>
                </Pressable>
              ))}
            </View>
            {sysCategory !== '' && (
              <Input
                value={sysSubCategory}
                onChangeText={setSub}
                placeholder={t('sysFormat.editor.subCategoryPlaceholder')}
              />
            )}
          </View>

          {/* Status */}
          <View className="gap-1.5">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('sysFormat.editor.fieldStatus')}</Text>
            {isEdit ? (
              <View
                className="flex-row items-center gap-2 border border-border rounded-xl px-3 py-2.5"
                style={{ borderCurve: 'continuous', backgroundColor: `${'#F59E0B'}0D` }}
              >
                <Eye size={13} color='#2563EB' />
                <Text className="flex-1 text-xs text-foreground">
                  {t('sysFormat.editor.statusDraftInfo')}
                </Text>
              </View>
            ) : (
              <View className="flex-row gap-2">
                {(['draft', 'published'] as FormatStatus[]).map((s) => {
                  const color = s === 'published' ? '#059669' : '#F59E0B';
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setStatus(s)}
                      className="rounded-full active:opacity-70 px-3 py-1.5"
                      style={{
                        backgroundColor: status === s ? color : '#F3F4F6',
                        borderWidth: 1, borderColor: status === s ? color : 'transparent',
                      }}
                    >
                      <Text textBreakStrategy="simple" className="text-xs font-medium capitalize"
                        style={{ color: status === s ? '#fff' : '#374151' }}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Template Content */}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('sysFormat.editor.fieldTemplate')} <Text className="text-destructive">*</Text>
              </Text>
              <Text className="text-xs text-muted-foreground">
                {t('sysFormat.editor.templateHint', { open: '{{', close: '}}' })}
              </Text>
            </View>
            <Input
              ref={vivranRef}
              type="multiline"
              value={vivran}
              onChangeText={handleVivranChange}
              placeholder={t('sysFormat.editor.templatePlaceholder', { open: '{{', close: '}}' })}
              numberOfLines={7}
            />
            {/* Auto-detected key suggestions */}
            {keySuggest.length > 0 && (
              <View className="border border-border rounded-xl p-3 gap-2 bg-card"
                style={{ borderCurve: 'continuous' }}>
                <View className="flex-row items-center gap-1.5">
                  <Zap size={13} color='#2563EB' />
                  <Text className="text-xs font-semibold" style={{ color: '#2563EB' }}>
                    {t('sysFormat.editor.detectedKeysTitle')}
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {keySuggest.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => addDetectedKey(k)}
                      className="flex-row items-center gap-1 rounded-full active:opacity-70 px-3 py-1.5"
                      style={{ backgroundColor: `${'#1E3A5F'}12`, borderWidth: 1, borderColor: `${'#1E3A5F'}25` }}
                    >
                      <Plus size={11} color='#1E3A5F' />
                      <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: '#1E3A5F' }}>{k}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Dynamic Fields */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Key size={14} color='#1E3A5F' />
                <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t('sysFormat.editor.fieldsSection', { count: keys.length })}
                </Text>
              </View>
              <Pressable
                onPress={addUserKey}
                className="flex-row items-center gap-1 rounded-full active:opacity-70 px-3 py-1.5"
                style={{ backgroundColor: `${'#1E3A5F'}12` }}
              >
                <Plus size={11} color='#1E3A5F' />
                <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: '#1E3A5F' }}>{t('sysFormat.editor.addField')}</Text>
              </Pressable>
            </View>

            {/* System keys */}
            {keys.filter((k) => k.isSystem).map((k) => (
              <SystemKeyRow key={k._id} keyDef={k} />
            ))}

            {/* User keys */}
            {keys.filter((k) => !k.isSystem).map((k) => (
              <UserKeyRow
                key={k._id}
                keyDef={k}
                onChange={(p) => updateKey(k._id, p)}
                onDelete={() => removeKey(k._id)}
              />
            ))}

            {/* Preset key picker */}
            <View className="gap-1.5 pt-1">
              <Text className="text-xs text-muted-foreground">{t('sysFormat.editor.presetsHint')}</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {PREDEFINED_USER_KEYS.filter(
                  (p) => !keys.some((k) => k.key_name === p.key_name)
                ).slice(0, 8).map((p) => (
                  <Pressable
                    key={p.key_name}
                    onPress={() => addPresetKey(p)}
                    className="flex-row items-center gap-1 rounded-full bg-muted active:opacity-70 px-3 py-1.5"
                  >
                    <BookOpen size={11} color="#6B7280" />
                    <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{p.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Tags */}
          <View className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Tag size={14} color='#1E3A5F' />
              <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('sysFormat.editor.tagsSection')}</Text>
            </View>
            {/* Selected */}
            {tags.length > 0 && (
              <View className="flex-row flex-wrap gap-1.5">
                {tags.map((t, idx) => (
                  <Pressable
                    key={`${idx}-${t}`}
                    onPress={() => removeTag(t)}
                    className="flex-row items-center gap-1 rounded-full active:opacity-70 px-3 py-1.5"
                    style={{ backgroundColor: `${'#1E3A5F'}12`, borderWidth: 1, borderColor: `${'#1E3A5F'}25` }}
                  >
                    <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: '#1E3A5F' }}>{t}</Text>
                    <X size={10} color='#1E3A5F' />
                  </Pressable>
                ))}
              </View>
            )}
            {/* Suggestions */}
            <View className="flex-row flex-wrap gap-1.5">
              {AVAILABLE_TAGS.filter((t) => !tags.includes(t)).map((t, idx) => (
                <Pressable
                  key={`${idx}-${t}`}
                  onPress={() => addTag(t)}
                  className="rounded-full bg-muted active:opacity-70 px-3 py-1.5"
                >
                  <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{t}</Text>
                </Pressable>
              ))}
            </View>
            {/* Custom tag */}
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Input
                  value={newTag}
                  onChangeText={setNewTag}
                  placeholder={t('sysFormat.editor.customTagPlaceholder')}
                  returnKeyType="done"
                  onSubmitEditing={() => addTag(newTag)}
                />
              </View>
              <Pressable
                onPress={() => addTag(newTag)}
                disabled={!newTag.trim()}
                className="w-10 h-10 rounded-xl items-center justify-center active:opacity-70"
                style={{ backgroundColor: newTag.trim() ? '#1E3A5F' : '#E5E7EB' }}
              >
                <Plus size={16} color={newTag.trim() ? '#fff' : '#9CA3AF'} />
              </Pressable>
            </View>
          </View>

          {/* Change Notes */}
          <View className="gap-1.5">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('sysFormat.editor.changeNotesSection')}</Text>
            <Input
              type="multiline"
              value={changeNotes}
              onChangeText={setChangeNotes}
              placeholder={t('sysFormat.editor.changeNotesPlaceholder')}
              numberOfLines={3}
            />
          </View>

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={saving || saved}
            className="rounded-2xl items-center justify-center active:opacity-70"
            style={{
              height: 52, borderCurve: 'continuous',
              backgroundColor: saved ? '#059669' : saving ? '#9CA3AF' : '#1E3A5F',
            }}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : saved
                ? <Text className="text-base font-semibold text-white">{t('sysFormat.editor.savedCheck')}</Text>
                : <Text className="text-base font-semibold text-white">
                    {isEdit ? t('sysFormat.editor.saveChanges') : t('sysFormat.editor.createFormat')}
                  </Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Discard dialog */}
      <AlertDialog open={discardDialog} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sysFormat.editor.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sysFormat.editor.discardDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Text>{t('sysFormat.editor.keepEditing')}</Text></AlertDialogCancel>
            <AlertDialogAction onPress={() => router.back()}><Text>{t('sysFormat.editor.discard')}</Text></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
