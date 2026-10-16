import { useCallback, useState } from 'react';
import { logger } from '@/lib/logger';
import { Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  BookOpen, ChevronRight, ClipboardList,
  FileText, Search, Shield, Users,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { getDatabase } from '@/lib/db/database';

const COLOR = '#0891B2';

// ─── Guide section definitions ────────────────────────────────────────────
interface GuideSection {
  type: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  route: string;
  subcategory: string;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    type: 'checklists',
    label: 'Investigation Checklists',
    subtitle: 'Master Checklist Library · auto-fills Mukadma Karyvahi',
    icon: ClipboardList,
    route: '/(app)/knowledge/checklists',
    subcategory: 'Investigation Checklists',
  },
  {
    type: 'sops',
    label: 'Crime-wise Investigation SOPs',
    subtitle: 'Standard operating procedures by crime type',
    icon: BookOpen,
    route: '/(app)/knowledge/investigation-guides/guide-list?type=sops',
    subcategory: 'Crime-wise Investigation',
  },
  {
    type: 'evidence',
    label: 'Evidence Collection',
    subtitle: 'Evidence collection steps and field procedures',
    icon: Search,
    route: '/(app)/knowledge/investigation-guides/guide-list?type=evidence',
    subcategory: 'Evidence Collection',
  },
  {
    type: 'witness',
    label: 'Witness Handling',
    subtitle: 'Witness interview and protection guidelines',
    icon: Users,
    route: '/(app)/knowledge/investigation-guides/guide-list?type=witness',
    subcategory: 'Witness Handling',
  },
  {
    type: 'charge-sheet',
    label: 'Charge Sheet Guide',
    subtitle: 'Charge sheet preparation and documentation guidance',
    icon: FileText,
    route: '/(app)/knowledge/investigation-guides/guide-list?type=charge-sheet',
    subcategory: 'Charge Sheet Guide',
  },
];

// ─── Counts per subcategory ───────────────────────────────────────────────
async function getGuideCounts(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ subcategory: string; cnt: number }>(
    `SELECT subcategory, COUNT(*) as cnt
     FROM knowledge_entries
     WHERE category='Investigation Guides' AND deleted_at IS NULL
     GROUP BY subcategory`
  );
  const map: Record<string, number> = {};
  for (const r of rows) { map[r.subcategory] = r.cnt; }
  return map;
}

async function getChecklistCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM investigation_checklists WHERE deleted_at IS NULL`
  );
  return row?.cnt ?? 0;
}

// ─── Section Card ─────────────────────────────────────────────────────────
function SectionCard({
  section, count, onPress,
}: {
  section: GuideSection; count: number; onPress: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const Icon = section.icon;
  const isChecklist = section.type === 'checklists';
  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-2xl px-5 py-4 flex-row items-center gap-4 active:opacity-70"
      style={{ borderCurve: 'continuous' }}
    >
      <View
        className="w-11 h-11 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${COLOR}15` }}
      >
        <Icon size={20} color={COLOR} />
      </View>
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="text-sm font-semibold text-foreground leading-5">
          {section.label}
        </Text>
        <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
          {section.subtitle}
        </Text>
      </View>
      <View className="items-end gap-1">
        <View
          className="rounded-full px-2.5 py-0.5"
          style={{ backgroundColor: `${COLOR}15` }}
        >
          <Text className="text-xs font-semibold" style={{ color: COLOR }}>
            {count}
          </Text>
        </View>
        {isChecklist && (
          <View className="rounded-full px-2 py-0.5 bg-secondary">
            <Text className="text-[10px] font-medium text-muted-foreground">SSOT</Text>
          </View>
        )}
      </View>
      <ChevronRight size={16} color={C.mutedForeground} />
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function InvestigationGuidesHomeScreen() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          const [guideCounts, clCount] = await Promise.all([
            getGuideCounts(),
            getChecklistCount(),
          ]);
          setCounts({ ...guideCounts, 'Investigation Checklists': clCount });
        } catch (e) {
          logger.error('[InvestigationGuides] counts error:', e);
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const totalGuides = GUIDE_SECTIONS.reduce(
    (sum, s) => sum + (counts[s.subcategory] ?? 0),
    0
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Investigation Guides" subtitle="Knowledge"
        showBack
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLOR} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-6 py-5 gap-3 pb-12"
        >
          {/* Intro note */}
          <View className="bg-secondary rounded-xl px-4 py-3 mb-1">
            <Text className="text-xs text-muted-foreground leading-5">
              Centralized investigation knowledge repository. Investigation Checklists act as the
              Single Source of Truth (SSOT) and auto-populate the Mukadma Karyvahi tab on FIR creation.
            </Text>
          </View>

          {/* Section cards */}
          {GUIDE_SECTIONS.map((section) => (
            <SectionCard
              key={section.type}
              section={section}
              count={counts[section.subcategory] ?? 0}
              onPress={() => router.push(section.route as never)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
