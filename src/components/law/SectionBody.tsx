import { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import type { Block } from '@/lib/law/formatSection';

export interface SectionBodyProps {
  blocks: Block[];
  fontSize?: number;
  actColor?: string;
  isHi?: boolean;
}

/**
 * Visual highlight renderer for penalty phrases:
 * - Sentences containing 'shall be punished' or 'liable to fine' are highlighted with a soft red tint.
 * - Phrases 'shall be punished', 'liable to fine', 'imprisonment for life', and 'death' are given bold weight.
 */
function HighlightedLegalText({
  text,
  fontSize,
  lineHeight,
  color,
  isSmall = false,
}: {
  text: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  isSmall?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const penaltyBg = isDark ? '#7F1D1D40' : '#FEE2E280';
  const penaltyBorder = isDark ? '#991B1B80' : '#FECACA';

  // Split into sentence segments while preserving punctuation
  const segments = useMemo(() => {
    // Regex splitting by sentence boundaries: period, semicolon, or colon followed by space
    const parts = text.split(/(?<=[.;:])\s+/);
    return parts;
  }, [text]);

  const renderStyledSentence = (sentence: string, isPunishmentSentence: boolean, sIdx: number) => {
    // Sub-parse penalty phrases for bolding
    const penaltyPhraseRegex = /(imprisonment for life|death|shall be punished|liable to fine)/gi;
    const tokens = sentence.split(penaltyPhraseRegex);

    const tokenNodes = tokens.map((token, tIdx) => {
      const isKeyPhrase = penaltyPhraseRegex.test(token);
      penaltyPhraseRegex.lastIndex = 0; // reset stateful regex
      return (
        <Text
          key={tIdx}
          selectable={true}
          style={{
            fontSize: isSmall ? fontSize - 1 : fontSize,
            lineHeight: isSmall ? Math.round((fontSize - 1) * 1.5) : lineHeight,
            color,
            fontWeight: isKeyPhrase ? '700' : '400',
          }}
        >
          {token}
        </Text>
      );
    });

    if (isPunishmentSentence) {
      return (
        <View
          key={sIdx}
          className="rounded-md px-1.5 py-0.5 my-0.5"
          style={{
            backgroundColor: penaltyBg,
            borderColor: penaltyBorder,
            borderWidth: 1,
            borderCurve: 'continuous',
            alignSelf: 'flex-start',
          }}
        >
          <Text selectable={true} style={{ flexWrap: 'wrap' }}>
            {tokenNodes}
          </Text>
        </View>
      );
    }

    return (
      <Text key={sIdx} selectable={true}>
        {tokenNodes}
        {sIdx < segments.length - 1 ? ' ' : ''}
      </Text>
    );
  };

  const hasPunishmentInBlock = /shall be punished|liable to fine/i.test(text);

  if (!hasPunishmentInBlock) {
    return (
      <Text
        selectable={true}
        style={{
          fontSize: isSmall ? fontSize - 1 : fontSize,
          lineHeight: isSmall ? Math.round((fontSize - 1) * 1.5) : lineHeight,
          color,
        }}
      >
        {text}
      </Text>
    );
  }

  return (
    <Text
      selectable={true}
      style={{
        fontSize: isSmall ? fontSize - 1 : fontSize,
        lineHeight: isSmall ? Math.round((fontSize - 1) * 1.5) : lineHeight,
        color,
      }}
    >
      {segments.map((seg, sIdx) => {
        const isPunish = /shall be punished|liable to fine/i.test(seg);
        return renderStyledSentence(seg, isPunish, sIdx);
      })}
    </Text>
  );
}

/**
 * Collapsible Illustrations Card
 */
function CollapsibleIllustrations({
  block,
  fontSize,
  lineHeight,
  color,
  isHi,
}: {
  block: Block & { type: 'illustrations' };
  fontSize: number;
  lineHeight: number;
  color: string;
  isHi: boolean;
}) {
  const itemCount = block.items.length;
  // Collapsed by default if > 2 items else expanded
  const [expanded, setExpanded] = useState<boolean>(itemCount <= 2);

  return (
    <View
      className="rounded-2xl border border-border bg-card overflow-hidden my-1"
      style={{ borderCurve: 'continuous' }}
    >
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        className="flex-row items-center justify-between p-3.5 bg-muted/30 active:opacity-70"
        style={{ minHeight: 44 }}
        accessibilityLabel="Toggle Illustrations"
      >
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-primary" />
          <Text className="text-xs font-bold text-foreground">
            {isHi ? `दृष्टांत / Illustrations (${itemCount})` : `Illustrations (${itemCount})`}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={18} color="#6B7280" />
        ) : (
          <ChevronDown size={18} color="#6B7280" />
        )}
      </Pressable>

      {expanded && (
        <View className="p-3.5 gap-3 border-t border-border/50">
          {block.items.map((item, idx) => (
            <View key={idx} className="flex-row items-start gap-2.5">
              <View
                className="w-7 h-7 rounded-lg bg-muted items-center justify-center pt-0.5"
                style={{ borderCurve: 'continuous' }}
              >
                <Text className="text-xs font-bold text-foreground">
                  {item.label || `${idx + 1}`}
                </Text>
              </View>
              <View className="flex-1" style={{ minWidth: 0 }}>
                <HighlightedLegalText
                  text={item.text}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  color={color}
                  isSmall={true}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function SectionBody({
  blocks,
  fontSize = 14,
  actColor = '#1D4ED8',
  isHi = false,
}: SectionBodyProps) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';

  // Task L21b: body line-height = 1.5 x B, Hindi line-height never below 1.4 (no clipped matras)
  const lineHeight = Math.max(Math.round(fontSize * 1.4), Math.round(fontSize * 1.5));

  return (
    <View style={{ gap: 8 }}>
      {blocks.map((block, index) => {
        switch (block.type) {
          // ── Level 1: Sub-section (1), (2), (2A) ──
          case 'sub':
            return (
              <View key={index} className="flex-row items-start">
                <View style={{ width: 34 }}>
                  <Text
                    selectable={true}
                    style={{
                      fontSize,
                      lineHeight,
                      fontWeight: '700',
                      color: actColor,
                    }}
                  >
                    {block.label}
                  </Text>
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <HighlightedLegalText
                    text={block.text}
                    fontSize={fontSize}
                    lineHeight={lineHeight}
                    color={C.foreground}
                  />
                </View>
              </View>
            );

          // ── Level 2: Clause (a), (b), (aa) ──
          case 'clause':
            return (
              <View key={index} className="flex-row items-start" style={{ paddingLeft: 28 }}>
                <View style={{ width: 28 }}>
                  <Text
                    selectable={true}
                    style={{
                      fontSize,
                      lineHeight,
                      fontWeight: '600',
                      color: C.mutedForeground,
                    }}
                  >
                    {block.label}
                  </Text>
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <HighlightedLegalText
                    text={block.text}
                    fontSize={fontSize}
                    lineHeight={lineHeight}
                    color={C.foreground}
                  />
                </View>
              </View>
            );

          // ── Level 3: Sub-clause (i), (ii), (iii) ──
          case 'subclause':
            return (
              <View key={index} className="flex-row items-start" style={{ paddingLeft: 56 }}>
                <View style={{ width: 30 }}>
                  <Text
                    selectable={true}
                    style={{
                      fontSize: fontSize - 0.5,
                      lineHeight,
                      fontWeight: '500',
                      color: C.mutedForeground,
                    }}
                  >
                    {block.label}
                  </Text>
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <HighlightedLegalText
                    text={block.text}
                    fontSize={fontSize - 0.5}
                    lineHeight={lineHeight}
                    color={C.foreground}
                  />
                </View>
              </View>
            );

          // ── Proviso ──
          case 'proviso':
            return (
              <View
                key={index}
                className="p-3.5 my-1 rounded-xl bg-muted/40 gap-1.5"
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: actColor,
                  borderCurve: 'continuous',
                }}
              >
                <Text
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: actColor }}
                >
                  {isHi ? 'परंतुक · PROVISO' : 'PROVISO'}
                </Text>
                <HighlightedLegalText
                  text={block.text}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  color={C.foreground}
                />
              </View>
            );

          // ── Explanation ──
          case 'explanation':
            return (
              <View
                key={index}
                className="p-3.5 my-1 rounded-xl gap-1.5 border"
                style={{
                  backgroundColor: isDark ? '#1E3A8A25' : '#EFF6FF',
                  borderColor: isDark ? '#1E40AF60' : '#BFDBFE',
                  borderCurve: 'continuous',
                }}
              >
                <View className="flex-row items-center gap-2">
                  <View className="w-2 h-2 rounded-full bg-blue-500" />
                  <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {block.label || (isHi ? 'स्पष्टीकरण' : 'Explanation')}
                  </Text>
                </View>
                <HighlightedLegalText
                  text={block.text}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  color={C.foreground}
                />
              </View>
            );

          // ── Exception ──
          case 'exception':
            return (
              <View
                key={index}
                className="p-3.5 my-1 rounded-xl gap-1.5 border"
                style={{
                  backgroundColor: isDark ? '#7C2D1225' : '#FFF7ED',
                  borderColor: isDark ? '#9A341260' : '#FED7AA',
                  borderCurve: 'continuous',
                }}
              >
                <View className="flex-row items-center gap-2">
                  <View className="w-2 h-2 rounded-full bg-amber-500" />
                  <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    {block.label || (isHi ? 'अपवाद' : 'Exception')}
                  </Text>
                </View>
                <HighlightedLegalText
                  text={block.text}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  color={C.foreground}
                />
              </View>
            );

          // ── Collapsible Illustrations ──
          case 'illustrations':
            return (
              <CollapsibleIllustrations
                key={index}
                block={block}
                fontSize={fontSize}
                lineHeight={lineHeight}
                color={C.foreground}
                isHi={isHi}
              />
            );

          // ── Note / Stage Direction ──
          case 'note':
            return (
              <View
                key={index}
                className="p-3 my-1 rounded-xl bg-muted/50 border border-border/50 gap-1"
                style={{ borderCurve: 'continuous' }}
              >
                {block.label ? (
                  <Text className="text-xs font-bold text-muted-foreground">
                    {block.label}
                  </Text>
                ) : null}
                <HighlightedLegalText
                  text={block.text}
                  fontSize={fontSize - 1}
                  lineHeight={Math.round((fontSize - 1) * 1.5)}
                  color={C.foreground}
                />
              </View>
            );

          // ── Regular Paragraph ──
          case 'para':
          default:
            return (
              <View key={index} className="my-0.5">
                <HighlightedLegalText
                  text={block.text}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  color={C.foreground}
                />
              </View>
            );
        }
      })}
    </View>
  );
}
