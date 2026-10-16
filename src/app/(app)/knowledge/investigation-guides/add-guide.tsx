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
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const { type, editId } = useLocalSearchParams<{ type?: string; editId?: string }>();
  const guideType = isGuideType(type) ? type : 'sops';
  const config = GUIDE_CONFIG[guideType];
  const isEdit = Boolean(editId);
  const Icon = config.icon;

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
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!crimeType.trim()) { setError('Crime Type is required.'); return; }
    if (!description.trim()) { setError(`${config.contentLabel} is required.`); return; }

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
      setError('Failed to save. Please try again.');
      logger.error('[AddGuide] save error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={isEdit ? 'Edit Entry' : 'New Entry'}
        subtitle={config.label}
        onBack={handleBack}
        rightActions={
          <Pressable onPress={handleSave} disabled={saving} className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl active:opacity-70" style={{ backgroundColor: COLOR, borderCurve: 'continuous' }}>
            <Save size={15} color="#fff" />
            <Text className="text-sm font-bold text-white">{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >

        <ScrollView
          contentContainerClassName="px-6 py-5 gap-5 pb-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Title ── */}
          <Input
            label="Title *"
            placeholder="Enter a descriptive title…"
            value={title}
            onChangeText={(v) => { setTitle(v); setError(''); }}
          />

          {/* ── Crime Type dropdown ── */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Crime Type <Text className="text-destructive">*</Text>
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
                {crimeType || 'Select crime type…'}
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
                      {ct}
                    </Text>
                    {crimeType === ct && (
                      <Text className="text-xs font-bold" style={{ color: COLOR }}>✓</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
            <Text className="text-xs text-muted-foreground">
              Used for filtering and search
            </Text>
          </View>

          {/* ── Main Content ── */}
          <Input
            type="multiline"
            label={`${config.contentLabel} *`}
            placeholder={config.contentPlaceholder}
            value={description}
            onChangeText={(v) => { setDescription(v); setError(''); }}
          />

          {/* ── Tags ── */}
          <Input
            label="Tags / Keywords"
            placeholder="e.g. BNS 302, Homicide, DNA Evidence…"
            value={tags}
            onChangeText={setTags}
            helperText="Separate multiple tags with commas"
          />

          {/* Attachments note */}
          <View className="bg-secondary rounded-xl px-4 py-3">
            <Text className="text-xs text-muted-foreground leading-5">
              📎 Attachments (PDF, images, documents) can be added from the detail view after saving.
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
              {saving ? 'Saving…' : isEdit ? 'Update Entry' : 'Save Entry'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsaved} onOpenChange={setShowUnsaved}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowUnsaved(false)}>
              <Text>Keep Editing</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => { isDirty.current = false; setShowUnsaved(false); router.back(); }}
              className="bg-destructive"
            >
              <Text className="text-destructive-foreground font-semibold">Discard</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
