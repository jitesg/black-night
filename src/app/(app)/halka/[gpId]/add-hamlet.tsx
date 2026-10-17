import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    if (!form.name.trim()) { setError(t('halka.hamlet.errorNameRequired')); return; }
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
      setError(t('halka.hamlet.errorUpdateFailed'));
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
      <AppHeader title={t('halka.hamlet.editTitle')}
        showBack
      />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'} className="flex-1">

        <ScrollView
          contentContainerClassName="px-6 py-6 gap-5"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-card border border-border rounded-2xl p-4 gap-4" style={{ borderCurve: 'continuous' }}>
            <View className="gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('halka.person.fieldName')} <Text className="text-destructive">*</Text>
              </Text>
              <Input value={form.name} onChangeText={update('name')} placeholder={t('halka.hamlet.placeholderName')} />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('halka.hamlet.fieldPopulation')}
              </Text>
              <Input type="number" value={form.population} onChangeText={update('population')} placeholder={t('halka.hamlet.placeholderPopulation')} />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('halka.person.fieldRemarks')}</Text>
              <Input type="multiline" value={form.remarks} onChangeText={update('remarks')}
                placeholder={t('halka.person.placeholderRemarks')} numberOfLines={2} />
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
              {saving ? t('common.saving') : t('halka.hamlet.btnUpdate')}
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
  const { t } = useTranslation();
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
    if (empty >= 0) { setError(t('halka.hamlet.errorHamletNameRequired', { index: empty + 1 })); return; }
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
      setError(t('halka.hamlet.errorSaveFailed'));
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* ── Discard-changes confirmation ──────────────────────────────────── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('common.unsavedDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDiscardDialog(false)}>{t('common.stay')}</AlertDialogCancel>
            <AlertDialogAction onPress={() => { setShowDiscardDialog(false); router.back(); }}>{t('common.discard')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppHeader title={t('halka.hamlet.addTitle')} onBack={handleBackPress} />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'} className="flex-1">

        <ScrollView
          contentContainerClassName="px-6 py-6 gap-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Count selector */}
          <View className="gap-2">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('halka.hamlet.countPrompt')}
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
              <Text className="text-sm font-semibold text-foreground">{t('halka.hamlet.hamletNumber', { index: idx + 1 })}</Text>

              <View className="gap-1.5">
                <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('halka.person.fieldName')} <Text className="text-destructive">*</Text>
                </Text>
                <Input value={h.name} onChangeText={(v) => updateField(idx, 'name', v)} placeholder={t('halka.hamlet.placeholderName')} />
              </View>

              <View className="gap-1.5">
                <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('halka.hamlet.fieldPopulation')}</Text>
                <Input type="number" value={h.population} onChangeText={(v) => updateField(idx, 'population', v)} placeholder={t('halka.hamlet.placeholderPopulation')} />
              </View>

              <View className="gap-1.5">
                <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('halka.person.fieldRemarks')}</Text>
                <Input type="multiline" value={h.remarks} onChangeText={(v) => updateField(idx, 'remarks', v)}
                  placeholder={t('halka.person.placeholderRemarks')} numberOfLines={2} />
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
              {saving ? t('common.saving') : t('halka.hamlet.btnSave', { count })}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
