/**
 * GeneratedReportView — Universal Generated Report Viewer + Inline Editor
 *
 * Used by every module that shows a generated document (Nyayalay, Prarthna Patra,
 * Formats/Preview, GD, etc.).
 *
 * View mode:
 *   • Compact Material 3 outlined action bar: Copy | Share | Edit | Export PDF
 *   • Selectable, print-ready report content
 *
 * Edit mode (inline — no navigation):
 *   • DocumentEditor opens inline with Save / Cancel / Share actions
 *   • onSave callback handles persistence; the component never touches the DB
 *   • Template is never modified — only the generated instance
 *
 * PDF export (v256):
 *   • Uses expo-print + expo-sharing when fixedHtml is provided
 *   • Falls back to window.print() on Web
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, Share, Text, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  CheckCircle, Copy, Edit3, FileDown, Save, Share2, X,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { FardCheckButton } from '@/components/fard/FardCheckButton';
import { renderMarkdown } from '@/lib/markdownRenderer';
import { useTranslation } from 'react-i18next';

interface GeneratedReportViewProps {
  /** The generated report content (plain text or lightly formatted) */
  content: string;
  /** Pre-rendered, font-fit A4 HTML from formatFixingEngine — enables PDF export */
  fixedHtml?: string;
  /**
   * v257: Inline-styled editor HTML from renderModelsForEditor().
   * When present, DocumentEditor opens showing this structured HTML
   * (right-aligned header, justified body, right-aligned signature)
   * instead of the plain `content` string — true WYSIWYG editing.
   *
   * Only provided for generated-format reports. Free-text entries
   * (Nakal Chick, Rapat) leave this undefined and open as before.
   */
  editorHtml?: string;
  /** Human-readable title shown in edit-mode header */
  title?: string;
  /**
   * Called when the user taps Save in edit mode.
   * The component sets saving=true, awaits the callback, then exits edit mode.
   * If omitted, the Edit button is hidden (read-only mode).
   */
  onSave?: (newContent: string) => Promise<void>;
  /**
   * Optional text prepended to the clipboard/share payload (e.g. case number,
   * date, etc.) without polluting the editable content.
   */
  sharePrefix?: string;
}

