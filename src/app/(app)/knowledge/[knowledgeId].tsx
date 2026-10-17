import React, { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, Pressable, ScrollView, Share, Text, TextInput, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  AlertTriangle, Check, Clock, ClipboardCopy, ClipboardList, Edit2, ExternalLink, FileText,
  Paperclip, Plus, RefreshCw, Scale, Share2, Sparkles, Tag, Trash2, X, Search,
} from 'lucide-react-native';
import { useSopStruct, type SopStruct } from '@/ai/sopStruct';
import { useSopIndex } from '@/ai/sopIndex';
import { SopStructuredViewer } from '@/components/knowledge/SopStructuredViewer';
import { SopChecklistTab } from '@/components/knowledge/SopChecklistTab';
import { openSection } from '@/lib/law/openLaw';
import { getSection, type ActId } from '@/lib/law/lawLibrary';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '@/client/supabase';
import {
  getKnowledgeById, deleteKnowledgeEntry,
  updateKnowledgeAttachments,
  updateSimpleExplanation, type KnowledgeEntry,
} from '@/lib/db/knowledgeRepo';
import { getKnowledgeNote, saveKnowledgeNote } from '@/lib/db/knowledgeNotesRepo';
import {
  getDisplayShortTitle,
  getCircularNumberChip,
  parseSadharanBlock,
  stripSadharanBlock,
} from '@/lib/knowledge/knowledgeDisplay';
import { KNOWLEDGE_CATEGORY_MAP } from '@/lib/knowledgeConstants';
import { SourceBadge } from '@/components/common/SourceBadge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useSettingsStore } from '@/hooks/useSettingsStore';

// ─── Categories that support AI explanation ───────────────────────────────
const AI_EXPLAIN_CATEGORIES = ['Law', 'SOP', 'Circular', 'Court Judgment'] as const;

// ─── Per-category label used in both prompt templates ─────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  'Law':           'BNS/BNSS/BSA ka legal section',
  'SOP':           'Standard Operating Procedure (SOP)',
  'Circular':      'department ka circular/order',
  'Court Judgment':'adalat ka judgment/case law',
};

// ─── Local Tab Error Boundary ─────────────────────────────────────────────
interface LocalTabErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
}

