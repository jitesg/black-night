/**
 * AIMessageBubble — Minimal MD3 chat bubble.
 *
 * Minimal aesthetic: near-zero shadow, 1px border only, restrained colour.
 * AI:   white bg, #111827 text, left-aligned, avatar dot, no border.
 * User: #F3F4F6 bg, #111827 text, right-aligned, no border.
 * Both: 93% max-width, 14dp h-pad, 12dp v-pad, 18dp radius with tail corner.
 * Toolbar: copy/retry inline below bubble on tap.
 * Typing: 3-dot fade indicator.
 * Entrance: opacity 0→1 + 4dp slide-up, 180ms ease-out.
 */

import React, { memo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import {
  Copy, CheckCheck, BookOpen, Bookmark, RefreshCw, AlertCircle,
  Bot, ChevronDown, ChevronUp, Loader,
} from 'lucide-react-native';
import { T } from '@/lib/typography';
import type { AIMessage, AIToolCall } from '@/ai/AITypes';
import { AIResponseFormatter } from '@/ai/AIResponseFormatter';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useRouter } from 'expo-router';
import { openSection } from '@/lib/law/openLaw';
import type { ActId } from '@/lib/law/lawLibrary';

// ── Minimal colour tokens — theme-aware hook ─────────────────────────
interface ThemePalette {
  aiSurface: string;
  aiText: string;
  aiTimestamp: string;
  aiBorder: string;
  userSurface: string;
  userText: string;
  userBorder: 'transparent';
  accent: string;
  muted: string;
  toolBg: string;
}

interface Props {
  message: AIMessage;
  onOpenDraft?: (draft: NonNullable<AIMessage['draft']>) => void;
  onRegenerate?: (messageId: string) => void;
  onSaveToDiary?: () => void;
}

