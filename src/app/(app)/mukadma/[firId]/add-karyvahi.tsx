/**
 * add-karyvahi.tsx — Create-only form for adding a custom Karyvahi to a FIR.
 *
 * v250: Edit mode has been removed. Karyvahi cards are now read-only in karyvahi.tsx
 * and editable only via their detail page (karyvahi-detail.tsx). This screen is
 * purely for adding NEW user-defined karyvahi items.
 *
 * Route: /(app)/mukadma/[firId]/add-karyvahi
 */
import { useState } from 'react';
import { logger } from '@/lib/logger';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView } from 'react-native';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { FardCheckButton } from '@/components/fard/FardCheckButton';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { createKaryvahi, getNextKaryvahiSortOrder } from '@/lib/db/firKaryvahiRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';

export default function AddKaryvahiScreen() {
  const { firId } = useLocalSearchParams<{ firId: string }>();
  const { t } = useTranslation();

  const [name, setName]             = useState('');
  const [precautions, setPrecautions] = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError(t('fir.karyvahiNameRequired')); return; }
    if (!firId) { setError(t('fir.firIdMissing')); return; }
    setError('');
    setSaving(true);
    try {
      const sortOrder = await getNextKaryvahiSortOrder(firId);
      await createKaryvahi({
        fir_id:       firId,
        name:         name.trim(),
        precautions:  precautions.trim() || undefined,
        is_completed: 0,
        execution_count: 0,
        sort_order:   sortOrder,
        source:       'user',
      });
      logger.warn(`[AddKaryvahi] created name="${name.trim()}" firId="${firId}"`);
      router.back();
    } catch (e) {
      logger.error('[AddKaryvahi] save error:', e);
      setError(t('fir.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
      className="flex-1 bg-background"
    >
      <AppHeader
        title={t('fir.addKaryvahi')}
        showBack
        rightActions={
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl px-4 py-2 active:opacity-70"
            style={{ backgroundColor: '#6366F1' }}
          >
            <Text className="text-white text-sm font-bold">{saving ? t('common.saving') : t('common.save')}</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="px-6 py-6 gap-5 pb-20"
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        ) : null}

        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('fir.karyvahiName')} *
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={t('fir.karyvahiNamePlaceholder')}
            returnKeyType="next"
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('fir.briefDescription')}
          </Text>
          <DocumentEditor
            value={precautions}
            onChangeText={setPrecautions}
            title={t('fir.briefDescription')}
            placeholder={t('fir.briefDescriptionPlaceholder')}
            minHeight={120}
            accessibilityLabel={t('fir.karyvahiBriefDescAccessibility')}
          />
          <FardCheckButton text={precautions} title={name} className="mt-1" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
