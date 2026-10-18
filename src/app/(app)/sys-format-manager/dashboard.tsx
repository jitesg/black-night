/**
 * System Format Manager — Dashboard
 * Owner-only stats: total / published / draft / archived + category breakdown + recent.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  LayoutTemplate, CheckCircle2, FileEdit, Archive,
  Clock, BarChart3, Plus, List, LogOut, Settings, RefreshCw,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { getSysStats, type SysFormatStats } from '@/lib/db/sysFormatRepo';
import { clearSession, isSessionActive, changePin } from '@/lib/sysFormatAuth';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

function StatCard({
  label, value, icon: Icon, color, onPress,
}: {
  label: string; value: number; icon: typeof LayoutTemplate; color: string; onPress?: () => void;
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

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function SysFormatDashboard() {
  const { t } = useTranslation();
  const [stats, setStats]         = useState<SysFormatStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [logoutDialog, setLogout] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!isSessionActive()) {
      router.replace('/(app)/sys-format-manager' as never);
      return;
    }
    (async () => {
      setLoading(true);
      try { setStats(await getSysStats()); }
      finally { setLoading(false); }
    })();
  }, []));

  function handleLogout() {
    clearSession();
    router.replace('/(app)/home' as never);
  }

  const sortedCategories = Object.entries(stats?.byCategory ?? {})
    .sort((a, b) => b[1] - a[1]);

  return (
    <View className="flex-1 bg-background">

      {/* Header */}
      <AppHeader
        title={t('sysFormat.dashboard.title')}
        subtitle={t('sysFormat.dashboard.subtitle')}
        showBack
        actions={
          <HeaderIconBtn
            icon={LogOut}
            onPress={() => setLogout(true)}
            label={t('sysFormat.dashboard.logoutLabel')}
          />
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color='#1E3A5F' />
          <Text className="text-sm text-muted-foreground">{t('sysFormat.dashboard.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-4 pt-5 pb-10 gap-5"
        >
          {/* Quick actions */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push('/(app)/sys-format-manager/editor' as never)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3 active:opacity-70"
              style={{ backgroundColor: '#1E3A5F', borderCurve: 'continuous' }}
            >
              <Plus size={16} color="#fff" />
              <Text className="text-sm font-semibold text-white">{t('sysFormat.dashboard.newFormat')}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/sys-format-manager/list' as never)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3 border border-border bg-card active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <List size={16} color='#1E3A5F' />
              <Text className="text-sm font-semibold" style={{ color: '#1E3A5F' }}>{t('sysFormat.dashboard.allFormats')}</Text>
            </Pressable>
          </View>

          {/* Stat cards */}
          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              {t('sysFormat.dashboard.overviewSection')}
            </Text>
            <View className="flex-row gap-3 mb-3">
              <StatCard label={t('sysFormat.dashboard.statTotal')} value={stats?.total ?? 0}
                icon={LayoutTemplate} color='#1E3A5F'
                onPress={() => router.push('/(app)/sys-format-manager/list' as never)} />
              <StatCard label={t('sysFormat.dashboard.statPublished')} value={stats?.published ?? 0}
                icon={CheckCircle2} color="#059669"
                onPress={() => router.push({ pathname: '/(app)/sys-format-manager/list' as never, params: { status: 'published' } })} />
            </View>
            <View className="flex-row gap-3">
              <StatCard label={t('sysFormat.dashboard.statDraft')} value={stats?.draft ?? 0}
                icon={FileEdit} color='#2563EB'
                onPress={() => router.push({ pathname: '/(app)/sys-format-manager/list' as never, params: { status: 'draft' } })} />
              <StatCard label={t('sysFormat.dashboard.statArchived')} value={stats?.archived ?? 0}
                icon={Archive} color="#6B7280"
                onPress={() => router.push({ pathname: '/(app)/sys-format-manager/list' as never, params: { status: 'archived' } })} />
            </View>
          </View>

          {/* Recently updated */}
          {(stats?.recentlyUpdated?.length ?? 0) > 0 && (
            <View>
              <View className="flex-row items-center gap-2 mb-3">
                <Clock size={14} color='#1E3A5F' />
                <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t('sysFormat.dashboard.recentSection')}
                </Text>
              </View>
              <View className="gap-2">
                {stats!.recentlyUpdated.map((f) => {
                  const status = (f as unknown as Record<string, string>).status ?? 'published';
                  const statusColor = status === 'published' ? '#059669'
                    : status === 'draft' ? '#F59E0B' : '#6B7280';
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => router.push({
                        pathname: '/(app)/sys-format-manager/editor' as never,
                        params: { editId: f.id },
                      })}
                      className="flex-row items-center gap-3 bg-card border border-border rounded-2xl p-3 active:opacity-70"
                      style={{ borderCurve: 'continuous' }}
                    >
                      <View className="w-8 h-8 rounded-xl items-center justify-center"
                        style={{ backgroundColor: `${'#1E3A5F'}10` }}>
                        <LayoutTemplate size={14} color='#1E3A5F' />
                      </View>
                      <View className="flex-1 gap-0.5">
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                          {f.title}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {f.format_type} · v{f.version} · {formatDate(f.updated_at)}
                        </Text>
                      </View>
                      <View className="rounded-full px-2.5 py-1"
                        style={{ backgroundColor: `${statusColor}15` }}>
                        <Text textBreakStrategy="simple" className="text-xs font-semibold capitalize"
                          style={{ color: statusColor }}>{status}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Category breakdown */}
          {sortedCategories.length > 0 && (
            <View>
              <View className="flex-row items-center gap-2 mb-3">
                <BarChart3 size={14} color='#1E3A5F' />
                <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t('sysFormat.dashboard.categorySection')}
                </Text>
              </View>
              <View className="bg-card border border-border rounded-2xl overflow-hidden"
                style={{ borderCurve: 'continuous' }}>
                {sortedCategories.map(([cat, count], idx) => (
                  <View key={cat}>
                    {idx > 0 && <View className="h-px bg-border mx-4" />}
                    <View className="flex-row items-center justify-between px-4 py-3">
                      <Text className="text-sm text-foreground">{cat}</Text>
                      <View className="flex-row items-center gap-2">
                        <View className="h-1.5 rounded-full bg-muted overflow-hidden" style={{ width: 60 }}>
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round((count / (stats?.total || 1)) * 100)}%`,
                              backgroundColor: '#1E3A5F',
                            }}
                          />
                        </View>
                        <Text className="text-xs font-semibold text-muted-foreground w-5 text-right">
                          {count}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Refresh */}
          <Pressable
            onPress={async () => {
              setLoading(true);
              try { setStats(await getSysStats()); }
              finally { setLoading(false); }
            }}
            className="flex-row items-center justify-center gap-2 rounded-2xl py-3 border border-border active:opacity-70"
            style={{ borderCurve: 'continuous' }}
          >
            <RefreshCw size={15} color="#6B7280" />
            <Text className="text-sm text-muted-foreground">{t('sysFormat.dashboard.refresh')}</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Logout confirm */}
      <AlertDialog open={logoutDialog} onOpenChange={setLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sysFormat.dashboard.logoutTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sysFormat.dashboard.logoutDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Text>{t('sysFormat.dashboard.cancel')}</Text></AlertDialogCancel>
            <AlertDialogAction onPress={handleLogout}><Text>{t('sysFormat.dashboard.endSession')}</Text></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
