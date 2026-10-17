import { useCallback, useEffect, useState } from 'react';
import { persistPickedFile } from '@/lib/attachmentFiles';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, ChevronUp, Camera, Image as ImageIcon, User, X, Check } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { getAllGramPanchayats, type GramPanchayat } from '@/lib/db/gramPanchayatRepo';
import {
  addSurveillanceTarget, CRIMINAL_ACTIVITIES,
} from '@/lib/db/halkaSurveillanceRepo';

const NAVY = '#1E3A5F';

// ── Small anchor dropdown ─────────────────────────────────────────────────────
function AnchorDropdown<T extends string>({
  label,
  value,
  options,
  onSelect,
  renderOption,
  placeholder,
  error,
}: {
  label: string;
  value: T | null;
  options: T[];
  onSelect: (v: T) => void;
  renderOption?: (v: T) => string;
  placeholder?: string;
  error?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const display = value ? (renderOption ? renderOption(value) : value) : null;
  return (
    <View className="gap-1">
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Text>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between border border-border rounded-xl px-3 h-11 bg-card active:opacity-70"
      >
        <Text className={display ? 'text-sm text-foreground' : 'text-sm text-muted-foreground'}>
          {display ?? placeholder ?? t('common.select')}
        </Text>
        {open ? <ChevronUp size={15} color="#9CA3AF" /> : <ChevronDown size={15} color="#9CA3AF" />}
      </Pressable>
      {error ? <Text className="text-xs" style={{ color: '#E11D48' }}>{error}</Text> : null}
      {open && (
        <View className="border border-border rounded-xl bg-card overflow-hidden" style={{ elevation: 4 }}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => { onSelect(opt); setOpen(false); }}
                className="flex-row items-center justify-between px-3 py-2.5 active:bg-secondary"
                style={{ borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' }}
              >
                <Text className="text-sm text-foreground flex-1" numberOfLines={2}>
                  {renderOption ? renderOption(opt) : opt}
                </Text>
                {value === opt && <Check size={14} color={NAVY} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── GP picker (id → name mapping) ────────────────────────────────────────────
function GPDropdown({
  gps,
  value,
  onSelect,
  error,
}: {
  gps: GramPanchayat[];
  value: string | null;
  onSelect: (gp: GramPanchayat) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = gps.find((g) => g.id === value) ?? null;
  return (
    <View className="gap-1">
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('halka.surveillance.fieldGP')}</Text>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between border border-border rounded-xl px-3 h-11 bg-card active:opacity-70"
      >
        <Text className={selected ? 'text-sm text-foreground' : 'text-sm text-muted-foreground'}>
          {selected ? selected.name : t('halka.surveillance.placeholderGP')}
        </Text>
        {open ? <ChevronUp size={15} color="#9CA3AF" /> : <ChevronDown size={15} color="#9CA3AF" />}
      </Pressable>
      {error ? <Text className="text-xs" style={{ color: '#E11D48' }}>{error}</Text> : null}
      {open && (
        <View className="border border-border rounded-xl bg-card overflow-hidden" style={{ elevation: 4 }}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {gps.map((gp) => (
              <Pressable
                key={gp.id}
                onPress={() => { onSelect(gp); setOpen(false); }}
                className="flex-row items-center justify-between px-3 py-2.5 active:bg-secondary"
                style={{ borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' }}
              >
                <View className="flex-1">
                  <Text className="text-sm text-foreground">{gp.name}</Text>
                  <Text className="text-xs text-muted-foreground">{gp.tehsil}</Text>
                </View>
                {value === gp.id && <Check size={14} color={NAVY} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function AddSurveillanceScreen() {
  const { t } = useTranslation();
  const [gps, setGps]               = useState<GramPanchayat[]>([]);
  const [saving, setSaving]         = useState(false);

  // Form fields
  const [name, setName]             = useState('');
  const [fatherName, setFatherName] = useState('');
  const [gpId, setGpId]             = useState<string | null>(null);
  const [gpName, setGpName]         = useState('');
  const [activity, setActivity]     = useState<string | null>(null);
  const [photoUri, setPhotoUri]     = useState<string | null>(null);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const list = await getAllGramPanchayats();
        setGps(list);
      } catch (e) {
        logger.warn('[Surveillance/Add] GP load failed:', e);
      }
    })();
  }, []);

  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
      }
      if (!result.canceled && result.assets[0]?.uri) {
        // Keep the photo out of the picker's cache folder, which Android may clear.
        const asset = result.assets[0];
        setPhotoUri(await persistPickedFile(asset.uri, asset.fileName ?? 'photo.jpg'));
      }
    } catch (e) {
      logger.warn('[Surveillance/Add] Image pick failed:', e);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim())     errs.name     = t('halka.surveillance.errorNameRequired');
    if (!gpId)            errs.gp       = t('halka.surveillance.errorGPRequired');
    if (!activity)        errs.activity = t('halka.surveillance.errorActivityRequired');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await addSurveillanceTarget({
        gp_id: gpId!,
        gp_name: gpName,
        name: name.trim(),
        father_name: fatherName.trim(),
        criminal_activity: activity!,
        photo_uri: photoUri,
      });
      router.back();
    } catch (e) {
      logger.warn('[Surveillance/Add] Save failed:', e);
      setErrors({ _global: t('halka.surveillance.errorSaveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('halka.surveillance.addTitle')} subtitle={t('halka.surveillance.subtitle')} showBack />

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Photo picker */}
          <View className="items-center gap-3">
            <View className="w-24 h-24 rounded-2xl overflow-hidden bg-secondary items-center justify-center border border-border">
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={{ width: 96, height: 96 }} contentFit="cover" />
              ) : (
                <User size={36} color="#9CA3AF" />
              )}
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => pickImage('camera')}
                className="flex-row items-center gap-1.5 border border-border rounded-lg px-3 py-2 active:opacity-70"
              >
                <Camera size={14} color={NAVY} />
                <Text className="text-xs font-semibold" style={{ color: NAVY }}>{t('halka.surveillance.camera')}</Text>
              </Pressable>
              <Pressable
                onPress={() => pickImage('gallery')}
                className="flex-row items-center gap-1.5 border border-border rounded-lg px-3 py-2 active:opacity-70"
              >
                <ImageIcon size={14} color={NAVY} />
                <Text className="text-xs font-semibold" style={{ color: NAVY }}>{t('halka.surveillance.gallery')}</Text>
              </Pressable>
              {photoUri && (
                <Pressable
                  onPress={() => setPhotoUri(null)}
                  className="border border-border rounded-lg px-2 py-2 active:opacity-70"
                >
                  <X size={14} color="#6B7280" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Name */}
          <View className="gap-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('halka.surveillance.fieldName')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('halka.surveillance.placeholderName')}
              placeholderTextColor="#9CA3AF"
              className="border border-border rounded-xl px-3 h-11 text-sm text-foreground bg-card"
            />
            {errors.name ? <Text className="text-xs" style={{ color: '#E11D48' }}>{errors.name}</Text> : null}
          </View>

          {/* Father name */}
          <View className="gap-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('halka.surveillance.fieldFatherName')}</Text>
            <TextInput
              value={fatherName}
              onChangeText={setFatherName}
              placeholder={t('halka.surveillance.placeholderFatherName')}
              placeholderTextColor="#9CA3AF"
              className="border border-border rounded-xl px-3 h-11 text-sm text-foreground bg-card"
            />
          </View>

          {/* GP dropdown */}
          <GPDropdown
            gps={gps}
            value={gpId}
            onSelect={(gp) => { setGpId(gp.id); setGpName(gp.name); setErrors((e) => ({ ...e, gp: '' })); }}
            error={errors.gp}
          />

          {/* Activity dropdown */}
          <AnchorDropdown
            label={t('halka.surveillance.fieldActivity')}
            value={activity}
            options={[...CRIMINAL_ACTIVITIES]}
            onSelect={(v) => { setActivity(v); setErrors((e) => ({ ...e, activity: '' })); }}
            placeholder={t('halka.surveillance.placeholderActivity')}
            error={errors.activity}
          />

          {/* Global error */}
          {errors._global ? (
            <Text className="text-xs text-center" style={{ color: '#E11D48' }}>{errors._global}</Text>
          ) : null}

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl h-12 items-center justify-center active:opacity-70"
            style={{ backgroundColor: saving ? '#9CA3AF' : '#E11D48' }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm font-bold text-white">{t('halka.surveillance.btnSaveTarget')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
