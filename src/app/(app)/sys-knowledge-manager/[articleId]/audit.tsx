/**
 * System Knowledge Manager — Audit Trail
 *
 * Complete chronological log of all owner actions on a specific article.
 */
import { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus, Edit2, CheckCircle2, Archive, RotateCcw, Trash2,
  Copy, ClipboardList, GitBranch, Shield,
} from 'lucide-react-native';
import {
  getSysKnowledgeAudit, type SysKnowledgeAudit,
} from '@/lib/db/sysKnowledgeRepo';
import { isDevSessionActive } from '@/lib/devOptionsAuth';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const GREEN   = '#059669';
const RED     = '#DC2626';
const MUTED   = '#6B7280';

const ACTION_META: Record<string, { icon: React.ComponentType<{ size: number; color: string }>; color: string; label: string }> = {
  create:      { icon: Plus,         color: GREEN,   label: 'Created'    },
  update:      { icon: Edit2,        color: '#1E3A5F',    label: 'Updated'    },
  publish:     { icon: CheckCircle2, color: GREEN,   label: 'Published'  },
  unpublish:   { icon: Edit2,        color: '#2563EB', label: 'Unpublished'},
  archive:     { icon: Archive,      color: MUTED,   label: 'Archived'   },
  restore:     { icon: RotateCcw,    color: GREEN,   label: 'Restored'   },
  delete:      { icon: Trash2,       color: RED,     label: 'Deleted'    },
  duplicate:   { icon: Copy,         color: '#7C3AED', label: 'Duplicated'},
  rollback:    { icon: GitBranch,    color: '#2563EB', label: 'Rolled Back'},
  bulk_import: { icon: ClipboardList, color: '#1E3A5F',   label: 'Bulk Import'},
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function AuditCard({ item }: { item: SysKnowledgeAudit }) {
  const meta = ACTION_META[item.action] ?? { icon: Shield, color: MUTED, label: item.action };
  const Icon = meta.icon;
  return (
    <View className="flex-row gap-3 py-3">
      {/* Timeline */}
      <View className="items-center gap-1">
        <View className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: `${meta.color}15` }}>
          <Icon size={15} color={meta.color} />
        </View>
        <View className="flex-1 w-px bg-border" />
      </View>
      {/* Content */}
      <View className="flex-1 gap-0.5 pb-4">
        <Text className="text-sm font-semibold text-foreground">{meta.label}</Text>
        {!!item.details && (
          <Text className="text-xs text-muted-foreground">{item.details}</Text>
        )}
        <View className="flex-row items-center gap-2 mt-1">
          <Text className="text-xs text-muted-foreground">{formatDate(item.created_at)}</Text>
          <Text className="text-xs text-muted-foreground">· by {item.created_by}</Text>
          {item.version_number !== null && (
            <View className="rounded-full bg-muted px-2.5 py-1">
              <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">v{item.version_number}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function AuditTrailScreen() {
  const insets   = useSafeAreaInsets();
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const [audit, setAudit]     = useState<SysKnowledgeAudit[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!isDevSessionActive()) { router.replace('/(app)/dev-options/pin-entry' as never); return; }
    (async () => {
      setLoading(true);
      try { setAudit(await getSysKnowledgeAudit(articleId)); }
      finally { setLoading(false); }
    })();
  }, [articleId]));

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <AppHeader
        title="Audit Trail"
        subtitle={`${audit.length} event${audit.length !== 1 ? 's' : ''}`}
        variant="navy"
        onBack={() => router.back()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color='#1E3A5F' /></View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          data={audit}
          keyExtractor={a => a.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32,
          }}
          ListEmptyComponent={
            <View className="items-center py-16 gap-3">
              <Shield size={32} color={MUTED} />
              <Text className="text-sm text-muted-foreground">No audit events found.</Text>
            </View>
          }
          renderItem={({ item }) => <AuditCard item={item} />}
        />
      )}
    </View>
  );
}
