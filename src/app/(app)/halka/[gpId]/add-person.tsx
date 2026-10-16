import { useState, useCallback, useRef } from 'react';
import {
  BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Save, ChevronDown } from 'lucide-react-native';
import { createPerson, updatePerson, getPersonsByType } from '@/lib/db/personRepo';
import { PERSON_TYPES, IMPORTANT_PERSON_CATEGORIES } from '@/lib/db/schema';
import { Input } from '@/components/ui/input';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const PERSON_TYPE_LABELS: Record<string, string> = {
  [PERSON_TYPES.CURRENT_PRADHAN]: 'Current Gram Pradhan',
  [PERSON_TYPES.FORMER_PRADHAN]: 'Former Gram Pradhan',
  [PERSON_TYPES.BDC]: 'BDC Member',
  [PERSON_TYPES.IMPORTANT]: 'Important Person',
  [PERSON_TYPES.HISTORY_SHEETER]: 'History Sheeter (HS)',
};

function emptyForm() {
  return { name: '', address: '', mobile: '', alternate_mobile: '', remarks: '', category: '', designation: '' };
}

type FormState = ReturnType<typeof emptyForm>;

// ─── Single HS entry card ──────────────────────────────────────────────────
function HSFormCard({
  index, total, form, onChange,
}: {
  index: number;
  total: number;
  form: FormState;
  onChange: (key: keyof FormState) => (val: string) => void;
}) {
  return (
    <View
      className="bg-card border border-border rounded-2xl px-5 py-5 gap-4"
      style={{ borderCurve: 'continuous' }}
    >
      {total > 1 && (
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Entry {index + 1} of {total}
        </Text>
      )}

      {/* Name */}
      <View className="gap-1.5">
        <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Name <Text className="text-destructive">*</Text>
        </Text>
        <Input value={form.name} onChangeText={onChange('name')} placeholder="Full name" />
      </View>

      {/* Name With Full Address */}
      <View className="gap-1.5">
        <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name With Full Address</Text>
        <Input type="multiline" value={form.address} onChangeText={onChange('address')}
          placeholder="Name and complete residential address" numberOfLines={2} />
      </View>

      {/* HS Number */}
      <View className="gap-1.5">
        <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">History Sheet Number</Text>
        <Input value={form.category} onChangeText={onChange('category')} placeholder="e.g. HS/001/2024" />
      </View>

      {/* Hamlet */}
      <View className="gap-1.5">
        <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hamlet / Majra</Text>
        <Input value={form.designation} onChangeText={onChange('designation')} placeholder="Village / Hamlet name" />
      </View>

      {/* Mobile */}
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1.5">
          <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mobile</Text>
          <Input type="mobile" value={form.mobile} onChangeText={onChange('mobile')} placeholder="Primary" />
        </View>
        <View className="flex-1 gap-1.5">
          <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alt. Mobile</Text>
          <Input type="mobile" value={form.alternate_mobile} onChangeText={onChange('alternate_mobile')} placeholder="Alternate" />
        </View>
      </View>

      {/* Remarks */}
      <View className="gap-1.5">
        <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remarks</Text>
        <Input type="multiline" value={form.remarks} onChangeText={onChange('remarks')}
          placeholder="Optional remarks…" numberOfLines={2} />
      </View>
    </View>
  );
}

