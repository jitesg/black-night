import { useCallback, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AlertCircle, ChevronDown, Plus, Save, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import {
  createChecklistItemM2M, updateChecklistItemM2M,
  getAllChecklistItems, getUniqueCrimeTypes, getSubTypesForCrimeType,
  type ChecklistItemM2M, type SubtypePair,
} from '@/lib/db/checklistRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';

const COLOR = '#0891B2';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function FieldLabel({ label }: { label: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
      {label}
    </Text>
  );
}

// Checkbox row shared by both Crime Type and Sub Type lists
function CheckRow({
  label, checked, onToggle, isLast,
}: { label: string; checked: boolean; onToggle: () => void; isLast: boolean }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  return (
    <Pressable
      onPress={onToggle}
      className={`flex-row items-center gap-3 px-4 py-3 active:bg-secondary ${isLast ? '' : 'border-b border-border'}`}
    >
      <View
        className="w-5 h-5 rounded items-center justify-center"
        style={{
          backgroundColor: checked ? COLOR : C.card,
          borderWidth: 1.5,
          borderColor: checked ? COLOR : C.border,
        }}
      >
        {checked && (
          <Text className="text-white font-bold" style={{ fontSize: 11, lineHeight: 14 }}>✓</Text>
        )}
      </View>
      <Text
        className="flex-1 text-sm"
        style={{ color: checked ? COLOR : C.foreground, fontWeight: checked ? '700' : '400' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Sub Type picker card for one selected Crime Type ─────────────────────────
function SubTypePicker({
  crimeType,
  selectedSubs,
  onToggleSub,
  onAddNewSub,
}: {
  crimeType: string;
  selectedSubs: string[];
  onToggleSub: (ct: string, sub: string) => void;
  onAddNewSub: (ct: string, sub: string) => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const [subTypes, setSubTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [newSub, setNewSub] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      try { setSubTypes(await getSubTypesForCrimeType(crimeType)); }
      finally { setLoading(false); }
    })();
  }, [crimeType]));

  const commitNewSub = () => {
    const v = newSub.trim();
    if (!v || /[,:|]/.test(v)) return;
    onAddNewSub(crimeType, v);
    if (!subTypes.includes(v)) setSubTypes((prev) => [...prev, v].sort());
    setNewSub('');
  };

  return (
    <View className="border border-border rounded-2xl overflow-hidden mt-2" style={{ borderCurve: 'continuous' }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center justify-between px-4 py-3 bg-secondary active:opacity-70"
      >
        <View className="flex-row items-center gap-2 flex-1" style={{ minWidth: 0 }}>
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR }} />
          <Text className="text-xs font-bold uppercase tracking-wider flex-1" style={{ color: COLOR }} numberOfLines={1}>
            {crimeType}
          </Text>
          {selectedSubs.length > 0 && (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: COLOR }}>
              <Text className="text-white font-bold" style={{ fontSize: 10 }}>{selectedSubs.length}</Text>
            </View>
          )}
        </View>
        <ChevronDown size={15} color={C.mutedForeground} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>

      {open && (
        <View className="bg-card">
          {loading ? (
            <View className="py-4 items-center"><ActivityIndicator size="small" color={COLOR} /></View>
          ) : subTypes.length === 0 ? (
            <View className="px-4 py-3">
              <Text className="text-xs text-muted-foreground">
                {t('knowledge.checklist.noSubTypesYet')}
              </Text>
            </View>
          ) : (
            subTypes.map((sub, idx) => (
              <CheckRow
                key={sub}
                label={sub}
                checked={selectedSubs.includes(sub)}
                onToggle={() => onToggleSub(crimeType, sub)}
                isLast={idx === subTypes.length - 1}
              />
            ))
          )}

          {/* Inline "add new sub type" row */}
          <View className="flex-row items-center gap-2 px-3 py-2 border-t border-border/50">
            <TextInput
              value={newSub}
              onChangeText={(v) => { if (!/[,:|]/.test(v)) setNewSub(v); }}
              placeholder={t('knowledge.checklist.newSubTypePlaceholder')}
              placeholderTextColor={C.mutedForeground}
              className="flex-1 text-sm text-foreground bg-secondary rounded-lg px-3 py-2"
              style={{ ...(Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } as never : {}) }}
              returnKeyType="done"
              onSubmitEditing={commitNewSub}
            />
            <Pressable
              onPress={commitNewSub}
              className="w-8 h-8 rounded-lg items-center justify-center active:opacity-70"
              style={{ backgroundColor: `${COLOR}20` }}
            >
              <Plus size={14} color={COLOR} />
            </Pressable>
          </View>

          {/* Selected chips */}
          {selectedSubs.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5 px-4 pt-1 pb-3 border-t border-border/50">
              {selectedSubs.map((sub) => (
                <Pressable
                  key={sub}
                  onPress={() => onToggleSub(crimeType, sub)}
                  className="flex-row items-center gap-1 rounded-full px-3 py-1 active:opacity-70"
                  style={{ backgroundColor: `${COLOR}15`, borderWidth: 1, borderColor: `${COLOR}40` }}
                >
                  <Text className="text-xs font-medium" style={{ color: COLOR }}>{sub}</Text>
                  <Text className="text-xs font-bold ml-0.5" style={{ color: COLOR }}>×</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Nested Crime Type + Sub Type multi-select ────────────────────────────────
function NestedSubTypeSelect({
  selections,
  onToggleCrimeType,
  onToggleSubType,
  onAddNewCrimeType,
  onAddNewSubType,
}: {
  selections: Record<string, string[]>;
  onToggleCrimeType: (ct: string) => void;
  onToggleSubType: (ct: string, sub: string) => void;
  onAddNewCrimeType: (ct: string) => void;
  onAddNewSubType: (ct: string, sub: string) => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const [crimeTypes, setCrimeTypes] = useState<string[]>([]);
  const [ctOpen, setCtOpen] = useState(false);
  const [newCt, setNewCt] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => { setCrimeTypes(await getUniqueCrimeTypes()); })();
  }, []));

  const selectedCrimeTypes = Object.keys(selections);

  const commitNewCt = () => {
    const v = newCt.trim();
    if (!v || /[,:|]/.test(v)) return;
    onAddNewCrimeType(v);
    if (!crimeTypes.includes(v)) setCrimeTypes((prev) => [...prev, v].sort());
    setNewCt('');
  };

  return (
    <View className="gap-1">
      <FieldLabel label={t('knowledge.checklist.subtypesLabel')} />

      {/* Crime Type trigger */}
      <Pressable
        onPress={() => setCtOpen((o) => !o)}
        className="flex-row items-center justify-between bg-secondary rounded-xl px-4 py-3 active:opacity-70"
      >
        <Text className={`text-sm ${selectedCrimeTypes.length > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
          {selectedCrimeTypes.length > 0
            ? t('knowledge.checklist.crimeTypeSelected', { count: selectedCrimeTypes.length })
            : t('knowledge.checklist.crimeTypePlaceholder')}
        </Text>
        <ChevronDown size={16} color={C.mutedForeground} />
      </Pressable>

      {/* Crime Type chips */}
      {selectedCrimeTypes.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 pt-0.5">
          {selectedCrimeTypes.map((ct) => (
            <Pressable
              key={ct}
              onPress={() => onToggleCrimeType(ct)}
              className="flex-row items-center gap-1 rounded-full px-3 py-1 active:opacity-70"
              style={{ backgroundColor: `${COLOR}15`, borderWidth: 1, borderColor: `${COLOR}40` }}
            >
              <Text className="text-xs font-medium" style={{ color: COLOR }}>{ct}</Text>
              <Text className="text-xs font-bold ml-0.5" style={{ color: COLOR }}>×</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Crime Type dropdown */}
      {ctOpen && (
        <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {crimeTypes.length === 0 ? (
            <View className="px-4 py-3">
              <Text className="text-xs text-muted-foreground">{t('knowledge.checklist.noCrimeTypesYet')}</Text>
            </View>
          ) : (
            crimeTypes.map((ct, idx) => (
              <CheckRow
                key={ct}
                label={ct}
                checked={ct in selections}
                onToggle={() => onToggleCrimeType(ct)}
                isLast={idx === crimeTypes.length - 1}
              />
            ))
          )}
          {/* Inline new Crime Type */}
          <View className="flex-row items-center gap-2 px-3 py-2 border-t border-border/50">
            <TextInput
              value={newCt}
              onChangeText={(v) => { if (!/[,:|]/.test(v)) setNewCt(v); }}
              placeholder={t('knowledge.checklist.newCrimeTypePlaceholder')}
              placeholderTextColor={C.mutedForeground}
              className="flex-1 text-sm text-foreground bg-secondary rounded-lg px-3 py-2"
              style={{ ...(Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } as never : {}) }}
              returnKeyType="done"
              onSubmitEditing={commitNewCt}
            />
            <Pressable
              onPress={commitNewCt}
              className="w-8 h-8 rounded-lg items-center justify-center active:opacity-70"
              style={{ backgroundColor: `${COLOR}20` }}
            >
              <Plus size={14} color={COLOR} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => setCtOpen(false)}
            className="items-center py-3 border-t border-border bg-secondary active:opacity-70"
          >
            <Text className="text-sm font-bold" style={{ color: COLOR }}>{t('knowledge.checklist.done')}</Text>
          </Pressable>
        </View>
      )}

      {/* Sub Type pickers per selected Crime Type */}
      {selectedCrimeTypes.map((ct) => (
        <SubTypePicker
          key={ct}
          crimeType={ct}
          selectedSubs={selections[ct] ?? []}
          onToggleSub={onToggleSubType}
          onAddNewSub={onAddNewSubType}
        />
      ))}
    </View>
  );
}

// ─── Add / Edit screen ────────────────────────────────────────────────────────
export default function AddChecklistScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = Boolean(editId);

  const [name, setName]   = useState('');
  const [brief, setBrief] = useState('');
  // selections: key = Crime Type, value = array of selected Sub Types
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const [error, setSaveError]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const isDirty = useRef(false);

  // Load existing item for edit
  const hasLoadedRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!editId || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    (async () => {
      const all = await getAllChecklistItems();
      const item = all.find((i) => i.id === editId) as ChecklistItemM2M | undefined;
      if (!item) return;
      setName(item.task_name);
      setBrief(item.brief_description);
      // Rebuild selections from pairs
      const sel: Record<string, string[]> = {};
      for (const p of item.pairs) {
        if (!sel[p.crimeType]) sel[p.crimeType] = [];
        if (p.subType && !sel[p.crimeType].includes(p.subType)) {
          sel[p.crimeType].push(p.subType);
        }
      }
      setSelections(sel);
      isDirty.current = false;
    })();
  }, [editId]));

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isDirty.current) { setShowUnsaved(true); return true; }
      return false;
    });
    return () => sub.remove();
  }, []));

  const toggleCrimeType = (ct: string) => {
    isDirty.current = true;
    setSelections((prev) => {
      if (ct in prev) { const n = { ...prev }; delete n[ct]; return n; }
      return { ...prev, [ct]: [] };
    });
  };
  const toggleSubType = (ct: string, sub: string) => {
    isDirty.current = true;
    setSelections((prev) => {
      const cur = prev[ct] ?? [];
      return { ...prev, [ct]: cur.includes(sub) ? cur.filter((s) => s !== sub) : [...cur, sub] };
    });
  };
  const addNewCrimeType = (ct: string) => {
    isDirty.current = true;
    setSelections((prev) => (ct in prev ? prev : { ...prev, [ct]: [] }));
  };
  const addNewSubType = (ct: string, sub: string) => {
    isDirty.current = true;
    setSelections((prev) => {
      const cur = prev[ct] ?? [];
      return { ...prev, [ct]: cur.includes(sub) ? cur : [...cur, sub] };
    });
  };

  const handleSave = async () => {
    setSaveError('');
    if (!name.trim()) { setSaveError(t('knowledge.checklist.errorNameRequired')); return; }
    const cts = Object.keys(selections);
    if (cts.length === 0) { setSaveError(t('knowledge.checklist.errorNoCrimeType')); return; }
    const missingSubType = cts.find((ct) => (selections[ct]?.length ?? 0) === 0);
    if (missingSubType) { setSaveError(t('knowledge.checklist.errorNoSubType', { crimeType: missingSubType })); return; }

    // Flatten selections into SubtypePair[]
    const pairs: SubtypePair[] = cts.flatMap((ct) =>
      (selections[ct] ?? []).map((sub) => ({ crimeType: ct, subType: sub }))
    );

    setSaving(true);
    try {
      if (isEdit && editId) {
        await updateChecklistItemM2M(editId, name.trim(), brief.trim(), pairs);
      } else {
        await createChecklistItemM2M(name.trim(), brief.trim(), pairs);
      }
      isDirty.current = false;
      router.back();
    } catch (e) {
      logger.error('[AddChecklistScreen] save failed:', e);
      const msg = e instanceof Error ? e.message : String(e);
      setSaveError(t('knowledge.checklist.errorSaveFailed', { msg }));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty.current) setShowUnsaved(true); else router.back();
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={isEdit ? t('knowledge.checklist.editTitle') : t('knowledge.checklist.addTitle')}
        subtitle={t('knowledge.checklist.addSubtitle')}
        onBack={handleBack}
        rightActions={
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl active:opacity-70"
            style={{ backgroundColor: COLOR, borderCurve: 'continuous' }}
          >
            <Save size={15} color="#fff" />
            <Text className="text-sm font-bold text-white">{saving ? t('knowledge.checklist.saving') : t('knowledge.checklist.save')}</Text>
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
          <Input
            label={t('knowledge.checklist.fieldName')}
            placeholder={t('knowledge.checklist.namePlaceholder')}
            value={name}
            onChangeText={(v) => { setName(v); isDirty.current = true; setSaveError(''); }}
          />

          <Input
            type="multiline"
            label={t('knowledge.checklist.fieldBrief')}
            placeholder={t('knowledge.checklist.briefPlaceholder')}
            value={brief}
            onChangeText={(v) => { setBrief(v); isDirty.current = true; }}
          />

          <NestedSubTypeSelect
            selections={selections}
            onToggleCrimeType={toggleCrimeType}
            onToggleSubType={toggleSubType}
            onAddNewCrimeType={addNewCrimeType}
            onAddNewSubType={addNewSubType}
          />

          {error.length > 0 && (
            <View className="flex-row items-center gap-2 bg-destructive/10 rounded-xl px-4 py-3">
              <AlertCircle size={14} color={C.destructive} />
              <Text className="text-sm text-destructive flex-1">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl py-4 items-center justify-center active:opacity-80 mt-2"
            style={{ backgroundColor: COLOR, borderCurve: 'continuous' }}
          >
            <Text className="text-base font-bold text-white">
              {saving ? t('knowledge.checklist.saving') : isEdit ? t('knowledge.checklist.updateItem') : t('knowledge.checklist.saveItem')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <AlertDialog open={showUnsaved} onOpenChange={setShowUnsaved}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('knowledge.checklist.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('knowledge.checklist.unsavedDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowUnsaved(false)}>
              <Text>{t('knowledge.checklist.keepEditing')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { isDirty.current = false; setShowUnsaved(false); router.back(); }}
              className="bg-destructive"
            >
              <Text className="text-destructive-foreground font-semibold">{t('knowledge.checklist.discard')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
