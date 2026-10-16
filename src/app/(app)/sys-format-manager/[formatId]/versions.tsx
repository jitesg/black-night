/**
 * System Format Manager — Version History
 * Shows all version snapshots for a format with rollback capability.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { History, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react-native';
import { stripHtmlTags } from '@/lib/stringUtils';
import {
  getVersionHistory, rollbackToVersion, type SysFormatVersion,
} from '@/lib/db/sysFormatRepo';
import { getFormatById } from '@/lib/db/predefinedFormatRepo';
import { isSessionActive, touchSession } from '@/lib/sysFormatAuth';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const NAVY = '#1E3A5F';
const SAFFRON = '#2563EB';
function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function SysFormatVersionsScreen() {

  const { formatId } = useLocalSearchParams<{ formatId: string }>();

  const [versions, setVersions]       = useState<SysFormatVersion[]>([]);
  const [formatTitle, setFormatTitle] = useState('');
  const [currentVersion, setCurrentV] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [rollbackTarget, setRollback] = useState<SysFormatVersion | null>(null);
  const [rolling, setRolling]         = useState(false);

  useFocusEffect(useCallback(() => {
    if (!isSessionActive()) { router.replace('/(app)/sys-format-manager' as never); return; }
    touchSession();
    (async () => {
      setLoading(true);
      try {
        const [vList, fmt] = await Promise.all([
          getVersionHistory(formatId),
          getFormatById(formatId),
        ]);
        setVersions(vList);
        setFormatTitle(fmt?.title ?? formatId);
        setCurrentV(fmt?.version ?? 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [formatId]));

  async function handleRollback() {
    if (!rollbackTarget) return;
    setRolling(true);
    try {
      await rollbackToVersion(formatId, rollbackTarget.id);
      setRollback(null);
      // Reload
      const [vList, fmt] = await Promise.all([
        getVersionHistory(formatId),
        getFormatById(formatId),
      ]);
      setVersions(vList);
      setCurrentV(fmt?.version ?? 0);
    } finally {
      setRolling(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={formatTitle}
        subtitle="Version History"
        showBack
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : versions.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <History size={40} color="#D1D5DB" />
          <Text className="text-base font-semibold text-muted-foreground text-center">
            No version snapshots yet
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            Snapshots are created automatically when you edit a format.
          </Text>
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          data={versions}
          keyExtractor={(v) => v.id}
          contentContainerClassName="px-4 py-4 gap-3 pb-10"
          contentInsetAdjustmentBehavior="automatic"
          renderItem={({ item }) => {
            const isCurrent = item.version_number === currentVersion;
            const isOpen    = expanded === item.id;
            const keys: Array<{ key_name: string; label: string }> = (() => {
              try { return JSON.parse(item.keys_snapshot); } catch { return []; }
            })();
            const tags: string[] = (() => {
              try { return JSON.parse(item.tags_snapshot); } catch { return []; }
            })();

            return (
              <View
                className="bg-card border border-border rounded-2xl overflow-hidden"
                style={{
                  borderCurve: 'continuous',
                  borderLeftWidth: isCurrent ? 3 : 1,
                  borderLeftColor: isCurrent ? '#059669' : undefined,
                }}
              >
                <Pressable
                  onPress={() => setExpanded(isOpen ? null : item.id)}
                  className="flex-row items-center px-4 py-3 gap-3 active:opacity-70"
                >
                  <View className="w-9 h-9 rounded-xl items-center justify-center"
                    style={{ backgroundColor: isCurrent ? '#05996918' : `${NAVY}10` }}>
                    <Text className="text-sm font-bold"
                      style={{ color: isCurrent ? '#059669' : NAVY }}>
                      v{item.version_number}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {item.title}
                      </Text>
                      {isCurrent && (
                        <View className="px-1.5 py-0.5 rounded-full bg-green-100">
                          <Text className="text-xs text-green-700 font-medium">Current</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {formatDate(item.created_at)} · {item.created_by}
                    </Text>
                    {item.change_notes ? (
                      <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                        {item.change_notes}
                      </Text>
                    ) : null}
                  </View>
                  {isOpen ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
                </Pressable>

                {isOpen && (
                  <View className="border-t border-border px-4 py-3 gap-3">
                    <View>
                      <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        Template Description
                      </Text>
                      <Text className="text-sm text-foreground leading-5">{stripHtmlTags(item.vivran) || '—'}</Text>
                    </View>
                    {keys.length > 0 && (
                      <View>
                        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                          Fields ({keys.length})
                        </Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {keys.map((k) => (
                            <View key={k.key_name} className="px-2 py-1 bg-muted rounded-full">
                              <Text className="text-xs text-muted-foreground">{k.label || k.key_name}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    {tags.length > 0 && (
                      <View>
                        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                          Tags
                        </Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {tags.map((t, idx) => (
                            <View key={`${idx}-${t}`} className="px-2 py-1 bg-muted rounded-full">
                              <Text className="text-xs text-muted-foreground">{t}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    {!isCurrent && (
                      <Pressable
                        onPress={() => setRollback(item)}
                        className="flex-row items-center justify-center gap-2 rounded-xl py-2.5 active:opacity-70"
                        style={{ backgroundColor: `${NAVY}10` }}
                      >
                        <RotateCcw size={14} color={NAVY} />
                        <Text className="text-sm font-semibold" style={{ color: NAVY }}>
                          Roll Back to v{item.version_number}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <AlertDialog open={!!rollbackTarget} onOpenChange={(v) => !v && setRollback(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll Back to v{rollbackTarget?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new version with the content from v{rollbackTarget?.version_number}.
              The current version is preserved in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Text>Cancel</Text></AlertDialogCancel>
            <AlertDialogAction onPress={handleRollback} disabled={rolling}>
              {rolling ? <Text>Rolling back…</Text> : <Text>Roll Back</Text>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
