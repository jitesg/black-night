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
import { useLocalSearchParams, router } from 'expo-router';
import { createKaryvahi, getNextKaryvahiSortOrder } from '@/lib/db/firKaryvahiRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';

export default function AddKaryvahiScreen() {
  const { firId } = useLocalSearchParams<{ firId: string }>();

  const [name, setName]             = useState('');
  const [precautions, setPrecautions] = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Karyvahi name is required'); return; }
    if (!firId) { setError('FIR ID missing — go back and retry'); return; }
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
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1 bg-background"
    >
      <AppHeader
        title="Add Karyvahi"
        showBack
        rightActions={
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl px-4 py-2 active:opacity-70"
            style={{ backgroundColor: '#6366F1' }}
          >
            <Text className="text-white text-sm font-bold">{saving ? 'Saving…' : 'Save'}</Text>
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
            Karyvahi Name *
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Enter karyvahi name"
            returnKeyType="next"
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Brief Description
          </Text>
          <DocumentEditor
            value={precautions}
            onChangeText={setPrecautions}
            title="Brief Description"
            placeholder="Describe purpose or notes for this karyvahi…"
            minHeight={120}
            accessibilityLabel="Karyvahi brief description editor"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
