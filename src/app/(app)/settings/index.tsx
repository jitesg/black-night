/**
 * Settings Home — Grouped settings list with live search
 * Route: (app)/settings/index
 */
import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Search, User, Globe, Palette, Bell,
  Clock, SlidersHorizontal, Sparkles, Database, Download,
  Shield, Info, HelpCircle, ChevronRight, Settings,
} from 'lucide-react-native';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import { SearchBar } from '@/components/SearchBar';


// ── Setting Item Definition ───────────────────────────────────────────────
interface SettingItem {
  id: string;
  icon: typeof Settings;
  color: string;
  titleKey: string;
  descKey: string;
  route: string;
  keywords: string[];
  badgeKey?: string;
}

const ALL_SETTINGS: SettingItem[] = [
  {
    id: 'profile',
    icon: User,
    color: '#1E3A5F',
    titleKey: 'settings.items.profile.title',
    descKey: 'settings.items.profile.desc',
    route: '/(app)/workspace-setup',
    keywords: ['profile', 'officer', 'name', 'rank', 'designation', 'posting', 'station', 'district', 'halka', 'beat', 'photo'],
  },
  {
    id: 'language',
    icon: Globe,
    color: '#1D4ED8',
    titleKey: 'settings.items.language.title',
    descKey: 'settings.items.language.desc',
    route: '/(app)/settings/language',
    keywords: ['language', 'hindi', 'english', 'bhasha', 'locale'],
  },
  {
    id: 'appearance',
    icon: Palette,
    color: '#7C3AED',
    titleKey: 'settings.items.appearance.title',
    descKey: 'settings.items.appearance.desc',
    route: '/(app)/settings/appearance',
    keywords: ['theme', 'dark', 'light', 'appearance', 'color', 'mode', 'system'],
  },
  {
    id: 'notifications',
    icon: Bell,
    color: '#D97706',
    titleKey: 'settings.items.notifications.title',
    descKey: 'settings.items.notifications.desc',
    route: '/(app)/settings/notifications',
    keywords: ['notification', 'alert', 'reminder', 'court', 'deadline', 'summary', 'push'],
  },
  {
    id: 'reminders',
    icon: Clock,
    color: '#F59E0B',
    titleKey: 'settings.items.reminders.title',
    descKey: 'settings.items.reminders.desc',
    route: '/(app)/settings/reminders',
    keywords: ['reminder', 'time', 'sound', 'snooze', 'repeat', 'alarm', 'schedule'],
  },
  {
    id: 'search',
    icon: SlidersHorizontal,
    color: '#0891B2',
    titleKey: 'settings.items.search.title',
    descKey: 'settings.items.search.desc',
    route: '/(app)/settings/search-prefs',
    keywords: ['search', 'history', 'suggestion', 'autocomplete', 'typo', 'highlight', 'instant'],
  },
  {
    id: 'ai',
    icon: Sparkles,
    color: '#7C3AED',
    titleKey: 'settings.items.ai.title',
    descKey: 'settings.items.ai.desc',
    route: '/(app)/settings/ai-assistant',
    keywords: ['ai', 'artificial intelligence', 'suggestions', 'draft', 'report', 'smart'],
  },
  {
    id: 'backup',
    icon: Database,
    color: '#10B981',
    titleKey: 'settings.items.backup.title',
    descKey: 'settings.items.backup.desc',
    route: '/(app)/settings/data-backup',
    keywords: ['backup', 'restore', 'data', 'database', 'sync', 'save'],
  },
  {
    id: 'export',
    icon: Download,
    color: '#0F766E',
    titleKey: 'settings.items.export.title',
    descKey: 'settings.items.export.desc',
    route: '/(app)/settings/import-export',
    keywords: ['export', 'import', 'pdf', 'json', 'reports', 'database', 'transfer'],
  },
  {
    id: 'security',
    icon: Shield,
    color: '#DC2626',
    titleKey: 'settings.items.security.title',
    descKey: 'settings.items.security.desc',
    route: '/(app)/settings/security',
    keywords: ['security', 'lock', 'pin', 'biometric', 'fingerprint', 'privacy', 'sensitive'],
  },
  {
    id: 'about',
    icon: Info,
    color: '#6B7280',
    titleKey: 'settings.items.about.title',
    descKey: 'settings.items.about.desc',
    route: '/(app)/settings/about',
    keywords: ['about', 'version', 'build', 'license', 'terms', 'privacy policy', 'release'],
  },
  {
    id: 'help',
    icon: HelpCircle,
    color: '#7C3AED',
    titleKey: 'settings.items.help.title',
    descKey: 'settings.items.help.desc',
    route: '/(app)/settings/help',
    keywords: ['help', 'support', 'guide', 'faq', 'bug', 'feedback', 'contact'],
  },
];

