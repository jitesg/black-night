import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  BookOpen, Clock, Edit2, FileText, Paperclip,
  Search, Trash2, Users,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import {
  getKnowledgeById, deleteKnowledgeEntry, type KnowledgeEntry,
} from '@/lib/db/knowledgeRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const COLOR = '#0891B2';

type GuideType = 'sops' | 'evidence' | 'witness' | 'charge-sheet';

interface GuideConfig {
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  contentLabel: string;
}

const GUIDE_CONFIG: Record<GuideType, GuideConfig> = {
  sops: {
    label: 'Crime-wise Investigation SOPs',
    icon: BookOpen,
    contentLabel: 'SOP Content',
  },
  evidence: {
    label: 'Evidence Collection',
    icon: Search,
    contentLabel: 'Evidence Collection Steps',
  },
  witness: {
    label: 'Witness Handling',
    icon: Users,
    contentLabel: 'Witness Handling Guidelines',
  },
  'charge-sheet': {
    label: 'Charge Sheet Guide',
    icon: FileText,
    contentLabel: 'Charge Sheet Guidance',
  },
};

function isGuideType(v: string | undefined): v is GuideType {
  return v === 'sops' || v === 'evidence' || v === 'witness' || v === 'charge-sheet';
}

function fmtTs(ts: number) {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface AttachmentItem {
  uri: string;
  name: string;
  type: string;
}

export default function GuideDetailScreen() {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const { guideId, type } = useLocalSearchParams<{ guideId: string; type?: string }>();
  const guideType = isGuideType(type) ? type : 'sops';
  const config = GUIDE_CONFIG[guideType];
  const Icon = config.icon;

  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!guideId) return;
      (async () => {
        setLoading(true);
        const e = await getKnowledgeById(guideId);
        setEntry(e);
        setLoading(false);
      })();
    }, [guideId])
  );

  const handleDeleteConfirm = async () => {
    if (!entry) return;
    await deleteKnowledgeEntry(entry.id);
    setShowDelete(false);
    router.back();
  };

  const attachments: AttachmentItem[] = (() => {
    try { return JSON.parse(entry?.attachment_uris ?? '[]') as AttachmentItem[]; } catch { return []; }
  })();

  const tagList = (entry?.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading…</Text>
      </View>
    );
  }

  if (!entry) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3 px-6">
        <Text className="text-base font-semibold text-foreground">Record not found</Text>
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <Text className="text-sm" style={{ color: COLOR }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={entry.title} subtitle={config.label}
        showBack
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Action buttons */}
        <View className="flex-row gap-2">
          <Pressable
            onPress={() =>
              router.push(
                `/(app)/knowledge/investigation-guides/add-guide?type=${guideType}&editId=${entry.id}` as never
              )
            }
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:opacity-70 border border-border bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <Edit2 size={14} color={C.mutedForeground} />
            <Text className="text-sm font-medium text-foreground">Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowDelete(true)}
            className="w-10 items-center justify-center rounded-xl active:opacity-70 border border-border bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <Trash2 size={14} color={C.destructive} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="px-6 py-5 gap-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Badges */}
        <View className="flex-row flex-wrap gap-2">
          {entry.crime_type ? (
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: `${COLOR}15` }}
            >
              <Text className="text-xs font-semibold" style={{ color: COLOR }}>
                {entry.crime_type}
              </Text>
            </View>
          ) : null}
          <View className="rounded-full px-3 py-1 bg-secondary">
            <Text className="text-xs font-medium text-muted-foreground">
              {entry.subcategory}
            </Text>
          </View>
        </View>

        {/* Main content */}
        <View
          className="bg-card border border-border rounded-2xl p-4 gap-2"
          style={{ borderCurve: 'continuous' }}
        >
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {config.contentLabel}
          </Text>
          <Text className="text-base text-foreground leading-7" selectable>
            {entry.description}
          </Text>
        </View>

        {/* Tags */}
        {tagList.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {tagList.map((tag, idx) => (
              <View key={`${idx}-${tag}`} className="bg-secondary rounded-full px-3 py-1">
                <Text className="text-xs text-muted-foreground">{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <View
            className="bg-card border border-border rounded-2xl overflow-hidden"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="px-4 py-3 border-b border-border/60 flex-row items-center gap-2">
              <Paperclip size={13} color={C.mutedForeground} />
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Attachments ({attachments.length})
              </Text>
            </View>
            {attachments.map((att, idx) => (
              <View
                key={att.uri}
                className="px-4 py-3 flex-row items-center gap-3"
                style={{
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: C.border,
                }}
              >
                <Paperclip size={14} color={C.mutedForeground} />
                <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                  {att.name}
                </Text>
                <Text className="text-xs text-muted-foreground">{att.type}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Audit */}
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Clock size={12} color={C.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              Created: {fmtTs(entry.created_at)}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Clock size={12} color={C.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              Modified: {fmtTs(entry.updated_at)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Delete confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Delete{' '}
              <Text className="font-semibold text-foreground">{entry.title}</Text>
              ? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDelete(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
