/**
 * Developer Seed Manager — Add / Edit System Format
 * DEV-ONLY. Not accessible in production builds.
 */
import { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView, Pressable, ScrollView,
  Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  Save, Plus, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import { useDevSeedStore, type SeedFormatKey } from '@/lib/devSeedStore';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

// ─── Constants ────────────────────────────────────────────────────────────────
const FORMAT_TYPES = ['GD', 'Case Diary', 'Nyayalay', 'Prarthna Patra', 'BNSS Karyavahi', 'Any'];

const CONTENT_TYPES = [
  { value: 'format',    label: 'Format'           },
  { value: 'sop',       label: 'SOP'              },
  { value: 'guide',     label: 'Guide'            },
  { value: 'checklist', label: 'Checklist'        },
  { value: 'court',     label: 'Court Format'     },
  { value: 'circular',  label: 'Police Circular'  },
  { value: 'template',  label: 'Sample Report'    },
];

const FIELD_TYPES = ['text', 'multiline', 'number', 'date', 'dropdown'] as const;
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text', multiline: 'Multi-line', number: 'Number', date: 'Date', dropdown: 'Dropdown',
};

const AVAILABLE_TAGS = [
  'FIR', 'GD', 'Arrest', 'NBW', 'Notice', 'Witness',
  'BNSS', 'BNS', 'Court', 'Panchayat', 'Beat', 'Investigation',
  'SOP', 'Checklist', 'Circular', 'Template',
];

type KeyDef = SeedFormatKey & { _id: string };
let _keySeq = 0;
function newKey(): KeyDef {
  return {
    _id: `k_${++_keySeq}`,
    key_name: '', label: '', field_type: 'text',
    is_required: 0, sort_order: 0,
  };
}

