/** केस डायरी का A4 प्रीव्यू (owner) — full-screen modal showing `buildCaseDiaryPrintHtml` sheets. */
import { Modal, Pressable, Text, View } from 'react-native';
import WebView from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

export function CaseDiaryA4Preview({ visible, html, title, onClose }: { visible: boolean; html: string; title: string; onClose: () => void }) {
  const isWeb = process.env.EXPO_OS === 'web';
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, paddingBottom: NAV_BAR_INSET, backgroundColor: '#e8e8e8' }}>
        <View style={{ paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#6366F1' }}>
          <Pressable onPress={onClose} style={{ padding: 4 }} accessibilityLabel="बंद करें">
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#fff' }} numberOfLines={1}>{title}</Text>
          <Text style={{ fontSize: 12, color: '#E0E7FF' }}>A4</Text>
        </View>
        {isWeb ? (
          <View style={{ flex: 1 }}>
            {/* @ts-ignore — iframe is valid in the web branch */}
            <iframe srcDoc={html} style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} title="A4" />
          </View>
        ) : (
          <WebView source={{ html }} style={{ flex: 1 }} originWhitelist={['*']} />
        )}
      </View>
    </Modal>
  );
}
