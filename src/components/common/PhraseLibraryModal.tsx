import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BookMarked,
  Check,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useTranslation } from 'react-i18next';
import {
  type Phrase,
  getAllPhrases,
  createPhrase,
  updatePhrase,
  deletePhrase,
  incrementUsage,
  seedDefaultPhrasesIfEmpty,
} from '@/lib/db/phraseLibraryRepo';

export interface PhraseLibraryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (phraseText: string, phraseId?: string) => void;
}

export function PhraseLibraryModal({
  visible,
  onClose,
  onSelect,
}: PhraseLibraryModalProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = isDark ? THEME.dark : THEME.light;

  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Form states for Add / Edit
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newText, setNewText] = useState('');
  const [editingPhrase, setEditingPhrase] = useState<Phrase | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // Delete confirmation state
  const [phraseToDelete, setPhraseToDelete] = useState<Phrase | null>(null);

  // Load phrases
  const loadPhrases = useCallback(async () => {
    setLoading(true);
    try {
      await seedDefaultPhrasesIfEmpty();
      const list = await getAllPhrases();
      setPhrases(list);
    } catch (e) {
      console.warn('[PhraseLibraryModal] Error loading phrases:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadPhrases();
      setIsAdding(false);
      setEditingPhrase(null);
      setPhraseToDelete(null);
      setSearchQuery('');
    }
  }, [visible, loadPhrases]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of phrases) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  }, [phrases]);

  // Filtered phrases
  const filteredPhrases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return phrases.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        p.phrase_text.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [phrases, searchQuery, selectedCategory]);

  // Grouped by category
  const groupedPhrases = useMemo(() => {
    const map = new Map<string, Phrase[]>();
    for (const p of filteredPhrases) {
      const cat = p.category || 'सामान्य वाक्यांश';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries());
  }, [filteredPhrases]);

  // Handlers
  const handleSelectPhrase = async (phrase: Phrase) => {
    // Non-blocking usage increment
    incrementUsage(phrase.id).catch(() => {});
    onSelect(phrase.phrase_text, phrase.id);
    onClose();
  };

  const handleSaveNew = async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const cat = newCategory.trim() || 'सामान्य वाक्यांश';
    try {
      await createPhrase(cat, trimmed);
      setNewText('');
      setNewCategory('');
      setIsAdding(false);
      await loadPhrases();
    } catch (e) {
      console.warn('[PhraseLibraryModal] Error creating phrase:', e);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPhrase) return;
    const trimmed = editText.trim();
    if (!trimmed) return;
    const cat = editCategory.trim() || editingPhrase.category;
    try {
      await updatePhrase(editingPhrase.id, trimmed, cat);
      setEditingPhrase(null);
      await loadPhrases();
    } catch (e) {
      console.warn('[PhraseLibraryModal] Error updating phrase:', e);
    }
  };

  const handleDeleteConfirm = async (id: string) => {
    try {
      await deletePhrase(id);
      setPhraseToDelete(null);
      await loadPhrases();
    } catch (e) {
      console.warn('[PhraseLibraryModal] Error deleting phrase:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-col max-h-[88%] bg-card border-t border-border rounded-t-3xl overflow-hidden"
          style={{ borderCurve: 'continuous' }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <View className="flex-row items-center gap-2.5 flex-1 mr-2">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                <BookMarked size={16} color={palette.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                  {t('editor.phrasesTitle')}
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {t('editor.phrasesSubtitle')}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-secondary items-center justify-center active:opacity-60"
              accessibilityLabel={t('common.close')}
            >
              <X size={16} color={palette.mutedForeground} />
            </Pressable>
          </View>

          {/* Search bar */}
          <View className="px-5 pt-3 pb-2">
            <View className="flex-row items-center px-3 py-2 bg-secondary/60 border border-border rounded-xl">
              <Search size={15} color={palette.mutedForeground} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('editor.searchPhrasesPlaceholder')}
                placeholderTextColor={palette.mutedForeground}
                className="flex-1 ml-2 text-sm text-foreground py-0"
                style={[
                  Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as never) : {},
                ]}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} className="p-1">
                  <X size={14} color={palette.mutedForeground} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Category Filter Chips */}
          <View className="px-5 py-1">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
            >
              <Pressable
                onPress={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-full border ${
                  selectedCategory === 'all'
                    ? 'bg-primary border-primary'
                    : 'bg-secondary/40 border-border'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedCategory === 'all'
                      ? 'text-primary-foreground font-semibold'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('editor.allWithCount', { count: phrases.length })}
                </Text>
              </Pressable>

              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const count = phrases.filter((p) => p.category === cat).length;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full border ${
                      isSelected
                        ? 'bg-primary border-primary'
                        : 'bg-secondary/40 border-border'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        isSelected
                          ? 'text-primary-foreground font-semibold'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {cat} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Phrases Scroll Area */}
          <ScrollView
            className="flex-1 px-5 pt-2"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Delete confirmation banner */}
            {phraseToDelete && (
              <View className="p-3 mb-3 bg-destructive/10 border border-destructive/20 rounded-xl flex-row items-center justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-xs font-semibold text-destructive">
                    {t('editor.deletePhraseConfirm')}
                  </Text>
                  <Text className="text-xs text-foreground/80 mt-0.5" numberOfLines={2}>
                    &ldquo;{phraseToDelete.phrase_text}&rdquo;
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => setPhraseToDelete(null)}
                    className="px-2.5 py-1 rounded-lg bg-secondary border border-border"
                  >
                    <Text className="text-xs font-medium text-foreground">{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteConfirm(phraseToDelete.id)}
                    className="px-2.5 py-1 rounded-lg bg-destructive"
                  >
                    <Text className="text-xs font-semibold text-white">{t('common.delete')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Inline Edit Form */}
            {editingPhrase && (
              <View className="p-3.5 mb-4 bg-primary/5 border border-primary/20 rounded-2xl gap-2.5">
                <Text className="text-xs font-bold text-primary">
                  {t('editor.editPhraseTitle')}
                </Text>

                <View>
                  <Text className="text-[11px] text-muted-foreground mb-1">{t('editor.categoryLabel')}</Text>
                  <TextInput
                    value={editCategory}
                    onChangeText={setEditCategory}
                    placeholder={t('editor.categoryPlaceholder')}
                    placeholderTextColor={palette.mutedForeground}
                    className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground"
                    style={[
                      Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as never) : {},
                    ]}
                  />
                </View>

                <View>
                  <Text className="text-[11px] text-muted-foreground mb-1">{t('editor.phraseLabel')}</Text>
                  <TextInput
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                    textAlignVertical="top"
                    className="px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground min-h-[60px]"
                    style={[
                      Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as never) : {},
                    ]}
                  />
                </View>

                <View className="flex-row justify-end gap-2 mt-1">
                  <Pressable
                    onPress={() => setEditingPhrase(null)}
                    className="px-3 py-1.5 rounded-lg bg-secondary border border-border"
                  >
                    <Text className="text-xs font-medium text-foreground">{t('editor.cancelWithLabel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveEdit}
                    className="px-3.5 py-1.5 rounded-lg bg-primary"
                  >
                    <Text className="text-xs font-semibold text-primary-foreground">{t('editor.saveWithLabel')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Empty state */}
            {groupedPhrases.length === 0 && !loading && (
              <View className="py-8 items-center justify-center">
                <Text className="text-sm font-medium text-muted-foreground">
                  {t('editor.noPhrasesFound')}
                </Text>
                {searchQuery ? (
                  <Text className="text-xs text-muted-foreground mt-1">
                    {t('editor.searchPhrasesHint')}
                  </Text>
                ) : null}
              </View>
            )}

            {/* Category Groups */}
            {groupedPhrases.map(([category, items]) => (
              <View key={category} className="mb-4">
                {/* Section Header */}
                <View className="flex-row items-center justify-between pb-1.5 mb-1.5 border-b border-border/60">
                  <Text className="text-xs font-bold text-foreground tracking-wide">
                    {category}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {t('editor.phrasesCount', { count: items.length })}
                  </Text>
                </View>

                {/* Phrase Rows */}
                <View className="gap-2">
                  {items.map((p) => (
                    <View
                      key={p.id}
                      className="flex-row items-start justify-between p-3 rounded-xl bg-card border border-border active:border-primary/50"
                      style={{ borderCurve: 'continuous' }}
                    >
                      <Pressable
                        onPress={() => handleSelectPhrase(p)}
                        className="flex-1 mr-2"
                        accessibilityLabel={t('editor.insertPhraseAria', { text: p.phrase_text })}
                      >
                        <Text className="text-sm text-foreground leading-5 font-normal">
                          {p.phrase_text}
                        </Text>
                        {p.usage_count > 0 && (
                          <Text className="text-[10px] text-muted-foreground mt-1 font-medium">
                            {t('editor.usageCount', { count: p.usage_count })}
                          </Text>
                        )}
                      </Pressable>

                      {/* Action buttons */}
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Pressable
                          onPress={() => {
                            setEditingPhrase(p);
                            setEditText(p.phrase_text);
                            setEditCategory(p.category);
                          }}
                          className="w-7 h-7 rounded-lg bg-secondary/80 items-center justify-center active:opacity-60"
                          accessibilityLabel={t('editor.editPhraseAria')}
                        >
                          <Pencil size={12} color={palette.mutedForeground} />
                        </Pressable>
                        <Pressable
                          onPress={() => setPhraseToDelete(p)}
                          className="w-7 h-7 rounded-lg bg-secondary/80 items-center justify-center active:opacity-60"
                          accessibilityLabel={t('editor.deletePhraseAria')}
                        >
                          <Trash2 size={12} color={palette.destructive} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* Add Phrase Form or Trigger */}
            <View className="mt-2 pt-2 border-t border-border">
              {isAdding ? (
                <View className="p-3.5 bg-secondary/40 border border-border rounded-2xl gap-2.5">
                  <Text className="text-xs font-bold text-foreground">
                    {t('editor.addPhraseTitle')}
                  </Text>

                  {/* Category Selection / Input */}
                  <View>
                    <Text className="text-[11px] text-muted-foreground mb-1">{t('editor.selectOrTypeCategory')}</Text>
                    <View className="flex-row flex-wrap gap-1.5 mb-2">
                      {categories.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => setNewCategory(c)}
                          className={`px-2.5 py-1 rounded-md border ${
                            newCategory === c
                              ? 'bg-primary/20 border-primary'
                              : 'bg-card border-border'
                          }`}
                        >
                          <Text
                            className={`text-[11px] ${
                              newCategory === c ? 'text-primary font-semibold' : 'text-muted-foreground'
                            }`}
                          >
                            {c}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      value={newCategory}
                      onChangeText={setNewCategory}
                      placeholder={t('editor.orTypeNewCategory')}
                      placeholderTextColor={palette.mutedForeground}
                      className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground"
                      style={[
                        Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as never) : {},
                      ]}
                    />
                  </View>

                  {/* Phrase Text */}
                  <View>
                    <Text className="text-[11px] text-muted-foreground mb-1">{t('editor.phraseTextLabel')}</Text>
                    <TextInput
                      value={newText}
                      onChangeText={setNewText}
                      placeholder={t('editor.enterPhrasePlaceholder')}
                      placeholderTextColor={palette.mutedForeground}
                      multiline
                      textAlignVertical="top"
                      className="px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground min-h-[64px]"
                      style={[
                        Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as never) : {},
                      ]}
                    />
                  </View>

                  {/* Form Actions */}
                  <View className="flex-row justify-end gap-2 mt-1">
                    <Pressable
                      onPress={() => {
                        setIsAdding(false);
                        setNewText('');
                        setNewCategory('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-secondary border border-border"
                    >
                      <Text className="text-xs font-medium text-foreground">{t('editor.cancelWithLabel')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSaveNew}
                      disabled={!newText.trim()}
                      className={`px-3.5 py-1.5 rounded-lg ${
                        newText.trim() ? 'bg-primary' : 'bg-muted opacity-50'
                      }`}
                    >
                      <Text className="text-xs font-semibold text-primary-foreground">
                        {t('editor.addPhraseWithLabel')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setIsAdding(true)}
                  className="flex-row items-center justify-center p-3 rounded-xl bg-secondary/50 border border-dashed border-border active:opacity-70 gap-2"
                >
                  <Plus size={15} color={palette.primary} />
                  <Text className="text-xs font-semibold text-primary">
                    {t('editor.addPhraseBtn')}
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
