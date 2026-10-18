/**
 * Developer Seed Manager — Read-only System Content Preview
 *
 * Displays content exactly as it will render in the production app.
 * DEV-ONLY. Not accessible in production builds.
 *
 * Route params:
 *   itemId  — UUID of the item to preview
 *   kind    — "format" | "knowledge"
 */
import { useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { stripHtmlTags } from '@/lib/stringUtils';
import {
  FileText, BookOpen, Tag, Shield, Hash,
  AlignLeft, Calendar, Type, List, ToggleLeft, CheckSquare,
  Eye,
} from 'lucide-react-native';
import { useDevSeedStore, type SeedFormat, type SeedKnowledge } from '@/lib/devSeedStore';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

// ─── Constants ────────────────────────────────────────────────────────────────
const FIELD_TYPE_ICON: Record<string, React.ReactNode> = {
  text:      <Type      size={12} color="#6B7280" />,
  multiline: <AlignLeft size={12} color="#6B7280" />,
  number:    <Hash      size={12} color="#6B7280" />,
  date:      <Calendar  size={12} color="#6B7280" />,
  dropdown:  <List      size={12} color="#6B7280" />,
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  format: 'Format', sop: 'SOP', guide: 'Guide', checklist: 'Checklist',
  court: 'Court Format', circular: 'Police Circular', template: 'Sample Report', law: 'Law',
};

const CONTENT_TYPE_COLOR: Record<string, string> = {
  format: '#1E3A5F', sop: '#7C3AED', guide: '#059669',
  checklist: '#D97706', court: '#DC2626', circular: '#0891B2',
  template: '#6B7280', law: '#92400E',
};

// ─── Shared primitives ────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
      {children}
    </Text>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-2 py-2 border-b border-border">
      <Text className="text-xs text-muted-foreground w-24 shrink-0">{label}</Text>
      <Text className="flex-1 text-sm text-foreground">{value || '—'}</Text>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-full mr-1 mb-1 px-2.5 py-1" style={{ backgroundColor: `${color}15` }}>
      <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color }}>{label}</Text>
    </View>
  );
}