interface LocalTabErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class LocalTabErrorBoundary extends Component<LocalTabErrorBoundaryProps, LocalTabErrorBoundaryState> {
  constructor(props: LocalTabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LocalTabErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    logger.error('[LocalTabErrorBoundary] Tab content error caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="p-6 my-4 rounded-2xl bg-card border border-destructive/30 items-center justify-center gap-3">
          <AlertTriangle size={28} className="text-destructive mb-1" />
          <Text className="text-sm font-semibold text-foreground text-center">
            {this.props.fallbackMessage || 'यह भाग लोड नहीं हो सका — फिर प्रयास करें'}
          </Text>
          <Pressable
            onPress={this.handleReset}
            className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl bg-primary active:opacity-80 mt-1"
          >
            <RefreshCw size={14} className="text-primary-foreground" />
            <Text className="text-xs font-semibold text-primary-foreground">फिर प्रयास करें</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

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

function parseAttachments(raw?: string): Attachment[] {
  if (!raw) return [];
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
  const [explanation, setExplanation] = useState(entry.simple_explanation ?? '');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [isOnline, setIsOnline]       = useState(true);
  const [copied, setCopied]           = useState(false);
  const copiedTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });
    return () => unsub();
  }, []);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const handleExplain = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('knowledge_explain', {
        body: {
          title: entry.title,
          sectionText: entry.description,
          category: entry.category,
        },
      });

      if (fnErr) {
        logger.error('knowledge_explain error:', fnErr);
        setError(t('knowledge.detail.aiGeneralError'));
        return;
      }

      const text = (data as { explanation?: string })?.explanation ?? '';
      if (!text) {
        setError(t('knowledge.detail.aiGeneralError'));
        return;
      }

      setExplanation(text);
      await updateSimpleExplanation(entry.id, text);
    } catch (err: any) {
      logger.error('knowledge_explain network/runtime error:', err);
      if (!isOnline) {
        setError(t('knowledge.detail.aiNoInternet'));
      } else {
        setError(t('knowledge.detail.aiGeneralError'));
      }
    } finally {
      setLoading(false);
    }
  };

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
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Sparkles size={15} color={color} />
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('knowledge.detail.aiExplainTitle')}
          </Text>
        </View>
        {hasExplanation && (
          <Pressable
            onPress={handleExplain}
            disabled={btnDisabled}
            className="flex-row items-center gap-1 active:opacity-60"
          >
            {loading ? (
              <ActivityIndicator size="small" color={color} />
            ) : (
              <Text className="text-xs font-medium" style={{ color: btnDisabled ? '#9CA3AF' : color }}>
                {t('knowledge.detail.aiRegenerate')}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      {hasExplanation ? (
        <View className="gap-2">
          <Text className="text-base text-foreground leading-7" selectable>
            {explanation}
          </Text>
          <Text className="text-xs text-muted-foreground italic">
            {t('knowledge.detail.aiDisclaimerHint')}
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {!isOnline && (
            <Text className="text-xs text-muted-foreground">
              {t('knowledge.detail.aiOffline')}
            </Text>
          )}

          {error.length > 0 && (
            <Text selectable className="text-sm text-destructive">{error}</Text>
          )}

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

        {copied && (
          <Text className="text-xs text-center text-muted-foreground">
            {t('knowledge.detail.copied')}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Formatted Description Component ──────────────────────────────────────
function FormattedDescription({
  description,
  descriptionLabel,
  isSop = false,
  accentColor = '#0F766E',
}: {
  description: string;
  descriptionLabel: string;
  isSop?: boolean;
  accentColor?: string;
}) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const handleLawChipPress = (rawLine: string) => {
    const parts = rawLine.split(/[→\->]/);
    const targetText = parts.length > 1 ? parts.slice(1).join(' ') : rawLine;
    const m = targetText.match(/\b(BNS|BNSS|BSA)\s*[-.]?\s*(\d+[a-zA-Z]?)\b/i);
    if (m) {
      const act = m[1].toUpperCase() as ActId;
      const secNum = parseInt(m[2], 10);
      const existing = getSection(act, secNum);
      if (existing) {
        openSection(router, act, secNum);
        return;
      }
    }
    router.push(`/(app)/knowledge/list?category=All&query=${encodeURIComponent(targetText.trim() || rawLine.trim())}` as any);
  };

  const separator = '━━━━━━━━━━━━━━━━';
  const hasSeparator = description.includes(separator);
  const parts = hasSeparator ? description.split(separator) : [description];
  const mainText = parts[0].trim();
  const guidanceText = parts.length > 1 ? parts.slice(1).join(separator).trim() : null;

  const renderLines = (text: string, isGuidance = false) => {
    const lines = text.split('\n');
    let inLawSection = false;

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <View key={idx} className="h-2" />;
      }

      if (line.startsWith('# ')) {
        return null;
      }

      if (line.startsWith('## ')) {
        const headingText = line.replace(/^##\s*/, '').trim();
        inLawSection = headingText.includes('संबंधित धाराएँ') || headingText.includes('धाराएँ');

        return (
          <Text
            key={idx}
            className="text-base font-bold leading-6 mt-4 mb-1"
            style={{ color: accentColor }}
            selectable
          >
            {headingText}
          </Text>
        );
      }

      if (inLawSection && (line.includes('→') || line.includes('->'))) {
        const chipText = trimmed.replace(/^[•\-]\s*/, '').trim();
        return (
          <Pressable
            key={idx}
            onPress={() => handleLawChipPress(line)}
            className="my-1 px-3.5 py-2.5 rounded-xl border flex-row items-center justify-between active:opacity-70"
            style={{
              backgroundColor: `${accentColor}10`,
              borderColor: `${accentColor}35`,
              borderCurve: 'continuous',
            }}
          >
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              <Scale size={15} color={accentColor} />
              <Text className="text-sm font-semibold text-foreground flex-1" numberOfLines={2}>
                {chipText}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-xs font-medium" style={{ color: accentColor }}>
                देखें
              </Text>
              <ExternalLink size={12} color={accentColor} />
            </View>
          </Pressable>
        );
      }

      if (/^(\s{3,}|\t+)[•\-]\s*/.test(line)) {
        const bulletText = line.trim().replace(/^[•\-]\s*/, '');
        return (
          <View key={idx} className="flex-row items-start gap-2 pl-6 my-0.5">
            <Text className="text-sm text-muted-foreground leading-6">◦</Text>
            <Text className="flex-1 text-sm text-foreground leading-6" selectable>
              {bulletText}
            </Text>
          </View>
        );
      }

      const numMatch = line.match(/^\s*(\d+)[\.\)]\s*(.*)/);
      if (numMatch) {
        const stepNum = numMatch[1];
        const stepContent = numMatch[2];
        return (
          <View key={idx} className="flex-row items-start gap-2.5 pl-1 my-1">
            <View
              className="w-6 h-6 rounded-full items-center justify-center mt-0.5"
              style={{ backgroundColor: `${accentColor}18` }}
            >
              <Text className="text-xs font-bold" style={{ color: accentColor }}>
                {stepNum}
              </Text>
            </View>
            <Text className="flex-1 text-sm text-foreground leading-6" selectable>
              {stepContent}
            </Text>
          </View>
        );
      }

      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        return (
          <View key={idx} className="flex-row items-start gap-2 pl-1 my-0.5">
            <Text className="text-sm text-foreground leading-6">•</Text>
            <Text className="flex-1 text-sm text-foreground leading-6" selectable>
              {trimmed.replace(/^[•\-]\s*/, '')}
            </Text>
          </View>
        );
      }

      const labelMatch = line.match(/^(\s*)(उद्देश्य|क्षेत्र|संदर्भ|जिम्मेदारी|परिभाषा|प्रक्रिया)\s*[:：]\s*(.*)/);
      if (labelMatch) {
        const indent = labelMatch[1] || '';
        const label = labelMatch[2];
        const rest = labelMatch[3];
        return (
          <View key={idx} className={`my-0.5 ${indent.length >= 2 ? 'pl-5' : 'pl-0.5'}`}>
            <Text className="text-sm text-foreground leading-6" selectable>
              <Text className="font-bold text-foreground">{label}: </Text>
              <Text className="text-foreground">{rest}</Text>
            </Text>
          </View>
        );
      }

      if (trimmed.startsWith('⚠')) {
        return (
          <View key={idx} className="my-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <Text className="text-sm font-semibold text-amber-700 dark:text-amber-400 leading-6" selectable>
              {line}
            </Text>
          </View>
        );
      }

      if (trimmed.includes('☐')) {
        return (
          <View key={idx} className="my-2 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30">
            <Text className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">
              सेल्फ-चेक / Self-Check
            </Text>
            <Text className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-6" selectable>
              {line}
            </Text>
          </View>
        );
      }

      const isHeading =
        /^(भाग\s+[A-Z0-9]+|मुख्य निर्देश|समय-सीमाएँ|संबंधित प्रावधान|प्रशिक्षण|महत्वपूर्ण बिंदु)\s*[:.]?/i.test(trimmed) ||
        (trimmed.endsWith(':') && trimmed.length < 50);

      if (isHeading) {
        return (
          <Text
            key={idx}
            className={`text-sm font-bold text-foreground leading-6 mt-3 mb-1 ${isGuidance ? 'text-amber-900 dark:text-amber-200' : ''}`}
            selectable
          >
            {line}
          </Text>
        );
      }

      return (
        <Text
          key={idx}
          className="text-sm text-foreground leading-6"
          selectable
        >
          {line}
        </Text>
      );
    });
  };

  return (
    <View className="gap-4">
      <View
        className="bg-card border border-border rounded-2xl p-4 gap-2"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {descriptionLabel}
        </Text>
        <View className="gap-0.5">
          {renderLines(mainText)}
        </View>

        {isSop ? (
          <View
            className="mt-4 p-3 rounded-xl border"
            style={{
              backgroundColor: colorScheme === 'dark' ? '#78350f20' : '#fffbeb',
              borderColor: colorScheme === 'dark' ? '#d9770640' : '#fde68a',
              borderCurve: 'continuous',
            }}
          >
            <Text className="text-xs text-amber-800 dark:text-amber-300 leading-5 text-center font-medium">
              स्रोत: पुस्तिका/SOP का सारांश — अंतिम निर्णय हेतु मूल आदेश/न्यायालय निर्देश देखें
            </Text>
          </View>
        ) : null}
      </View>

      {guidanceText ? (
        <View
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 gap-2"
          style={{ borderCurve: 'continuous' }}
        >
          <View className="flex-row items-center gap-2 mb-1">
            <ClipboardList size={16} color="#D97706" />
            <Text className="text-sm font-bold text-amber-800 dark:text-amber-300">
              व्यवहार में कैसे लागू करें (सहायक सुझाव — परिपत्र का भाग नहीं)
            </Text>
          </View>
          <View className="gap-0.5">
            {renderLines(
              guidanceText.replace(/^व्यवहार में कैसे लागू करें\s*\(सहायक सुझाव — परिपत्र का भाग नहीं\)\s*\n*/, ''),
              true
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─── Sadharan Block Card ───────────────────────────────────────────────────
function SadharanBlockCard({ rawDescription }: { rawDescription: string }) {
  const sadharan = parseSadharanBlock(rawDescription);
  if (!sadharan) return null;

  return (
    <View
      className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 gap-3"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center gap-2 border-b border-emerald-500/20 pb-2">
        <Sparkles size={16} color="#059669" />
        <Text className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
          साधारण व्याख्या (सरल शब्दों में)
        </Text>
      </View>

      {sadharan.seedhiBaat ? (
        <View className="gap-1">
          <Text className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">
            सीधी बात:
          </Text>
          <Text className="text-sm text-foreground leading-5" selectable>
            {sadharan.seedhiBaat}
          </Text>
        </View>
      ) : null}

      {sadharan.aapkoKyaKarnaHai && sadharan.aapkoKyaKarnaHai.length > 0 ? (
        <View className="gap-1">
          <Text className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">
            आपको क्या करना है:
          </Text>
          {sadharan.aapkoKyaKarnaHai.map((item, idx) => (
            <Text key={idx} className="text-sm text-foreground leading-5" selectable>
              • {item}
            </Text>
          ))}
        </View>
      ) : null}

      {sadharan.kyaNaKaren && sadharan.kyaNaKaren.length > 0 ? (
        <View className="gap-1">
          <Text className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">
            क्या न करें:
          </Text>
          {sadharan.kyaNaKaren.map((item, idx) => (
            <Text key={idx} className="text-sm text-foreground leading-5" selectable>
              • {item}
            </Text>
          ))}
        </View>
      ) : null}

      {sadharan.ekLineMeYaadRakhen ? (
        <View className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
          <Text className="text-sm font-bold text-emerald-950 dark:text-emerald-50 leading-5" selectable>
            <Text className="font-extrabold text-emerald-900 dark:text-emerald-200">एक लाइन में याद रखें: </Text>
            {sadharan.ekLineMeYaadRakhen}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Knowledge Action Bar (Share / Edit / Delete) ──────────────────────────
function KnowledgeActionBar({
  entry,
  onShare,
  onEdit,
  onDelete,
  color,
}: {
  entry: KnowledgeEntry;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
  color: string;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isSystem = entry.source === 'system';

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <SourceBadge source={entry.source} />
        <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: `${color}15` }}>
          <Text className="text-xs font-semibold" style={{ color }}>{entry.category}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Pressable
          onPress={onShare}
          className="w-9 h-9 rounded-xl items-center justify-center active:opacity-60 bg-card border border-border"
          accessibilityLabel="Share"
        >
          <Share2 size={15} color={C.foreground} />
        </Pressable>
        {!isSystem && (
          <>
            <Pressable
              onPress={onEdit}
              className="w-9 h-9 rounded-xl items-center justify-center active:opacity-60 bg-card border border-border"
              accessibilityLabel="Edit"
            >
              <Edit2 size={15} color={C.foreground} />
            </Pressable>
            <Pressable
              onPress={onDelete}
              className="w-9 h-9 rounded-xl items-center justify-center active:opacity-60 bg-destructive/10 border border-destructive/20"
              accessibilityLabel="Delete"
            >
              <Trash2 size={15} color={C.destructive} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Knowledge Note Card ───────────────────────────────────────────────────
function KnowledgeNoteCard({
  noteText,
  saveStatus,
  onChange,
  onBlur,
}: {
  noteText: string;
  saveStatus: 'idle' | 'saving' | 'saved';
  onChange: (t: string) => void;
  onBlur: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;

  return (
    <View
      className="bg-card border border-border rounded-2xl p-4 gap-2.5"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-foreground">📝 मेरा नोट</Text>
        {saveStatus === 'saved' && (
          <View className="flex-row items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-md">
            <Check size={12} color="#16A34A" />
            <Text className="text-xs font-medium text-green-600 dark:text-green-400">सहेजा गया</Text>
          </View>
        )}
        {saveStatus === 'saving' && (
          <Text className="text-xs font-medium text-muted-foreground">सहेज रहे हैं…</Text>
        )}
      </View>
      <TextInput
        value={noteText}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="अपनी जानकारी यहाँ लिखें…"
        placeholderTextColor={C.mutedForeground}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        className="min-h-[96px] p-3 rounded-xl border border-border bg-background text-sm text-foreground leading-5"
      />
    </View>
  );
}

// ─── Knowledge Attachments Card ────────────────────────────────────────────
function KnowledgeAttachmentsCard({
  attachments,
  color,
  picking,
  onPick,
  onOpen,
  onRemove,
}: {
  attachments: Attachment[];
  color: string;
  picking: boolean;
  onPick: () => void;
  onOpen: (a: Attachment) => void;
  onRemove: (idx: number) => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;

  return (
    <View
      className="bg-card border border-border rounded-2xl p-4 gap-3"
      style={{ borderCurve: 'continuous' }}
    >
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
          onPress={onPick}
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

      {attachments.length > 0 ? (
        attachments.map((a, i) => (
          <AttachmentRow
            key={`${a.uri}-${i}`}
            item={a}
            color={color}
            onOpen={() => onOpen(a)}
            onRemove={() => onRemove(i)}
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
  );
}

// ─── SOP Law Chips Sub-component ──────────────────────────────────────────
function SopLawChips({
  laws,
  onLawPress,
}: {
  laws?: { old: string; new: string[] }[];
  onLawPress: (ref: string) => void;
}) {
  if (!laws || laws.length === 0) return null;

  return (
    <View className="gap-1.5 pt-1">
      <Text className="text-xs font-bold text-foreground">संबंधित धाराएँ (पुरानी → नई):</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {laws.map((lw, lIdx) => {
          const newStr = lw.new.join(', ');
          const label = `${lw.old} → ${newStr}`;
          return (
            <Pressable
              key={`sop-law-${lIdx}`}
              onPress={() => onLawPress(newStr || lw.old)}
              className="px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/25 flex-row items-center gap-1 active:opacity-70"
            >
              <Scale size={12} className="text-primary" />
              <Text className="text-xs font-semibold text-primary">{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── SOP Circular Chips Sub-component ─────────────────────────────────────
function SopCircularChips({
  circs,
  onCircularPress,
}: {
  circs?: { n: string; id: string | null }[];
  onCircularPress: (c: { n: string; id: string | null }) => void;
}) {
  if (!circs || circs.length === 0) return null;

  return (
    <View className="gap-1.5 pt-1">
      <Text className="text-xs font-bold text-foreground">डीजी परिपत्र संदर्भ:</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {circs.map((cr, cIdx) => (
          <Pressable
            key={`sop-circ-${cIdx}`}
            onPress={() => onCircularPress(cr)}
            className="px-2.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex-row items-center gap-1 active:opacity-70"
          >
            <ExternalLink size={12} className="text-blue-600 dark:text-blue-400" />
            <Text className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              {cr.n}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── SOP Header Metadata Card ──────────────────────────────────────────────
function SopHeaderMetadataCard({
  sopStruct,
  stepCount,
  onLawPress,
  onCircularPress,
}: {
  sopStruct: SopStruct;
  stepCount?: number;
  onLawPress: (ref: string) => void;
  onCircularPress: (c: { n: string; id: string | null }) => void;
}) {
  const srcBadge =
    sopStruct.src === 'b1'
      ? 'पुस्तिका 1 (2018)'
      : sopStruct.src === 'b2'
      ? 'पुस्तिका 2 (2020)'
      : 'पुस्तिका 3 (2021)';

  return (
    <View
      className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="gap-1">
        <Text className="text-base font-bold text-foreground leading-6" selectable>
          {sopStruct.title}
        </Text>
        {sopStruct.en ? (
          <Text className="text-xs text-muted-foreground font-medium" selectable>
            {sopStruct.en}
          </Text>
        ) : null}
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
        <View className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
          <Text className="text-xs font-bold text-primary">{srcBadge}</Text>
        </View>
        {stepCount ? (
          <View className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {stepCount} चेकलिस्ट बिंदु
            </Text>
          </View>
        ) : null}
        {sopStruct.pages ? (
          <View className="px-2 py-0.5 rounded-full bg-muted/60 border border-border">
            <Text className="text-xs text-muted-foreground">पृष्ठ {sopStruct.pages}</Text>
          </View>
        ) : null}
        {sopStruct.crime ? (
          <View className="px-2 py-0.5 rounded-full bg-secondary border border-border">
            <Text className="text-xs text-secondary-foreground font-medium">{sopStruct.crime}</Text>
          </View>
        ) : null}
      </View>

      <SopLawChips laws={sopStruct.laws} onLawPress={onLawPress} />
      <SopCircularChips circs={sopStruct.circ} onCircularPress={onCircularPress} />
    </View>
  );
}

// ─── SOP Details Tab Body ──────────────────────────────────────────────────
function SopDetailsTab({
  sopStruct,
  sopIndex,
  entry,
  searchQuery,
  onLawPress,
  onCircularPress,
}: {
  sopStruct: SopStruct | null;
  sopIndex?: { steps?: any[] } | null;
  entry: KnowledgeEntry;
  searchQuery: string;
  onLawPress: (ref: string) => void;
  onCircularPress: (c: { n: string; id: string | null }) => void;
}) {
  const { t } = useTranslation();

  if (sopStruct) {
    return (
      <View className="gap-4">
        <SopHeaderMetadataCard
          sopStruct={sopStruct}
          stepCount={sopIndex?.steps?.length}
          onLawPress={onLawPress}
          onCircularPress={onCircularPress}
        />
        <SopStructuredViewer
          sop={sopStruct}
          searchQuery={searchQuery}
          onLawPress={onLawPress}
          onCircularPress={onCircularPress}
        />
      </View>
    );
  }

  // Fallback for legacy SOP rows without struct json
  return (
    <View className="gap-4">
      <SadharanBlockCard rawDescription={entry.description} />
      {entry.description ? (
        <FormattedDescription
          description={stripSadharanBlock(entry.description)}
          descriptionLabel={t('knowledge.detail.description')}
          isSop
          accentColor="#0F766E"
        />
      ) : null}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. SOP Detail Component (<SopDetail />)
// ═════════════════════════════════════════════════════════════════════════════
export function SopDetail({
  entry,
  routeTab,
  routeCaseId,
}: {
  entry: KnowledgeEntry;
  routeTab?: string;
  routeCaseId?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const color = '#0F766E';

  // State & Hooks: ALL hooks called unconditionally at top of SopDetail
  const [activeTab, setActiveTab] = useState<'details' | 'checklist'>(
    routeTab === 'checklist' || routeTab === 'चेकलिस्ट' ? 'checklist' : 'details'
  );
  const [sopSearchQuery, setSopSearchQuery] = useState('');

  useEffect(() => {
    if (routeTab === 'checklist' || routeTab === 'चेकलिस्ट') {
      setActiveTab('checklist');
    } else if (routeTab === 'details' || routeTab === 'विवरण') {
      setActiveTab('details');
    }
  }, [routeTab]);

  // Lazy data loader hooks (ALWAYS called, never conditional)
  const sopStruct = useSopStruct(entry.id);
  const sopIndex = useSopIndex(sopStruct?.kid || sopStruct?.id || entry.id);

  const [attachments, setAttachments] = useState<Attachment[]>(() => parseAttachments(entry.attachment_uris));
  const [picking, setPicking] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);

  const [noteText, setNoteText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const noteSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const savedNote = await getKnowledgeNote(entry.id);
      if (active) setNoteText(savedNote ?? '');
    })();
    return () => {
      active = false;
    };
  }, [entry.id]);

  // Handlers
  const handleNoteChange = (text: string) => {
    setNoteText(text);
    setSaveStatus('saving');
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    noteSaveTimeout.current = setTimeout(async () => {
      await saveKnowledgeNote(entry.id, text);
      setSaveStatus('saved');
    }, 800);
  };

  const handleNoteBlur = async () => {
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    setSaveStatus('saving');
    await saveKnowledgeNote(entry.id, noteText);
    setSaveStatus('saved');
  };

  const persistAttachments = async (updated: Attachment[]) => {
    await updateKnowledgeAttachments(entry.id, JSON.stringify(updated));
  };

  const handlePickFile = async () => {
    if (process.env.EXPO_OS === 'web') {
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
        const next = [...attachments, ...picked];
        setAttachments(next);
        await persistAttachments(next);
      };
      input.click();
      return;
    }

    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets) {
        const picked: Attachment[] = res.assets.map((a) => ({
          uri: a.uri,
          name: a.name,
          mimeType: a.mimeType ?? 'application/octet-stream',
          size: a.size,
        }));
        const next = [...attachments, ...picked];
        setAttachments(next);
        await persistAttachments(next);
      }
    } catch (err) {
      logger.error('Failed to pick document:', err);
    } finally {
      setPicking(false);
    }
  };

  const handleOpenFile = async (a: Attachment) => {
    try {
      await WebBrowser.openBrowserAsync(a.uri);
    } catch {
      if (process.env.EXPO_OS === 'web') {
        window.open(a.uri, '_blank');
      }
    }
  };

  const handleRemoveConfirm = async () => {
    if (removeTarget === null) return;
    const next = attachments.filter((_, i) => i !== removeTarget);
    setAttachments(next);
    setRemoveTarget(null);
    await persistAttachments(next);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: entry.title,
        message: `*${entry.title}*\n\n${entry.description}\n\n— via InvestSuite`,
      });
    } catch (err) {
      logger.error('Share failed:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    setShowDelete(false);
    await deleteKnowledgeEntry(entry.id);
    router.back();
  };

  const handleSopLawPress = (rawRef: string) => {
    const m = rawRef.match(/\b(BNS|BNSS|BSA)\s*[-.]?\s*(\d+[a-zA-Z]?)\b/i);
    if (m) {
      const act = m[1].toUpperCase() as ActId;
      const secNum = parseInt(m[2], 10);
      const existing = getSection(act, secNum);
      if (existing) {
        openSection(router, act, secNum);
        return;
      }
    }
    router.push(`/(app)/knowledge/list?category=All&query=${encodeURIComponent(rawRef.trim())}` as any);
  };

  const handleSopCircularPress = (c: { n: string; id: string | null }) => {
    if (c.id) {
      router.push(`/(app)/knowledge/${c.id}` as any);
      return;
    }
    router.push(`/(app)/knowledge/list?category=Circular&query=${encodeURIComponent(c.n.trim())}` as any);
  };

  const displayTitle = getDisplayShortTitle(entry);
  const tagList = entry.tags ? entry.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={displayTitle}
        subtitle="मानक संचालन प्रक्रिया"
        showBack
      />

      {/* 2-Tab Navigation Bar: विवरण & चेकलिस्ट */}
      <View className="flex-row border-b border-border bg-card px-4 pt-2">
        <Pressable
          onPress={() => setActiveTab('details')}
          className={`flex-1 py-2.5 items-center justify-center border-b-2 active:opacity-70 ${
            activeTab === 'details' ? 'border-primary' : 'border-transparent'
          }`}
        >
          <Text
            className={`text-sm font-bold ${
              activeTab === 'details' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            📖 विवरण
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('checklist')}
          className={`flex-1 py-2.5 items-center justify-center border-b-2 active:opacity-70 ${
            activeTab === 'checklist' ? 'border-primary' : 'border-transparent'
          }`}
        >
          <Text
            className={`text-sm font-bold ${
              activeTab === 'checklist' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            ✅ चेकलिस्ट
          </Text>
        </Pressable>
      </View>

      {/* Sticky Search bar when on Details tab and sopStruct exists */}
      {activeTab === 'details' && sopStruct && (
        <View className="px-4 py-2 bg-background border-b border-border/50">
          <View className="flex-row items-center bg-card border border-border rounded-xl px-3 py-2 gap-2">
            <Search size={16} className="text-muted-foreground" />
            <TextInput
              value={sopSearchQuery}
              onChangeText={setSopSearchQuery}
              placeholder="इस SOP में खोजें (चरण, सामग्री, विधि, उपकरण)..."
              placeholderTextColor={C.mutedForeground}
              className="flex-1 text-sm text-foreground p-0"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {sopSearchQuery.length > 0 && (
              <Pressable onPress={() => setSopSearchQuery('')} hitSlop={8}>
                <X size={16} className="text-muted-foreground" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      <ScrollView
        contentContainerClassName="px-4 py-4 gap-4 pb-20"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <KnowledgeActionBar
          entry={entry}
          onShare={handleShare}
          onEdit={() => router.push(`/(app)/knowledge/add-edit?id=${entry.id}` as any)}
          onDelete={() => setShowDelete(true)}
          color={color}
        />

        {/* Tab content wrapped in a local error boundary so tab crash never blanks the screen */}
        <LocalTabErrorBoundary fallbackMessage="यह भाग लोड नहीं हो सका — फिर प्रयास करें">
          {activeTab === 'checklist' ? (
            <SopChecklistTab
              sopId={sopStruct?.id || entry.id}
              sopKid={sopStruct?.kid || entry.id}
              initialCaseId={routeCaseId}
            />
          ) : (
            <SopDetailsTab
              sopStruct={sopStruct}
              sopIndex={sopIndex}
              entry={entry}
              searchQuery={sopSearchQuery}
              onLawPress={handleSopLawPress}
              onCircularPress={handleSopCircularPress}
            />
          )}
        </LocalTabErrorBoundary>

        {/* मेरा नोट Card */}
        <KnowledgeNoteCard
          noteText={noteText}
          saveStatus={saveStatus}
          onChange={handleNoteChange}
          onBlur={handleNoteBlur}
        />

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
        <KnowledgeAttachmentsCard
          attachments={attachments}
          color={color}
          picking={picking}
          onPick={handlePickFile}
          onOpen={handleOpenFile}
          onRemove={(idx) => setRemoveTarget(idx)}
        />

        {/* Audit timestamps */}
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

// ═════════════════════════════════════════════════════════════════════════════
// 2. Circular Detail Component (<CircularDetail />)
// ═════════════════════════════════════════════════════════════════════════════
export function CircularDetail({ entry }: { entry: KnowledgeEntry }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const color = '#2563EB';

  const [attachments, setAttachments] = useState<Attachment[]>(() => parseAttachments(entry.attachment_uris));
  const [picking, setPicking] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);

  const [noteText, setNoteText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const noteSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const savedNote = await getKnowledgeNote(entry.id);
      if (active) setNoteText(savedNote ?? '');
    })();
    return () => {
      active = false;
    };
  }, [entry.id]);

  const handleNoteChange = (text: string) => {
    setNoteText(text);
    setSaveStatus('saving');
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    noteSaveTimeout.current = setTimeout(async () => {
      await saveKnowledgeNote(entry.id, text);
      setSaveStatus('saved');
    }, 800);
  };

  const handleNoteBlur = async () => {
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    setSaveStatus('saving');
    await saveKnowledgeNote(entry.id, noteText);
    setSaveStatus('saved');
  };

  const persistAttachments = async (updated: Attachment[]) => {
    await updateKnowledgeAttachments(entry.id, JSON.stringify(updated));
  };

  const handlePickFile = async () => {
    if (process.env.EXPO_OS === 'web') {
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
        const next = [...attachments, ...picked];
        setAttachments(next);
        await persistAttachments(next);
      };
      input.click();
      return;
    }

    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets) {
        const picked: Attachment[] = res.assets.map((a) => ({
          uri: a.uri,
          name: a.name,
          mimeType: a.mimeType ?? 'application/octet-stream',
          size: a.size,
        }));
        const next = [...attachments, ...picked];
        setAttachments(next);
        await persistAttachments(next);
      }
    } catch (err) {
      logger.error('Failed to pick document:', err);
    } finally {
      setPicking(false);
    }
  };

  const handleOpenFile = async (a: Attachment) => {
    try {
      await WebBrowser.openBrowserAsync(a.uri);
    } catch {
      if (process.env.EXPO_OS === 'web') {
        window.open(a.uri, '_blank');
      }
    }
  };

  const handleRemoveConfirm = async () => {
    if (removeTarget === null) return;
    const next = attachments.filter((_, i) => i !== removeTarget);
    setAttachments(next);
    setRemoveTarget(null);
    await persistAttachments(next);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: entry.title,
        message: `*${entry.title}*\n\n${entry.description}\n\n— via InvestSuite`,
      });
    } catch (err) {
      logger.error('Share failed:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    setShowDelete(false);
    await deleteKnowledgeEntry(entry.id);
    router.back();
  };

  const circularChip = getCircularNumberChip(entry);
  const displayTitle = getDisplayShortTitle(entry);
  const tagList = entry.tags ? entry.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={displayTitle}
        subtitle="परिपत्र / निर्देश"
        showBack
      />

      <ScrollView
        contentContainerClassName="px-4 py-4 gap-4 pb-20"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <KnowledgeActionBar
          entry={entry}
          onShare={handleShare}
          onEdit={() => router.push(`/(app)/knowledge/add-edit?id=${entry.id}` as any)}
          onDelete={() => setShowDelete(true)}
          color={color}
        />

        {/* Circular Identification Card */}
        <View
          className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5"
          style={{ borderCurve: 'continuous' }}
        >
          {circularChip ? (
            <View className="flex-row items-center">
              <View className="rounded-full px-3 py-1 bg-blue-500/15 border border-blue-500/30">
                <Text className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  {circularChip}
                </Text>
              </View>
            </View>
          ) : null}
          <Text className="text-base font-bold text-foreground leading-6" selectable>
            {entry.title}
          </Text>
        </View>

        {/* Sadharan block */}
        <SadharanBlockCard rawDescription={entry.description} />

        {/* Formatted Description */}
        {entry.description ? (
          <FormattedDescription
            description={stripSadharanBlock(entry.description)}
            descriptionLabel={t('knowledge.detail.description')}
            accentColor={color}
          />
        ) : null}

        {/* Note Card */}
        <KnowledgeNoteCard
          noteText={noteText}
          saveStatus={saveStatus}
          onChange={handleNoteChange}
          onBlur={handleNoteBlur}
        />

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

        {/* Attachments */}
        <KnowledgeAttachmentsCard
          attachments={attachments}
          color={color}
          picking={picking}
          onPick={handlePickFile}
          onOpen={handleOpenFile}
          onRemove={(idx) => setRemoveTarget(idx)}
        />

        {/* Timestamps */}
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

      {/* Remove attachment dialog */}
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

      {/* Delete record dialog */}
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

// ═════════════════════════════════════════════════════════════════════════════
// 3. Law Detail Component (<LawDetail />)
// ═════════════════════════════════════════════════════════════════════════════
export function LawDetail({ entry }: { entry: KnowledgeEntry }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { settings } = useSettingsStore();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const color = '#DC2626';

  const [attachments, setAttachments] = useState<Attachment[]>(() => parseAttachments(entry.attachment_uris));
  const [picking, setPicking] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);

  const [noteText, setNoteText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const noteSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const savedNote = await getKnowledgeNote(entry.id);
      if (active) setNoteText(savedNote ?? '');
    })();
    return () => {
      active = false;
    };
  }, [entry.id]);

  const handleNoteChange = (text: string) => {
    setNoteText(text);
    setSaveStatus('saving');
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    noteSaveTimeout.current = setTimeout(async () => {
      await saveKnowledgeNote(entry.id, text);
      setSaveStatus('saved');
    }, 800);
  };

  const handleNoteBlur = async () => {
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    setSaveStatus('saving');
    await saveKnowledgeNote(entry.id, noteText);
    setSaveStatus('saved');
  };

  const persistAttachments = async (updated: Attachment[]) => {
    await updateKnowledgeAttachments(entry.id, JSON.stringify(updated));
  };

  const handlePickFile = async () => {
    if (process.env.EXPO_OS === 'web') {
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
        const next = [...attachments, ...picked];
        setAttachments(next);
        await persistAttachments(next);
      };
      input.click();
      return;
    }

    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets) {
        const picked: Attachment[] = res.assets.map((a) => ({
          uri: a.uri,
          name: a.name,
          mimeType: a.mimeType ?? 'application/octet-stream',
          size: a.size,
        }));
        const next = [...attachments, ...picked];
        setAttachments(next);
        await persistAttachments(next);
      }
    } catch (err) {
      logger.error('Failed to pick document:', err);
    } finally {
      setPicking(false);
    }
  };

  const handleOpenFile = async (a: Attachment) => {
    try {
      await WebBrowser.openBrowserAsync(a.uri);
    } catch {
      if (process.env.EXPO_OS === 'web') {
        window.open(a.uri, '_blank');
      }
    }
  };

  const handleRemoveConfirm = async () => {
    if (removeTarget === null) return;
    const next = attachments.filter((_, i) => i !== removeTarget);
    setAttachments(next);
    setRemoveTarget(null);
    await persistAttachments(next);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: entry.title,
        message: `*${entry.title}*\n\n${entry.description}\n\n— via InvestSuite`,
      });
    } catch (err) {
      logger.error('Share failed:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    setShowDelete(false);
    await deleteKnowledgeEntry(entry.id);
    router.back();
  };

  const displayTitle = getDisplayShortTitle(entry);
  const tagList = entry.tags ? entry.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={displayTitle}
        subtitle={entry.subcategory || 'कानूनी धारा / अधिनियम'}
        showBack
      />

      <ScrollView
        contentContainerClassName="px-4 py-4 gap-4 pb-20"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <KnowledgeActionBar
          entry={entry}
          onShare={handleShare}
          onEdit={() => router.push(`/(app)/knowledge/add-edit?id=${entry.id}` as any)}
          onDelete={() => setShowDelete(true)}
          color={color}
        />

        <View
          className="bg-card border border-border rounded-2xl p-4 gap-2"
          style={{ borderCurve: 'continuous' }}
        >
          <Text className="text-base font-bold text-foreground leading-6" selectable>
            {entry.title}
          </Text>
          {entry.subcategory ? (
            <Text className="text-xs font-semibold text-primary">{entry.subcategory}</Text>
          ) : null}
        </View>

        <SadharanBlockCard rawDescription={entry.description} />

        {entry.description ? (
          <FormattedDescription
            description={stripSadharanBlock(entry.description)}
            descriptionLabel={t('knowledge.detail.description')}
            accentColor={color}
          />
        ) : null}

        {/* AI Simple Explanation */}
        {settings.aiKnowledgeSearch && (
          <SimpleExplanationCard entry={entry} color={color} />
        )}

        {/* Note */}
        <KnowledgeNoteCard
          noteText={noteText}
          saveStatus={saveStatus}
          onChange={handleNoteChange}
          onBlur={handleNoteBlur}
        />

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

        {/* Attachments */}
        <KnowledgeAttachmentsCard
          attachments={attachments}
          color={color}
          picking={picking}
          onPick={handlePickFile}
          onOpen={handleOpenFile}
          onRemove={(idx) => setRemoveTarget(idx)}
        />

        {/* Timestamps */}
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

      {/* Remove attachment dialog */}
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

      {/* Delete record dialog */}
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

// ═════════════════════════════════════════════════════════════════════════════
// 4. Default Detail Component (<DefaultDetail />)
// ═════════════════════════════════════════════════════════════════════════════
export function DefaultDetail({ entry }: { entry: KnowledgeEntry }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { settings } = useSettingsStore();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const color = (KNOWLEDGE_CATEGORY_MAP as any)[entry.category]?.color ?? '#6366F1';

  const [attachments, setAttachments] = useState<Attachment[]>(() => parseAttachments(entry.attachment_uris));
  const [picking, setPicking] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);

  const [noteText, setNoteText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const noteSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const savedNote = await getKnowledgeNote(entry.id);
      if (active) setNoteText(savedNote ?? '');
    })();
    return () => {
      active = false;
    };
  }, [entry.id]);

  const handleNoteChange = (text: string) => {
    setNoteText(text);
    setSaveStatus('saving');
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    noteSaveTimeout.current = setTimeout(async () => {
      await saveKnowledgeNote(entry.id, text);
      setSaveStatus('saved');
    }, 800);
  };

  const handleNoteBlur = async () => {
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    setSaveStatus('saving');
    await saveKnowledgeNote(entry.id, noteText);
    setSaveStatus('saved');
  };

  const persistAttachments = async (updated: Attachment[]) => {
    await updateKnowledgeAttachments(entry.id, JSON.stringify(updated));
  };

  const handlePickFile = async () => {
    if (process.env.EXPO_OS === 'web') {
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
        const next = [...attachments, ...picked];
        setAttachments(next);
        await persistAttachments(next);
      };
      input.click();
      return;
    }

    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets) {
        const picked: Attachment[] = res.assets.map((a) => ({
          uri: a.uri,
          name: a.name,
          mimeType: a.mimeType ?? 'application/octet-stream',
          size: a.size,
        }));
        const next = [...attachments, ...picked];
        setAttachments(next);
        await persistAttachments(next);
      }
    } catch (err) {
      logger.error('Failed to pick document:', err);
    } finally {
      setPicking(false);
    }
  };

  const handleOpenFile = async (a: Attachment) => {
    try {
      await WebBrowser.openBrowserAsync(a.uri);
    } catch {
      if (process.env.EXPO_OS === 'web') {
        window.open(a.uri, '_blank');
      }
    }
  };

  const handleRemoveConfirm = async () => {
    if (removeTarget === null) return;
    const next = attachments.filter((_, i) => i !== removeTarget);
    setAttachments(next);
    setRemoveTarget(null);
    await persistAttachments(next);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: entry.title,
        message: `*${entry.title}*\n\n${entry.description}\n\n— via InvestSuite`,
      });
    } catch (err) {
      logger.error('Share failed:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    setShowDelete(false);
    await deleteKnowledgeEntry(entry.id);
    router.back();
  };

  const displayTitle = getDisplayShortTitle(entry);
  const tagList = entry.tags ? entry.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={displayTitle}
        subtitle={entry.subcategory || entry.category}
        showBack
      />

      <ScrollView
        contentContainerClassName="px-4 py-4 gap-4 pb-20"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <KnowledgeActionBar
          entry={entry}
          onShare={handleShare}
          onEdit={() => router.push(`/(app)/knowledge/add-edit?id=${entry.id}` as any)}
          onDelete={() => setShowDelete(true)}
          color={color}
        />

        <View
          className="bg-card border border-border rounded-2xl p-4 gap-2"
          style={{ borderCurve: 'continuous' }}
        >
          <Text className="text-base font-bold text-foreground leading-6" selectable>
            {entry.title}
          </Text>
        </View>

        <SadharanBlockCard rawDescription={entry.description} />

        {entry.description ? (
          <FormattedDescription
            description={stripSadharanBlock(entry.description)}
            descriptionLabel={t('knowledge.detail.description')}
            accentColor={color}
          />
        ) : null}

        {/* AI Simple Explanation */}
        {settings.aiKnowledgeSearch && AI_EXPLAIN_CATEGORIES.includes(entry.category as any) && (
          <SimpleExplanationCard entry={entry} color={color} />
        )}

        {/* Note */}
        <KnowledgeNoteCard
          noteText={noteText}
          saveStatus={saveStatus}
          onChange={handleNoteChange}
          onBlur={handleNoteBlur}
        />

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

        {/* Attachments */}
        <KnowledgeAttachmentsCard
          attachments={attachments}
          color={color}
          picking={picking}
          onPick={handlePickFile}
          onOpen={handleOpenFile}
          onRemove={(idx) => setRemoveTarget(idx)}
        />

        {/* Timestamps */}
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

      {/* Remove attachment dialog */}
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

      {/* Delete record dialog */}
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

// ═════════════════════════════════════════════════════════════════════════════
// 5. Main Knowledge Detail Screen (<KnowledgeDetailScreen />)
// ═════════════════════════════════════════════════════════════════════════════
export default function KnowledgeDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { knowledgeId, tab: routeTab, caseId: routeCaseId } = useLocalSearchParams<{
    knowledgeId: string;
    tab?: string;
    caseId?: string;
  }>();

  // All screen-level hooks are placed unconditionally at the top
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!knowledgeId) return;
      let active = true;
      (async () => {
        setLoading(true);
        const e = await getKnowledgeById(knowledgeId);
        let resolvedEntry = e;
        if (!resolvedEntry) {
          const { getByKid, getById } = await import('@/ai/sopStruct');
          const st = getByKid(knowledgeId) || getById(knowledgeId);
          if (st) {
            resolvedEntry = {
              id: st.kid,
              title: st.title,
              category: 'SOP',
              subcategory: st.crime || 'मानक संचालन प्रक्रिया',
              description: st.title,
              tags: `SOP, ${st.crime}`,
              source: 'system',
              created_at: 0,
              updated_at: 0,
              content_type: 'sop',
              crime_type: st.crime || '',
              attachment_uris: '[]',
              version: 1,
              sync_status: 'synced',
            };
          }
        }
        if (active) {
          setEntry(resolvedEntry);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [knowledgeId])
  );

  // Early returns: Only after ALL screen hooks have run!
  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3 px-6">
        <Text className="text-base font-semibold text-foreground">
          {t('knowledge.detail.notFound')}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="active:opacity-70 px-4 py-2 rounded-xl bg-primary"
        >
          <Text className="text-sm font-semibold text-primary-foreground">
            {t('knowledge.detail.goBack')}
          </Text>
        </Pressable>
      </View>
    );
  }

  // Split by content_type: each child component is mounted with key={entry.id}
  const isSop = entry.content_type === 'sop' || entry.category === 'SOP';
  const isCircular = entry.content_type === 'circular' || entry.category === 'Circular';
  const isLaw = entry.content_type === 'law' || entry.category === 'Law';

  if (isSop) {
    return (
      <SopDetail
        key={entry.id}
        entry={entry}
        routeTab={routeTab}
        routeCaseId={routeCaseId}
      />
    );
  }

  if (isCircular) {
    return (
      <CircularDetail
        key={entry.id}
        entry={entry}
      />
    );
  }

  if (isLaw) {
    return (
      <LawDetail
        key={entry.id}
        entry={entry}
      />
    );
  }

  return (
    <DefaultDetail
      key={entry.id}
      entry={entry}
    />
  );
}
