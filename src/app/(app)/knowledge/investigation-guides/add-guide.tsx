import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  KeyboardAvoidingView, Pressable, ScrollView,
  Text, View,
} from 'react-native';
import { Input } from '@/components/ui/input';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  AlertCircle, BookOpen, ChevronDown,
  FileText, Save, Search, Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import {
  createKnowledgeEntry, updateKnowledgeEntry, getKnowledgeById,
} from '@/lib/db/knowledgeRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const COLOR = '#0891B2';
const CATEGORY = 'Investigation Guides';

// ─── Guide type config ────────────────────────────────────────────────────
type GuideType = 'sops' | 'evidence' | 'witness' | 'charge-sheet';

interface GuideConfig {
  label: string;
  subcategory: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  contentLabel: string;
  contentPlaceholder: string;
}

const GUIDE_CONFIG: Record<GuideType, GuideConfig> = {
  sops: {
    label: 'Crime-wise Investigation SOPs',
    subcategory: 'Crime-wise Investigation',
    icon: BookOpen,
    contentLabel: 'SOP Content',
    contentPlaceholder:
      'Describe the standard operating procedure, key steps, and investigation guidelines…',
  },
  evidence: {
    label: 'Evidence Collection',
    subcategory: 'Evidence Collection',
    icon: Search,
    contentLabel: 'Evidence Collection Steps',
    contentPlaceholder:
      'List the evidence collection steps, site preservation procedures, and chain of custody requirements…',
  },
  witness: {
    label: 'Witness Handling',
    subcategory: 'Witness Handling',
    icon: Users,
    contentLabel: 'Witness Handling Guidelines',
    contentPlaceholder:
      'Describe witness identification, interview techniques, protection measures, and recording procedures…',
  },
  'charge-sheet': {
    label: 'Charge Sheet Guide',
    subcategory: 'Charge Sheet Guide',
    icon: FileText,
    contentLabel: 'Charge Sheet Guidance',
    contentPlaceholder:
      'Describe charge sheet preparation steps, required documents, applicable BNS sections, and filing procedures…',
  },
};

function isGuideType(v: string | undefined): v is GuideType {
  return v === 'sops' || v === 'evidence' || v === 'witness' || v === 'charge-sheet';
}