// ─── Format preview ───────────────────────────────────────────────────────────
function FormatPreview({ item }: { item: SeedFormat }) {
  const ctColor = CONTENT_TYPE_COLOR[item.content_type] ?? '#6B7280';

  return (
    <ScrollView
      contentContainerClassName="px-5 py-5 gap-6 pb-16"
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View className="bg-card border border-border rounded-2xl p-5 gap-4" style={{ borderCurve: 'continuous' }}>
        <View className="flex-row items-start gap-3">
          <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: `${ctColor}15` }}>
            <FileText size={20} color={ctColor} />
          </View>
          <View className="flex-1 gap-1" style={{ minWidth: 0 }}>
            <Text className="text-xl font-bold text-foreground">{item.title}</Text>
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Badge label={CONTENT_TYPE_LABEL[item.content_type] ?? item.content_type} color={ctColor} />
              <Badge label="System" color="#059669" />
              <Badge label={`v${item.seed_version}`} color="#6B7280" />
            </View>
          </View>
        </View>

        {item.vivran ? (
          <Text className="text-sm text-muted-foreground leading-6">{stripHtmlTags(item.vivran)}</Text>
        ) : null}
      </View>

      {/* Metadata */}
      <View>
        <SectionLabel>Details</SectionLabel>
        <View className="bg-card border border-border rounded-2xl px-4" style={{ borderCurve: 'continuous' }}>
          <InfoRow label="Format Type"   value={item.format_type} />
          <InfoRow label="Content Type"  value={CONTENT_TYPE_LABEL[item.content_type] ?? item.content_type} />
          <InfoRow label="Source"        value="System" />
          <InfoRow label="App Version"   value={item.app_version} />
          <InfoRow label="Seed Version"  value={String(item.seed_version)} />
          <InfoRow label="Last Updated"  value={item.last_updated} />
          <InfoRow label="UUID"          value={item.id} />
        </View>
      </View>

      {/* Tags */}
      {item.tags.length > 0 && (
        <View>
          <SectionLabel>Tags</SectionLabel>
          <View className="flex-row flex-wrap">
            {item.tags.map((tag, idx) => (
              <View key={`${idx}-${tag}`} className="flex-row items-center gap-1 rounded-full bg-secondary mr-1.5 mb-1.5 px-2.5 py-1">
                <Tag size={10} color="#9CA3AF" />
                <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Form Keys — production-like field layout */}
      {item.keys.length > 0 && (
        <View className="gap-3">
          <SectionLabel>{`Form Fields (${item.keys.length})`}</SectionLabel>
          {item.keys
            .slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((k, idx) => (
              <View
                key={`${k.key_name}-${idx}`}
                className="bg-card border border-border rounded-xl px-4 py-3 gap-1"
                style={{ borderCurve: 'continuous' }}
              >
                {/* Label row */}
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-foreground flex-1">
                    {k.label || k.key_name}
                    {Boolean(k.is_required) && (
                      <Text className="text-destructive"> *</Text>
                    )}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    {FIELD_TYPE_ICON[k.field_type] ?? <Type size={12} color="#6B7280" />}
                    <Text className="text-xs text-muted-foreground capitalize">{k.field_type}</Text>
                  </View>
                </View>

                {/* Key name chip */}
                <Text className="text-xs font-mono text-muted-foreground">{`{{${k.key_name}}}`}</Text>

                {/* Mock field */}
                {k.field_type === 'multiline' ? (
                  <View className="mt-1 border border-border rounded-lg px-3 py-2 bg-muted/30" style={{ minHeight: 56 }}>
                    <Text className="text-xs text-muted-foreground italic">
                      {k.default_value || `Enter ${k.label || k.key_name}…`}
                    </Text>
                  </View>
                ) : k.field_type === 'dropdown' ? (
                  <View className="mt-1 border border-border rounded-lg px-3 py-2.5 bg-muted/30 flex-row items-center justify-between">
                    <Text className="text-xs text-muted-foreground italic">
                      {k.dropdown_options?.split(',')[0] ?? 'Select…'}
                    </Text>
                    <List size={11} color="#9CA3AF" />
                  </View>
                ) : k.field_type === 'date' ? (
                  <View className="mt-1 border border-border rounded-lg px-3 py-2.5 bg-muted/30 flex-row items-center gap-2">
                    <Calendar size={11} color="#9CA3AF" />
                    <Text className="text-xs text-muted-foreground italic">dd/mm/yyyy</Text>
                  </View>
                ) : (
                  <View className="mt-1 border border-border rounded-lg px-3 py-2.5 bg-muted/30">
                    <Text className="text-xs text-muted-foreground italic">
                      {k.default_value || `Enter ${k.label || k.key_name}…`}
                    </Text>
                  </View>
                )}

                {/* Required badge */}
                {Boolean(k.is_required) && (
                  <View className="flex-row items-center gap-1 mt-0.5">
                    <CheckSquare size={10} color="#DC2626" />
                    <Text className="text-xs text-destructive">Required</Text>
                  </View>
                )}
              </View>
            ))}
        </View>
      )}

      {/* System lock notice */}
      <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-secondary">
        <Shield size={12} color="#6B7280" />
        <Text className="text-xs text-muted-foreground flex-1">
          System content — read-only in production. Edit via Seed Manager in dev builds only.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Knowledge preview ────────────────────────────────────────────────────────
function KnowledgePreview({ item }: { item: SeedKnowledge }) {
  const ctColor = CONTENT_TYPE_COLOR[item.content_type] ?? '#92400E';

  // Parse tags (stored as comma-separated string or JSON array string)
  let tagList: string[] = [];
  try {
    const parsed = JSON.parse(item.tags);
    tagList = Array.isArray(parsed) ? parsed : String(item.tags).split(',').map((t) => t.trim()).filter(Boolean);
  } catch {
    tagList = String(item.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  }

  // Parse attachment URIs
  let attachments: string[] = [];
  try {
    const parsed = JSON.parse(item.attachment_uris ?? '[]');
    attachments = Array.isArray(parsed) ? parsed : [];
  } catch {
    attachments = [];
  }

  return (
    <ScrollView
      contentContainerClassName="px-5 py-5 gap-6 pb-16"
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View className="bg-card border border-border rounded-2xl p-5 gap-4" style={{ borderCurve: 'continuous' }}>
        <View className="flex-row items-start gap-3">
          <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: `${ctColor}15` }}>
            <BookOpen size={20} color={ctColor} />
          </View>
          <View className="flex-1 gap-1" style={{ minWidth: 0 }}>
            <Text className="text-xl font-bold text-foreground">{item.title}</Text>
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Badge label={CONTENT_TYPE_LABEL[item.content_type] ?? item.content_type} color={ctColor} />
              <Badge label="System" color="#059669" />
              <Badge label={`v${item.seed_version}`} color="#6B7280" />
            </View>
          </View>
        </View>
      </View>

      {/* Body / Description */}
      {item.description ? (
        <View>
          <SectionLabel>Body</SectionLabel>
          <View className="bg-card border border-border rounded-2xl px-4 py-4" style={{ borderCurve: 'continuous' }}>
            <Text className="text-sm text-foreground leading-6">{stripHtmlTags(item.description)}</Text>
          </View>
        </View>
      ) : null}

      {/* Metadata */}
      <View>
        <SectionLabel>Details</SectionLabel>
        <View className="bg-card border border-border rounded-2xl px-4" style={{ borderCurve: 'continuous' }}>
          <InfoRow label="Category"     value={item.category} />
          {item.subcategory ? <InfoRow label="Subcategory"  value={item.subcategory} /> : null}
          {item.crime_type  ? <InfoRow label="Crime Type"   value={item.crime_type} /> : null}
          <InfoRow label="Content Type" value={CONTENT_TYPE_LABEL[item.content_type] ?? item.content_type} />
          <InfoRow label="Source"       value="System" />
          <InfoRow label="App Version"  value={item.app_version} />
          <InfoRow label="Seed Version" value={String(item.seed_version)} />
          <InfoRow label="Last Updated" value={item.last_updated} />
          <InfoRow label="UUID"         value={item.id} />
        </View>
      </View>

      {/* Tags */}
      {tagList.length > 0 && (
        <View>
          <SectionLabel>Tags</SectionLabel>
          <View className="flex-row flex-wrap">
            {tagList.map((tag, idx) => (
              <View key={`${idx}-${tag}`} className="flex-row items-center gap-1 rounded-full bg-secondary mr-1.5 mb-1.5 px-2.5 py-1">
                <Tag size={10} color="#9CA3AF" />
                <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <View>
          <SectionLabel>{`Attachments (${attachments.length})`}</SectionLabel>
          {attachments.map((uri, idx) => (
            <View
              key={idx}
              className="flex-row items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 mb-2"
              style={{ borderCurve: 'continuous' }}
            >
              <FileText size={14} color="#6B7280" />
              <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>{uri}</Text>
            </View>
          ))}
        </View>
      )}

      {/* System lock notice */}
      <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-secondary">
        <Shield size={12} color="#6B7280" />
        <Text className="text-xs text-muted-foreground flex-1">
          System content — read-only in production. Edit via Seed Manager in dev builds only.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PreviewScreen() {
  const { itemId, kind } = useLocalSearchParams<{ itemId: string; kind: 'format' | 'knowledge' }>();
  const store = useDevSeedStore();

  // Ensure item reflects latest store state on focus
  useFocusEffect(useCallback(() => {}, []));

  const item: SeedFormat | SeedKnowledge | undefined =
    kind === 'format'
      ? store.formats.find((f) => f.id === itemId)
      : store.knowledge.find((k) => k.id === itemId);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Preview"
        subtitle={item?.title ?? itemId}
        showBack
        rightActions={
          <Pressable
            onPress={() => {
              if (kind === 'format') {
                router.replace(`/(app)/dev-seed-manager/edit-format?editId=${itemId}` as never);
              } else {
                router.replace(`/(app)/dev-seed-manager/edit-knowledge?editId=${itemId}` as never);
              }
            }}
            className="px-3 py-2 rounded-xl bg-secondary active:opacity-70"
          >
            <Text className="text-xs font-semibold text-foreground">Edit</Text>
          </Pressable>
        }
      />

      {/* Body */}
      {!item ? (
        <View className="flex-1 items-center justify-center gap-2">
          <Text className="text-muted-foreground text-sm">Item not found</Text>
          <Text className="text-xs text-muted-foreground">{itemId}</Text>
        </View>
      ) : kind === 'format' ? (
        <FormatPreview item={item as SeedFormat} />
      ) : (
        <KnowledgePreview item={item as SeedKnowledge} />
      )}
    </View>
  );
}
