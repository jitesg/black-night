import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, Pressable, ScrollView, Share, Text, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Clock, ClipboardCopy, Copy, Edit2, ExternalLink, FileText,
  Paperclip, Plus, Share2, Sparkles, Tag, Trash2, X,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '@/client/supabase';
import {
  getKnowledgeById, deleteKnowledgeEntry,
  updateKnowledgeAttachments, duplicateKnowledgeAsUser,
  updateSimpleExplanation, type KnowledgeEntry,
} from '@/lib/db/knowledgeRepo';
import { KNOWLEDGE_CATEGORY_MAP } from '@/lib/knowledgeConstants';
import { SourceBadge } from '@/components/common/SourceBadge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

// ─── Categories that support AI explanation ───────────────────────────────
const AI_EXPLAIN_CATEGORIES = ['Law', 'SOP', 'Circular', 'Court Judgment'] as const;

// ─── Per-category label used in both prompt templates ─────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  'Law':           'BNS/BNSS/BSA ka legal section',
  'SOP':           'Standard Operating Procedure (SOP)',
  'Circular':      'department ka circular/order',
  'Court Judgment':'adalat ka judgment/case law',
};

// ─── Clipboard prompt builder ─────────────────────────────────────────────
function buildCopyPrompt(title: string, sectionText: string, category: string): string {
  const label = CATEGORY_LABEL[category] ?? 'document';
  return (
    `Tum ek police training assistant ho. Neeche diya gaya ${label} hai. ` +
    `Ise ek Sub-Inspector ke liye saral, rozmarra ki Hindi mein samjhao — ` +
    `legal jargon hata do, 2-4 chhote vaakya mein. Sirf yeh batao: ` +
    `(1) yeh kis situation par lagu hota hai, (2) kya saza/nirdesh hai. ` +
    `Kanuni sateekta na khona, lekin bhasha aam bolchaal jaisi ho.\n\n` +
    `Section: ${title}\n\nText:\n${sectionText}`
  );
}

// ─── Attachment type ──────────────────────────────────────────────────────
interface Attachment {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

function parseAttachments(raw: string): Attachment[] {
  try { return JSON.parse(raw) as Attachment[]; } catch { return []; }
}

function extLabel(mimeType: string, name: string): string {
  if (mimeType.startsWith('image/')) return 'IMG';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('video/')) return 'VID';
  if (mimeType.startsWith('audio/')) return 'AUD';
  const ext = name.split('.').pop()?.toUpperCase() ?? 'FILE';
  return ext.slice(0, 4);
}

function extColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '#0891B2';
  if (mimeType === 'application/pdf') return '#DC2626';
  if (mimeType.startsWith('video/')) return '#7C3AED';
  if (mimeType.startsWith('audio/')) return '#D97706';
  return '#6B7280';
}

function fmtSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Attachment Row ───────────────────────────────────────────────────────
function AttachmentRow({
  item, color, onOpen, onRemove,
}: {
  item: Attachment;
  color: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const label = extLabel(item.mimeType, item.name);
  const dotColor = extColor(item.mimeType);

  return (
    <View className="flex-row items-center gap-3 py-2.5 border-t border-border/40">
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${dotColor}15` }}
      >
        <Text className="text-xs font-bold" style={{ color: dotColor }}>{label}</Text>
      </View>
      <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>{item.name}</Text>
        {item.size ? (
          <Text className="text-xs text-muted-foreground">{fmtSize(item.size)}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={onOpen}
        className="w-8 h-8 rounded-lg items-center justify-center active:opacity-60"
        style={{ backgroundColor: `${color}15` }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <ExternalLink size={14} color={color} />
      </Pressable>
      <Pressable
        onPress={onRemove}
        className="w-8 h-8 rounded-lg items-center justify-center active:opacity-60"
        style={{ backgroundColor: `${C.destructive}15` }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <X size={14} color={C.destructive} />
      </Pressable>
    </View>
  );
}

// ─── Simple Explanation Card (Law / SOP / Circular / Court Judgment) ─────
function SimpleExplanationCard({
  entry,
  color,
}: {
  entry: KnowledgeEntry;
  color: string;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const [explanation, setExplanation] = useState(entry.simple_explanation ?? '');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [isOnline, setIsOnline]       = useState(true);
  const [copied, setCopied]           = useState(false);
  const copiedTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to network state changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    (async () => {
      const state = await NetInfo.fetch();
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    })();
    return () => {
      unsubscribe();
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const handleExplain = async () => {
    const state = await NetInfo.fetch();
    const online = state.isConnected === true && state.isInternetReachable !== false;
    if (!online) {
      setError(t('knowledge.detail.aiOffline'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('explain-simple', {
        body: { title: entry.title, sectionText: entry.description, category: entry.category },
      });

      // ── TEMPORARY DEBUG: supabase-js puts non-2xx body in error.context ──
      // Remove this block once root cause is confirmed; restore plain throw below.
      if (fnError) {
        let debugMsg = `[DEBUG] fnError: ${fnError.message ?? String(fnError)}`;
        const ctx = (fnError as { context?: unknown }).context;
        if (ctx && typeof (ctx as { json?: unknown }).json === 'function') {
          const errBody = await (ctx as { json: () => Promise<unknown> })
            .json()
            .catch(() => null);
          if (errBody !== null) {
            debugMsg = `[DEBUG] ${JSON.stringify(errBody)}`;
          }
        }
        setError(debugMsg);
        return;
      }
      // ── END TEMPORARY DEBUG — restore for production: ─────────────────────
      // if (fnError) throw fnError;
      // ──────────────────────────────────────────────────────────────────────

      // ── TEMPORARY DEBUG: catch debug fields on a surprising 2xx ──────────
      const debugData = data as {
        explanation?: string;
        debug_anthropic_status?: number;
        debug_anthropic_body?: string;
      } | null;
      if (debugData?.debug_anthropic_status !== undefined || debugData?.debug_anthropic_body !== undefined) {
        const statusStr = debugData.debug_anthropic_status !== undefined
          ? `HTTP ${debugData.debug_anthropic_status}` : '';
        setError(`[DEBUG] Anthropic error — ${statusStr}\n${debugData.debug_anthropic_body ?? ''}`);
        return;
      }
      // ── END TEMPORARY DEBUG ───────────────────────────────────────────────

      const text: string = (data as { explanation: string })?.explanation ?? '';
      if (!text) throw new Error('Empty explanation received');

      setExplanation(text);
      await updateSimpleExplanation(entry.id, text);
    } catch (e) {
      logger.warn('[SimpleExplanation] invoke error:', e);
      setError(t('knowledge.detail.aiError'));
    } finally {
      setLoading(false);
    }
  };

  // ── Clipboard copy — pure offline operation ──────────────────────────────
  const handleCopyPrompt = async () => {
    const prompt = buildCopyPrompt(entry.title, entry.description, entry.category);
    await Clipboard.setStringAsync(prompt);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const hasExplanation = explanation.trim().length > 0;
  const btnDisabled    = loading || !isOnline;

  return (
    <View
      className="bg-card border border-border rounded-2xl p-4 gap-3"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Header */}
      <View className="flex-row items-center gap-2">
        <Sparkles size={13} color={color} />
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t('knowledge.detail.aiSectionTitle')}
        </Text>
      </View>

      {hasExplanation ? (
        // ── Cached or freshly generated explanation ───────────────────────
        <View className="gap-2">
          <Text className="text-base text-foreground leading-7" selectable>
            {explanation}
          </Text>
          <Text className="text-xs text-muted-foreground italic">
            {t('knowledge.detail.aiDisclaimerHint')}
          </Text>
        </View>
      ) : (
        // ── Not yet generated ─────────────────────────────────────────────
        <View className="gap-3">
          {!isOnline && (
            <Text className="text-xs text-muted-foreground">
              {t('knowledge.detail.aiOffline')}
            </Text>
          )}

          {/* Error / debug message — selectable for on-device readability */}
          {error.length > 0 && (
            <Text selectable className="text-sm text-destructive">{error}</Text>
          )}

          {/* Supabase / Anthropic explain button */}
          <Pressable
            onPress={handleExplain}
            disabled={btnDisabled}
            className="flex-row items-center justify-center gap-2 py-3 rounded-xl active:opacity-70"
            style={{
              backgroundColor: btnDisabled ? (colorScheme === 'dark' ? '#374151' : '#F3F4F6') : `${color}15`,
              borderCurve: 'continuous',
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={color} />
            ) : (
              <Sparkles size={14} color={btnDisabled ? (colorScheme === 'dark' ? '#6B7280' : '#9CA3AF') : color} />
            )}
            <Text
              className="text-sm font-semibold"
              style={{ color: btnDisabled ? (colorScheme === 'dark' ? '#6B7280' : '#9CA3AF') : color }}
            >
              {loading ? t('knowledge.detail.aiGenerating') : t('knowledge.detail.aiExplainBtn')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Clipboard copy button — always visible, works offline ─────────── */}
      <View className="border-t border-border/40 pt-3 gap-2">
        <Pressable
          onPress={handleCopyPrompt}
          className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl active:opacity-70 border border-border bg-background"
          style={{ borderCurve: 'continuous' }}
        >
          <ClipboardCopy size={14} color={colorScheme === 'dark' ? '#9CA3AF' : '#6B7280'} />
          <Text className="text-sm font-medium text-muted-foreground">
            {t('knowledge.detail.copyPrompt')}
          </Text>
        </Pressable>

        {/* Inline copy confirmation — auto-hides after 2 s */}
        {copied && (
          <Text className="text-xs text-center text-muted-foreground">
            {t('knowledge.detail.copied')}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function KnowledgeDetailScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const { knowledgeId } = useLocalSearchParams<{ knowledgeId: string }>();

  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!knowledgeId) return;
      (async () => {
        setLoading(true);
        const e = await getKnowledgeById(knowledgeId);
        setEntry(e);
        setAttachments(e ? parseAttachments(e.attachment_uris) : []);
        setLoading(false);
      })();
    }, [knowledgeId])
  );

  const persistAttachments = async (updated: Attachment[]) => {
    if (!knowledgeId) return;
    await updateKnowledgeAttachments(knowledgeId, JSON.stringify(updated));
  };

  // ── Pick file ─────────────────────────────────────────────────────────
  const handlePickFile = async () => {
    if (process.env.EXPO_OS === 'web') {
      // Web fallback: use native <input type="file">
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,image/*,video/*,audio/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
      input.multiple = true;
      input.onchange = async () => {
        if (!input.files) return;
        const picked: Attachment[] = Array.from(input.files).map((f) => ({
          uri: URL.createObjectURL(f),
          name: f.name,
          mimeType: f.type || 'application/octet-stream',
          size: f.size,
        }));
        const updated = [...attachments, ...picked];
        setAttachments(updated);
        await persistAttachments(updated);
      };
      input.click();
      return;
    }

    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/*',
          'video/*',
          'audio/*',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const picked: Attachment[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType ?? 'application/octet-stream',
        size: a.size,
      }));

      const updated = [...attachments, ...picked];
      setAttachments(updated);
      await persistAttachments(updated);
    } catch (e) {
      logger.warn('[Knowledge] file pick error:', e);
    } finally {
      setPicking(false);
    }
  };

  // ── Open file ─────────────────────────────────────────────────────────
  const handleOpenFile = async (item: Attachment) => {
    try {
      await WebBrowser.openBrowserAsync(item.uri);
    } catch (e) {
      logger.warn('[Knowledge] open file error:', e);
    }
  };

  // ── Remove attachment ─────────────────────────────────────────────────
  const handleRemoveConfirm = async () => {
    if (removeTarget === null) return;
    const updated = attachments.filter((_, i) => i !== removeTarget);
    setAttachments(updated);
    await persistAttachments(updated);
    setRemoveTarget(null);
  };

  // ── Share record ──────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!entry) return;
    const lines = [
      entry.title,
      entry.category + (entry.subcategory ? ` › ${entry.subcategory}` : ''),
      '',
      entry.description,
      entry.tags ? `Tags: ${entry.tags}` : '',
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n'), title: entry.title });
    } catch { /* cancelled */ }
  };

  // ── Duplicate as user copy ────────────────────────────────────────────
  const handleDuplicateAsUser = async () => {
    if (!entry) return;
    await duplicateKnowledgeAsUser(entry.id);
    router.back();
  };

  // ── Delete record ─────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!entry) return;
    await deleteKnowledgeEntry(entry.id);
    setShowDelete(false);
    router.back();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">{t('knowledge.detail.loading')}</Text>
      </View>
    );
  }

  if (!entry) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3 px-6">
        <Text className="text-base font-semibold text-foreground">{t('knowledge.detail.notFound')}</Text>
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <Text className="text-sm text-primary">{t('knowledge.detail.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const cat = KNOWLEDGE_CATEGORY_MAP[entry.category];
  const color = cat?.color ?? '#0F766E';
  const isSystem = entry.source === 'system';

  const tagList = entry.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={entry.title}
        showBack
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Actions — source-aware */}
        <View className="flex-row gap-2">
          {isSystem ? (
            /* System: Duplicate & Edit + Share only */
            <>
              <Pressable
                onPress={handleDuplicateAsUser}
                className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:opacity-70"
                style={{ backgroundColor: `${C.primary}15`, borderCurve: 'continuous' }}
              >
                <Copy size={14} color={C.primary} />
                <Text className="text-sm font-semibold" style={{ color: C.primary }}>{t('knowledge.detail.duplicateEdit')}</Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                className="flex-row items-center justify-center gap-1.5 px-4 rounded-xl active:opacity-70 border border-border bg-card"
                style={{ borderCurve: 'continuous' }}
              >
                <Share2 size={14} color={C.mutedForeground} />
                <Text className="text-sm font-medium text-foreground">{t('knowledge.detail.share')}</Text>
              </Pressable>
            </>
          ) : (
            /* User: Edit + Share + Delete */
            <>
              <Pressable
                onPress={() =>
                  router.push(
                    `/(app)/knowledge/add-knowledge?editId=${entry.id}&category=${encodeURIComponent(entry.category)}` as never
                  )
                }
                className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:opacity-70 border border-border bg-card"
                style={{ borderCurve: 'continuous' }}
              >
                <Edit2 size={14} color={C.mutedForeground} />
                <Text className="text-sm font-medium text-foreground">{t('knowledge.detail.edit')}</Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:opacity-70 border border-border bg-card"
                style={{ borderCurve: 'continuous' }}
              >
                <Share2 size={14} color={C.mutedForeground} />
                <Text className="text-sm font-medium text-foreground">{t('knowledge.detail.share')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowDelete(true)}
                className="w-10 items-center justify-center rounded-xl active:opacity-70 border border-border bg-card"
                style={{ borderCurve: 'continuous' }}
              >
                <Trash2 size={14} color={C.destructive} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerClassName="px-6 py-5 gap-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Category / Subcategory badges */}
        <View className="flex-row flex-wrap gap-2">
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: `${color}15` }}
          >
            <Text className="text-xs font-semibold" style={{ color }}>{entry.category}</Text>
          </View>
          {entry.subcategory ? (
            <View className="rounded-full px-3 py-1 bg-secondary">
              <Text className="text-xs font-medium text-muted-foreground">{entry.subcategory}</Text>
            </View>
          ) : null}
        </View>

        {/* Description */}
        {entry.description ? (
          <View
            className="bg-card border border-border rounded-2xl p-4 gap-2"
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('knowledge.detail.description')}
            </Text>
            <Text className="text-base text-foreground leading-7" selectable>
              {entry.description}
            </Text>
          </View>
        ) : null}

        {/* Simple Explanation — Law / SOP / Circular / Court Judgment */}
        {AI_EXPLAIN_CATEGORIES.includes(entry.category as typeof AI_EXPLAIN_CATEGORIES[number]) && (
          <SimpleExplanationCard entry={entry} color={color} />
        )}

        {/* Tags */}
        {tagList.length > 0 && (
          <View
            className="bg-card border border-border rounded-2xl p-4 gap-3"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-row items-center gap-2">
              <Tag size={13} color={C.mutedForeground} />
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('knowledge.detail.tags')}</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {tagList.map((tag, idx) => (
                <View key={`${idx}-${tag}`} className="rounded-full px-3 py-1" style={{ backgroundColor: `${color}15` }}>
                  <Text className="text-xs font-medium" style={{ color }}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Attachments section */}
        <View
          className="bg-card border border-border rounded-2xl p-4 gap-3"
          style={{ borderCurve: 'continuous' }}
        >
          {/* Section header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Paperclip size={13} color={C.mutedForeground} />
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {attachments.length > 0
                  ? t('knowledge.detail.attachmentsCount', { count: attachments.length })
                  : t('knowledge.detail.attachments')}
              </Text>
            </View>
            <Pressable
              onPress={handlePickFile}
              disabled={picking}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl active:opacity-70"
              style={{ backgroundColor: `${color}15`, borderCurve: 'continuous' }}
            >
              {picking
                ? <ActivityIndicator size="small" color={color} />
                : <Plus size={13} color={color} />}
              <Text className="text-xs font-semibold" style={{ color }}>
                {picking ? t('knowledge.detail.picking') : t('knowledge.detail.attachFile')}
              </Text>
            </Pressable>
          </View>

          {/* Attachment list */}
          {attachments.length > 0 ? (
            attachments.map((a, i) => (
              <AttachmentRow
                key={`${a.uri}-${i}`}
                item={a}
                color={color}
                onOpen={() => handleOpenFile(a)}
                onRemove={() => setRemoveTarget(i)}
              />
            ))
          ) : (
            <View className="items-center py-6 gap-2">
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: C.muted }}
              >
                <FileText size={18} color={C.mutedForeground} />
              </View>
              <Text className="text-xs text-muted-foreground text-center">
                {t('knowledge.detail.noAttachments')}
              </Text>
            </View>
          )}
        </View>

        {/* Audit */}
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Clock size={12} color={C.mutedForeground} />
            <Text className="text-xs text-muted-foreground">{t('knowledge.detail.created', { date: fmtTs(entry.created_at) })}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Clock size={12} color={C.mutedForeground} />
            <Text className="text-xs text-muted-foreground">{t('knowledge.detail.modified', { date: fmtTs(entry.updated_at) })}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Remove attachment confirmation */}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('knowledge.detail.removeAttachTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledge.detail.removeAttachDesc', {
                name: removeTarget !== null ? attachments[removeTarget]?.name : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setRemoveTarget(null)}>
              <Text>{t('knowledge.detail.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleRemoveConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">{t('knowledge.detail.remove')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete record confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('knowledge.detail.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledge.detail.deleteDesc', { title: entry.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDelete(false)}>
              <Text>{t('knowledge.detail.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">{t('knowledge.detail.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
