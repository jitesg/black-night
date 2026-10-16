import { useState } from 'react';
import { ScrollView, Text, View, Pressable, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import {
  Save, CheckCircle2, Building2, User, MapPin, Layout,
} from 'lucide-react-native';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Input } from '@/components/ui/input';
import { AppHeader } from '@/components/ui/ds/AppHeader';

const ACTION = '#2563EB';
export default function WorkspaceSetupScreen() {
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
      title: 'Officer Information',
      icon: User,
      color: '#1E3A5F',
      fields: [
        { key: 'officer_name' as const, label: 'Officer Name', placeholder: 'Full name' },
      ],
    },
    {
      title: 'Police Station',
      icon: Building2,
      color: '#1D4ED8',
      fields: [
        { key: 'police_station' as const, label: 'Station Name', placeholder: 'Police station' },
        { key: 'district' as const, label: 'District', placeholder: 'District name' },
        { key: 'state' as const, label: 'State', placeholder: 'State name' },
      ],
    },
    {
      title: 'Beat Area',
      icon: MapPin,
      color: '#059669',
      fields: [
        { key: 'halka' as const, label: 'Halka', placeholder: 'Halka name' },
        { key: 'beat' as const, label: 'Beat', placeholder: 'Beat name' },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Workspace Setup" showBack />
      <KeyboardAvoidingView behavior="padding" className="flex-1">
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
                Workspace settings saved successfully
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
              {saving ? 'Saving…' : 'Save Settings'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