// ─── Key row ──────────────────────────────────────────────────────────────────
function KeyRow({
  keyDef, index, onUpdate, onDelete,
}: {
  keyDef: KeyDef;
  index: number;
  onUpdate: (field: keyof SeedFormatKey, value: string | number) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="border border-border rounded-xl overflow-hidden mb-2" style={{ borderCurve: 'continuous' }}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="px-4 py-3 flex-row items-center gap-3 bg-card active:opacity-70"
      >
        <View className="w-7 h-7 rounded-lg bg-secondary items-center justify-center">
          <Text className="text-xs font-bold text-muted-foreground">{index + 1}</Text>
        </View>
        <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
          {`{{${keyDef.key_name || 'new_key'}}}`}
          {keyDef.label ? ` — ${keyDef.label}` : ''}
        </Text>
        <View className="flex-row items-center gap-2">
          {Boolean(keyDef.is_required) && (
            <View className="rounded-full bg-destructive/10 px-2.5 py-1">
              <Text textBreakStrategy="simple" className="text-xs text-destructive font-medium">Req</Text>
            </View>
          )}
          <Pressable onPress={onDelete} className="p-1 active:opacity-60">
            <Trash2 size={13} color="#DC2626" />
          </Pressable>
          {expanded ? <ChevronUp size={13} color="#9CA3AF" /> : <ChevronDown size={13} color="#9CA3AF" />}
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 pt-2 gap-3 bg-background">
          {/* Key name */}
          <View className="gap-1">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Key Name</Text>
            <TextInput
              value={keyDef.key_name}
              onChangeText={(v) => onUpdate('key_name', v.replace(/\s/g, '_'))}
              placeholder="e.g. fir_number"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              className="border border-border rounded-xl px-4 py-3 text-sm text-foreground bg-card"
              style={{ borderCurve: 'continuous' }}
            />
          </View>
          {/* Label */}
          <View className="gap-1">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display Label</Text>
            <TextInput
              value={keyDef.label}
              onChangeText={(v) => onUpdate('label', v)}
              placeholder="e.g. FIR Number"
              placeholderTextColor="#9CA3AF"
              className="border border-border rounded-xl px-4 py-3 text-sm text-foreground bg-card"
              style={{ borderCurve: 'continuous' }}
            />
          </View>
          {/* Field type chips */}
          <View className="gap-1">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Field Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-0.5">
              {FIELD_TYPES.map((ft) => (
                <Pressable
                  key={ft}
                  onPress={() => onUpdate('field_type', ft)}
                  className="mx-0.5 rounded-full active:opacity-70 px-3 py-1.5"
                  style={{ backgroundColor: keyDef.field_type === ft ? '#1E3A5F' : '#F3F4F6' }}
                >
                  <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: keyDef.field_type === ft ? '#fff' : '#374151' }}>
                    {FIELD_TYPE_LABELS[ft]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          {/* Dropdown options */}
          {keyDef.field_type === 'dropdown' && (
            <View className="gap-1">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Options (comma-separated)</Text>
              <TextInput
                value={keyDef.dropdown_options ?? ''}
                onChangeText={(v) => onUpdate('dropdown_options', v)}
                placeholder="Option A,Option B,Option C"
                placeholderTextColor="#9CA3AF"
                className="border border-border rounded-xl px-4 py-3 text-sm text-foreground bg-card"
                style={{ borderCurve: 'continuous' }}
              />
            </View>
          )}
          {/* Required toggle */}
          <Pressable
            onPress={() => onUpdate('is_required', keyDef.is_required ? 0 : 1)}
            className="flex-row items-center gap-3 active:opacity-70"
          >
            <View
              className="w-5 h-5 rounded-md border-2 items-center justify-center"
              style={{ borderColor: keyDef.is_required ? '#1E3A5F' : '#D1D5DB', backgroundColor: keyDef.is_required ? '#1E3A5F' : 'transparent' }}
            >
              {Boolean(keyDef.is_required) && <Text className="text-white text-xs font-bold">✓</Text>}
            </View>
            <Text className="text-sm text-foreground">Required field</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function EditFormatScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const store = useDevSeedStore();
  const isEdit = Boolean(editId);

  // Form state
  const [title, setTitle]           = useState('');
  const [formatType, setFormatType] = useState(FORMAT_TYPES[0]);
  const [contentType, setContentType] = useState(CONTENT_TYPES[0].value);
  const [vivran, setVivran]         = useState('');
  const [tags, setTags]             = useState<string[]>([]);
  const [keys, setKeys]             = useState<KeyDef[]>([]);
  const [error, setError]           = useState('');
  const [saving, setSaving]         = useState(false);

  // Load existing for edit
  useFocusEffect(useCallback(() => {
    if (!editId) return;
    const fmt = store.formats.find((f) => f.id === editId);
    if (!fmt) return;
    setTitle(fmt.title);
    setFormatType(fmt.format_type);
    setContentType(fmt.content_type);
    setVivran(fmt.vivran);
    setTags(fmt.tags);
    setKeys(fmt.keys.map((k, i) => ({ ...k, _id: `k_loaded_${i}` })));
  }, [editId, store.formats]));

  const toggleTag = (tag: string) =>
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const updateKey = (idx: number, field: keyof SeedFormatKey, value: string | number) => {
    setKeys((prev) => prev.map((k, i) => i === idx ? { ...k, [field]: value } : k));
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required.'); return; }

    const isDup = isEdit
      ? store.isTitleDuplicateFormat(title.trim(), editId)
      : store.isTitleDuplicateFormat(title.trim());
    if (isDup) { setError('A format with this title already exists.'); return; }

    // Validate keys
    for (const k of keys) {
      if (!k.key_name.trim()) { setError('All keys must have a key name.'); return; }
    }

    setSaving(true);
    const keysWithOrder: SeedFormatKey[] = keys.map((k, i) => ({
      key_name:         k.key_name,
      label:            k.label,
      field_type:       k.field_type,
      is_required:      k.is_required,
      sort_order:       i + 1,
      default_value:    k.default_value,
      dropdown_options: k.dropdown_options,
    }));

    if (isEdit && editId) {
      store.updateFormat(editId, { title: title.trim(), format_type: formatType, content_type: contentType, vivran, tags, keys: keysWithOrder });
    } else {
      store.addFormat({ title: title.trim(), format_type: formatType, content_type: contentType, vivran, is_favorite: 0, created_by: 'system', tags, keys: keysWithOrder });
    }
    setSaving(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <AppHeader
        title={isEdit ? 'Edit Format' : 'New Format'}
        subtitle="System content · DEV only"
        showBack
        rightActions={
          <Pressable onPress={handleSave} disabled={saving} className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl active:opacity-70" style={{ backgroundColor: saving ? '#9CA3AF' : '#1E3A5F' }}>
            <Save size={14} color="#fff" />
            <Text className="text-sm font-semibold text-white">{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="px-5 py-5 gap-5 pb-20"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View className="px-4 py-3 rounded-xl" style={{ backgroundColor: '#FEF2F2' }}>
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        ) : null}

        {/* Title */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Format title"
            placeholderTextColor="#9CA3AF"
            className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-card"
            style={{ borderCurve: 'continuous' }}
          />
        </View>

        {/* Content type */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content Type *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-0.5">
            {CONTENT_TYPES.map((ct) => (
              <Pressable
                key={ct.value}
                onPress={() => setContentType(ct.value)}
                className="mx-0.5 rounded-full active:opacity-70 px-3 py-1.5"
                style={{ backgroundColor: contentType === ct.value ? '#1E3A5F' : '#F3F4F6' }}
              >
                <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: contentType === ct.value ? '#fff' : '#374151' }}>
                  {ct.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Format type */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Format Type *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-0.5">
            {FORMAT_TYPES.map((ft) => (
              <Pressable
                key={ft}
                onPress={() => setFormatType(ft)}
                className="mx-0.5 rounded-full active:opacity-70 px-3 py-1.5"
                style={{ backgroundColor: formatType === ft ? '#1E3A5F' : '#F3F4F6' }}
              >
                <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: formatType === ft ? '#fff' : '#374151' }}>
                  {ft}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Description */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</Text>
          <TextInput
            value={vivran}
            onChangeText={setVivran}
            placeholder="Brief description of this format"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="border border-border rounded-xl px-4 py-3 text-sm text-foreground bg-card"
            style={{ borderCurve: 'continuous', minHeight: 80 }}
          />
        </View>

        {/* Tags */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</Text>
          <View className="flex-row flex-wrap gap-2">
            {AVAILABLE_TAGS.map((tag, idx) => (
              <Pressable
                key={`${idx}-${tag}`}
                onPress={() => toggleTag(tag)}
                className="rounded-full active:opacity-70 px-3 py-1.5"
                style={{ backgroundColor: tags.includes(tag) ? '#1E3A5F' : '#F3F4F6' }}
              >
                <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: tags.includes(tag) ? '#fff' : '#374151' }}>
                  {tag}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Keys */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Form Keys ({keys.length})
            </Text>
            <Pressable
              onPress={() => setKeys((prev) => [...prev, newKey()])}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary active:opacity-70"
            >
              <Plus size={13} color="#374151" />
              <Text className="text-xs font-medium text-foreground">Add Key</Text>
            </Pressable>
          </View>

          {keys.length === 0 && (
            <View className="border border-dashed border-border rounded-xl py-6 items-center gap-1">
              <Text className="text-sm text-muted-foreground">No keys yet</Text>
              <Text className="text-xs text-muted-foreground">Tap "Add Key" to define form fields</Text>
            </View>
          )}

          {keys.map((k, i) => (
            <KeyRow
              key={k._id}
              keyDef={k}
              index={i}
              onUpdate={(field, value) => updateKey(i, field, value)}
              onDelete={() => setKeys((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
