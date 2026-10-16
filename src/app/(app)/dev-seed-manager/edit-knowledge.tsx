/**
 * Developer Seed Manager — Add / Edit System Knowledge Entry
 * DEV-ONLY. Not accessible in production builds.
 */
import { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView, Pressable, ScrollView,
  Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useDevSeedStore } from '@/lib/devSeedStore';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

// ─── Constants ────────────────────────────────────────────────────────────────
const CONTENT_TYPES = [
  { value: 'law',       label: 'Law / Section'    },
  { value: 'sop',       label: 'SOP'              },
  { value: 'guide',     label: 'Investigation Guide' },
  { value: 'checklist', label: 'Checklist'        },
  { value: 'court',     label: 'Court Format'     },
  { value: 'circular',  label: 'Police Circular'  },
  { value: 'template',  label: 'Sample Report'    },
];

const CATEGORIES = [
  { id: 'Laws & Sections', label: 'Laws & Sections', subcategories: ['BNS', 'BNSS', 'BSA', 'IPC', 'CrPC', 'Evidence Act', 'Other'] },
  { id: 'Investigation SOPs', label: 'Investigation SOPs', subcategories: ['Murder', 'Theft', 'POCSO', 'Cybercrime', 'Fraud', 'Other'] },
  { id: 'Beat Intelligence', label: 'Beat Intelligence', subcategories: ['Village Mapping', 'Surveillance', 'Intelligence', 'Other'] },
  { id: 'Court Procedures', label: 'Court Procedures', subcategories: ['NBW', 'Challan', 'Bail', 'Appeal', 'Other'] },
  { id: 'Police Orders', label: 'Police Orders', subcategories: ['Circulars', 'Standing Orders', 'Policy', 'Other'] },
];

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function EditKnowledgeScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const store = useDevSeedStore();
  const isEdit = Boolean(editId);

  // Form state
  const [title, setTitle]             = useState('');
  const [contentType, setContentType] = useState(CONTENT_TYPES[0].value);
  const [category, setCategory]       = useState(CATEGORIES[0].id);
  const [subcategory, setSubcategory] = useState(CATEGORIES[0].subcategories[0]);
  const [crimeType, setCrimeType]     = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags]               = useState('');
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);

  const currentCat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  // Load existing for edit
  useFocusEffect(useCallback(() => {
    if (!editId) return;
    const kn = store.knowledge.find((k) => k.id === editId);
    if (!kn) return;
    setTitle(kn.title);
    setContentType(kn.content_type);
    setCategory(kn.category);
    setSubcategory(kn.subcategory);
    setCrimeType(kn.crime_type);
    setDescription(kn.description);
    setTags(kn.tags);
  }, [editId, store.knowledge]));

  const handleSave = async () => {
    setError('');
    if (!title.trim())       { setError('Title is required.');       return; }
    if (!description.trim()) { setError('Description is required.'); return; }

    const isDup = isEdit
      ? store.isTitleDuplicateKnowledge(title.trim(), editId)
      : store.isTitleDuplicateKnowledge(title.trim());
    if (isDup) { setError('A knowledge entry with this title already exists.'); return; }

    setSaving(true);
    const payload = {
      title: title.trim(),
      content_type: contentType,
      category,
      subcategory,
      crime_type: crimeType.trim(),
      description: description.trim(),
      tags: tags.trim(),
      attachment_uris: '[]',
    };

    if (isEdit && editId) store.updateKnowledge(editId, payload);
    else store.addKnowledge(payload);

    setSaving(false);
    router.back();
  };

  // ── Shared input style ──────────────────────────────────────────────────────
  const inputClass = 'border border-border rounded-xl px-4 py-3 text-sm text-foreground bg-card';
  const inputStyle = { borderCurve: 'continuous' as const };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <AppHeader
        title={isEdit ? 'Edit Knowledge' : 'New Knowledge'}
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
            placeholder="Knowledge entry title"
            placeholderTextColor="#9CA3AF"
            className={inputClass}
            style={inputStyle}
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
                className="mx-0.5 rounded-full px-3 py-2 active:opacity-70"
                style={{ backgroundColor: contentType === ct.value ? '#1E3A5F' : '#F3F4F6' }}
              >
                <Text className="text-xs font-medium" style={{ color: contentType === ct.value ? '#fff' : '#374151' }}>
                  {ct.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Category */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-0.5">
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => { setCategory(cat.id); setSubcategory(cat.subcategories[0]); }}
                className="mx-0.5 rounded-full px-3 py-2 active:opacity-70"
                style={{ backgroundColor: category === cat.id ? '#1E3A5F' : '#F3F4F6' }}
              >
                <Text className="text-xs font-medium" style={{ color: category === cat.id ? '#fff' : '#374151' }}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Subcategory */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subcategory</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-0.5">
            {currentCat.subcategories.map((sub) => (
              <Pressable
                key={sub}
                onPress={() => setSubcategory(sub)}
                className="mx-0.5 rounded-full px-3 py-2 active:opacity-70"
                style={{ backgroundColor: subcategory === sub ? '#374151' : '#F3F4F6' }}
              >
                <Text className="text-xs font-medium" style={{ color: subcategory === sub ? '#fff' : '#374151' }}>
                  {sub}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Crime type */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Crime Type <Text className="normal-case font-normal">(optional)</Text>
          </Text>
          <TextInput
            value={crimeType}
            onChangeText={setCrimeType}
            placeholder="e.g. Murder, Theft, POCSO"
            placeholderTextColor="#9CA3AF"
            className={inputClass}
            style={inputStyle}
          />
        </View>

        {/* Description */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description / Content *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Full content of the knowledge entry. Use plain text with line breaks."
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            className={inputClass}
            style={{ ...inputStyle, minHeight: 180 }}
          />
        </View>

        {/* Tags */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags <Text className="normal-case font-normal">(comma-separated)</Text></Text>
          <TextInput
            value={tags}
            onChangeText={setTags}
            placeholder="e.g. BNSS,FIR,Section 173"
            placeholderTextColor="#9CA3AF"
            className={inputClass}
            style={inputStyle}
          />
        </View>

        {/* Metadata hint */}
        <View className="px-4 py-3 rounded-xl bg-secondary gap-1">
          <Text className="text-xs font-semibold text-muted-foreground">Auto-set on Save</Text>
          <Text className="text-xs text-muted-foreground">
            Source = System · Editable = false{'\n'}
            UUID (new) · Version (1 or incremented) · AppVersion · LastUpdated = today
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
