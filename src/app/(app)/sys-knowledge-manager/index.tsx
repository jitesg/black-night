/**
 * System Knowledge Manager — Dashboard
 *
 * Owner-only analytics: total / published / draft / archived,
 * category breakdown, recently updated, quick-access actions.
 *
 * Access: Developer Options → System Knowledge Management
 * Guard:  isDevSessionActive() — session inherited from Dev Options PIN.
 */
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpen, CheckCircle2, FileEdit, Archive, Plus, List,
  FolderOpen, Clock, BarChart3, LogOut, Download, Upload,
} from 'lucide-react-native';
import { isDevSessionActive } from '@/lib/devOptionsAuth';
import { getSysKnowledgeStats, type SysKnowledgeStats } from '@/lib/db/sysKnowledgeRepo';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledgeConstants';

const GREEN   = '#059669';
const MUTED   = '#6B7280';

function StatCard({
  label, value, icon: Icon, color, onPress,
}: {
  label: string; value: number;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string; onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-1 rounded-2xl bg-card border border-border p-4 gap-2 active:opacity-70"
      style={{ borderCurve: 'continuous', minWidth: 0 }}
    >
      <View className="w-8 h-8 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${color}15` }}>
        <Icon size={16} color={color} />
      </View>
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </Pressable>
  );
}

function ActionRow({
  label, icon: Icon, color = '#1E3A5F', onPress,
}: {
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-4 active:opacity-60"
    >
      <View className="w-8 h-8 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${color}15` }}>
        <Icon size={16} color={color} />
      </View>
      <Text className="flex-1 text-sm font-medium text-foreground">{label}</Text>
    </Pressable>
  );
}

function SectionDivider() {
  return <View className="h-px bg-border mx-4" />;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function SysKnowledgeDashboard() {
  const insets = useSafeAreaInsets();
  const [stats, setStats]     = useState<SysKnowledgeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!isDevSessionActive()) {
      router.replace('/(app)/dev-options/pin-entry' as never);
      return;
    }
    (async () => {
      setLoading(true);
      try { setStats(await getSysKnowledgeStats()); }
      finally { setLoading(false); }
    })();
  }, []));

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="System Knowledge"
        subtitle="Owner · Content Management System"
        variant="navy"
        onBack={() => router.back()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color='#1E3A5F' />
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 20, paddingTop: 20 }}
        >
          {/* ── Stat cards ─────────────────────────────────────────────── */}
          <View className="flex-row gap-3">
            <StatCard label="Total"     value={stats?.total     ?? 0} icon={BookOpen}    color='#1E3A5F'    onPress={() => router.push('/(app)/sys-knowledge-manager/list' as never)} />
            <StatCard label="Published" value={stats?.published ?? 0} icon={CheckCircle2} color={GREEN}  onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/list' as never, params: { status: 'published' } })} />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="Draft"    value={stats?.draft    ?? 0} icon={FileEdit} color='#2563EB' onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/list' as never, params: { status: 'draft' } })} />
            <StatCard label="Archived" value={stats?.archived ?? 0} icon={Archive}  color={MUTED}   onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/list' as never, params: { status: 'archived' } })} />
          </View>

          {/* ── Quick actions ───────────────────────────────────────────── */}
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
              Quick Actions
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
              <ActionRow label="New Article"          icon={Plus}       onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/editor' as never, params: { articleId: '' } })} />
              <SectionDivider />
              <ActionRow label="All Articles"         icon={List}       onPress={() => router.push('/(app)/sys-knowledge-manager/list' as never)} />
              <SectionDivider />
              <ActionRow label="Manage Categories"    icon={FolderOpen} onPress={() => router.push('/(app)/sys-knowledge-manager/categories' as never)} />
              <SectionDivider />
              <ActionRow label="Bulk Export (JSON)"   icon={Download}   color="#0891B2" onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/list' as never, params: { mode: 'export' } })} />
              <SectionDivider />
              <ActionRow label="Bulk Import (JSON)"   icon={Upload}     color="#7C3AED" onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/list' as never, params: { mode: 'import' } })} />
            </View>
          </View>

          {/* ── Category breakdown ──────────────────────────────────────── */}
          {stats && Object.keys(stats.byCategory).length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
                Category Breakdown
              </Text>
              <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
                {Object.entries(stats.byCategory).map(([cat, cnt], i, arr) => {
                  const catDef = KNOWLEDGE_CATEGORIES.find(c => c.id === cat);
                  return (
                    <View key={cat}>
                      <Pressable
                        onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/list' as never, params: { category: cat } })}
                        className="flex-row items-center px-4 py-3 gap-3 active:opacity-60"
                      >
                        <View className="w-7 h-7 rounded-lg items-center justify-center"
                          style={{ backgroundColor: `${catDef?.color ?? MUTED}15` }}>
                          <BarChart3 size={14} color={catDef?.color ?? MUTED} />
                        </View>
                        <Text className="flex-1 text-sm text-foreground">{cat}</Text>
                        <Text className="text-sm font-semibold text-muted-foreground">{cnt}</Text>
                      </Pressable>
                      {i < arr.length - 1 && <SectionDivider />}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Recently updated ────────────────────────────────────────── */}
          {stats && stats.recentlyUpdated.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
                Recently Updated
              </Text>
              <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
                {stats.recentlyUpdated.map((a, i) => (
                  <View key={a.id}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/(app)/sys-knowledge-manager/editor' as never, params: { articleId: a.id } })}
                      className="flex-row items-center px-4 py-3 gap-3 active:opacity-60"
                    >
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>{a.title}</Text>
                        <Text className="text-xs text-muted-foreground mt-0.5">{a.category} · {formatDate(a.updated_at)}</Text>
                      </View>
                      <View
                        className="rounded-full px-2.5 py-1"
                        style={{ backgroundColor: a.status === 'published' ? '#D1FAE5' : a.status === 'archived' ? '#F3F4F6' : '#FEF3C7' }}
                      >
                        <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: a.status === 'published' ? GREEN : a.status === 'archived' ? MUTED : '#F59E0B' }}>
                          {a.status}
                        </Text>
                      </View>
                    </Pressable>
                    {i < stats.recentlyUpdated.length - 1 && <SectionDivider />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Sign out ────────────────────────────────────────────────── */}
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center justify-center gap-2 py-3 active:opacity-60"
          >
            <LogOut size={16} color={MUTED} />
            <Text className="text-sm text-muted-foreground">Back to Developer Options</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