export default function AddPersonScreen() {
  const { gpId, type, editId, count: countParam } = useLocalSearchParams<{
    gpId: string; type: string; editId?: string; count?: string;
  }>();
  const isEdit = !!editId;
  const personType = type ?? PERSON_TYPES.IMPORTANT;
  const isHS = personType === PERSON_TYPES.HISTORY_SHEETER;
  const batchCount = isHS && !isEdit ? Math.min(Math.max(parseInt(countParam ?? '1', 10) || 1, 1), 10) : 1;

  // Batch forms (HS multi-entry) or single form
  const [forms, setForms] = useState<FormState[]>(
    Array.from({ length: batchCount }, emptyForm)
  );
  const [showCategories, setShowCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Unsaved-changes protection ───────────────────────────────────────────
  const isDirty = useRef(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const handleBackPress = useCallback(() => {
    if (isDirty.current) { setShowDiscardDialog(true); } else { router.back(); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isDirty.current) { setShowDiscardDialog(true); return true; }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  // Single-form helpers (non-HS / edit mode)
  const form = forms[0];
  const updateSingle = (key: keyof FormState) => (val: string) => {
    isDirty.current = true;
    setForms((prev) => [{ ...prev[0], [key]: val }, ...prev.slice(1)]);
    setError('');
  };

  // Batch-form helpers (HS add mode)
  const updateBatch = (index: number) => (key: keyof FormState) => (val: string) => {
    isDirty.current = true;
    setForms((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: val } : f)));
    setError('');
  };

  useFocusEffect(
    useCallback(() => {
      if (isEdit && editId) {
        (async () => {
          const list = await getPersonsByType(gpId!, personType);
          const found = list.find((p) => p.id === editId);
          if (found) {
            setForms([{
              name: found.name, address: found.address ?? '',
              mobile: found.mobile ?? '', alternate_mobile: found.alternate_mobile ?? '',
              remarks: found.remarks ?? '', category: found.category ?? '',
              designation: found.designation ?? '',
            }]);
          }
        })();
      }
    }, [isEdit, editId, gpId, personType])
  );

  const handleSave = async () => {
    // Validate: at least name required in every entry
    const invalid = forms.find((f) => !f.name.trim());
    if (invalid) { setError('Name is required for every entry'); return; }
    setSaving(true);
    try {
      if (isEdit && editId) {
        await updatePerson(editId, {
          name: form.name.trim(),
          address: form.address || undefined,
          mobile: form.mobile || undefined,
          alternate_mobile: form.alternate_mobile || undefined,
          remarks: form.remarks || undefined,
          category: form.category || undefined,
          designation: isHS ? (form.designation || undefined) : undefined,
        });
      } else {
        for (const f of forms) {
          await createPerson({
            gp_id: gpId!, person_type: personType,
            name: f.name.trim(),
            address: f.address || undefined,
            mobile: f.mobile || undefined,
            alternate_mobile: f.alternate_mobile || undefined,
            remarks: f.remarks || undefined,
            category: isHS ? (f.category || undefined) : (personType === PERSON_TYPES.IMPORTANT ? f.category || undefined : undefined),
            designation: isHS ? (f.designation || undefined) : undefined,
          });
        }
      }
      router.back();
    } catch {
      setError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const title = PERSON_TYPE_LABELS[personType] ?? 'Person';

  // ── History Sheeter batch form ────────────────────────────────────────────
  if (isHS) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader
          title={`${isEdit ? 'Edit' : 'Add'} ${title}`}
          countLabel={!isEdit && batchCount > 1 ? `${batchCount} entries` : undefined}
        />
        <KeyboardAvoidingView behavior="padding" className="flex-1">

          <ScrollView
            contentContainerClassName="px-6 py-5 gap-4 pb-10"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {forms.map((f, i) => (
              <HSFormCard
                key={i}
                index={i}
                total={forms.length}
                form={f}
                onChange={updateBatch(i)}
              />
            ))}

            {error ? <Text className="text-destructive text-sm">{error}</Text> : null}

            <Pressable
              onPress={handleSave} disabled={saving}
              className="bg-primary rounded-xl py-4 items-center flex-row justify-center gap-2 active:opacity-80"
              style={{ borderCurve: 'continuous' }}
            >
              <Save size={18} color="#fff" />
              <Text className="text-primary-foreground font-semibold text-base">
                {saving ? 'Saving…' : isEdit ? `Update ${title}` : `Save ${batchCount > 1 ? `${batchCount} Entries` : title}`}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Standard single-entry form (all other person types) ──────────────────
  return (
    <View className="flex-1 bg-background">
      {/* ── Discard-changes confirmation ──────────────────────────────────── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Unsaved changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onPress={() => { setShowDiscardDialog(false); router.back(); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppHeader title={`${isEdit ? 'Edit' : 'Add'} Person`} onBack={handleBackPress} />
      <KeyboardAvoidingView behavior="padding" className="flex-1">

        <ScrollView
          contentContainerClassName="px-6 py-6 gap-5"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <View className="gap-1.5">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Name <Text className="text-destructive">*</Text>
            </Text>
            <Input value={form.name} onChangeText={updateSingle('name')} placeholder="Full name" />
          </View>

          {/* Category (only for important persons) */}
          {personType === PERSON_TYPES.IMPORTANT && (
            <View className="gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</Text>
              <Pressable
                onPress={() => setShowCategories(!showCategories)}
                className="border border-border rounded-xl px-4 py-3 flex-row items-center justify-between bg-card active:opacity-70"
                style={{ borderCurve: 'continuous' }}
              >
                <Text className={form.category ? 'text-base text-foreground' : 'text-base text-muted-foreground'}>
                  {form.category || 'Select category'}
                </Text>
                <ChevronDown size={16} color="#9CA3AF" />
              </Pressable>
              {showCategories && (
                <View className="border border-border rounded-xl bg-card overflow-hidden" style={{ borderCurve: 'continuous' }}>
                  {IMPORTANT_PERSON_CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => { updateSingle('category')(cat); setShowCategories(false); }}
                      className="px-4 py-3 border-b border-border last:border-b-0 active:bg-secondary"
                    >
                      <Text className={`text-base ${form.category === cat ? 'text-primary font-medium' : 'text-foreground'}`}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Address */}
          <View className="gap-1.5">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Address</Text>
            <Input type="multiline" value={form.address} onChangeText={updateSingle('address')}
              placeholder="House/Village/Town" numberOfLines={2} />
          </View>

          {/* Mobile */}
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mobile</Text>
              <Input type="mobile" value={form.mobile} onChangeText={updateSingle('mobile')} placeholder="Primary number" />
            </View>
            <View className="flex-1 gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alternate Mobile</Text>
              <Input type="mobile" value={form.alternate_mobile} onChangeText={updateSingle('alternate_mobile')} placeholder="Alt. number" />
            </View>
          </View>

          {/* Remarks */}
          <View className="gap-1.5">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remarks</Text>
            <Input type="multiline" value={form.remarks} onChangeText={updateSingle('remarks')}
              placeholder="Optional remarks…" numberOfLines={2} />
          </View>

          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}

          <Pressable
            onPress={handleSave} disabled={saving}
            className="bg-primary rounded-xl py-4 items-center flex-row justify-center gap-2 active:opacity-80 mt-2"
            style={{ borderCurve: 'continuous' }}
          >
            <Save size={18} color="#fff" />
            <Text className="text-primary-foreground font-semibold text-base">
              {saving ? 'Saving…' : `Save ${title}`}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

