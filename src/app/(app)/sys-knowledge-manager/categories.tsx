/**
 * System Knowledge Manager — Category Management
 *
 * View built-in categories + create / edit / delete custom categories.
 * Custom categories are stored in sys_knowledge_custom_categories.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Edit2, Trash2, FolderOpen, Lock } from 'lucide-react-native';
import {
  getCustomCategories, createCustomCategory, updateCustomCategory,
  deleteCustomCategory, type SysCustomCategory,
} from '@/lib/db/sysKnowledgeRepo';
import { isDevSessionActive } from '@/lib/devOptionsAuth';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledgeConstants';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const RED   = '#DC2626';
const MUTED = '#6B7280';

const PRESET_COLORS = [
  '#1D4ED8', '#0F766E', '#B45309', '#7C3AED', '#B91C1C',
  '#0891B2', '#15803D', '#D97706', '#6B7280', '#2563EB',
];

function SectionDivider() { return <View className="h-px bg-border mx-4" />; }

export default function SysKnowledgeCategories() {
  const insets = useSafeAreaInsets();
  const [custom, setCustom]       = useState<SysCustomCategory[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editItem, setEditItem]   = useState<SysCustomCategory | null>(null);
  const [deleteItem, setDeleteItem] = useState<SysCustomCategory | null>(null);
  const [formModal, setFormModal] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [formSubs, setFormSubs]   = useState('');
  const [saving, setSaving]       = useState(false);

  useFocusEffect(useCallback(() => {
    if (!isDevSessionActive()) { router.replace('/(app)/dev-options/pin-entry' as never); return; }
    (async () => {
      setLoading(true);
      try { setCustom(await getCustomCategories()); }
      finally { setLoading(false); }
    })();
  }, []));

  const openCreate = () => {
    setEditItem(null);
    setFormLabel(''); setFormColor(PRESET_COLORS[0]); setFormSubs('');
    setFormModal(true);
  };

  const openEdit = (cat: SysCustomCategory) => {
    setEditItem(cat);
    setFormLabel(cat.label);
    setFormColor(cat.color);
    setFormSubs(JSON.parse(cat.subcategories).join(', '));
    setFormModal(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim()) return;
    setSaving(true);
    try {
      const subs = formSubs.split(',').map(s => s.trim()).filter(Boolean);
      if (editItem) {
        await updateCustomCategory(editItem.id, formLabel, formColor, subs);
      } else {
        await createCustomCategory(formLabel, formColor, subs);
      }
      setCustom(await getCustomCategories());
      setFormModal(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await deleteCustomCategory(deleteItem.id);
    setDeleteItem(null);
    setCustom(await getCustomCategories());
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Categories"
        subtitle="Built-in + Custom Knowledge Categories"
        variant="navy"
        onBack={() => router.back()}
        rightActions={
          <Pressable
            onPress={openCreate}
            className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          >
            <Plus size={20} color="#fff" />
          </Pressable>
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color='#1E3A5F' /></View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <View className="gap-5">
              {/* Built-in categories */}
              <View>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
                  Built-in Categories ({KNOWLEDGE_CATEGORIES.length})
                </Text>
                <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
                  {KNOWLEDGE_CATEGORIES.map((cat, i) => {
                    const Icon = cat.icon;
                    return (
                      <View key={cat.id}>
                        <View className="flex-row items-center gap-3 px-4 py-3.5">
                          <View className="w-9 h-9 rounded-xl items-center justify-center"
                            style={{ backgroundColor: `${cat.color}15` }}>
                            <Icon size={18} color={cat.color} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-medium text-foreground">{cat.label}</Text>
                            <Text className="text-xs text-muted-foreground">{cat.subcategories.length} subcategories</Text>
                          </View>
                          <Lock size={14} color={MUTED} />
                        </View>
                        {i < KNOWLEDGE_CATEGORIES.length - 1 && <SectionDivider />}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Custom categories */}
              <View>
                <View className="flex-row items-center justify-between mb-2 px-1">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Custom Categories ({custom.length})
                  </Text>
                  <Pressable onPress={openCreate} className="active:opacity-60">
                    <Text className="text-xs font-semibold" style={{ color: '#1E3A5F' }}>+ Add New</Text>
                  </Pressable>
                </View>

                {custom.length === 0 ? (
                  <View className="bg-card border border-border rounded-2xl p-8 items-center gap-2" style={{ borderCurve: 'continuous' }}>
                    <FolderOpen size={28} color={MUTED} />
                    <Text className="text-sm text-muted-foreground text-center">No custom categories yet.</Text>
                    <Pressable onPress={openCreate} className="active:opacity-60 mt-2">
                      <Text className="text-sm font-semibold" style={{ color: '#1E3A5F' }}>Create your first category</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
                    {custom.map((cat, i) => {
                      const subs = JSON.parse(cat.subcategories) as string[];
                      return (
                        <View key={cat.id}>
                          <View className="flex-row items-center gap-3 px-4 py-3.5">
                            <View className="w-9 h-9 rounded-xl items-center justify-center"
                              style={{ backgroundColor: `${cat.color}15` }}>
                              <FolderOpen size={18} color={cat.color} />
                            </View>
                            <View className="flex-1">
                              <Text className="text-sm font-medium text-foreground">{cat.label}</Text>
                              <Text className="text-xs text-muted-foreground">{subs.length} subcategories</Text>
                            </View>
                            <Pressable onPress={() => openEdit(cat)} className="w-8 h-8 items-center justify-center active:opacity-60">
                              <Edit2 size={16} color='#1E3A5F' />
                            </Pressable>
                            <Pressable onPress={() => setDeleteItem(cat)} className="w-8 h-8 items-center justify-center active:opacity-60">
                              <Trash2 size={16} color={RED} />
                            </Pressable>
                          </View>
                          {i < custom.length - 1 && <SectionDivider />}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          }
        />
      )}

      {/* Create / Edit modal */}
      <Modal visible={formModal} transparent animationType="slide" onRequestClose={() => setFormModal(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setFormModal(false)}>
          <View className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl px-5 overflow-hidden" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="h-1 w-12 rounded-full bg-border self-center mt-3 mb-5" />
            <Text className="text-base font-semibold text-foreground mb-4">
              {editItem ? 'Edit Category' : 'New Category'}
            </Text>

            <Text className="text-xs font-semibold text-muted-foreground mb-1">Label *</Text>
            <Input
              value={formLabel}
              onChangeText={setFormLabel}
              placeholder="Category name…"
            />

            <Text className="text-xs font-semibold text-muted-foreground mb-2">Color</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {PRESET_COLORS.map(c => (
                <Pressable key={c} onPress={() => setFormColor(c)}
                  className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
                  style={{ backgroundColor: c, borderWidth: formColor === c ? 3 : 0, borderColor: '#fff' }}>
                  {formColor === c && <View className="w-3 h-3 rounded-full bg-white" />}
                </Pressable>
              ))}
            </View>

            <Text className="text-xs font-semibold text-muted-foreground mb-1">Subcategories (comma-separated)</Text>
            <Input
              value={formSubs}
              onChangeText={setFormSubs}
              placeholder="Sub A, Sub B, Sub C"
            />

            <View className="flex-row gap-3">
              <Pressable onPress={() => setFormModal(false)}
                className="flex-1 py-3 rounded-xl items-center border border-border active:opacity-60">
                <Text className="text-sm font-semibold text-muted-foreground">Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSave}
                className="flex-1 py-3 rounded-xl items-center active:opacity-70"
                style={{ backgroundColor: !formLabel.trim() ? '#9CA3AF' : '#1E3A5F' }}
                disabled={!formLabel.trim() || saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" />
                  : <Text className="text-sm font-semibold text-white">{editItem ? 'Update' : 'Create'}</Text>}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={o => { if (!o) setDeleteItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteItem?.label}" will be deleted. Articles in this category will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onPress={handleDelete} style={{ backgroundColor: RED }}>
              <Text className="text-white text-sm font-semibold">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
