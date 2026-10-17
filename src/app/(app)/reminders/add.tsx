import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import * as reminderRepo from '@/lib/db/reminderRepo';
import { scheduleReminderNotification } from '@/lib/reminderNotifications';
import {
  OptionPicker,
  SOUND_OPTION_KEYS,
} from '@/app/(app)/settings/reminders';

export default function AddReminderScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { settings } = useSettingsStore();

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const defaultTime = settings.reminderTime || '09:00';

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dateStr, setDateStr] = useState(defaultDate);
  const [timeStr, setTimeStr] = useState(defaultTime);
  const [repeatMode, setRepeatMode] = useState<'once' | 'daily' | 'weekly'>(
    settings.reminderRepeat || 'once'
  );
  const [sound, setSound] = useState<'default' | 'bell' | 'chime' | 'silent'>(
    settings.reminderSound || 'default'
  );

  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const repeatOptions = [
    { value: 'once' as const, label: t('reminders.repeat.once') },
    { value: 'daily' as const, label: t('reminders.repeat.daily') },
    { value: 'weekly' as const, label: t('reminders.repeat.weekly') },
  ];
  const soundOptions = SOUND_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  const canSave = title.trim().length > 0 && dateStr.trim().length > 0 && timeStr.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setValidationError(null);
    setErrorBanner(null);

    // 1. Parse dateStr ("YYYY-MM-DD") + timeStr ("HH:MM") into epoch-ms timestamp (local time)
    const dateParts = dateStr.split('-').map(Number);
    const timeParts = timeStr.split(':').map(Number);

    if (
      dateParts.length !== 3 ||
      timeParts.length !== 2 ||
      isNaN(dateParts[0]) ||
      isNaN(dateParts[1]) ||
      isNaN(dateParts[2]) ||
      isNaN(timeParts[0]) ||
      isNaN(timeParts[1])
    ) {
      setValidationError(t('reminders.errorInvalidDateTime'));
      return;
    }

    const [year, month, day] = dateParts;
    const [hour, minute] = timeParts;
    const targetDate = new Date(year, month - 1, day, hour, minute, 0, 0);
    const dueAt = targetDate.getTime();

    // 2. If timestamp is in the past, show inline validation error
    if (dueAt <= Date.now()) {
      setValidationError(t('reminders.errorPastTime'));
      return;
    }

    setSaving(true);
    try {
      // 3. Create reminder record in SQLite
      const reminder = await reminderRepo.createReminder(
        title.trim(),
        note.trim(),
        dueAt,
        repeatMode,
        sound
      );

      // 4. Schedule local notification
      const notificationId = await scheduleReminderNotification(
        reminder.id,
        title.trim(),
        note.trim(),
        dueAt,
        repeatMode,
        sound
      );

      // 5. Update reminder with notification ID
      await reminderRepo.updateReminder(reminder.id, { notification_id: notificationId });

      // 6. Return to list
      router.back();
    } catch (e) {
      console.error('[AddReminder] Error scheduling reminder:', e);
      setErrorBanner(t('reminders.errorSchedule'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('reminders.newReminder')} showBack />

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error Banner */}
        {errorBanner && (
          <View className="mb-4 bg-destructive/15 border border-destructive/30 rounded-2xl p-4 flex-row items-center gap-3">
            <AlertTriangle size={18} className="text-destructive shrink-0" />
            <Text className="text-sm text-destructive font-medium flex-1">
              {errorBanner}
            </Text>
          </View>
        )}

        {/* Inputs */}
        <View className="gap-4">
          <Input
            label={t('reminders.fieldTitle')}
            required
            placeholder={t('reminders.fieldTitlePlaceholder')}
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (validationError) setValidationError(null);
            }}
          />

          <Input
            type="multiline"
            label={t('reminders.fieldNote')}
            placeholder={t('reminders.fieldNotePlaceholder')}
            value={note}
            onChangeText={setNote}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                type="date"
                label={t('reminders.fieldDate')}
                required
                value={dateStr}
                onChangeText={(v) => {
                  setDateStr(v);
                  if (validationError) setValidationError(null);
                }}
              />
            </View>
            <View className="flex-1">
              <Input
                type="time"
                label={t('reminders.fieldTime')}
                required
                value={timeStr}
                onChangeText={(v) => {
                  setTimeStr(v);
                  if (validationError) setValidationError(null);
                }}
              />
            </View>
          </View>

          {/* Inline validation error */}
          {validationError && (
            <Text className="text-xs text-destructive font-medium px-1">
              {validationError}
            </Text>
          )}

          {/* Repeat and Sound pickers */}
          <View className="mt-2">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
              {t('reminders.options')}
            </Text>
            <View
              className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border"
              style={{ borderCurve: 'continuous' }}
            >
              <OptionPicker
                label={t('settings.reminders.repeat')}
                value={repeatMode}
                options={repeatOptions}
                onSelect={(v) => setRepeatMode(v as 'once' | 'daily' | 'weekly')}
              />
              <OptionPicker
                label={t('settings.reminders.sound')}
                value={sound}
                options={soundOptions}
                onSelect={(v) => setSound(v as 'default' | 'bell' | 'chime' | 'silent')}
              />
            </View>
          </View>

          {/* Save Button */}
          <View className="mt-6">
            <Pressable
              onPress={handleSave}
              disabled={!canSave || saving}
              className={`h-12 rounded-xl flex-row items-center justify-center gap-2 active:opacity-80 ${
                !canSave || saving ? 'bg-primary/50' : 'bg-primary'
              }`}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Bell size={18} color="#FFFFFF" />
                  <Text className="text-base font-semibold text-white">{t('reminders.saveReminder')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
