import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  BackHandler, KeyboardAvoidingView, Pressable, ScrollView,
  Text, TextInput, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  AlertCircle, ChevronDown, Save, Tag,
} from 'lucide-react-native';
import {
  createKnowledgeEntry, updateKnowledgeEntry, getKnowledgeById,
} from '@/lib/db/knowledgeRepo';
import {
  KNOWLEDGE_CATEGORIES, KNOWLEDGE_CATEGORY_MAP, getCategoryLabel,
} from '@/lib/knowledgeConstants';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export default function AddKnowledgeScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const { editId, category: paramCategory } = useLocalSearchParams<{
    editId?: string; category?: string;
  }>();
  const isEdit = Boolean(editId);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(paramCategory ?? KNOWLEDGE_CATEGORIES[0].id);
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  // UI state
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [showSubcatDropdown, setShowSubcatDropdown] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);

  const isDirty = useRef(false);
  const originalRef = useRef({ title: '', category: '', subcategory: '', description: '', tags: '' });

  const currentCat = KNOWLEDGE_CATEGORY_MAP[category];
  const color = currentCat?.color ?? '#0F766E';
  const subcategories = currentCat?.subcategories ?? [];

  // Load entry for edit
  useFocusEffect(
    useCallback(() => {
      if (!editId) return;
      (async () => {
        const e = await getKnowledgeById(editId);
        if (!e) return;
        setTitle(e.title);
        setCategory(e.category);
        setSubcategory(e.subcategory);
        setDescription(e.description);
        setTags(e.tags);
        originalRef.current = {
          title: e.title, category: e.category, subcategory: e.subcategory,
          description: e.description, tags: e.tags,
        };
      })();
    }, [editId])
  );

  // Track dirty
  useEffect(() => {
    const o = originalRef.current;
    isDirty.current = (
      title !== o.title || category !== o.category ||
      subcategory !== o.subcategory || description !== o.description || tags !== o.tags
    );
  }, [title, category, subcategory, description, tags]);

  // Reset subcategory when category changes
  const handleCategoryChange = (catId: string) => {
    setCategory(catId);
    setSubcategory('');
    setShowCatDropdown(false);
  };

  const handleBack = () => {
    if (isDirty.current) { setShowUnsaved(true); } else { router.back(); }
  };

  // ── Android hardware-back interceptor ────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isDirty.current) {
          setShowUnsaved(true);
          return true; // consumed — suppress default pop
        }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  const handleSave = async () => {
    setError('');
    if (!title.trim()) { setError(t('knowledge.addEdit.errorTitleRequired')); return; }
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        category,
        subcategory,
        crime_type: '',   // non-guide entries carry empty crime_type
        description: description.trim(),
        tags: tags.trim(),
        attachment_uris: '[]',
      };
      if (isEdit && editId) {
        // Preserve existing attachment_uris on edit
        const existing = await getKnowledgeById(editId);
        await updateKnowledgeEntry(editId, {
          ...data,
          attachment_uris: existing?.attachment_uris ?? '[]',
        });
      } else {
        await createKnowledgeEntry(data);
      }
      isDirty.current = false;
      router.back();
    } catch (e) {
      setError(t('knowledge.addEdit.errorSaveFailed'));
      logger.warn('[AddKnowledge] save error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={isEdit ? t('knowledge.addEdit.titleEdit') : t('knowledge.addEdit.titleNew')}
        subtitle={getCategoryLabel(category, t)}
        onBack={handleBack}
        rightActions={
          <Pressable onPress={handleSave} disabled={saving} className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl active:opacity-70" style={{ backgroundColor: color, borderCurve: 'continuous' }}>
            <Save size={15} color="#fff" />
            <Text className="text-sm font-bold text-white">{saving ? t('knowledge.addEdit.saving') : t('knowledge.addEdit.save')}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
        className="flex-1"
      >

        <ScrollView
          contentContainerClassName="px-6 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Title ─────────────────────────────────────── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('knowledge.addEdit.fieldTitleRequired')} <Text className="text-destructive">*</Text>
            </Text>
            <Input
              value={title}
              onChangeText={(v) => { setTitle(v); setError(''); }}
              placeholder={t('knowledge.addEdit.titlePlaceholder')}
            />
          </View>

          {/* ── Category ──────────────────────────────────── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('knowledge.addEdit.fieldCategoryRequired')} <Text className="text-destructive">*</Text>
            </Text>
            <Pressable
              onPress={() => { setShowCatDropdown(!showCatDropdown); setShowSubcatDropdown(false); }}
              className="flex-row items-center gap-3 border border-border rounded-xl px-4 py-3 bg-card active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <Text className="flex-1 text-base text-foreground">{getCategoryLabel(category, t)}</Text>
              <ChevronDown size={16} color={C.mutedForeground} />
            </Pressable>
            {showCatDropdown && (
              <View className="border border-border rounded-xl overflow-hidden bg-card mt-1" style={{ borderCurve: 'continuous' }}>
                {KNOWLEDGE_CATEGORIES.map((c, idx) => (
                  <Pressable
                    key={c.id}
                    onPress={() => handleCategoryChange(c.id)}
                    className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
                    style={{
                      borderTopWidth: idx > 0 ? 1 : 0,
                      borderTopColor: C.border,
                      backgroundColor: category === c.id ? `${c.color}10` : 'transparent',
                    }}
                  >
                    <c.icon size={15} color={c.color} />
                    <Text className="flex-1 text-sm font-medium text-foreground">{getCategoryLabel(c.id, t)}</Text>
                    {category === c.id && (
                      <Text className="text-xs font-bold" style={{ color: c.color }}>✓</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* ── Subcategory ───────────────────────────────── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('knowledge.addEdit.fieldSubcategory')}
            </Text>
            <Pressable
              onPress={() => { setShowSubcatDropdown(!showSubcatDropdown); setShowCatDropdown(false); }}
              className="flex-row items-center gap-3 border border-border rounded-xl px-4 py-3 bg-card active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <Text className="flex-1 text-base" style={{ color: subcategory ? C.foreground : C.mutedForeground }}>
                {subcategory || t('knowledge.addEdit.subcategoryPlaceholder')}
              </Text>
              <ChevronDown size={16} color={C.mutedForeground} />
            </Pressable>
            {showSubcatDropdown && (
              <View className="border border-border rounded-xl overflow-hidden bg-card mt-1" style={{ borderCurve: 'continuous' }}>
                {subcategories.map((sub, idx) => (
                  <Pressable
                    key={sub}
                    onPress={() => { setSubcategory(sub); setShowSubcatDropdown(false); }}
                    className="flex-row items-center px-4 py-3 active:opacity-70"
                    style={{
                      borderTopWidth: idx > 0 ? 1 : 0,
                      borderTopColor: C.border,
                      backgroundColor: subcategory === sub ? `${color}10` : 'transparent',
                    }}
                  >
                    <Text
                      className="flex-1 text-sm font-medium"
                      style={{ color: subcategory === sub ? color : C.foreground }}
                    >
                      {sub}
                    </Text>
                    {subcategory === sub && (
                      <Text className="text-xs font-bold" style={{ color }}>✓</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* ── Description ───────────────────────────────── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('knowledge.addEdit.fieldDescription')}
            </Text>
            <DocumentEditor
              value={description}
              onChangeText={setDescription}
              title={t('knowledge.addEdit.descEditorTitle')}
              placeholder={t('knowledge.addEdit.descPlaceholder')}
              accessibilityLabel={t('knowledge.addEdit.descAccessibility')}
            />
          </View>

          {/* ── Tags ──────────────────────────────────────── */}
          <View className="gap-1.5">
            <View className="flex-row items-center gap-2">
              <Tag size={13} color={C.mutedForeground} />
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('knowledge.addEdit.fieldTags')}
              </Text>
            </View>
            <Input
              value={tags}
              onChangeText={setTags}
              placeholder={t('knowledge.addEdit.tagsPlaceholder')}
            />
            <Text className="text-xs text-muted-foreground">
              {t('knowledge.addEdit.tagsHint')}
            </Text>
          </View>

          {/* ── Attachments note ──────────────────────────── */}
          <View className="bg-secondary rounded-xl px-4 py-3">
            <Text className="text-xs text-muted-foreground leading-5">
              {t('knowledge.addEdit.attachmentNote')}
            </Text>
          </View>

          {/* ── Error ─────────────────────────────────────── */}
          {error.length > 0 && (
            <View className="flex-row items-center gap-2 bg-destructive/10 rounded-xl px-4 py-3">
              <AlertCircle size={14} color={C.destructive} />
              <Text className="text-sm text-destructive flex-1">{error}</Text>
            </View>
          )}

          {/* ── Save Button ───────────────────────────────── */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl py-4 items-center justify-center active:opacity-80 mt-2"
            style={{ backgroundColor: color, borderCurve: 'continuous' }}
          >
            <Text className="text-base font-bold text-white">
              {saving ? t('knowledge.addEdit.saving') : isEdit ? t('knowledge.addEdit.updateRecord') : t('knowledge.addEdit.saveRecord')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Unsaved dialog */}
      <AlertDialog open={showUnsaved} onOpenChange={setShowUnsaved}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('knowledge.addEdit.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledge.addEdit.unsavedDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowUnsaved(false)}>
              <Text>{t('knowledge.addEdit.keepEditing')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { isDirty.current = false; setShowUnsaved(false); router.back(); }}
              className="bg-destructive"
            >
              <Text className="text-destructive-foreground font-semibold">{t('knowledge.addEdit.discard')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
