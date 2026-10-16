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
import {
  Copy, CheckCheck, BookOpen, Bookmark, RefreshCw, AlertCircle,
  Bot, ChevronDown, ChevronUp, Loader,
} from 'lucide-react-native';
import { T } from '@/lib/typography';
import type { AIMessage, AIToolCall } from '@/ai/AITypes';
import { AIResponseFormatter } from '@/ai/AIResponseFormatter';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

// ── Minimal colour tokens — now theme-aware via hook ─────────────────────────
// C is defined per-render inside the component; this top-level stub is kept
// only so ToolCallChip (which can't call hooks) still compiles — it accesses
// C.toolBg / C.muted / C.accent which are intentionally theme-neutral.
const C = {
  aiSurface:   '#FFFFFF',   // overridden by hook inside component
  aiText:      '#111827',
  aiTimestamp: '#9CA3AF',
  aiBorder:    '#F3F4F6',
  userSurface: '#F3F4F6',
  userText:    '#111827',
  userBorder:  'transparent',
  accent:      '#1E3A8A',
  muted:       '#6B7280',
  toolBg:      '#F8F9FA',
};

interface Props {
  message: AIMessage;
  onOpenDraft?: (draft: NonNullable<AIMessage['draft']>) => void;
  onRegenerate?: (messageId: string) => void;
}

export const AIMessageBubble = memo(function AIMessageBubble({
  message, onOpenDraft, onRegenerate,
}: Props) {
  const [copied, setCopied]               = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(4)).current;

  const isUser    = message.role === 'user';
  const isLoading = message.content === '…';
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  // Theme-resolved bubble palette
  const TC = {
    aiSurface:   colors.card,
    aiText:      colors.foreground,
    aiTimestamp: colors.mutedForeground,
    aiBorder:    colors.border,
    userSurface: colors.muted,
    userText:    colors.foreground,
    userBorder:  'transparent' as const,
    accent:      colors.primary,
    muted:       colors.mutedForeground,
    toolBg:      colors.muted,
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
            accessibilityLabel="AI message — tap for actions"
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
            />
          )}

          {/* Tool calls collapsible */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Pressable
                onPress={() => setToolsExpanded(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 }}
                accessibilityRole="button"
                accessibilityLabel="Toggle tool calls"
              >
                <Text style={{ ...T.caption2, color: TC.muted, fontSize: 10 }}>
                  {message.toolCalls.length} tool{message.toolCalls.length > 1 ? 's' : ''} used
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
  onCopy, copied, onRegenerate, onSave,
}: {
  onCopy: () => void;
  copied: boolean;
  onRegenerate?: () => void;
  onSave?: () => void;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 2,
      marginTop: 5, marginLeft: 2,
    }}>
      <ToolbarBtn
        icon={copied ? CheckCheck : Copy}
        label={copied ? 'Copied' : 'Copy'}
        color={copied ? C.accent : C.muted}
        onPress={onCopy}
      />
      {onRegenerate && (
        <ToolbarBtn icon={RefreshCw} label="Retry" color={C.muted} onPress={onRegenerate} />
      )}
      {onSave && (
        <ToolbarBtn icon={Bookmark} label="Save" color={C.muted} onPress={onSave} />
      )}
      <ToolbarBtn icon={BookOpen} label="Diary" color={C.muted} onPress={() => {}} />    </View>
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
          backgroundColor: C.accent, opacity: dot,
        }} />
      ))}
    </View>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownText({ content, colors: tc }: { content: string; colors: typeof C }) {
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
            backgroundColor: '#0F172A', borderRadius: 10,
            padding: 12, marginVertical: 4,
          }}>
            <Text style={{ fontSize: 12, color: '#7DD3FC', fontFamily: 'monospace', lineHeight: 18 }}>
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
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#2563EB', marginTop: 8, flexShrink: 0 }} />
        )}
        {isNum && (
          <Text style={{ fontSize: 13, color: '#2563EB', lineHeight: 20, flexShrink: 0, fontWeight: '600' }}>
            {line.match(/^\d+/)?.[0]}.
          </Text>
        )}
        <Text style={{ fontSize, fontWeight, color, lineHeight: 20, flex: 1 }}>
          {renderInline(stripped, MUTED, tc)}
        </Text>
      </View>
    );
  });

  return <View style={{ gap: 2 }}>{rendered}</View>;
}

/** Renders inline **bold** and `code` within a text node */
function renderInline(text: string, mutedColor: string, tc: typeof C): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={{ fontWeight: '700', color: tc.aiText }}>{part.slice(2, -2)}</Text>;
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
        return <Text key={i}>{part}</Text>;
      })}
    </>
  );
}

// ── Tool Call Chip ────────────────────────────────────────────────────────────

function ToolCallChip({ toolCall }: { toolCall: AIToolCall }) {
  const statusMap = {
    idle:    { color: C.muted,    icon: null },
    running: { color: C.accent,   icon: <Loader size={9} color={C.accent} /> },
    done:    { color: '#16A34A',  icon: <CheckCheck size={9} color="#16A34A" /> },
    error:   { color: '#DC2626',  icon: <AlertCircle size={9} color="#DC2626" /> },
  };
  const cfg   = statusMap[toolCall.status] ?? statusMap.idle;
  const label = toolCall.toolName.replace('Tool', '').replace(/([A-Z])/g, ' $1').trim();

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.toolBg, borderRadius: 6,
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
  const plainPreview = draft.content
    .replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 100);

  return (
    <View style={{
      marginTop: 8, borderRadius: 12,
      borderWidth: 1, borderColor: C.aiBorder,
      backgroundColor: C.toolBg, padding: 12, gap: 7,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: C.aiText, flex: 1 }} numberOfLines={1}>
          {draft.title}
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: C.muted, lineHeight: 16 }} numberOfLines={2}>
        {plainPreview}…
      </Text>
      <Pressable
        onPress={onOpen}
        className="active:opacity-60"
        style={{
          borderWidth: 1, borderColor: C.accent,
          borderRadius: 8, paddingVertical: 7,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '600', color: C.accent, letterSpacing: 0.2 }}>
          Open in Editor
        </Text>
      </Pressable>
    </View>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