export function GeneratedReportView({
  content,
  fixedHtml,
  editorHtml,
  title = 'Report',
  onSave,
  sharePrefix,
}: GeneratedReportViewProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const successColor = colorScheme === 'dark' ? '#34D399' : '#059669';

  const [editing, setEditing]       = useState(false);
  // draft: tracks what the editor currently holds (HTML when editorHtml available, plain text otherwise)
  const [draft, setDraft]           = useState(editorHtml ?? content);
  const [saving, setSaving]         = useState(false);
  const [copied, setCopied]         = useState(false);
  const [exporting, setExporting]   = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the copy-feedback timer on unmount to prevent setState on unmounted component.
  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  // ── Sync draft when parent pushes new content (e.g. template change) ──────
  const prevContentRef = useRef(content);
  if (content !== prevContentRef.current && !editing) {
    prevContentRef.current = content;
    // Always reset draft to the structured editor HTML when available
    setDraft(editorHtml ?? content);
  }

  // For Copy/Share we always use plain text regardless of editor HTML
  const shareText = sharePrefix ? `${sharePrefix}\n\n${content}` : content;

  const handleCopy = async () => {
    if (process.env.EXPO_OS === 'web') {
      try { await navigator.clipboard.writeText(shareText); } catch { /* silent */ }
    } else {
      await Clipboard.setStringAsync(shareText);
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: shareText, title });
    } catch { /* cancelled */ }
  };

  const handleEdit = () => {
    // v257: Open editor with structured inline-styled HTML when available.
    // Free-text entries (no editorHtml) fall back to plain content as before.
    setDraft(editorHtml ?? content);
    setEditing(true);
  };

  const handleCancel = () => {
    // Reset draft back to the structured HTML (or plain text for free-text entries)
    setDraft(editorHtml ?? content);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // ── PDF Export (v256) ──────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      if (process.env.EXPO_OS === 'web') {
        // Web: use browser print dialog
        if (typeof window !== 'undefined') window.print();
        return;
      }
      const htmlToExport = fixedHtml || `<html><body><pre style="white-space:pre-wrap">${shareText}</pre></body></html>`;
      const { uri } = await Print.printToFileAsync({ html: htmlToExport });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: title,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e) {
      if (__DEV__) console.warn('[GeneratedReportView] PDF export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <View className="gap-3">
        {/* Edit-mode action bar */}
        <View className="flex-row items-center gap-2">
          {/* Cancel */}
          <Pressable
            onPress={handleCancel}
            disabled={saving}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card active:opacity-70"
            style={{ borderCurve: 'continuous' }}
          >
            <X size={13} color={C.mutedForeground} />
            <Text className="text-xs font-medium text-muted-foreground">{t('common.cancel')}</Text>
          </Pressable>

          <View className="flex-1" />

          {/* Share draft */}
          <Pressable
            onPress={handleShare}
            disabled={saving}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card active:opacity-70"
            style={{ borderCurve: 'continuous' }}
          >
            <Share2 size={13} color={C.foreground} />
            <Text className="text-xs font-medium text-foreground">{t('common.share')}</Text>
          </Pressable>

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary active:opacity-70"
            style={{ borderCurve: 'continuous', backgroundColor: C.primary }}
          >
            {saving
              ? <ActivityIndicator size={13} color={C.primaryForeground} />
              : <Save size={13} color={C.primaryForeground} />}
            <Text style={{ color: C.primaryForeground }} className="text-xs font-semibold">
              {saving ? t('common.saving') : t('common.save')}
            </Text>
          </Pressable>
        </View>

        {/* Inline DocumentEditor — no navigation */}
        <DocumentEditor
          value={draft}
          onChangeText={setDraft}
          title={title}
          placeholder={t('editor.editReportPlaceholder')}
          minHeight={300}
          accessibilityLabel={t('editor.reportEditorAccessibility')}
        />
        <FardCheckButton text={draft} title={title} className="mt-2" />
      </View>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  return (
    <View className="gap-3">
      {/* Compact Material 3 outlined action bar */}
      <View className="flex-row gap-2 flex-wrap">
        <Pressable
          onPress={handleCopy}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card active:opacity-70"
          style={{ borderCurve: 'continuous' }}
        >
          {copied
            ? <CheckCircle size={13} color={successColor} />
            : <Copy size={13} color={C.foreground} />}
          <Text className="text-xs font-medium" style={{ color: copied ? successColor : C.foreground }}>
            {copied ? t('common.copied') : t('common.copy')}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleShare}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card active:opacity-70"
          style={{ borderCurve: 'continuous' }}
        >
          <Share2 size={13} color={C.foreground} />
          <Text className="text-xs font-medium text-foreground">{t('common.share')}</Text>
        </Pressable>

        {/* PDF Export — always shown; uses fixedHtml when available */}
        <Pressable
          onPress={handleExportPdf}
          disabled={exporting}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card active:opacity-70"
          style={{ borderCurve: 'continuous' }}
        >
          {exporting
            ? <ActivityIndicator size={13} color={C.foreground} />
            : <FileDown size={13} color={C.foreground} />}
          <Text className="text-xs font-medium text-foreground">
            {exporting ? t('editor.exporting') : t('common.exportPdf')}
          </Text>
        </Pressable>

        {onSave ? (
          <Pressable
            onPress={handleEdit}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card active:opacity-70"
            style={{ borderCurve: 'continuous' }}
          >
            <Edit3 size={13} color={C.foreground} />
            <Text className="text-xs font-medium text-foreground">{t('common.edit')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Report content — rendered markdown, selectable, print-ready */}
      <View
        className="bg-card border border-border rounded-2xl p-5"
        style={{ borderCurve: 'continuous' }}
      >
        {content
          ? renderMarkdown(content, colorScheme)
          : <Text className="text-sm text-muted-foreground italic">Report content will appear here.</Text>
        }
      </View>
    </View>
  );
}
