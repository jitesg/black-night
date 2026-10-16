/**
 * System Format Manager — Audit Log
 * Complete action history for a single format.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { ClipboardList, CheckCircle2, FileEdit, Archive,
  RotateCcw, Trash2, Plus, Eye, History,
} from 'lucide-react-native';
import { getAuditLog, type SysFormatAudit } from '@/lib/db/sysFormatRepo';
import { getFormatById } from '@/lib/db/predefinedFormatRepo';
import { isSessionActive, touchSession } from '@/lib/sysFormatAuth';

const NAVY = '#1E3A5F';
const SAFFRON = '#2563EB';
const ACTION_META: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  create:    { color: '#059669', icon: Plus,         label: 'Created'     },
  update:    { color: NAVY,      icon: FileEdit,      label: 'Updated'     },
  publish:   { color: '#059669', icon: CheckCircle2,  label: 'Published'   },
  unpublish: { color: SAFFRON,   icon: FileEdit,      label: 'Unpublished' },
  archive:   { color: '#6B7280', icon: Archive,       label: 'Archived'    },
  restore:   { color: '#0891B2', icon: RotateCcw,     label: 'Restored'    },
  delete:    { color: '#DC2626', icon: Trash2,        label: 'Deleted'     },
  rollback:  { color: '#7C3AED', icon: History,       label: 'Rolled Back' },
  duplicate: { color: '#D97706', icon: Eye,           label: 'Duplicated'  },
};

function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function SysFormatAuditScreen() {

  const { formatId } = useLocalSearchParams<{ formatId: string }>();

  const [log, setLog]                 = useState<SysFormatAudit[]>([]);
  const [formatTitle, setFormatTitle] = useState('');
  const [loading, setLoading]         = useState(true);

  useFocusEffect(useCallback(() => {
    if (!isSessionActive()) { router.replace('/(app)/sys-format-manager' as never); return; }
    touchSession();
    (async () => {
      setLoading(true);
      try {
        const [auditRows, fmt] = await Promise.all([
          getAuditLog(formatId),
          getFormatById(formatId),
        ]);
        setLog(auditRows);
        setFormatTitle(fmt?.title ?? formatId);
      } finally {
        setLoading(false);
      }
    })();
  }, [formatId]));

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={formatTitle}
        subtitle="Audit Log"
        showBack
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : log.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <ClipboardList size={40} color="#D1D5DB" />
          <Text className="text-base font-semibold text-muted-foreground text-center">No audit records</Text>
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          data={log}
          keyExtractor={(a) => a.id}
          contentContainerClassName="px-4 py-4 gap-0 pb-10"
          contentInsetAdjustmentBehavior="automatic"
          renderItem={({ item, index }) => {
            const meta = ACTION_META[item.action] ?? {
              color: '#6B7280', icon: ClipboardList, label: item.action,
            };
            const Icon  = meta.icon;
            const isLast = index === log.length - 1;

            return (
              <View className="flex-row gap-3">
                {/* Timeline */}
                <View className="items-center" style={{ width: 32 }}>
                  <View className="w-8 h-8 rounded-full items-center justify-center z-10"
                    style={{ backgroundColor: `${meta.color}18`, borderWidth: 2, borderColor: `${meta.color}40` }}>
                    <Icon size={14} color={meta.color} />
                  </View>
                  {!isLast && <View className="w-0.5 flex-1 mt-1" style={{ backgroundColor: '#E5E7EB', minHeight: 16 }} />}
                </View>

                {/* Content */}
                <View className="flex-1 pb-4">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <View className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${meta.color}15` }}>
                      <Text className="text-xs font-semibold" style={{ color: meta.color }}>
                        {meta.label}
                      </Text>
                    </View>
                    {item.version_number != null && (
                      <Text className="text-xs text-muted-foreground">v{item.version_number}</Text>
                    )}
                  </View>
                  {item.details ? (
                    <Text className="text-sm text-foreground mt-1 leading-5">{item.details}</Text>
                  ) : null}
                  <Text className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(item.created_at)} · {item.created_by}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
