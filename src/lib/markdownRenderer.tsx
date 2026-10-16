/**
 * markdownRenderer — Shared lightweight markdown → React Native renderer
 *
 * SSOT for ALL document display surfaces in InvestSuite:
 *   • GeneratedReportView (view mode)
 *   • DocumentEditor      (PrintPreviewModal, full-screen preview)
 *
 * ── Canonical document format ────────────────────────────────────────────────
 * Block markers (line-level, must be at line start):
 *   # text           → Heading 1
 *   ## text          → Heading 2
 *   ### text         → Heading 3
 *   #### text        → Heading 4
 *   ##### text       → Heading 5
 *   ###### text      → Heading 6
 *   :center: text    → Center-aligned paragraph
 *   :right: text     → Right-aligned paragraph
 *   :justify: text   → Justified paragraph
 *   :left: text      → Left-aligned paragraph
 *   > text           → Blockquote
 *   • text           → Bullet list item
 *   - text           → Bullet list item (alternate)
 *   1. text          → Numbered list item
 *   - [x] text       → Checked checklist item
 *   - [ ] text       → Unchecked checklist item
 *       text         → Indented paragraph (4-space indent)
 *   ---              → Horizontal divider
 *   ```              → Code block fence (open/close)
 *
 * Inline markers (span-level, within a line):
 *   **text**                  → Bold
 *   *text*                    → Italic
 *   __text__                  → Underline
 *   ~~text~~                  → Strikethrough
 *   `text`                    → Inline code
 *   [color=#HEX]text[/color]  → Text color
 *   [bg=#HEX]text[/bg]        → Highlight / background color
 *   [size=N]text[/size]       → Font size (pt)
 *   [font=NAME]text[/font]    → Font family
 *   [link text](url)          → Hyperlink (rendered as underlined blue)
 *
 * Backward compatibility: all v1 markers are supported unchanged.
 * DocumentEditor imports from here — never duplicates this logic.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { T } from '@/lib/typography';

// ─── Design tokens (matches DocumentEditor) ───────────────────────────────────
const NAVY    = '#0F2344';
const SAFFRON = '#E8670A';
const BORDER  = '#E5E7EB';
const MUTED   = '#6B7280';

// ─── Inline segment types ─────────────────────────────────────────────────────
interface Segment {
  type: 'normal' | 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link'
      | 'color' | 'bg' | 'size' | 'font';
  text: string;
  /** For type=color: hex color string */
  color?: string;
  /** For type=bg: hex highlight color */
  bg?: string;
  /** For type=size: numeric pt size */
  size?: number;
  /** For type=font: font family name */
  fontFamily?: string;
  /** For type=link: href */
  href?: string;
}

// ─── Inline parser ─────────────────────────────────────────────────────────────
/**
 * Tokenise a line into typed Segments.
 * Processes markers in priority order so nested/adjacent markers work correctly.
 * All v1 markers remain supported.
 */
