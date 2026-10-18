/**
 * karyvahi-detail.tsx — Detail page for a single FIR Karyvahi.
 * Route: /(app)/mukadma/[firId]/karyvahi-detail?karyvahiId=<uuid>
 *
 * Shows:
 *   • Status summary card
 *   • Evidence section — attach photos / docs, view, delete (Phase 2)
 *   • Knowledge sections (Why, When, Legal, Steps, Docs, Best Practices, Mistakes)
 *   • Execution history
 *   • Delete karyvahi (user-added items only)
 */
import { useState, useEffect, useCallback } from 'react';
import { persistPickedFile } from '@/lib/attachmentFiles';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  TextInput, FlatList, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import {
  BookOpen, CheckCircle2, Circle, AlertTriangle, Trash2, Info,
  Paperclip, Image as ImageIcon, FileText, X, Pencil, Check,
} from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getKaryvahiById, getExecutionsByKaryvahi, deleteKaryvahi,
  type FIRKaryvahi, type KaryvahiExecution,
} from '@/lib/db/firKaryvahiRepo';
import {
  getChecklistItemByStepCode,
  type ChecklistItem,
} from '@/lib/db/checklistRepo';
import {
  addEvidence, getEvidenceByKaryvahi, updateEvidenceCaption, deleteEvidence,
  type KaryvahiEvidence,
} from '@/lib/db/karyvahiEvidenceRepo';

const NAVY = '#6366F1';

// ── Static knowledge sections ─────────────────────────────────────────────────

import { matchDefaultKaryvahi } from '@/lib/karyvahiNames';
import {
  getDefaultKnowledge,
  resolveKnowledgeSections,
  deriveKnowledgeSections,
  type KnowledgeSection,
} from '@/lib/defaultKaryvahiKnowledge';

export { resolveKnowledgeSections, deriveKnowledgeSections, type KnowledgeSection };

// ── Section card ──────────────────────────────────────────────────────────────

function InfoSection({ section }: { section: KnowledgeSection }) {
  return (
    <View className="gap-2 py-4 border-b border-border">
      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
        {section.title}
      </Text>
      <Text className="text-sm text-foreground leading-7">{section.body}</Text>
    </View>
  );
}

// ── Execution history row ─────────────────────────────────────────────────────