export const AIMessageBubble = memo(function AIMessageBubble({
  message, onOpenDraft, onRegenerate, onSaveToDiary,
}: Props) {
  const { t } = useTranslation();
  const [copied, setCopied]               = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(4)).current;

  const isUser    = message.role === 'user';
  const isLoading = message.content === '…';
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  // Theme-resolved bubble palette
  const TC: ThemePalette = {
    aiSurface:   C.card,
    aiText:      C.foreground,
    aiTimestamp: C.mutedForeground,
    aiBorder:    C.border,
    userSurface: C.muted,
    userText:    C.foreground,
    userBorder:  'transparent',
    accent:      C.primary,
    muted:       C.mutedForeground,
    toolBg:      C.muted,
  };

  // Entrance: fade-in + 4dp slide-up, 180ms ease-out
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(AIResponseFormatter.toPlainText(message.content));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Timestamp helper ─────────────────────────────────────────────────────────
  const ts = formatTime(message.timestamp);

  // ── User bubble — light neutral, right-aligned, 93% width ───────────────────
  if (isUser) {
    return (
      <Animated.View style={{
        marginBottom: 6, alignItems: 'flex-end',
        opacity, transform: [{ translateY }],
        paddingHorizontal: 8,
      }}>
        <View style={{
          maxWidth: '93%',
          backgroundColor: TC.userSurface,
          borderRadius: 18, borderBottomRightRadius: 5,
          paddingHorizontal: 14, paddingVertical: 11,
        }}>
          <Text style={{ fontSize: 14, color: TC.userText, lineHeight: 21, letterSpacing: -0.1 }}>
            {message.content}
          </Text>
        </View>
        <Text style={{ fontSize: 10, color: TC.aiTimestamp, marginTop: 3, marginRight: 6 }}>
          {ts}
        </Text>
      </Animated.View>
    );
  }

  // ── AI bubble — card bg, left-aligned, accent avatar dot, 93% width ──────────
  return (
    <Animated.View style={{
      marginBottom: 8, alignItems: 'flex-start',
      opacity, transform: [{ translateY }],
      paddingHorizontal: 8,
    }}>
      {/* Avatar + bubble row */}
      <View style={{ flexDirection: 'row', gap: 7, maxWidth: '93%', alignItems: 'flex-end' }}>
        {/* Minimal avatar: 22dp circle, accent bg */}
        <View style={{
          width: 22, height: 22, borderRadius: 11, flexShrink: 0,
          backgroundColor: TC.accent,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
        }}>
          <Bot size={11} color="#FFFFFF" strokeWidth={2.5} />
        </View>

        <View style={{ flex: 1 }}>
          {/* Bubble: card bg, hairline border, left tail */}
          <Pressable
            onPress={() => !isLoading && setToolbarVisible(v => !v)}
            onLongPress={() => !isLoading && setToolbarVisible(true)}
            delayLongPress={350}
            accessibilityRole="button"
            accessibilityLabel={t('ai.messageActions')}
          >
            <View style={{
              backgroundColor: isLoading ? TC.toolBg : TC.aiSurface,
              borderRadius: 18, borderBottomLeftRadius: 5,
              borderWidth: 1,
              borderColor: isLoading ? TC.aiBorder : TC.aiBorder,
              paddingHorizontal: 14, paddingVertical: 11,
            }}>
              {isLoading ? <TypingIndicator /> : <MarkdownText content={message.content} colors={TC} />}
            </View>
          </Pressable>

          {/* Inline toolbar */}
          {!isLoading && toolbarVisible && (
            <MessageToolbar
              onCopy={handleCopy}
              copied={copied}
              onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
              onSave={message.draft ? () => {} : undefined}
              onSaveToDiary={onSaveToDiary}
            />
          )}

          {/* Tool calls collapsible */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Pressable
                onPress={() => setToolsExpanded(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 }}
                accessibilityRole="button"
                accessibilityLabel={t('ai.toggleTools')}
              >
                <Text style={{ ...T.caption2, color: TC.muted, fontSize: 10 }}>
                  {t('ai.toolUsed', { count: message.toolCalls.length })}
                </Text>
                {toolsExpanded
                  ? <ChevronUp size={9} color={TC.muted} />
                  : <ChevronDown size={9} color={TC.muted} />}
              </Pressable>
              {toolsExpanded && (
                <View style={{ gap: 3 }}>
                  {message.toolCalls.map((tc, i) => <ToolCallChip key={i} toolCall={tc} />)}
                </View>
              )}
            </View>
          )}

          {/* Draft preview card */}
          {message.draft && (
            <DraftPreviewCard
              draft={message.draft}
              onOpen={() => onOpenDraft?.(message.draft!)}
            />
          )}

          {/* Timestamp */}
          {!isLoading && (
            <Text style={{ fontSize: 10, color: TC.aiTimestamp, marginTop: 4, marginLeft: 2 }}>
              {ts}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

// ── Message action toolbar ────────────────────────────────────────────────────

// ── Inline toolbar — minimal: icon-only row, no background card ───────────────
function MessageToolbar({
  onCopy, copied, onRegenerate, onSave, onSaveToDiary,
}: {
  onCopy: () => void;
  copied: boolean;
  onRegenerate?: () => void;
  onSave?: () => void;
  onSaveToDiary?: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 2,
      marginTop: 5, marginLeft: 2,
    }}>
      <ToolbarBtn
        icon={copied ? CheckCheck : Copy}
        label={copied ? t('ai.copied') : t('ai.copy')}
        color={copied ? C.primary : C.mutedForeground}
        onPress={onCopy}
      />
      {onRegenerate && (
        <ToolbarBtn icon={RefreshCw} label={t('ai.retry')} color={C.mutedForeground} onPress={onRegenerate} />
      )}
      {onSave && (
        <ToolbarBtn icon={Bookmark} label={t('ai.save')} color={C.mutedForeground} onPress={onSave} />
      )}
      {onSaveToDiary && (
        <ToolbarBtn icon={BookOpen} label={t('ai.diary')} color={C.mutedForeground} onPress={onSaveToDiary} />
      )}
    </View>
  );
}

function ToolbarBtn({
  icon: Icon, label, color, onPress,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-50"
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: 8, paddingVertical: 5,
      }}
    >
      <Icon size={11} color={color} strokeWidth={2} />
      <Text style={{ fontSize: 10, fontWeight: '500', color, letterSpacing: 0.1 }}>{label}</Text>
    </Pressable>
  );
}

