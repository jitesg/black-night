/**
 * System Knowledge Manager — Version History
 *
 * Displays all saved versions of a system knowledge article.
 * Owner can: compare two versions (side-by-side diff summary), rollback.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw, GitBranch, Eye, X } from 'lucide-react-native';
import {
  getSysKnowledgeVersions, rollbackSysKnowledge,
  type SysKnowledgeVersion,
} from '@/lib/db/sysKnowledgeRepo';
import { isDevSessionActive } from '@/lib/devOptionsAuth';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const GREEN   = '#059669';
const RED     = '#DC2626';
const MUTED   = '#6B7280';

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function VersionCard({
  version, isLatest, onPreview, onRollback,
}: {
  version: SysKnowledgeVersion;
  isLatest: boolean;
  onPreview: () => void;
  onRollback: () => void;
}) {
  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-start gap-3">
        <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: isLatest ? `${'#1E3A5F'}15` : '#F3F4F6' }}>
          <GitBranch size={16} color={isLatest ? '#1E3A5F' : MUTED} />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-semibold text-foreground">Version {version.version_number}</Text>
            {isLatest && (
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${'#1E3A5F'}15` }}>
                <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: '#1E3A5F' }}>Current</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-muted-foreground">{formatDate(version.created_at)}</Text>
          <Text className="text-xs text-muted-foreground">by {version.created_by}</Text>
        </View>
      </View>

      {!!version.change_notes && (
        <View className="bg-background rounded-xl px-3 py-2.5">
          <Text className="text-xs text-muted-foreground font-medium mb-0.5">Change Notes</Text>
          <Text className="text-sm text-foreground">{version.change_notes}</Text>
        </View>
      )}

      {!!version.title && (
        <Text className="text-sm text-foreground font-medium" numberOfLines={1}>{version.title}</Text>
      )}

      {!!version.content && (
        <Text className="text-xs text-muted-foreground" numberOfLines={3}>{version.content}</Text>
      )}

      <View className="flex-row gap-2">
        <Pressable onPress={onPreview}
          className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl border border-border active:opacity-60">
          <Eye size={14} color='#1E3A5F' />
          <Text className="text-xs font-semibold" style={{ color: '#1E3A5F' }}>Preview</Text>
        </Pressable>
        {!isLatest && (
          <Pressable onPress={onRollback}
            className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl active:opacity-60"
            style={{ backgroundColor: `${'#F59E0B'}15` }}>
            <RotateCcw size={14} color='#2563EB' />
            <Text className="text-xs font-semibold" style={{ color: '#2563EB' }}>Rollback</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function VersionHistoryScreen() {
  const insets   = useSafeAreaInsets();
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const [versions, setVersions]       = useState<SysKnowledgeVersion[]>([]);
  const [loading, setLoading]         = useState(true);
  const [previewVersion, setPreview]  = useState<SysKnowledgeVersion | null>(null);
  const [rollbackTarget, setRollback] = useState<SysKnowledgeVersion | null>(null);
  const [rolling, setRolling]         = useState(false);

  useFocusEffect(useCallback(() => {
    if (!isDevSessionActive()) { router.replace('/(app)/dev-options/pin-entry' as never); return; }
    (async () => {
      setLoading(true);
      try { setVersions(await getSysKnowledgeVersions(articleId)); }
      finally { setLoading(false); }
    })();
  }, [articleId]));

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setRolling(true);
    try {
      await rollbackSysKnowledge(articleId, rollbackTarget.id);
      setVersions(await getSysKnowledgeVersions(articleId));
      setRollback(null);
    } finally { setRolling(false); }
  };

  const latestVersion = versions[0]?.version_number ?? 0;

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <AppHeader
        title="Version History"
        subtitle={`${versions.length} version${versions.length !== 1 ? 's' : ''}`}
        variant="navy"
        onBack={() => router.back()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color='#1E3A5F' /></View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          data={versions}
          keyExtractor={v => v.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}
          ListEmptyComponent={
            <View className="items-center py-16 gap-3">
              <GitBranch size={32} color={MUTED} />
              <Text className="text-sm text-muted-foreground">No version history yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <VersionCard
              version={item}
              isLatest={item.version_number === latestVersion}
              onPreview={() => setPreview(item)}
              onRollback={() => setRollback(item)}
            />
          )}
        />
      )}

      {/* Preview modal */}
      <Modal visible={!!previewVersion} transparent animationType="slide"
        onRequestClose={() => setPreview(null)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-card rounded-t-3xl" style={{ maxHeight: '80%', paddingBottom: insets.bottom + 16 }}>
            <View className="flex-row items-center px-5 pt-4 pb-3">
              <View className="h-1 w-12 rounded-full bg-border" style={{ alignSelf: 'center', marginBottom: 8 }} />
              <Text className="flex-1 text-base font-semibold text-foreground">
                Version {previewVersion?.version_number} Preview
              </Text>
              <Pressable onPress={() => setPreview(null)} className="w-8 h-8 items-center justify-center">
                <X size={18} color={MUTED} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 12 }}>
              {previewVersion && (
                <>
                  <View>
                    <Text className="text-xs font-semibold text-muted-foreground mb-1">Title</Text>
                    <Text className="text-sm text-foreground font-medium">{previewVersion.title}</Text>
                  </View>
                  {!!previewVersion.subtitle && (
                    <View>
                      <Text className="text-xs font-semibold text-muted-foreground mb-1">Subtitle</Text>
                      <Text className="text-sm text-foreground">{previewVersion.subtitle}</Text>
                    </View>
                  )}
                  <View>
                    <Text className="text-xs font-semibold text-muted-foreground mb-1">Category</Text>
                    <Text className="text-sm text-foreground">{previewVersion.category} {previewVersion.subcategory ? `> ${previewVersion.subcategory}` : ''}</Text>
                  </View>
                  {!!previewVersion.change_notes && (
                    <View>
                      <Text className="text-xs font-semibold text-muted-foreground mb-1">Change Notes</Text>
                      <Text className="text-sm text-foreground">{previewVersion.change_notes}</Text>
                    </View>
                  )}
                  {!!previewVersion.content && (
                    <View>
                      <Text className="text-xs font-semibold text-muted-foreground mb-1">Content Preview</Text>
                      <Text className="text-sm text-foreground" numberOfLines={20}>{previewVersion.content}</Text>
                    </View>
                  )}
                  <View className="pt-2">
                    <Text className="text-xs text-muted-foreground">Tags: {previewVersion.tags_snapshot}</Text>
                    <Text className="text-xs text-muted-foreground">Saved: {formatDate(previewVersion.created_at)}</Text>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rollback confirm */}
      <AlertDialog open={!!rollbackTarget} onOpenChange={o => { if (!o) setRollback(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback to v{rollbackTarget?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The article content will be restored to version {rollbackTarget?.version_number}.
              A new version will be created to record this rollback.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setRollback(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onPress={handleRollback} style={{ backgroundColor: '#2563EB' }}>
              {rolling
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text className="text-white text-sm font-semibold">Rollback</Text>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
