/**
 * DocumentEditor — WYSIWYG Rich Text Editor (react-native-pell-rich-editor)
 *
 * Rebuilt from @10play/tentap-editor to eliminate stale-content sync bugs.
 * Uses an explicit imperative API (setContentHTML / onChange callback) so
 * content is never silently stale.
 *
 * Features:
 *   • WYSIWYG — no raw markdown ever shown to users
 *   • Minimal toolbar: Bold, Italic, Underline, Bullet/Numbered lists,
 *     H1/H2 headings, Undo, Redo
 *   • Compact read-only preview card + word count + Edit button
 *   • Full-screen editing Modal on native
 *   • A4 Print Preview (styled WebView on native, <iframe> on web)
 *   • Automatic one-way migration: legacy markdown → HTML on first open
 *   • Web fallback: plain multiline TextInput (mobile = full WYSIWYG)
 *   • External-value sync: setContentHTML called when value prop changes
 *     from an external source, NOT on every editor keystroke (avoids
 *     cursor-jump / infinite-loop).
 *
 * Public API (UNCHANGED — all call sites work with zero modifications):
 *   <DocumentEditor
 *     value={html}
 *     onChangeText={setHtml}
 *     title="Beat Book Entry"
 *   />
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import {
  RichEditor,
  RichToolbar,
  actions,
} from 'react-native-pell-rich-editor';
import WebView from 'react-native-webview';
import { ArrowLeft, BookMarked, Eye, FileText, Maximize2, Sparkles, X } from 'lucide-react-native';
import { markdownToHtml, needsMigration } from '@/lib/markdownToHtml';
import { T } from '@/lib/typography';
import { logger } from '@/lib/logger';
import type { DocumentModel } from '@/lib/formatParsingEngine';
import { DEFAULT_LAYOUT_PROFILE, type LayoutProfile } from '@/lib/db/predefinedFormatRepo';
import { LETTER_FIT_SCRIPT, LETTER_SHEET_CSS, renderLetterHtml, renderTextForPrint } from '@/lib/printLayout';
import { fixFormat } from '@/lib/formatFixingEngine';
import { htmlToPlainText } from '@/lib/stringUtils';
import { PhraseLibraryModal } from './PhraseLibraryModal';
import { incrementUsage } from '@/lib/db/phraseLibraryRepo';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useTranslation } from 'react-i18next';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY   = '#1E3A5F';
const BORDER = '#E5E7EB';
const MUTED  = '#6B7280';

// ─── Minimal toolbar actions ──────────────────────────────────────────────────
const TOOLBAR_ACTIONS = [
  actions.setBold,
  actions.setItalic,
  actions.setUnderline,
  actions.insertBulletsList,
  actions.insertOrderedList,
  actions.heading1,
  actions.heading2,
  actions.undo,
  actions.redo,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function countWords(html: string): number {
  const plain = stripHtml(html).trim();
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

/** Ensure value is always HTML (migrate legacy markdown on first open). */
function prepareHtml(value: string): string {
  if (!value || !value.trim()) return '';
  if (needsMigration(value)) return markdownToHtml(value);
  return value;
}

// ─── Structural document renderer ────────────────────────────────────────────
/**
 * Turn a parsed DocumentModel into an HTML fragment using the structural
 * CSS classes declared in buildPrintHtml's <style> block.
 * Called once per sub-letter; wrap multiple results in .doc-letter divs.
 */
export function renderDocumentModel(model: DocumentModel, _profile: LayoutProfile): string {
  // Fixed print layout (one A4 sheet per letter) — see src/lib/printLayout.ts
  return renderLetterHtml(model);
}

// ─── Print Preview HTML wrapper ───────────────────────────────────────────────
/**
 * Build a complete A4-styled HTML document.
 *
 * v256 extensions:
 *   • CSS variables --doc-font-size, --doc-line-height, --doc-font-family,
 *     --doc-margin-top/right/bottom/left, --doc-alignment, --doc-indent
 *     are declared with sensible defaults and overridden by formatFixingEngine.
 *   • Structural CSS classes for parsed DocumentModel blocks
 *     (.doc-header, .doc-sewa-mein, .doc-salutation, .doc-body, etc.)
 *   • All existing WYSIWYG editor styles preserved unchanged.
 */
