import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Pressable, ScrollView, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Save } from 'lucide-react-native';
import {
  createGramPanchayat,
  updateGramPanchayat,
  getGramPanchayatById,
} from '@/lib/db/gramPanchayatRepo';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';

export default function AddGramPanchayatScreen() {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const params = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!params.editId;

  const [form, setForm] = useState({
    name: '',
    tehsil: '',
    police_station: workspace.police_station,
    district: workspace.district,
    state: workspace.state,
    remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (isEdit && params.editId) {
        (async () => {
          const gp = await getGramPanchayatById(params.editId!);
          if (gp) {
            setForm({
              name: gp.name,
              tehsil: gp.tehsil,
              police_station: gp.police_station,
              district: gp.district,
              state: gp.state,
              remarks: gp.remarks ?? '',
            });
          }
        })();
      }
    }, [isEdit, params.editId])
  );

  const update = (key: keyof typeof form) => (val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('halka.errorGPNameRequired')); return; }
    if (!form.tehsil.trim()) { setError(t('halka.errorTehsilRequired')); return; }
    setSaving(true);
    try {
      if (isEdit && params.editId) {
        await updateGramPanchayat(params.editId, {
          name: form.name.trim(),
          tehsil: form.tehsil.trim(),
          police_station: form.police_station,
          district: form.district,
          state: form.state,
          remarks: form.remarks.trim() || undefined,
        });
      } else {
        await createGramPanchayat({
          name: form.name.trim(),
          tehsil: form.tehsil.trim(),
          police_station: form.police_station || workspace.police_station,
          district: form.district || workspace.district,
          state: form.state || workspace.state,
          remarks: form.remarks.trim() || undefined,
        });
      }
      // setSaving(false) intentionally omitted here — component unmounts on navigation
      router.back();
    } catch {
      setError(t('halka.errorSaveFailed'));
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={isEdit ? t('halka.editGPTitle') : t('halka.addGPTitle')}
        showBack
      />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'} className="flex-1">

        <ScrollView
          contentContainerClassName="px-6 py-6 gap-5"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* GP Name */}
          <View className="gap-1.5">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('halka.fieldGPName')} <Text className="text-destructive">*</Text>
            </Text>
            <Input value={form.name} onChangeText={update('name')} placeholder={t('halka.placeholderGPName')} />
          </View>

          {/* Tehsil */}
          <View className="gap-1.5">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('halka.fieldTehsil')} <Text className="text-destructive">*</Text>
            </Text>
            <Input value={form.tehsil} onChangeText={update('tehsil')} placeholder={t('halka.placeholderTehsil')} />
          </View>

          {/* Auto-filled fields */}
          <View className="bg-secondary rounded-2xl p-4 gap-3" style={{ borderCurve: 'continuous' }}>
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('halka.autoFilledFromWorkspace')}
            </Text>
            {[
              { label: t('halka.fieldPoliceStation'), value: form.police_station, key: 'police_station' as const },
              { label: t('halka.fieldDistrict'), value: form.district, key: 'district' as const },
              { label: t('halka.fieldState'), value: form.state, key: 'state' as const },
            ].map(({ label, value, key }) => (
              <View key={key} className="gap-1">
                <Text className="text-xs text-muted-foreground">{label}</Text>
                <Input value={value} onChangeText={update(key)} placeholder={t('halka.placeholderEnter', { field: label.toLowerCase() })} />
              </View>
            ))}
          </View>

          {/* Remarks */}
          <View className="gap-1.5">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('halka.fieldRemarks')}</Text>
            <Input type="multiline" value={form.remarks} onChangeText={update('remarks')}
              placeholder={t('halka.placeholderRemarks')} numberOfLines={3} />
          </View>

          {error ? (
            <Text className="text-destructive text-sm">{error}</Text>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="bg-primary rounded-xl py-4 items-center flex-row justify-center gap-2 active:opacity-80 mt-2"
            style={{ borderCurve: 'continuous' }}
          >
            <Save size={18} color="#fff" />
            <Text className="text-primary-foreground font-semibold text-base">
              {saving ? t('common.saving') : isEdit ? t('common.update') : t('halka.btnSaveGP')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