// ── Group definitions (use translation keys for labels) ───────────────────
const GROUPS = [
  { labelKey: 'settings.groups.account',      ids: ['profile', 'language', 'appearance'] },
  { labelKey: 'settings.groups.alertsSearch', ids: ['notifications', 'reminders', 'search'] },
  { labelKey: 'settings.groups.aiData',       ids: ['ai', 'backup', 'export'] },
  { labelKey: 'settings.groups.security',     ids: ['security'] },
  { labelKey: 'settings.groups.information',  ids: ['about', 'help'] },
];

// ── Setting row ───────────────────────────────────────────────────────────
function SettingRow({ item, isLast }: { item: SettingItem; isLast: boolean }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <Pressable
      onPress={() => router.push(item.route as never)}
      className={`flex-row items-center gap-3 px-4 py-4 active:opacity-70 ${isLast ? '' : 'border-b border-border'}`}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${item.color}15` }}
      >
        <Icon size={16} color={item.color} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold text-foreground">{t(item.titleKey)}</Text>
          {item.badgeKey ? (
            <View className="rounded-full bg-muted px-2.5 py-1">
              <Text textBreakStrategy="simple" className="text-xs font-semibold text-muted-foreground">{t(item.badgeKey)}</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-xs text-muted-foreground mt-0.5 leading-4">{t(item.descKey)}</Text>
      </View>
      <ChevronRight size={15} color="#D1D5DB" />
    </Pressable>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { settings } = useSettingsStore();

  // Reset search on focus (e.g. navigating back from sub-screen)
  useFocusEffect(useCallback(() => { setQuery(''); }, []));

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return ALL_SETTINGS.filter(
      (s) =>
        t(s.titleKey).toLowerCase().includes(q) ||
        t(s.descKey).toLowerCase().includes(q) ||
        s.keywords.some((k) => k.includes(q)),
    );
  }, [query, t]);

  const langLabel = settings.language === 'hi' ? 'हिन्दी' : 'English';
  const themeLabel = settings.theme === 'light' ? 'Light' : settings.theme === 'dark' ? 'Dark' : 'System';

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AppHeader title={t('settings.title')} onMenuPress={() => setDrawerOpen(true)} />
      <View className="px-4 pt-3 pb-2 border-b border-border bg-background">
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('settings.searchPlaceholder')}
          variant="light"
          accessibilityLabel={t('settings.searchAccessibility')}
        />
      </View>

      {/* ── Search results ── */}
      {filtered !== null ? (
        <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View className="items-center py-16 gap-3">
              <Search size={28} color="#D1D5DB" />
              <Text className="text-sm text-muted-foreground text-center">
                {t('settings.noResultsFor', { query })}
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                {t('settings.resultCount', { count: filtered.length })}
              </Text>
              <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
                {filtered.map((item, idx) => (
                  <SettingRow key={item.id} item={item} isLast={idx === filtered.length - 1} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        /* ── Grouped list ── */
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary strip */}
          <View
            className="flex-row items-center gap-4 bg-card border border-border rounded-2xl px-4 py-3 mb-5"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-1 items-center">
              <Text className="text-xs font-bold text-foreground">{langLabel}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.summaryLanguage')}</Text>
            </View>
            <View className="w-px h-8 bg-border" />
            <View className="flex-1 items-center">
              <Text className="text-xs font-bold text-foreground">{themeLabel}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.summaryTheme')}</Text>
            </View>
            <View className="w-px h-8 bg-border" />
            <View className="flex-1 items-center">
              <Text className="text-xs font-bold text-foreground">
                {settings.appLock ? t('settings.summaryOn') : t('settings.summaryOff')}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.summaryAppLock')}</Text>
            </View>
          </View>

          {GROUPS.map((group) => {
            const items = group.ids
              .map((id) => ALL_SETTINGS.find((s) => s.id === id))
              .filter(Boolean) as SettingItem[];
            return (
              <View key={group.labelKey} className="mb-5">
                <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">
                  {t(group.labelKey)}
                </Text>
                <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
                  {items.map((item, idx) => (
                    <SettingRow key={item.id} item={item} isLast={idx === items.length - 1} />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
