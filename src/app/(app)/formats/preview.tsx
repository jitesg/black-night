import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal, Pressable, ScrollView, Text, View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ArrowLeft, BookOpen, FileWarning, Eye } from 'lucide-react-native';
import WebView from 'react-native-webview';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { gdFormatBridge } from '@/lib/gdFormatBridge';
import { nirodhatmakFormatBridge } from '@/lib/nirodhatmakFormatBridge';
import { formatPreviewBridge } from '@/lib/formatPreviewBridge';
import { GeneratedReportView } from '@/components/common/GeneratedReportView';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

function safeDecode(v?: string) {
  if (!v) return '';
  try { return decodeURIComponent(v); } catch { return v; }
}

// ─── A4 Print Preview Modal ───────────────────────────────────────────────────
function PrintPreviewModal({
  visible, onClose, html, title,
}: { visible: boolean; onClose: () => void; html: string; title: string }) {
  const isWeb = process.env.EXPO_OS === 'web';
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ paddingBottom: NAV_BAR_INSET, flex: 1, backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#e8e8e8' }}>
        {/* Header bar */}
        <View style={{
          paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: C.primary, borderBottomWidth: 1, borderBottomColor: C.primary,
        }}>
          <Pressable onPress={onClose} style={{ padding: 4 }} accessibilityLabel={t('format.preview.closePreview')}>
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#fff' }} numberOfLines={1}>
            {title}
          </Text>
          <Text style={{ fontSize: 11, color: colorScheme === 'dark' ? '#CBD5E1' : '#94a3b8' }}>A4</Text>
        </View>
        {/* Content */}
        {isWeb ? (
          <View style={{ flex: 1 }}>
            {/* @ts-ignore — iframe is valid in web branch */}
            <iframe
              srcDoc={html}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
              title={t('format.preview.printPreview')}
            />
          </View>
        ) : (
          <WebView
            source={{ html }}
            style={{ flex: 1 }}
            originWhitelist={['*']}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PreviewScreen() {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;

  // Phase 1: only lightweight IDs come via URL — payloads come from bridge
  const { formatTitle, formatId, callingModule, isBlankPrint } =
    useLocalSearchParams<{
      formatTitle: string;
      formatId: string;
      callingModule?: string;
      isBlankPrint?: string;
    }>();
  const navigation = useNavigation();

  const [reportContent, setReportContent] = useState('');
  const [decodedHtml, setDecodedHtml]         = useState('');
  const [decodedEditorHtml, setDecodedEditorHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Retrieve payload from bridge on mount and clear it to free memory
  useEffect(() => {
    const payload = formatPreviewBridge.get();
    setReportContent(payload.reportText);
    setDecodedHtml(payload.formatHtml);
    setDecodedEditorHtml(payload.formatEditorHtml);
    formatPreviewBridge.clear();
  }, []);

  const isBlank  = isBlankPrint === 'true';
  const isFromGD = !isBlank && callingModule === 'GD';
  const isFromNK = !isBlank && callingModule === 'NK';
  const title    = safeDecode(formatTitle) || t('format.preview.title');

  const handleInsertIntoGD = () => {
    gdFormatBridge.set(reportContent, formatId);
    const parent = navigation.getParent();
    if (parent) parent.goBack(); else router.back();
  };

  const handleSaveProceeding = () => {
    nirodhatmakFormatBridge.set(reportContent, formatId);
    const parent = navigation.getParent();
    if (parent) parent.goBack(); else router.back();
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('format.preview.title')}
        subtitle={title}
        showBack
        rightActions={
          decodedHtml ? (
            <Pressable
              onPress={() => setShowPreview(true)}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg active:opacity-70"
              style={{ backgroundColor: colorScheme === 'dark' ? `${C.primary}25` : `${C.primary}15` }}
            >
              <Eye size={15} color={C.primary} />
              <Text className="text-xs font-semibold" style={{ color: C.primary }}>{t('format.preview.a4Preview')}</Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* Module-specific action buttons */}
      {(isFromGD || isFromNK) && (
        <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
          {isFromGD && (
            <Pressable
              onPress={handleInsertIntoGD}
              className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl active:opacity-80 bg-primary"
              style={{ borderCurve: 'continuous' }}
            >
              <BookOpen size={15} color="#fff" />
              <Text className="text-sm font-bold text-primary-foreground">{t('format.preview.insertIntoGD')}</Text>
            </Pressable>
          )}
          {isFromNK && (
            <Pressable
              onPress={handleSaveProceeding}
              className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl active:opacity-80"
              style={{ backgroundColor: '#DC2626', borderCurve: 'continuous' }}
            >
              <FileWarning size={15} color="#fff" />
              <Text className="text-sm font-bold text-white">{t('format.preview.saveProceeding')}</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        contentContainerClassName="px-6 py-5 pb-12 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <GeneratedReportView
          content={reportContent}
          fixedHtml={decodedHtml || undefined}
          editorHtml={decodedEditorHtml || undefined}
          title={title}
          onSave={isBlank ? undefined : async (v) => setReportContent(v)}
        />
      </ScrollView>

      {/* A4 structured print preview */}
      {decodedHtml ? (
        <PrintPreviewModal
          visible={showPreview}
          onClose={() => setShowPreview(false)}
          html={decodedHtml}
          title={title}
        />
      ) : null}
    </View>
  );
}
