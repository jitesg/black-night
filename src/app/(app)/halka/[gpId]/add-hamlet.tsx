import { useState, useCallback, useRef } from 'react';
import {
  BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, View, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Minus, Save } from 'lucide-react-native';
import { createHamlet, updateHamlet, getHamletById } from '@/lib/db/hamletRepo';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

// ─── Edit mode: single hamlet ────────────────────────────────────────────────
function EditHamletScreen({ gpId, editId }: { gpId: string; editId: string }) {
  const [form, setForm] = useState({ name: '', population: '', remarks: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      const hamlet = await getHamletById(editId);
      if (hamlet) {
        setForm({
          name: hamlet.name,
          population: hamlet.population ? String(hamlet.population) : '',
          remarks: hamlet.remarks ?? '',
        });
      }
      setLoading(false);
    })();
  }, [editId]));

  const update = (key: keyof typeof form) => (val: string) => {
    setForm((p) => ({ ...p, [key]: val }));
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      await updateHamlet(editId, {
        gp_id: gpId,
        name: form.name.trim(),
        population: form.population ? parseInt(form.population, 10) : undefined,
        remarks: form.remarks.trim() || undefined,
      });
      router.back();
    } catch {
      setError('Failed to update. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Edit Hamlet / Majra"
        showBack
      />
      <KeyboardAvoidingView behavior="padding" className="flex-1">

        <ScrollView
          contentContainerClassName="px-6 py-6 gap-5"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-card border border-border rounded-2xl p-4 gap-4" style={{ borderCurve: 'continuous' }}>
            <View className="gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name <Text className="text-destructive">*</Text>
              </Text>
              <Input value={form.name} onChangeText={update('name')} placeholder="Hamlet name" />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Population (Optional)
              </Text>
              <Input type="number" value={form.population} onChangeText={update('population')} placeholder="Approximate population" />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remarks</Text>
              <Input type="multiline" value={form.remarks} onChangeText={update('remarks')}
                placeholder="Optional remarks…" numberOfLines={2} />
            </View>
          </View>

          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}

          <Pressable
            onPress={handleSave} disabled={saving}
            className="bg-primary rounded-xl py-4 items-center flex-row justify-center gap-2 active:opacity-80"
            style={{ borderCurve: 'continuous' }}
          >
            <Save size={18} color="#fff" />
            <Text className="text-primary-foreground font-semibold text-base">
              {saving ? 'Saving…' : 'Update Hamlet'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Add mode: batch creation ────────────────────────────────────────────────
export default function AddHamletScreen() {
  const { gpId, editId } = useLocalSearchParams<{ gpId: string; editId?: string }>();

  // Delegate to edit mode when editId is present
  if (editId) {
    return <EditHamletScreen gpId={gpId!} editId={editId} />;
  }

  return <AddHamletBatchScreen gpId={gpId!} />;
}

function AddHamletBatchScreen({ gpId }: { gpId: string }) {
  const [count, setCount] = useState(1);
  const [hamlets, setHamlets] = useState([{ name: '', population: '', remarks: '' }]);
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

  const updateCount = (n: number) => {
    const clamped = Math.max(1, Math.min(20, n));
    setCount(clamped);
    setHamlets((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push({ name: '', population: '', remarks: '' });
      while (next.length > clamped) next.pop();
      return next;
    });
  };

  const updateField = (idx: number, key: string, val: string) => {
    isDirty.current = true;
    setHamlets((prev) => prev.map((h, i) => i === idx ? { ...h, [key]: val } : h));
    setError('');
  };

  const handleSave = async () => {
    const empty = hamlets.findIndex((h) => !h.name.trim());
    if (empty >= 0) { setError(`Hamlet ${empty + 1} name is required`); return; }
    setSaving(true);
    try {
      for (const h of hamlets) {
        await createHamlet({
          gp_id: gpId,
          name: h.name.trim(),
          population: h.population ? parseInt(h.population, 10) : undefined,
          remarks: h.remarks.trim() || undefined,
        });
      }
      router.back();
    } catch {
      setError('Failed to save hamlets. Please try again.');
      setSaving(false);
    }
  };

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

      <AppHeader title="Add Hamlets / Majre" onBack={handleBackPress} />
      <KeyboardAvoidingView behavior="padding" className="flex-1">

        <ScrollView
          contentContainerClassName="px-6 py-6 gap-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Count selector */}
          <View className="gap-2">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              How many Hamlets do you want to add?
            </Text>
            <View className="flex-row items-center gap-4">
              <Pressable
                onPress={() => updateCount(count - 1)}
                className="w-10 h-10 rounded-xl border border-border items-center justify-center active:opacity-60"
              >
                <Minus size={18} color="#111827" />
              </Pressable>
              <Input type="number" value={String(count)} onChangeText={(v) => updateCount(parseInt(v, 10) || 1)} />
              <Pressable
                onPress={() => updateCount(count + 1)}
                className="w-10 h-10 rounded-xl border border-border items-center justify-center active:opacity-60"
              >
                <Plus size={18} color="#111827" />
              </Pressable>
            </View>
          </View>

          {/* Hamlet forms */}
          {hamlets.map((h, idx) => (
            <View
              key={idx}
              className="bg-card border border-border rounded-2xl p-4 gap-4"
              style={{ borderCurve: 'continuous' }}
            >
              <Text className="text-sm font-semibold text-foreground">Hamlet {idx + 1}</Text>

              <View className="gap-1.5">
                <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Name <Text className="text-destructive">*</Text>
                </Text>
                <Input value={h.name} onChangeText={(v) => updateField(idx, 'name', v)} placeholder="Hamlet name" />
              </View>

              <View className="gap-1.5">
                <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Population (Optional)</Text>
                <Input type="number" value={h.population} onChangeText={(v) => updateField(idx, 'population', v)} placeholder="Approximate population" />
              </View>

              <View className="gap-1.5">
                <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remarks</Text>
                <Input type="multiline" value={h.remarks} onChangeText={(v) => updateField(idx, 'remarks', v)}
                  placeholder="Optional remarks…" numberOfLines={2} />
              </View>
            </View>
          ))}

          {error ? <Text className="text-destructive text-sm">{error}</Text> : null}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="bg-primary rounded-xl py-4 items-center flex-row justify-center gap-2 active:opacity-80"
            style={{ borderCurve: 'continuous' }}
          >
            <Save size={18} color="#fff" />
            <Text className="text-primary-foreground font-semibold text-base">
              {saving ? 'Saving…' : `Save ${count} Hamlet${count > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