export function buildPrintHtml(bodyHtml: string, title: string): string {
  // Structured letters (renderDocumentModel) → one fixed A4 sheet per letter + auto-fit.
  const letters = bodyHtml.includes('class="doc-letter');
  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${letters ? 'width=840' : 'width=device-width,initial-scale=1'}">
<title>${title}</title>
<style>
  @page {
    size: A4;
    margin: 0;
  }

  /* ── Reset ──────────────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── CSS variables — overridden by formatFixingEngine ───── */
  :root {
    --doc-font-family: 'Kokila', 'Mangal', 'Noto Serif Devanagari', 'Noto Sans Devanagari', 'Times New Roman', Times, serif;
    --doc-font-size: 17pt;
    --doc-line-height: 1.15;
    --doc-alignment: justify;
    --doc-indent: 12.7mm;
    --doc-para-spacing: 0;
    --doc-margin-top: 5mm;
    --doc-margin-right: 25.4mm;
    --doc-margin-bottom: 25.4mm;
    --doc-margin-left: 17.5mm;
  }

  /* ── Body & page shell ─────────────────────────────────── */
  body {
    font-family: var(--doc-font-family);
    font-size: var(--doc-font-size);
    line-height: var(--doc-line-height);
    color: #111;
    background: #e8e8e8;
    padding: 24px 0 40px;
  }
  .page {
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: var(--doc-margin-top) var(--doc-margin-right) var(--doc-margin-bottom) var(--doc-margin-left);
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  }

  /* ── Legacy WYSIWYG editor styles (unchanged) ──────────── */
  .doc-title {
    font-size: 16pt;
    font-weight: 700;
    color: #1E3A5F;
    border-bottom: 2px solid #1E3A5F;
    padding-bottom: 6pt;
    margin-bottom: 18pt;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  h1 { font-size: 16pt; font-weight: 700; margin: 14pt 0 6pt; }
  h2 { font-size: 14pt; font-weight: 700; margin: 12pt 0 5pt; }
  h3 { font-size: 13pt; font-weight: 600; margin: 10pt 0 4pt; }
  h4 { font-size: 12pt; font-weight: 600; margin: 8pt 0 3pt; }
  h5 { font-size: 11pt; font-weight: 600; margin: 6pt 0 3pt; }
  h6 { font-size: 11pt; font-weight: 500; font-style: italic; margin: 6pt 0 3pt; }
  p  { margin: 0 0 7pt; }
  strong { font-weight: 700; }
  em     { font-style: italic; }
  u      { text-decoration: underline; }
  s      { text-decoration: line-through; }
  code   { font-family: 'Courier New', monospace; font-size: 10pt; background: #f4f4f4; padding: 1pt 3pt; border-radius: 2pt; }
  pre    { background: #f4f4f4; border: 1pt solid #ddd; border-radius: 3pt; padding: 8pt 10pt; margin: 8pt 0; overflow: auto; }
  pre code { background: none; padding: 0; }
  blockquote {
    border-left: 3pt solid #1E3A5F;
    margin: 8pt 0;
    padding: 4pt 10pt;
    color: #444;
    font-style: italic;
  }
  ul, ol { margin: 6pt 0 6pt 20pt; }
  li     { margin: 2pt 0; }
  hr { border: none; border-top: 1pt solid #bbb; margin: 12pt 0; }
  a  { color: #1E3A5F; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1pt solid #bbb; padding: 4pt 8pt; }
  th { background: #f0f0f0; font-weight: 700; }
  img { max-width: 100%; }
  .footer {
    margin-top: 20pt;
    padding-top: 6pt;
    border-top: 1pt solid #ccc;
    font-size: 9pt;
    color: #888;
    display: flex;
    justify-content: space-between;
  }

  /* ── Structural DocumentModel CSS classes ──────────────── */
  .doc-letter { margin-bottom: 0; }
  .doc-letter + .doc-letter {
    page-break-before: always;
    margin-top: 0;
    padding-top: 8mm;
  }
  .doc-header {
    text-align: right;
    font-weight: bold;
    text-decoration: underline;
    margin-bottom: 0.5em;
  }
  .doc-sewa-mein {
    margin-left: var(--doc-indent);
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }
  .doc-sewa-mein p { margin: 0; }
  .doc-salutation {
    margin-top: 1em;
    margin-bottom: 0.5em;
  }
  .doc-body p {
    text-align: var(--doc-alignment);
    text-indent: var(--doc-indent);
    margin-bottom: var(--doc-para-spacing);
  }
  .doc-closing {
    text-align: right;
    margin-top: 1em;
  }
  .doc-witness {
    margin-top: 0.5em;
  }
  .doc-attachments {
    margin-top: 1em;
  }
  .doc-attachments-title {
    font-weight: bold;
  }
  .doc-attachments ol {
    margin: 0.25em 0 0 1.5em;
  }
  .doc-signature {
    text-align: right;
    margin-top: 2em;
  }
  .doc-signature .sig-name { font-weight: bold; }
  .doc-signature .sig-designation { font-style: italic; }

  /* ── Print overrides ───────────────────────────────────── */
  @media print {
    body { background: #fff; padding: 0; }
    .page {
      box-shadow: none;
      width: 100%;
      padding: var(--doc-margin-top) var(--doc-margin-right) var(--doc-margin-bottom) var(--doc-margin-left);
    }
    .no-print { display: none; }
    .doc-letter + .doc-letter { page-break-before: always; }
  }
  ${letters ? LETTER_SHEET_CSS : ''}
</style>
</head>
<body${letters ? ' class="letters"' : ''}>
  <div class="page">
    ${bodyHtml || '<p style="color:#999;font-style:italic">No content yet.</p>'}
    <div class="footer no-print">
      <span>InvestSuite — Official Document</span>
      <span id="ts"></span>
    </div>
  </div>
  <script>
    document.getElementById('ts').textContent =
      new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  </script>
  ${letters ? `<script>${LETTER_FIT_SCRIPT}</script>` : ''}
</body>
</html>`;
}

// ─── Print Preview Modal ──────────────────────────────────────────────────────
interface PrintPreviewProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  title: string;
}

function PrintPreviewModal({ visible, onClose, value, title }: PrintPreviewProps) {
  const { t } = useTranslation();
  const html = useMemo(() => {
    // Every report prints in the fixed A4 layout (letters: one sheet each).
    const plain = htmlToPlainText(prepareHtml(value));
    if (!plain.trim()) return buildPrintHtml('', title);
    return fixFormat(buildPrintHtml(renderTextForPrint(plain), title), DEFAULT_LAYOUT_PROFILE, title).html;
  }, [value, title]);
  const isWeb = process.env.EXPO_OS === 'web';
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ paddingBottom: NAV_BAR_INSET, flex: 1, backgroundColor: colors.background }}>
        <View style={{
          paddingTop: 52, paddingBottom: T.space.md - 4, paddingHorizontal: T.space.md,
          flexDirection: 'row', alignItems: 'center', gap: T.space.sm + 2,
          backgroundColor: NAVY, borderBottomWidth: 1, borderBottomColor: '#1a3a6e',
        }}>
          <Pressable onPress={onClose} style={{ padding: T.space.xs }} accessibilityLabel={t('editor.closePreview')}>
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <Text style={{ flex: 1, ...T.body, fontWeight: T.weight.bold, color: '#fff' }} numberOfLines={1}>
            {t('editor.printPreview')}
          </Text>
          <Text style={{ ...T.caption1, color: colors.mutedForeground }}>{t('editor.a4')}</Text>
        </View>

        {isWeb ? (
          <View style={{ flex: 1 }}>
            {/* @ts-ignore — iframe is valid in web branch */}
            <iframe
              srcDoc={html}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
              title="Print Preview"
            />
          </View>
        ) : (
          <NativeWebView html={html} />
        )}
      </View>
    </Modal>
  );
}

function NativeWebView({ html }: { html: string }) {
  return (
    <WebView
      source={{ html }}
      style={{ flex: 1 }}
      originWhitelist={['*']}
    />
  );
}

// ─── Full Screen Editor Modal ─────────────────────────────────────────────────
interface FullScreenProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
  title: string;
  placeholder: string;
}

// Stable objects per theme: a new one each render made the editor re-apply its style.
const EDITOR_CSS = `
    font-family: -apple-system, 'Helvetica Neue', sans-serif;
    font-size: 16px;
    line-height: 1.7;
    padding: 0 4px;
  `;
const RICH_EDITOR_STYLE = {
  light: { backgroundColor: '#FFFFFF', color: '#111827', placeholderColor: '#9CA3AF', caretColor: '#1E3A5F', contentCSSText: `${EDITOR_CSS} color: #111827;` },
  dark: { backgroundColor: '#1E293B', color: '#F1F5F9', placeholderColor: '#64748B', caretColor: '#93C5FD', contentCSSText: `${EDITOR_CSS} color: #F1F5F9;` },
} as const;

function FullScreenModal({ visible, onClose, value, onChange, title, placeholder }: FullScreenProps) {
  const { t } = useTranslation();
  const { settings } = useSettingsStore();

  const isWeb = process.env.EXPO_OS === 'web';
  const [showPreview, setShowPreview] = useState(false);
  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const webSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  // keyboardVerticalOffset = status-bar inset + fixed header height (56 px)
  const HEADER_HEIGHT = insets.top + 56;

  // ── pell-rich-editor ref ─────────────────────────────────────────────────
  const editorRef = useRef<RichEditor>(null);

  // Tracks the HTML currently held by the editor so we can distinguish
  // "editor-originated change echoing back" vs "external prop update".
  const editorHtmlRef = useRef<string>('');

  // The exact last HTML string that the editor itself emitted via onChange.
  // Used instead of editorHtmlRef in the SYNC EFFECT guard because
  // editorHtmlRef can be mutated by later in-flight bridge events before the
  // comparison runs, giving a false "no change" result.
  const lastEmittedRef = useRef<string>('');

  // Recent HTML strings the editor itself emitted. When typing fast, the
  // parent's `value` lags a keystroke or two behind the editor; such a lagging
  // value is one of our own older emissions, not an external change, and
  // pushing it back reset the content and threw the cursor to the start.
  const emittedHistoryRef = useRef<string[]>([]);

  // Monotonically-increasing counter incremented every time a real (non-echoed)
  // onChange fires.  Effects capture the counter at their start and bail out if
  // it has advanced by the time they try to call setContentHTML — meaning a newer
  // editor-originated change has landed and the effect is now stale.
  const changeSeqRef = useRef(0);

  // Flag: true while we are programmatically calling setContentHTML so that
  // the onChange callback knows to NOT echo back to the parent.
  const settingExternalRef = useRef(false);

  // Tracks the previous `visible` value to detect open transitions.
  const prevVisibleRef = useRef(false);

  // ── AI Expand state ───────────────────────────────────────────────────────
  const [expanding, setExpanding] = useState(false);
  const [expandPreview, setExpandPreview] = useState<{ original: string; expanded: string } | null>(null);
  const [expandError, setExpandError] = useState('');

  // Derive initial HTML once (migration happens here if needed)
  const initialHtml = useMemo(() => prepareHtml(value), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── External value sync ──────────────────────────────────────────────────
  // Always keep editorHtmlRef up to date, even while modal is closed, so
  // that when the modal opens we always have the latest value ready.
  // Only push into the live editor when it is visible and mounted.
  useEffect(() => {
    const prepared = prepareHtml(value);
    // Capture sequence at start — bail if a newer editor change lands before
    // we reach setContentHTML (stale-effect guard).
    const seqAtStart = changeSeqRef.current;
    // Guard against echoing editor's own content back: compare against the last
    // string the editor itself emitted, not editorHtmlRef (which may have been
    // mutated by a later in-flight bridge event before this comparison runs).
    // Compare the raw value too: the first keystrokes in an empty editor come
    // out as plain text, which prepareHtml() wraps in <p>, so `prepared` never
    // matched and the editor was reset on every keystroke — the cursor jumped
    // to the start and new letters landed at the front.
    const own = emittedHistoryRef.current;
    if (
      value === lastEmittedRef.current || prepared === lastEmittedRef.current ||
      own.includes(value) || own.includes(prepared)
    ) return; // our own (possibly lagging) emission — not an external change
    editorHtmlRef.current = prepared;
    if (visible && editorRef.current) {
      // Final stale check before writing to the WebView
      if (changeSeqRef.current !== seqAtStart) return;
      settingExternalRef.current = true;
      editorRef.current.setContentHTML(prepared);
      logger.warn('[DocEditor] SYNC EFFECT called setContentHTML');
      setTimeout(() => { settingExternalRef.current = false; }, 0);
    }
  }, [value, visible]);

  // ── On-open belt-and-suspenders push ────────────────────────────────────
  // When the modal transitions from closed → open, re-push the latest known
  // content after a short delay to let the WebView finish initialising.
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      // Capture sequence before the async delay — if the user starts typing
      // before the 100 ms fires, this push is stale and must be aborted.
      const seqAtStart = changeSeqRef.current;
      const t = setTimeout(() => {
        if (editorHtmlRef.current && editorRef.current) {
          if (changeSeqRef.current !== seqAtStart) return; // stale — user already typed
          settingExternalRef.current = true;
          editorRef.current.setContentHTML(editorHtmlRef.current);
          setTimeout(() => { settingExternalRef.current = false; }, 0);
        }
      }, 100);
      return () => clearTimeout(t);
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  // ── Editor-ready handler ─────────────────────────────────────────────────
  // Fires when the WebView/editor signals it is ready to receive content.
  // Pushes the latest known HTML so content shows even if initialContentHTML
  // was set before the async data arrived.
  const handleEditorReady = useCallback(() => {
    logger.warn('[DocEditor] onLoad fired — editorHtmlRef.current.length=' +
      editorHtmlRef.current.length + ' editorRef.current=' + (editorRef.current ? 'EXISTS' : 'NULL'));
    // Capture sequence: if the user has already started typing (unlikely on
    // onLoad but possible on fast devices), don't clobber their content.
    const seqAtStart = changeSeqRef.current;
    if (editorHtmlRef.current && editorRef.current) {
      if (changeSeqRef.current !== seqAtStart) return;
      settingExternalRef.current = true;
      editorRef.current.setContentHTML(editorHtmlRef.current);
      logger.warn('[DocEditor] onLoad called setContentHTML');
      setTimeout(() => { settingExternalRef.current = false; }, 0);
    }
  }, []);

  // ── onChange handler ─────────────────────────────────────────────────────
  const handleChange = useCallback((html: string) => {
    if (settingExternalRef.current) return; // programmatic set — ignore echo

    // Guard against WebView bridge echo: if HTML hasn't actually changed from
    // the last string the editor itself emitted, swallow the event.
    if (html === lastEmittedRef.current) return;

    // Real user keystroke — advance the sequence counter FIRST so any in-flight
    // SYNC EFFECT or on-open effect sees the updated value and aborts.
    changeSeqRef.current += 1;
    editorHtmlRef.current = html;
    lastEmittedRef.current = html;
    emittedHistoryRef.current.push(html);
    if (emittedHistoryRef.current.length > 50) emittedHistoryRef.current.shift();
    onChange(html);
  }, [onChange]);

  // ── Web fallback: plain TextInput ────────────────────────────────────────
  // initialHtml is frozen at modal-mount time (value may be '' on first render).
  // Sync webValue from the live `value` prop when the modal opens so web users
  // never see a blank editor when content was set after initial mount.
  const [webValue, setWebValue] = useState(initialHtml);
  useEffect(() => {
    if (visible) {
      const prepared = prepareHtml(value);
      setWebValue((prev) => (prev === '' && prepared !== '') ? prepared : prev);
    }
  }, [visible, value]);
  const handleWebSave = () => { onChange(webValue); onClose(); };

  // ── Cursor insertion helper (used by the Phrase Library) ──
  const insertTextAtCursor = useCallback((textToInsert: string) => {
    if (isWeb) {
      const sel = webSelectionRef.current;
      const start = sel?.start ?? webValue.length;
      const end = sel?.end ?? start;
      const before = webValue.slice(0, start);
      const after = webValue.slice(end);
      const prefix = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
      const inserted = `${prefix}${textToInsert} `;
      const nextValue = before + inserted + after;
      setWebValue(nextValue);
      const newPos = start + inserted.length;
      webSelectionRef.current = { start: newPos, end: newPos };
    } else {
      editorRef.current?.insertHTML(textToInsert);
    }
  }, [isWeb, webValue]);

  // ── Phrase selection handler ─────────────────────────────────────────────
  const handlePhraseSelect = useCallback((phraseText: string, phraseId?: string) => {
    insertTextAtCursor(phraseText);
    if (phraseId) {
      incrementUsage(phraseId).catch(() => {});
    }
  }, [insertTextAtCursor]);

  // ── AI Expand handler & button ───────────────────────────────────────────
  const handleAiExpand = async () => {
    setExpandError('');
    const rawContent = isWeb ? webValue : (editorHtmlRef.current || value || '');
    const plainTextToExpand = isWeb ? webValue.trim() : stripHtml(rawContent).trim();
    if (!plainTextToExpand) return;

    setExpanding(true);
    try {
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-expand-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ shortText: plainTextToExpand }),
      });
      const json = await res.json() as { expandedText?: string; error?: string };
      if (json.error) {
        setExpandError(json.error || t('editor.expansionFailed'));
        return;
      }
      if (json.expandedText) {
        setExpandPreview({ original: plainTextToExpand, expanded: json.expandedText });
      } else {
        setExpandError(t('editor.expansionFailedEmpty'));
      }
    } catch {
      setExpandError(t('editor.expansionFailedConn'));
    } finally {
      setExpanding(false);
    }
  };

  const handleApplyExpanded = useCallback(() => {
    if (!expandPreview) return;
    const expanded = expandPreview.expanded;
    if (isWeb) {
      setWebValue(expanded);
      onChange(expanded);
    } else {
      changeSeqRef.current += 1;
      settingExternalRef.current = true;
      editorRef.current?.setContentHTML(expanded);
      editorHtmlRef.current = expanded;
      lastEmittedRef.current = expanded;
      onChange(expanded);
      setTimeout(() => { settingExternalRef.current = false; }, 0);
    }
    setExpandPreview(null);
  }, [expandPreview, isWeb, onChange]);

  const renderExpandButton = () => (
    <Pressable
      onPress={handleAiExpand}
      disabled={expanding}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8,
        minHeight: 40,
        backgroundColor: expanding ? `${colors.primary}20` : colors.muted,
      }}
      accessibilityLabel={expanding ? t('editor.expandingWithAi') : t('editor.expandWithAi')}
    >
      {expanding ? (
        <ActivityIndicator size={12} color={colors.primary} />
      ) : (
        <Sparkles size={13} color={colors.primary} />
      )}
      <Text style={{
        fontSize: 11,
        color: expanding ? colors.primary : colors.mutedForeground,
        fontWeight: '600',
      }}>
        {expanding ? t('editor.expanding') : t('editor.expand')}
      </Text>
    </Pressable>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={isWeb ? handleWebSave : onClose}
      >
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? HEADER_HEIGHT : 0}
          style={{ flex: 1, backgroundColor: colors.card, paddingBottom: NAV_BAR_INSET }}
        >
          {/* ── Header ── */}
          <View style={{
            paddingTop: insets.top + 12, paddingBottom: T.space.md - 4, paddingHorizontal: T.space.md,
            flexDirection: 'row', alignItems: 'center', gap: T.space.sm,
            backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
          }}>
            <Pressable
              onPress={isWeb ? handleWebSave : onClose}
              style={{ padding: T.space.xs, flexShrink: 0 }}
              accessibilityLabel={t('common.close')}
            >
              <ArrowLeft size={22} color={colors.foreground} />
            </Pressable>

            {/* Horizontally scrollable secondary action buttons */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 2,
                paddingRight: 10, // keep the last button clear of the pinned Save
              }}
            >
              {settings.aiDraftAssistance && renderExpandButton()}
              <Pressable
                onPress={() => {
                  // Close the editor's keyboard first; otherwise the phrase
                  // sheet opens underneath it.
                  editorRef.current?.blurContentEditor?.();
                  Keyboard.dismiss();
                  setTimeout(() => setShowPhraseModal(true), 120);
                }}
                style={{
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, width: 40, height: 40,
                  backgroundColor: colors.muted,
                }}
                accessibilityLabel={t('editor.phraseLibrary')}
              >
                <BookMarked size={16} color={colors.mutedForeground} />
              </Pressable>
              {!isWeb && (
                <Pressable
                  onPress={() => setShowPreview(true)}
                  style={{
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, width: 40, height: 40,
                    backgroundColor: colors.muted,
                  }}
                  accessibilityLabel={t('editor.printPreview')}
                >
                  <Eye size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </ScrollView>

            {/* Pinned Save button - always visible */}
            <Pressable
              onPress={isWeb ? handleWebSave : onClose}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                minHeight: 40,
                backgroundColor: NAVY,
                flexShrink: 0,
              }}
              accessibilityLabel={t('common.save')}
            >
              <FileText size={14} color="#fff" />
              <Text style={{ ...T.footnote, color: '#fff', fontWeight: T.weight.bold }}>{t('common.save')}</Text>
            </Pressable>
          </View>

          {/* ── Status indicators ── */}
          {expanding && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: T.space.md, paddingVertical: 6,
              backgroundColor: `${colors.primary}15`, borderBottomWidth: 1, borderBottomColor: `${colors.primary}30`,
            }}>
              <ActivityIndicator size={12} color={colors.primary} />
              <Text style={{ ...T.caption1, color: colors.primary, fontWeight: T.weight.semibold }}>
                {t('editor.expandingWithAi')}
              </Text>
            </View>
          )}

          {!!expandError && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: T.space.md, paddingVertical: 6,
              backgroundColor: `${colors.destructive}15`, borderBottomWidth: 1, borderBottomColor: `${colors.destructive}30`,
            }}>
              <Text style={{ flex: 1, ...T.caption1, color: colors.destructive, fontWeight: T.weight.medium }} numberOfLines={2}>
                {expandError}
              </Text>
              <Pressable onPress={() => setExpandError('')} style={{ padding: 4 }} accessibilityLabel={t('editor.dismissError')}>
                <X size={14} color={colors.destructive} />
              </Pressable>
            </View>
          )}

          {isWeb ? (
            // ── Web fallback: plain TextInput ─────────────────────────────
            <ScrollView
              style={{ flex: 1, backgroundColor: colors.background }}
              contentContainerStyle={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{
                backgroundColor: colors.card, borderRadius: 4, padding: T.space.xl, minHeight: 600,
                boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: 'rgba(0,0,0,0.06)' }],
              }}>
                <Text style={{ ...T.caption2, color: colors.mutedForeground, marginBottom: 8 }}>
                  {t('editor.webWysiwygNotice')}
                </Text>
                <TextInput
                  value={webValue}
                  onChangeText={setWebValue}
                  onSelectionChange={(e) => {
                    webSelectionRef.current = e.nativeEvent.selection;
                  }}
                  placeholder={placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  // @ts-ignore web-only
                  style={{
                    ...T.subhead, lineHeight: 24, color: colors.foreground,
                    minHeight: 560, borderWidth: 0, backgroundColor: 'transparent',
                    outlineStyle: 'none',
                    outlineWidth: 0,
                  }}
                />
              </View>
            </ScrollView>
          ) : (
            // ── Native: pell-rich-editor ──────────────────────────────────
            <>
              <RichToolbar
                editor={editorRef}
                actions={TOOLBAR_ACTIONS}
                selectedIconTint={NAVY}
                iconTint={MUTED}
                style={styles.toolbar}
              />
              <RichEditor
                ref={editorRef}
                initialContentHTML={initialHtml}
                placeholder={placeholder}
                onChange={handleChange}
                onLoad={() => {
                  logger.warn('[DocEditor] RichEditor onLoad fired');
                  handleEditorReady();
                }}
                style={styles.richEditor}
                editorStyle={RICH_EDITOR_STYLE[colorScheme === 'dark' ? 'dark' : 'light']}
                // Fill the screen and scroll inside the editor. The default container
                // grew to the text height on every keystroke: long text could not be
                // scrolled and the re-layout made the screen flicker.
                useContainer={false}
                scrollEnabled
                nestedScrollEnabled
              />
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Print Preview (spawned from inside the editor) */}
      {!isWeb && (
        <PrintPreviewModal
          visible={showPreview}
          onClose={() => setShowPreview(false)}
          value={editorHtmlRef.current || initialHtml}
          title={title}
        />
      )}

      {/* Phrase Library Modal */}
      <PhraseLibraryModal
        visible={showPhraseModal}
        onClose={() => setShowPhraseModal(false)}
        onSelect={handlePhraseSelect}
      />

      {/* AI Expand Comparison Modal */}
      <Modal
        visible={!!expandPreview}
        animationType="slide"
        transparent
        onRequestClose={() => setExpandPreview(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', paddingBottom: NAV_BAR_INSET }}>
          <KeyboardAvoidingView
            behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
            style={{
              maxHeight: '88%',
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderCurve: 'continuous',
              borderTopWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: `${colors.primary}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Sparkles size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...T.subhead, fontWeight: T.weight.bold, color: colors.foreground }} numberOfLines={1}>
                    {t('editor.reviewAiExpansion')}
                  </Text>
                  <Text style={{ ...T.caption2, color: colors.mutedForeground }} numberOfLines={1}>
                    {t('editor.compareOriginalAi')}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setExpandPreview(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.muted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityLabel={t('common.close')}
              >
                <X size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Content: Stacked Original and AI Expanded */}
            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ padding: 20, gap: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Original */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ ...T.caption1, fontWeight: T.weight.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {t('editor.original')}
                  </Text>
                  <Text style={{ ...T.caption2, color: colors.mutedForeground }}>
                    {t('editor.charsCount', { count: expandPreview?.original.length || 0 })}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: colors.muted,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                }}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 120 }}>
                    <Text style={{ ...T.footnote, color: colors.mutedForeground, lineHeight: 20 }}>
                      {expandPreview?.original}
                    </Text>
                  </ScrollView>
                </View>
              </View>

              {/* AI Expanded */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} color={colors.primary} />
                    <Text style={{ ...T.caption1, fontWeight: T.weight.bold, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {t('editor.aiExpanded')}
                    </Text>
                  </View>
                  <Text style={{ ...T.caption2, color: colors.mutedForeground }}>
                    {t('editor.charsCount', { count: expandPreview?.expanded.length || 0 })}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: `${colors.primary}40`,
                  padding: 14,
                }}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                    <Text style={{ ...T.body, color: colors.foreground, lineHeight: 22 }}>
                      {expandPreview?.expanded}
                    </Text>
                  </ScrollView>
                </View>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={{
              padding: 20,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.card,
              gap: 10,
            }}>
              <Pressable
                onPress={handleApplyExpanded}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
                accessibilityLabel={t('editor.useExpandedVersion')}
              >
                <Sparkles size={16} color={colors.primaryForeground} />
                <Text style={{ ...T.subhead, fontWeight: T.weight.bold, color: colors.primaryForeground }}>
                  {t('editor.useExpandedVersion')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setExpandPreview(null)}
                style={{
                  backgroundColor: colors.muted,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityLabel={t('editor.keepOriginal')}
              >
                <Text style={{ ...T.footnote, fontWeight: T.weight.semibold, color: colors.mutedForeground }}>
                  {t('editor.keepOriginal')}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface DocumentEditorProps {
  /** Controlled value — HTML string (legacy markdown auto-migrated on first open) */
  value: string;
  /** Called on every content change */
  onChangeText: (v: string) => void;
  /** Shown in the full-screen header and print preview title bar */
  title?: string;
  /** Placeholder shown when empty */
  placeholder?: string;
  /** Minimum height of the compact preview area (default 180) */
  minHeight?: number;
  /** Visual error state */
  error?: boolean;
  /** Accessibility label */
  accessibilityLabel?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DocumentEditor({
  value,
  onChangeText,
  title = 'Document',
  placeholder = 'Start typing…',
  minHeight = 250,
  error = false,
  accessibilityLabel,
}: DocumentEditorProps) {
  const { t } = useTranslation();
  const [fullScreen, setFullScreen] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

  const wordCount  = useMemo(() => countWords(value), [value]);
  const previewText = useMemo(() => stripHtml(value), [value]);

  return (
    <>
      {/* ── Compact Preview Card ── */}
      <View style={{ gap: 0 }}>
        {/* Mini toolbar bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: T.space.md - 4, paddingVertical: T.space.sm,
          backgroundColor: colors.muted,
          borderTopLeftRadius: 12, borderTopRightRadius: 12,
          borderWidth: 1, borderBottomWidth: 0,
          borderColor: error ? '#DC2626' : colors.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: T.space.xs }}>
            <FileText size={13} color={colors.mutedForeground} />
            <Text style={{ ...T.caption2, color: colors.mutedForeground, fontWeight: T.weight.medium }}>{t('editor.document')}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: T.space.sm }}>
            <Text style={{ ...T.caption2, color: colors.mutedForeground }}>
              {t('editor.wordCount', { count: wordCount })}
            </Text>

            <Pressable
              onPress={() => setPrintPreview(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: T.space.xs,
                paddingHorizontal: T.space.sm, paddingVertical: T.space.xs,
                borderRadius: 6, backgroundColor: colors.card,
                borderWidth: 1, borderColor: colors.border,
              }}
              accessibilityLabel={t('editor.printPreview')}
            >
              <Eye size={12} color={colors.mutedForeground} />
              <Text style={{ ...T.caption2, color: colors.mutedForeground, fontWeight: T.weight.medium }}>{t('common.preview')}</Text>
            </Pressable>

            <Pressable
              onPress={() => setFullScreen(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: T.space.xs,
                paddingHorizontal: T.space.sm, paddingVertical: T.space.xs,
                borderRadius: 6, backgroundColor: NAVY,
              }}
              accessibilityLabel={t('editor.openFullScreenEditor')}
            >
              <Maximize2 size={12} color="#fff" />
              <Text style={{ ...T.caption2, color: '#fff', fontWeight: T.weight.semibold }}>{t('common.edit')}</Text>
            </Pressable>
          </View>
        </View>

        {/* Read-only text preview */}
        <Pressable
          onPress={() => setFullScreen(true)}
          accessibilityLabel={accessibilityLabel ?? t('editor.editorTapToEdit', { title })}
          style={{
            minHeight,
            backgroundColor: colors.card,
            paddingHorizontal: T.space.md - 2, paddingTop: T.space.md - 4, paddingBottom: T.space.md - 4,
            borderWidth: 1, borderTopWidth: 0,
            borderColor: error ? '#DC2626' : colors.border,
            borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
          }}
        >
          {previewText ? (
            <Text style={{ ...T.subhead, lineHeight: 22, color: colors.foreground }} numberOfLines={8}>
              {previewText}
            </Text>
          ) : (
            <Text style={{ ...T.subhead, color: colors.mutedForeground, fontStyle: 'italic' }}>
              {placeholder}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Full Screen WYSIWYG Editor */}
      <FullScreenModal
        visible={fullScreen}
        onClose={() => setFullScreen(false)}
        value={value}
        onChange={onChangeText}
        title={title}
        placeholder={placeholder}
      />

      {/* Print Preview (from compact card) */}
      <PrintPreviewModal
        visible={printPreview}
        onClose={() => setPrintPreview(false)}
        value={value}
        title={title}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  toolbar: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'transparent',
    height: 44,
  },
  richEditor: {
    flex: 1,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
  },
});