const CRIME_TYPES = [
  'Murder', 'Dacoity', 'Robbery', 'Theft', 'Burglary',
  'Assault', 'Rape', 'Kidnapping', 'Fraud', 'Cybercrime',
  'NDPS / Drug Offence', 'Arms Act', 'Excise', 'Atrocity',
  'Domestic Violence', 'Other',
];

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function AddGuideScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const { type, editId } = useLocalSearchParams<{ type?: string; editId?: string }>();
  const guideType = isGuideType(type) ? type : 'sops';
  const config = GUIDE_CONFIG[guideType];
  const isEdit = Boolean(editId);
  const Icon = config.icon;

  const contentLabel = t(`knowledge.guide.${guideType}.contentLabel`);
  const contentPlaceholder = t(`knowledge.guide.${guideType}.contentPlaceholder`);

  const [title, setTitle] = useState('');
  const [crimeType, setCrimeType] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const [showCrimeDropdown, setShowCrimeDropdown] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const isDirty = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!editId) return;
      (async () => {
        const e = await getKnowledgeById(editId);
        if (!e) return;
        setTitle(e.title);
        setCrimeType(e.crime_type ?? '');
        setDescription(e.description);
        setTags(e.tags);
        isDirty.current = false;
      })();
    }, [editId])
  );

  useEffect(() => { isDirty.current = true; }, [title, crimeType, description, tags]);

  const handleBack = () => {
    if (isDirty.current) { setShowUnsaved(true); } else { router.back(); }
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) { setError(t('knowledge.guide.errorTitleRequired')); return; }
    if (!crimeType.trim()) { setError(t('knowledge.guide.errorCrimeTypeRequired')); return; }
    if (!description.trim()) { setError(t('knowledge.guide.errorContentRequired', { contentLabel })); return; }

    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        category: CATEGORY,
        subcategory: config.subcategory,
        crime_type: crimeType.trim(),
        description: description.trim(),
        tags: tags.trim(),
        attachment_uris: '[]',
      };
      if (isEdit && editId) {
        const existing = await getKnowledgeById(editId);
        await updateKnowledgeEntry(editId, {
          ...data,
          attachment_uris: existing?.attachment_uris ?? '[]',
        });
      } else {
        await createKnowledgeEntry(data);
      }
      isDirty.current = false;
      router.back();
    } catch (e) {
      setError(t('knowledge.guide.errorSaveFailed'));
      logger.error('[AddGuide] save error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={isEdit ? t('knowledge.guide.editEntry') : t('knowledge.guide.newEntry')}
        subtitle={t(`knowledge.guide.${guideType}.label`)}
        onBack={handleBack}
        rightActions={
          <Pressable onPress={handleSave} disabled={saving} className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl active:opacity-70" style={{ backgroundColor: COLOR, borderCurve: 'continuous' }}>
            <Save size={15} color="#fff" />
            <Text className="text-sm font-bold text-white">{saving ? t('common.saving') : t('common.save')}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
        className="flex-1"
      >

        <ScrollView
          contentContainerClassName="px-6 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Title ── */}
          <Input
            label={t('knowledge.guide.fieldTitle')}
            placeholder={t('knowledge.guide.titlePlaceholder')}
            value={title}
            onChangeText={(v) => { setTitle(v); setError(''); }}
          />

          {/* ── Crime Type dropdown ── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('knowledge.guide.fieldCrimeType')} <Text className="text-destructive">*</Text>
            </Text>
            <Pressable
              onPress={() => setShowCrimeDropdown((v) => !v)}
              className="flex-row items-center gap-3 border border-border rounded-xl px-4 py-3 bg-card active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <Text
                className="flex-1 text-base"
                style={{ color: crimeType ? C.foreground : C.mutedForeground }}
              >
                {crimeType
                  ? t('knowledge.guide.crimeType.' + crimeType, { defaultValue: crimeType })
                  : t('knowledge.guide.selectCrimeType')}
              </Text>
              <ChevronDown size={16} color={C.mutedForeground} />
            </Pressable>
            {showCrimeDropdown && (
              <View
                className="border border-border rounded-xl overflow-hidden bg-card mt-1"
                style={{ borderCurve: 'continuous' }}
              >
                {CRIME_TYPES.map((ct, idx) => (
                  <Pressable
                    key={ct}
                    onPress={() => {
                      setCrimeType(ct);
                      setShowCrimeDropdown(false);
                      setError('');
                    }}
                    className="flex-row items-center px-4 py-3 active:opacity-70"
                    style={{
                      borderTopWidth: idx > 0 ? 1 : 0,
                      borderTopColor: C.border,
                      backgroundColor: crimeType === ct ? `${COLOR}10` : 'transparent',
                    }}
                  >
                    <Text
                      className="flex-1 text-sm font-medium"
                      style={{ color: crimeType === ct ? COLOR : C.foreground }}
                    >
                      {t('knowledge.guide.crimeType.' + ct, { defaultValue: ct })}
                    </Text>
                    {crimeType === ct && (
                      <Text className="text-xs font-bold" style={{ color: COLOR }}>✓</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
            <Text className="text-xs text-muted-foreground">
              {t('knowledge.guide.crimeTypeHint')}
            </Text>
          </View>

          {/* ── Main Content ── */}
          <Input
            type="multiline"
            label={`${contentLabel} *`}
            placeholder={contentPlaceholder}
            value={description}
            onChangeText={(v) => { setDescription(v); setError(''); }}
          />

          {/* ── Tags ── */}
          <Input
            label={t('knowledge.guide.fieldTags')}
            placeholder={t('knowledge.guide.tagsPlaceholder')}
            value={tags}
            onChangeText={setTags}
            helperText={t('knowledge.guide.tagsHelper')}
          />

          {/* Attachments note */}
          <View className="bg-secondary rounded-xl px-4 py-3">
            <Text className="text-xs text-muted-foreground leading-5">
              {t('knowledge.guide.attachmentsNote')}
            </Text>
          </View>

          {/* Error */}
          {error.length > 0 && (
            <View className="flex-row items-center gap-2 bg-destructive/10 rounded-xl px-4 py-3">
              <AlertCircle size={14} color={C.destructive} />
              <Text className="text-sm text-destructive flex-1">{error}</Text>
            </View>
          )}

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl py-4 items-center justify-center active:opacity-80 mt-2"
            style={{ backgroundColor: COLOR, borderCurve: 'continuous' }}
          >
            <Text className="text-base font-bold text-white">
              {saving
                ? t('common.saving')
                : isEdit
                  ? t('knowledge.guide.updateEntry')
                  : t('knowledge.guide.saveEntry')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsaved} onOpenChange={setShowUnsaved}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('knowledge.guide.unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledge.guide.unsavedDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowUnsaved(false)}>
              <Text>{t('knowledge.guide.keepEditing')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { isDirty.current = false; setShowUnsaved(false); router.back(); }}
              className="bg-destructive"
            >
              <Text className="text-destructive-foreground font-semibold">{t('knowledge.guide.discard')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