// ── Typing Indicator — 3 minimal dots, opacity pulse ─────────────────────────
function TypingIndicator() {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const dots = [
    useRef(new Animated.Value(0.25)).current,
    useRef(new Animated.Value(0.25)).current,
    useRef(new Animated.Value(0.25)).current,
  ];

  React.useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, { toValue: 0.85, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.25, duration: 300, useNativeDriver: true }),
        ])
      )
    );
    Animated.stagger(0, animations).start();
    return () => animations.forEach(a => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 4 }}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: C.primary, opacity: dot,
        }} />
      ))}
    </View>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownText({ content, colors: tc }: { content: string; colors: ThemePalette }) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const lines  = content.split('\n');
  const TEXT   = tc.aiText;
  const MUTED  = tc.muted;
  const BOLD   = tc.aiText;

  const rendered: React.ReactNode[] = [];
  let inCode = false;
  const codeLines: string[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLines.length = 0;
      } else {
        inCode = false;
        rendered.push(
          <View key={`code-${i}`} style={{
            backgroundColor: colorScheme === 'dark' ? '#090D16' : '#0F172A', borderRadius: 10,
            padding: 12, marginVertical: 4,
          }}>
            <Text style={{ fontSize: 12, color: colorScheme === 'dark' ? '#93C5FD' : '#7DD3FC', fontFamily: 'monospace', lineHeight: 18 }}>
              {codeLines.join('\n')}
            </Text>
          </View>
        );
      }
      return;
    }
    if (inCode) { codeLines.push(line); return; }
    if (!line.trim()) { rendered.push(<View key={i} style={{ height: 6 }} />); return; }

    const isH1     = line.startsWith('# ');
    const isH2     = line.startsWith('## ');
    const isH3     = line.startsWith('### ');
    const isBullet = /^[•\-\*]\s/.test(line);
    const isNum    = /^\d+\.\s/.test(line);

    const stripped = line
      .replace(/^#{1,3}\s/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^[•\-\*]\s/, '')
      .replace(/^\d+\.\s/, '');

    const fontSize   = isH1 ? 16 : isH2 ? 14 : isH3 ? 13 : 13;
    const fontWeight: '700' | '600' | '400' =
      isH1 || isH2 ? '700' : isH3 ? '600' : '400';
    const color = isH1 || isH2 ? BOLD : TEXT;
    const marginTop = isH1 ? 8 : isH2 ? 6 : isH3 ? 4 : 0;

    rendered.push(
      <View key={i} style={{ flexDirection: 'row', gap: isBullet || isNum ? 8 : 0, marginTop }}>
        {isBullet && (
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.primary, marginTop: 8, flexShrink: 0 }} />
        )}
        {isNum && (
          <Text style={{ fontSize: 13, color: C.primary, lineHeight: 20, flexShrink: 0, fontWeight: '600' }}>
            {line.match(/^\d+/)?.[0]}.
          </Text>
        )}
        <Text style={{ fontSize, fontWeight, color, lineHeight: 20, flex: 1 }}>
          {renderInline(stripped, MUTED, tc, router)}
        </Text>
      </View>
    );
  });

  return <View style={{ gap: 2 }}>{rendered}</View>;
}

/** Renders inline **bold**, `code`, and tappable legal section links within a text node */
function renderInline(text: string, mutedColor: string, tc: ThemePalette, router: ReturnType<typeof useRouter>): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2);
          return (
            <Text key={i} style={{ fontWeight: '700', color: tc.aiText }}>
              {renderLegalLinks(inner, tc, router)}
            </Text>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <Text key={i} style={{
              fontFamily: 'monospace', fontSize: 12,
              backgroundColor: tc.toolBg, color: tc.muted,
              paddingHorizontal: 3, borderRadius: 3,
            }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return <React.Fragment key={i}>{renderLegalLinks(part, tc, router)}</React.Fragment>;
      })}
    </>
  );
}