function ExecutionRow({ exec, idx }: { exec: KaryvahiExecution; idx: number }) {
  const { t } = useTranslation();
  const dt = new Date(exec.created_at * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return (
    <View className="flex-row items-center gap-3 py-2.5 border-b border-border">
      <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: NAVY }}>
        <Text className="text-white text-xs font-bold">{idx + 1}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-xs font-semibold text-foreground">{t('fir.karyvahiDetail.execLabel', { n: exec.execution_number })}</Text>
        <Text className="text-xs text-muted-foreground">{dt}</Text>
      </View>
      {exec.template_used ? (
        <View className="bg-purple-50 rounded-full px-2.5 py-1 dark:bg-purple-500/15">
          <Text textBreakStrategy="simple" className="text-xs" style={{ color: '#7C3AED' }}>{exec.template_used}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Evidence item ─────────────────────────────────────────────────────────────

interface EvidenceItemProps {
  item: KaryvahiEvidence;
  onDelete: (id: string) => void;
  onCaptionSave: (id: string, caption: string) => void;
}

function EvidenceItem({ item, onDelete, onCaptionSave }: EvidenceItemProps) {
  const { t } = useTranslation();
  const isImage = item.mime_type.startsWith('image/');
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(item.caption ?? '');

  const dt = new Date(item.created_at * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const handleSave = () => {
    onCaptionSave(item.id, caption);
    setEditing(false);
  };

  return (
    <View
      className="bg-card border border-border rounded-2xl overflow-hidden"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Thumbnail or doc placeholder */}
      {isImage ? (
        <Image
          source={{ uri: item.local_uri }}
          style={{ width: '100%', height: 160 }}
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-20 bg-secondary items-center justify-center gap-1">
          <FileText size={28} color="#9CA3AF" />
          <Text className="text-xs text-muted-foreground">{item.mime_type}</Text>
        </View>
      )}

      <View className="px-3 py-2.5 gap-1.5">
        {/* Caption row */}
        {editing ? (
          <View className="flex-row items-center gap-2">
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={t('fir.karyvahiDetail.evidence.captionPlaceholder')}
              className="flex-1 text-sm text-foreground border-b border-border py-1"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            <Pressable onPress={handleSave} className="p-1.5 active:opacity-60">
              <Check size={16} color="#16a34a" />
            </Pressable>
          </View>
        ) : (
          <Pressable className="flex-row items-center gap-1.5 active:opacity-60" onPress={() => setEditing(true)}>
            <Text
              className="text-xs flex-1"
              style={{ color: caption ? '#374151' : '#9CA3AF' }}
              numberOfLines={2}
            >
              {caption || t('fir.karyvahiDetail.evidence.addCaption')}
            </Text>
            <Pencil size={11} color="#9CA3AF" />
          </Pressable>
        )}

        {/* Date + delete */}
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-muted-foreground">{dt}</Text>
          <Pressable
            onPress={() => onDelete(item.id)}
            className="p-1.5 active:opacity-60"
          >
            <X size={14} color="#DC2626" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Evidence section ──────────────────────────────────────────────────────────

interface EvidenceSectionProps {
  karyvahiId: string;
  firId: string;
}

function EvidenceSection({ karyvahiId, firId }: EvidenceSectionProps) {
  const { t } = useTranslation();
  const [items, setItems]     = useState<KaryvahiEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const loadEvidence = useCallback(async () => {
    try {
      const rows = await getEvidenceByKaryvahi(karyvahiId);
      setItems(rows);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [karyvahiId]);

  useEffect(() => { loadEvidence(); }, [loadEvidence]);

  const handleAttach = async () => {
    setError('');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError(t('fir.karyvahiDetail.evidence.permissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
      allowsMultipleSelection: true,
    });
    if (result.canceled) return;

    for (const asset of result.assets) {
      try {
        const added = await addEvidence({
          karyvahi_id: karyvahiId,
          fir_id:      firId,
          local_uri:   await persistPickedFile(asset.uri, asset.fileName ?? 'evidence.jpg'),
          mime_type:   asset.mimeType ?? 'image/jpeg',
        });
        setItems((prev) => [added, ...prev]);
      } catch { /* ignore individual failure */ }
    }
  };

  const handleCamera = async () => {
    setError('');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError(t('fir.karyvahiDetail.evidence.permissionDenied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    try {
      const added = await addEvidence({
        karyvahi_id: karyvahiId,
        fir_id:      firId,
        local_uri:   await persistPickedFile(asset.uri, asset.fileName ?? 'evidence.jpg'),
        mime_type:   asset.mimeType ?? 'image/jpeg',
      });
      setItems((prev) => [added, ...prev]);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    await deleteEvidence(id);
    setItems((prev) => prev.filter((e) => e.id !== id));
  };

  const handleCaptionSave = async (id: string, caption: string) => {
    await updateEvidenceCaption(id, caption);
    setItems((prev) => prev.map((e) => e.id === id ? { ...e, caption } : e));
  };

  return (
    <View className="gap-3 py-4 border-b border-border">
      {/* Section header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {t('fir.karyvahiDetail.evidence.title')}
          </Text>
          {items.length > 0 && (
            <View className="bg-secondary rounded-full px-2.5 py-1">
              <Text textBreakStrategy="simple" className="text-xs font-semibold text-muted-foreground">{items.length}</Text>
            </View>
          )}
        </View>

        {/* Attach buttons */}
        <View className="flex-row gap-2">
          <Pressable
            onPress={handleCamera}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary active:opacity-70"
          >
            <ImageIcon size={13} color={NAVY} />
            <Text className="text-xs font-semibold" style={{ color: NAVY }}>
              {t('fir.karyvahiDetail.evidence.camera')}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleAttach}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary active:opacity-70"
          >
            <Paperclip size={13} color={NAVY} />
            <Text className="text-xs font-semibold" style={{ color: NAVY }}>
              {t('fir.karyvahiDetail.evidence.attach')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Permission error */}
      {error ? (
        <Text className="text-xs text-destructive">{error}</Text>
      ) : null}

      {/* List */}
      {loading ? (
        <ActivityIndicator size="small" color={NAVY} />
      ) : items.length === 0 ? (
        <View className="items-center py-6 gap-2">
          <Paperclip size={24} color="#D1D5DB" />
          <Text className="text-xs text-muted-foreground text-center">
            {t('fir.karyvahiDetail.evidence.empty')}
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {items.map((item) => (
            <EvidenceItem
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onCaptionSave={handleCaptionSave}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function KaryvahiDetailScreen() {
  const { firId, karyvahiId } = useLocalSearchParams<{ firId: string; karyvahiId: string }>();
  const { t } = useTranslation();

  const [karyvahi, setKaryvahi]         = useState<FIRKaryvahi | null>(null);
  const [playbookItem, setPlaybookItem] = useState<ChecklistItem | null>(null);
  const [executions, setExecutions]     = useState<KaryvahiExecution[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showDelete, setShowDelete]     = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!karyvahiId || !firId) { setLoading(false); return; }
      (async () => {
        try {
          const [k, execs] = await Promise.all([
            getKaryvahiById(karyvahiId, firId),
            getExecutionsByKaryvahi(karyvahiId),
          ]);
          setKaryvahi(k);
          setExecutions(execs);
          if (k?.step_code) {
            try {
              const pi = await getChecklistItemByStepCode(k.step_code);
              setPlaybookItem(pi);
            } catch {
              setPlaybookItem(null);
            }
          } else {
            setPlaybookItem(null);
          }
        } catch { /* ignore */ }
        finally { setLoading(false); }
      })();
    }, [karyvahiId, firId]),
  );

  const handleDelete = async () => {
    if (!karyvahi || !firId) return;
    await deleteKaryvahi(karyvahi.id, firId);
    setShowDelete(false);
    router.back();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  if (!karyvahi) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3 px-8">
        <BookOpen size={32} color="#9CA3AF" />
        <Text className="text-base font-bold text-foreground text-center">{t('fir.karyvahiDetail.notFound')}</Text>
        <Pressable onPress={() => router.back()} className="rounded-xl px-5 py-3 mt-2 active:opacity-70" style={{ backgroundColor: NAVY }}>
          <Text className="text-white text-sm font-bold">{t('fir.karyvahiDetail.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const execCount   = karyvahi.execution_count ?? 0;
  const done        = execCount > 0;
  const isUserAdded = karyvahi.source === 'user';
  const sections    = resolveKnowledgeSections(karyvahi.name, karyvahi.precautions, playbookItem, t);
  const defKey      = matchDefaultKaryvahi(karyvahi.name);
  const defKnowledge = defKey ? getDefaultKnowledge(defKey) : null;
  const headerDescription = defKnowledge ? defKnowledge.what : (karyvahi.precautions || undefined);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={karyvahi.name}
        subtitle={t('fir.karyvahiDetail.subtitle')}
        showBack
        actions={
          isUserAdded ? (
            <Pressable
              onPress={() => setShowDelete(true)}
              className="flex-row items-center gap-1.5 rounded-xl px-3 py-2 active:opacity-70 bg-red-50"
            >
              <Trash2 size={13} color="#DC2626" />
              <Text className="text-xs font-bold" style={{ color: '#DC2626' }}>{t('fir.karyvahiDetail.delete')}</Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Status summary */}
        <View
          className="bg-card border border-border rounded-2xl p-5 gap-4"
          style={{ borderCurve: 'continuous' }}
        >
          <View className="flex-row items-center gap-3">
            {done
              ? <CheckCircle2 size={22} color="#16a34a" />
              : <Circle size={22} color="#D1D5DB" />
            }
            <View className="flex-1">
              <Text className="text-base font-bold text-foreground" numberOfLines={2}>
                {karyvahi.name}
              </Text>
              {headerDescription ? (
                <Text className="text-xs text-muted-foreground mt-0.5 leading-5">
                  {headerDescription}
                </Text>
              ) : null}
              <Text
                className="text-xs mt-0.5"
                style={{ color: done ? '#16a34a' : '#9CA3AF' }}
              >
                {done
                  ? t('fir.karyvahiDetail.completed', { count: execCount })
                  : t('fir.karyvahiDetail.pending')}
              </Text>
            </View>
            {execCount > 0 && (
              <View
                className="rounded-full items-center justify-center px-2.5 py-1"
                style={{ backgroundColor: execCount > 1 ? '#FEF3C7' : '#DCFCE7' }}
              >
                <Text textBreakStrategy="simple"
                  className="text-sm font-bold"
                  style={{ color: execCount > 1 ? '#92400E' : '#15803D' }}
                >
                  ×{execCount}
                </Text>
              </View>
            )}
          </View>

          {execCount > 1 && (
            <View className="flex-row items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertTriangle size={13} color="#D97706" style={{ marginTop: 1 }} />
              <Text className="text-xs flex-1" style={{ color: '#92400E' }}>
                {t('fir.karyvahiDetail.multiExecWarning', { count: execCount })}
              </Text>
            </View>
          )}

          <View className="flex-row items-start gap-2 bg-secondary rounded-xl px-3 py-2">
            <Info size={12} color="#9CA3AF" style={{ marginTop: 1 }} />
            <Text className="text-xs text-muted-foreground flex-1">
              {t('fir.karyvahiDetail.completionNote')}
            </Text>
          </View>
        </View>

        {/* ── Phase 2: Evidence section ─────────────────────────────────── */}
        <EvidenceSection karyvahiId={karyvahi.id} firId={firId!} />

        {/* Knowledge sections */}
        {sections.map((s) => (
          <InfoSection key={s.title} section={s} />
        ))}

        {/* Execution history */}
        {executions.length > 0 && (
          <View className="mt-2">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 mt-4">
              {t('fir.karyvahiDetail.execHistoryLabel', { count: executions.length })}
            </Text>
            {executions.map((ex, i) => (
              <ExecutionRow key={ex.id} exec={ex} idx={i} />
            ))}
          </View>
        )}
      </ScrollView>

      <AlertDialog open={showDelete} onOpenChange={(o) => { if (!o) setShowDelete(false); }}>
        <AlertDialogContent>
          <KeyboardAvoidingView
            behavior={process.env.EXPO_OS === 'ios' ? 'padding' : process.env.EXPO_OS === 'web' ? undefined : 'height'}
            style={{ width: '100%' }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{t('fir.karyvahiDetail.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('fir.karyvahiDetail.deleteDesc', { name: karyvahi.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onPress={() => setShowDelete(false)}><Text>{t('fir.karyvahiDetail.cancel')}</Text></AlertDialogCancel>
              <AlertDialogAction onPress={handleDelete}><Text>{t('fir.karyvahiDetail.delete')}</Text></AlertDialogAction>
            </AlertDialogFooter>
          </KeyboardAvoidingView>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

