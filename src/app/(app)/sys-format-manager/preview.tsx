/**
 * System Format Manager — Format Preview
 * Shows the rendered template with a status badge and key list.
 * Owner-only: always guarded by session check.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Edit2, Key, Tag, FileText } from 'lucide-react-native';
import { stripHtmlTags } from '@/lib/stringUtils';
import {
  getFormatById, getFormatKeys, getFormatTags,
} from '@/lib/db/predefinedFormatRepo';
import { isSessionActive, touchSession } from '@/lib/sysFormatAuth';

const STATUS_COLORS: Record<string, string> = {
  published: '#059669',
  draft:     '#F59E0B',
  archived:  '#6B7280',
};

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function SysFormatPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle]       = useState('');
  const [vivran, setVivran]     = useState('');
  const [formatType, setFmtType] = useState('');
  const [status, setStatus]     = useState('published');
  const [category, setCategory] = useState('');
  const [version, setVersion]   = useState(1);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [keys, setKeys]         = useState<{ key_name: string; label: string; field_type: string }[]>([]);
  const [tags, setTags]         = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);

  useFocusEffect(useCallback(() => {
    if (!isSessionActive()) { router.replace('/(app)/sys-format-manager' as never); return; }
    touchSession();
    (async () => {
      setLoading(true);
      try {
        const [fmt, fKeys, fTags] = await Promise.all([
          getFormatById(id),
          getFormatKeys(id),
          getFormatTags(id),
        ]);
        if (!fmt) return;
        const r = fmt as unknown as Record<string, string>;
        setTitle(fmt.title);
        setVivran(fmt.vivran);
        setFmtType(fmt.format_type);
        setStatus(r.status ?? 'published');
        setCategory(r.sys_category ?? '');
        setVersion(fmt.version ?? 1);
        setUpdatedAt(fmt.updated_at);
        setKeys(fKeys.map((k) => ({ key_name: k.key_name, label: k.label, field_type: k.field_type })));
        setTags(fTags);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]));

  const statusColor = STATUS_COLORS[status] ?? '#6B7280';

  return (
    <View className="flex-1 bg-background">

      <AppHeader
        title={title}
        subtitle="Preview"
        showBack
        actions={
          <HeaderIconBtn
            icon={Edit2}
            onPress={() => {
              touchSession();
              router.push({ pathname: '/(app)/sys-format-manager/editor' as never, params: { editId: id } });
            }}
            label="Edit format"
          />
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color='#1E3A5F' />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="px-4 py-5 gap-5 pb-12"
          showsVerticalScrollIndicator={false}
        >
          {/* Meta row */}
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${statusColor}18` }}>
              <Text textBreakStrategy="simple" className="text-xs font-semibold capitalize" style={{ color: statusColor }}>
                {status}
              </Text>
            </View>
            <View className="rounded-full bg-muted px-2.5 py-1">
              <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{formatType}</Text>
            </View>
            {category ? (
              <View className="rounded-full bg-muted px-2.5 py-1">
                <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{category}</Text>
              </View>
            ) : null}
            <Text className="text-xs text-muted-foreground">v{version}</Text>
            <Text className="text-xs text-muted-foreground">· {formatDate(updatedAt)}</Text>
          </View>

          {/* Template content */}
          <View>
            <View className="flex-row items-center gap-1.5 mb-2">
              <FileText size={13} color='#1E3A5F' />
              <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Template Content
              </Text>
            </View>
            <View className="bg-card border border-border rounded-2xl px-4 py-4"
              style={{ borderCurve: 'continuous' }}>
              <Text className="text-sm text-foreground leading-7 font-mono">
                {stripHtmlTags(vivran) || <Text className="text-muted-foreground italic">No template content.</Text>}
              </Text>
            </View>
          </View>

          {/* Keys */}
          {keys.length > 0 && (
            <View>
              <View className="flex-row items-center gap-1.5 mb-2">
                <Key size={13} color='#1E3A5F' />
                <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Fields ({keys.length})
                </Text>
              </View>
              <View className="bg-card border border-border rounded-2xl overflow-hidden"
                style={{ borderCurve: 'continuous' }}>
                {keys.map((k, idx) => (
                  <View key={k.key_name}>
                    {idx > 0 && <View className="h-px bg-border mx-4" />}
                    <View className="flex-row items-center justify-between px-4 py-3">
                      <View>
                        <Text className="text-sm font-medium text-foreground">{k.label || k.key_name}</Text>
                        <Text className="text-xs text-muted-foreground">{'{{'}{k.key_name}{'}}'}</Text>
                      </View>
                      <View className="rounded-full bg-muted px-2.5 py-1">
                        <Text textBreakStrategy="simple" className="text-xs text-muted-foreground capitalize">{k.field_type}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <View>
              <View className="flex-row items-center gap-1.5 mb-2">
                <Tag size={13} color='#1E3A5F' />
                <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tags</Text>
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                {tags.map((t, idx) => (
                  <View key={`${idx}-${t}`} className="rounded-full bg-card border border-border px-3 py-1.5">
                    <Text textBreakStrategy="simple" className="text-xs text-foreground">{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