function renderLegalLinks(text: string, tc: ThemePalette, router: ReturnType<typeof useRouter>): React.ReactNode {
  // 1) Match markdown links like [📖 पूरा SOP खोलें](sop:sys-sop-...) or [✅ चेकलिस्ट खोलें](sop_checklist:sys-sop-...)
  const linkRegex = /\[([^\]]+)\]\((?:(sop|sop_checklist):)?(sys-[a-z0-9-]+|sop-[a-z0-9-]+)\)/gi;
  if (linkRegex.test(text)) {
    const parts: React.ReactNode[] = [];
    let last = 0;
    linkRegex.lastIndex = 0;
    let lm: RegExpExecArray | null;
    while ((lm = linkRegex.exec(text)) !== null) {
      if (lm.index > last) {
        parts.push(text.slice(last, lm.index));
      }
      const label = lm[1];
      const scheme = lm[2];
      const targetId = lm[3];
      const isChecklist = scheme === 'sop_checklist' || label.includes('चेकलिस्ट');

      parts.push(
        <Text
          key={`mdlink-${lm.index}`}
          onPress={() =>
            router.push(
              `/(app)/knowledge/${targetId}${isChecklist ? '?tab=checklist' : ''}` as any
            )
          }
          style={{
            color: '#0F766E',
            fontWeight: '700',
            textDecorationLine: 'underline',
          }}
        >
          {label}
        </Text>
      );
      last = lm.index + lm[0].length;
    }
    if (last < text.length) {
      parts.push(text.slice(last));
    }
    return parts;
  }

  // Match both:
  // 1) Buttons / Action links: [धारा खोलें: BNS 103] or धारा खोलें → BNS 103
  // 2) Standard statutory references: BNS 103 or धारा 35 BNSS
  const secRegex = /(?:\[धारा खोलें[:\s→➔]*|धारा खोलें[:\s→➔]+)(BNS|BNSS|BSA)\s+(\d+)(?:\((\w+)\))?\]?|\b(BNS|BNSS|BSA)\s+(\d+)(?:\((\w+)\))?|\bधारा\s+(\d+)\s+(BNS|BNSS|BSA)\b/gi;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = secRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const matchedText = match[0];
    let act: ActId = 'BNS';
    let n = 0;

    if (match[1] && match[2]) {
      act = match[1].toUpperCase() as ActId;
      n = parseInt(match[2], 10);
    } else if (match[4] && match[5]) {
      act = match[4].toUpperCase() as ActId;
      n = parseInt(match[5], 10);
    } else if (match[7] && match[8]) {
      n = parseInt(match[7], 10);
      act = match[8].toUpperCase() as ActId;
    }

    const isButtonVariant = matchedText.includes('धारा खोलें');

    nodes.push(
      <Text
        key={`sec-${match.index}`}
        onPress={() => openSection(router, act, n)}
        style={
          isButtonVariant
            ? {
                color: '#2563EB',
                fontWeight: '700',
                textDecorationLine: 'none',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }
            : {
                color: '#2563EB',
                textDecorationLine: 'underline',
                fontWeight: '600',
              }
        }
      >
        {matchedText}
      </Text>
    );

    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length === 0 ? text : nodes;
}

// ── Tool Call Chip ────────────────────────────────────────────────────────────

function ToolCallChip({ toolCall }: { toolCall: AIToolCall }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  const statusMap = {
    idle:    { color: C.mutedForeground, icon: null },
    running: { color: C.primary,         icon: <Loader size={9} color={C.primary} /> },
    done:    { color: isDark ? '#4ADE80' : '#16A34A',  icon: <CheckCheck size={9} color={isDark ? '#4ADE80' : '#16A34A'} /> },
    error:   { color: C.destructive,     icon: <AlertCircle size={9} color={C.destructive} /> },
  };
  const cfg   = statusMap[toolCall.status] ?? statusMap.idle;
  const label = toolCall.toolName.replace('Tool', '').replace(/([A-Z])/g, ' $1').trim();

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.muted, borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 4,
    }}>
      {cfg.icon}
      <Text style={{ ...T.caption2, color: cfg.color, fontWeight: '500', fontSize: 10 }}>{label}</Text>
    </View>
  );
}

// ── Draft Preview Card ────────────────────────────────────────────────────────

function DraftPreviewCard({ draft, onOpen }: {
  draft: NonNullable<AIMessage['draft']>;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const plainPreview = draft.content
    .replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 100);

  return (
    <View style={{
      marginTop: 8, borderRadius: 12,
      borderWidth: 1, borderColor: C.border,
      backgroundColor: C.card, padding: 12, gap: 7,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary }} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: C.foreground, flex: 1 }} numberOfLines={1}>
          {draft.title}
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: C.mutedForeground, lineHeight: 16 }} numberOfLines={2}>
        {plainPreview}…
      </Text>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('ai.openInEditor')}
        className="active:opacity-60"
        style={{
          borderWidth: 1, borderColor: C.primary,
          borderRadius: 8, paddingVertical: 7,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '600', color: C.primary, letterSpacing: 0.2 }}>
          {t('ai.openInEditor')}
        </Text>
      </Pressable>
    </View>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