export function parseInline(raw: string): Segment[] {
  // Comprehensive token regex — order matters:
  //   [color=#HEX]…[/color]  [bg=#HEX]…[/bg]  [size=N]…[/size]  [font=NAME]…[/font]
  //   **bold**  __underline__  ~~strike~~  `code`  *italic*  [link](url)
  const TOKEN = /(\[color=(#[0-9A-Fa-f]{3,8})\])([\s\S]*?)\[\/color\]|(\[bg=(#[0-9A-Fa-f]{3,8})\])([\s\S]*?)\[\/bg\]|(\[size=(\d+(?:\.\d+)?)\])([\s\S]*?)\[\/size\]|(\[font=([^\]]+)\])([\s\S]*?)\[\/font\]|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|`([^`]+)`|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;

  const segments: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = TOKEN.exec(raw)) !== null) {
    if (m.index > last) segments.push({ type: 'normal', text: raw.slice(last, m.index) });

    if (m[1]) {
      // [color=#HEX]text[/color]
      segments.push({ type: 'color', text: m[3], color: m[2] });
    } else if (m[4]) {
      // [bg=#HEX]text[/bg]
      segments.push({ type: 'bg', text: m[6], bg: m[5] });
    } else if (m[7]) {
      // [size=N]text[/size]
      segments.push({ type: 'size', text: m[9], size: parseFloat(m[8]) });
    } else if (m[10]) {
      // [font=NAME]text[/font]
      segments.push({ type: 'font', text: m[12], fontFamily: m[11] });
    } else if (m[13] !== undefined) {
      // **bold**
      segments.push({ type: 'bold', text: m[13] });
    } else if (m[14] !== undefined) {
      // __underline__
      segments.push({ type: 'underline', text: m[14] });
    } else if (m[15] !== undefined) {
      // ~~strike~~
      segments.push({ type: 'strike', text: m[15] });
    } else if (m[16] !== undefined) {
      // `code`
      segments.push({ type: 'code', text: m[16] });
    } else if (m[17] !== undefined) {
      // *italic*
      segments.push({ type: 'italic', text: m[17] });
    } else if (m[18] !== undefined) {
      // [link text](url)
      segments.push({ type: 'link', text: m[18], href: m[19] });
    }

    last = m.index + m[0].length;
  }

  if (last < raw.length) segments.push({ type: 'normal', text: raw.slice(last) });
  return segments.length ? segments : [{ type: 'normal', text: raw }];
}

// ─── Inline text renderer ──────────────────────────────────────────────────────
export function InlineText({ raw, baseSize = 13, colorScheme }: { raw: string; baseSize?: number; colorScheme?: 'light' | 'dark' }) {
  const isDark = colorScheme === 'dark';
  const bodyText = isDark ? '#F1F5F9' : '#111827';
  const segments = parseInline(raw);
  return (
    <Text style={{ fontSize: baseSize, lineHeight: baseSize * 1.7, color: bodyText }}>
      {segments.map((seg, i) => {
        const base: Record<string, unknown> = {};
        switch (seg.type) {
          case 'bold':      base.fontWeight = '700'; break;
          case 'italic':    base.fontStyle = 'italic'; break;
          case 'underline': base.textDecorationLine = 'underline'; break;
          case 'strike':    base.textDecorationLine = 'line-through'; break;
          case 'code':
            base.fontFamily = 'monospace';
            base.backgroundColor = isDark ? '#1E293B' : '#F3F4F6';
            base.color = isDark ? '#F87171' : '#DC2626';
            base.fontSize = (baseSize - 1);
            break;
          case 'color':  base.color = seg.color; break;
          case 'bg':     base.backgroundColor = seg.bg; break;
          case 'size':   base.fontSize = seg.size; base.lineHeight = (seg.size ?? baseSize) * 1.6; break;
          case 'font':   base.fontFamily = seg.fontFamily; break;
          case 'link':
            base.color = isDark ? '#60A5FA' : '#2563EB';
            base.textDecorationLine = 'underline';
            break;
          default: break;
        }
        return <Text key={i} style={base}>{seg.text}</Text>;
      })}
    </Text>
  );
}

// ─── Block-level renderer ──────────────────────────────────────────────────────
/**
 * Convert a canonical-format document string into a React Native view tree.
 * Handles all block markers; inline markers are delegated to InlineText.
 *
 * Single renderer for: GeneratedReportView, PrintPreviewModal, and any future surface.
 */
export function renderMarkdown(text: string, colorScheme?: 'light' | 'dark'): React.ReactNode[] {
  const isDark = colorScheme === 'dark';
  const bodyText   = isDark ? '#F1F5F9' : '#111827';
  const headingDk  = isDark ? '#F1F5F9' : '#111827'; // for the near-black heading colors below
  const subheadDk  = isDark ? '#E2E8F0' : '#374151';
  const captionDk  = isDark ? '#CBD5E1' : '#1F2937';
  const codeBg     = isDark ? '#1E293B' : undefined; // if a code-block background exists nearby, verify and adjust
  const codeFg     = isDark ? '#F1F5F9' : '#F9FAFB'; // this one (line ~195) is currently light-on-dark already — verify it still contrasts in both modes, adjust if needed
  const whiteOnAccent = '#fff'; // checklist checkmark (line ~288) sits on a colored accent circle — leave as '#fff', it's correct in both modes
  const mutedText  = isDark ? '#94A3B8' : MUTED;
  const navyText   = isDark ? '#7C93E0' : NAVY;
  const borderCol  = isDark ? '#334155' : BORDER;

  const rawLines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const raw = rawLines[i];

    // ── Code block (fenced ```) ────────────────────────────────────────────
    if (raw.trim() === '```') {
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && rawLines[i].trim() !== '```') {
        codeLines.push(rawLines[i]);
        i++;
      }
      elements.push(
        <View
          key={`cb-${i}`}
          style={{
            backgroundColor: codeBg ?? '#1F2937', borderRadius: 8,
            padding: 12, marginVertical: 6,
          }}
        >
          <Text style={{ ...T.caption1, ...T.mono, color: codeFg, lineHeight: 20 }}>
            {codeLines.join('\n')}
          </Text>
        </View>
      );
      i++; // skip closing ```
      continue;
    }

    // ── Horizontal divider ────────────────────────────────────────────────
    if (raw.trim() === '---') {
      elements.push(
        <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: borderCol, marginVertical: 8 }} />
      );
      i++; continue;
    }

    // ── Alignment prefix ──────────────────────────────────────────────────
    let align: 'left' | 'center' | 'right' | 'justify' = 'left';
    let content = raw;
    if      (raw.startsWith(':center: '))  { align = 'center';  content = raw.slice(9);  }
    else if (raw.startsWith(':right: '))   { align = 'right';   content = raw.slice(8);  }
    else if (raw.startsWith(':justify: ')) { align = 'justify'; content = raw.slice(10); }
    else if (raw.startsWith(':left: '))    { align = 'left';    content = raw.slice(7);  }

    // ── Headings H1–H6 ────────────────────────────────────────────────────
    if (content.startsWith('###### ')) {
      elements.push(
        <Text key={i} style={{ ...T.caption2, fontWeight: T.weight.bold, color: mutedText, marginTop: 8, marginBottom: 2, textAlign: align, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {content.slice(7)}
        </Text>
      );
      i++; continue;
    }
    if (content.startsWith('##### ')) {
      elements.push(
        <Text key={i} style={{ ...T.caption1, fontWeight: T.weight.bold, color: subheadDk, marginTop: 9, marginBottom: 3, textAlign: align }}>
          {content.slice(6)}
        </Text>
      );
      i++; continue;
    }
    if (content.startsWith('#### ')) {
      elements.push(
        <Text key={i} style={{ ...T.footnote, fontWeight: T.weight.bold, color: captionDk, marginTop: 10, marginBottom: 3, textAlign: align }}>
          {content.slice(5)}
        </Text>
      );
      i++; continue;
    }
    if (content.startsWith('### ')) {
      elements.push(
        <Text key={i} style={{ ...T.subhead, fontWeight: T.weight.bold, color: headingDk, marginTop: 12, marginBottom: 4, textAlign: align }}>
          {content.slice(4)}
        </Text>
      );
      i++; continue;
    }
    if (content.startsWith('## ')) {
      elements.push(
        <Text key={i} style={{ ...T.body, fontWeight: T.weight.bold, color: navyText, marginTop: 14, marginBottom: 5, textAlign: align }}>
          {content.slice(3)}
        </Text>
      );
      i++; continue;
    }
    if (content.startsWith('# ')) {
      elements.push(
        <Text key={i} style={{ ...T.headline, fontWeight: T.weight.extrabold, color: navyText, marginTop: 16, marginBottom: 6, textAlign: align }}>
          {content.slice(2)}
        </Text>
      );
      i++; continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────
    if (content.startsWith('> ')) {
      elements.push(
        <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: SAFFRON, paddingLeft: 10, marginVertical: 4 }}>
          <InlineText raw={content.slice(2)} baseSize={12} colorScheme={colorScheme} />
        </View>
      );
      i++; continue;
    }

    // ── Checklist items ───────────────────────────────────────────────────
    if (content.startsWith('- [x] ') || content.startsWith('- [X] ')) {
      elements.push(
        <View key={i} style={{ flexDirection: 'row', marginVertical: 2, paddingLeft: 4, alignItems: 'flex-start' }}>
          <View style={{
            width: 16, height: 16, borderRadius: 3, backgroundColor: navyText,
            alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 3,
          }}>
            <Text style={{ ...T.micro, color: whiteOnAccent, lineHeight: 14, textTransform: undefined, letterSpacing: 0 }}>✓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ textDecorationLine: 'line-through', color: mutedText }}>
              <InlineText raw={content.slice(6)} colorScheme={colorScheme} />
            </Text>
          </View>
        </View>
      );
      i++; continue;
    }
    if (content.startsWith('- [ ] ')) {
      elements.push(
        <View key={i} style={{ flexDirection: 'row', marginVertical: 2, paddingLeft: 4, alignItems: 'flex-start' }}>
          <View style={{
            width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: borderCol,
            marginRight: 8, marginTop: 3,
          }} />
          <View style={{ flex: 1 }}>
            <InlineText raw={content.slice(6)} colorScheme={colorScheme} />
          </View>
        </View>
      );
      i++; continue;
    }

    // ── Bullet list item (• or -) ─────────────────────────────────────────
    if (content.startsWith('• ') || content.startsWith('- ')) {
      const txt = content.startsWith('• ') ? content.slice(2) : content.slice(2);
      elements.push(
        <View key={i} style={{ flexDirection: 'row', marginVertical: 2, paddingLeft: 4 }}>
          <Text style={{ ...T.footnote, color: bodyText, marginRight: 6, lineHeight: 22 }}>•</Text>
          <View style={{ flex: 1 }}><InlineText raw={txt} colorScheme={colorScheme} /></View>
        </View>
      );
      i++; continue;
    }

    // ── Numbered list item ────────────────────────────────────────────────
    const numMatch = /^(\d+)\. (.*)/.exec(content);
    if (numMatch) {
      elements.push(
        <View key={i} style={{ flexDirection: 'row', marginVertical: 2, paddingLeft: 4 }}>
          <Text style={{ ...T.footnote, color: bodyText, marginRight: 6, lineHeight: 22, minWidth: 20 }}>
            {numMatch[1]}.
          </Text>
          <View style={{ flex: 1 }}><InlineText raw={numMatch[2]} colorScheme={colorScheme} /></View>
        </View>
      );
      i++; continue;
    }

    // ── Indented paragraph (4-space) ──────────────────────────────────────
    if (content.startsWith('    ')) {
      elements.push(
        <View key={i} style={{ paddingLeft: 24, marginVertical: 2 }}>
          <InlineText raw={content.trim()} baseSize={13} colorScheme={colorScheme} />
        </View>
      );
      i++; continue;
    }

    // ── Empty line ────────────────────────────────────────────────────────
    if (!content.trim()) {
      elements.push(<View key={i} style={{ height: 8 }} />);
      i++; continue;
    }

    // ── Normal paragraph ──────────────────────────────────────────────────
    elements.push(
      <View key={i} style={{ marginVertical: 2 }}>
        <Text style={{ textAlign: align }}>
          <InlineText raw={content} colorScheme={colorScheme} />
        </Text>
      </View>
    );
    i++;
  }

  return elements;
}
