import { useState } from 'react';
import { ScrollView, Text, View, Pressable, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import {
  Save, CheckCircle2, Building2, User, MapPin, Layout,
} from 'lucide-react-native';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Input } from '@/components/ui/input';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { useTranslation } from 'react-i18next';

const ACTION = '#2563EB';
export default function WorkspaceSetupScreen() {
  const { t } = useTranslation();
  const { workspace, updateWorkspace } = useWorkspace();
  const [form, setForm] = useState({ ...workspace });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    await updateWorkspace(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const fieldGroups = [
    {
      title: t('workspace.officerInfo'),
      icon: User,
      color: '#1E3A5F',
      fields: [
        { key: 'officer_name' as const, label: t('workspace.officerName'), placeholder: t('workspace.officerNamePlaceholder') },
      ],
    },
    {
      title: t('workspace.policeStation'),
      icon: Building2,
      color: '#1D4ED8',
      fields: [
        { key: 'police_station' as const, label: t('workspace.stationName'), placeholder: t('workspace.stationPlaceholder') },
        { key: 'district' as const, label: t('workspace.district'), placeholder: t('workspace.districtPlaceholder') },
        { key: 'state' as const, label: t('workspace.state'), placeholder: t('workspace.statePlaceholder') },
      ],
    },
    {
      title: t('workspace.beatArea'),
      icon: MapPin,
      color: '#059669',
      fields: [
        { key: 'halka' as const, label: t('workspace.halka'), placeholder: t('workspace.halkaPlaceholder') },
        { key: 'beat' as const, label: t('workspace.beat'), placeholder: t('workspace.beatPlaceholder') },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('workspace.title')} showBack />
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'} className="flex-1">
        <ScrollView
          contentContainerClassName="px-5 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {fieldGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <View key={group.title} className="gap-3">
                {/* Group header */}
                <View className="flex-row items-center gap-2">
                  <View
                    className="w-7 h-7 rounded-lg items-center justify-center"
                    style={{ backgroundColor: `${group.color}15` }}
                  >
                    <GroupIcon size={14} color={group.color} />
                  </View>
                  <Text className="text-sm font-semibold text-foreground">{group.title}</Text>
                </View>

                {/* Fields card */}
                <View className="bg-card border border-border rounded-2xl overflow-hidden"
                  style={{ borderCurve: 'continuous' }}>
                  {group.fields.map(({ key, label, placeholder }, idx) => (
                    <View
                      key={key}
                      className="px-5 py-4"
                      style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#E5E7EB' }}
                    >
                      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        {label}
                      </Text>
                      <Input
                        value={form[key]}
                        onChangeText={update(key)}
                        placeholder={placeholder}
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}

          {/* Success feedback */}
          {saved && (
            <View className="flex-row items-center gap-2.5 rounded-2xl px-4 py-3"
              style={{ backgroundColor: '#DCFCE7', borderCurve: 'continuous' }}>
              <CheckCircle2 size={18} color="#16A34A" />
              <Text className="text-sm font-semibold" style={{ color: '#15803D' }}>
                {t('workspace.savedSuccess')}
              </Text>
            </View>
          )}

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-row items-center justify-center gap-2 py-4 rounded-2xl active:opacity-80 mt-1"
            style={{
              backgroundColor: saving ? '#6B7280' : '#1E3A5F',
              borderCurve: 'continuous',
            }}
          >
            <Save size={18} color="#fff" />
            <Text className="text-white font-bold text-base">
              {saving ? t('common.saving') : t('workspace.saveSettings')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
