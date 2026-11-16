/**
 * AttachmentsSection — "📎 संलग्न कागज़ (n)" (owner): photos / PDFs of a प्रार्थना पत्र or a न्यायालय document.
 *
 * Two modes:
 *  - `parentId` given → reads / writes module_attachments at once (detail screens);
 *  - no parentId → "pending" files held by the form (`pending` / `onPendingChange`), saved by the screen
 *    with addPendingAttachments() after the paper is created (add forms).
 * Tap = open in the phone's viewer (openFile); press and hold = साझा करें / हटाएँ. A file that came from the
 * कार्यालय (source 'office') warns that it is only removed from this phone.
 * Photos are taken at quality 0.6 so they stay small on the phone.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Camera, FileText, Image as ImageIcon, Paperclip, Plus, Share2, Trash2 } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { openFile, persistPickedFile } from '@/lib/attachmentFiles';
import {
  addAttachment, deleteAttachment, isImageMime, listAttachments,
  type Attachment, type AttachmentModule, type PendingAttachment,
} from '@/lib/db/attachmentRepo';

type Item = PendingAttachment & { id?: string; source?: Attachment['source'] };

interface Props {
  module: AttachmentModule;
  /** Saved paper → files are stored at once. */
  parentId?: string | null;
  /** Add form (no id yet) → files are kept here until the paper is saved. */
  pending?: PendingAttachment[];
  onPendingChange?: (files: PendingAttachment[]) => void;
  /** Module colour for the add tile / link. */
  accent?: string;
}

function sizeLabel(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extLabel(item: Item): string {
  if (/pdf/i.test(item.mime) || /\.pdf$/i.test(item.name)) return 'PDF';
  const m = /\.([a-z0-9]{1,5})$/i.exec(item.name);
  return m ? m[1].toUpperCase() : 'फ़ाइल';
}

async function fileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && 'size' in info ? (info.size ?? 0) : 0;
  } catch { return 0; }
}

export function AttachmentsSection({ module, parentId, pending, onPendingChange, accent }: Props) {
  const { colorScheme } = useColorScheme();
  const C = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const ACC = accent ?? C.primary;
  const saved = !!parentId;

  const [rows, setRows] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menuFor, setMenuFor] = useState<Item | null>(null);
  const [confirmFor, setConfirmFor] = useState<Item | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!parentId) return;
    try { setRows(await listAttachments(module, parentId)); } catch { /* table missing on a very old DB → empty */ }
  }, [module, parentId]);

  useEffect(() => { void reload(); }, [reload]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);

  const items: Item[] = saved ? rows : (pending ?? []);

  const addFiles = async (files: PendingAttachment[]) => {
    if (!files.length) return;
    if (saved && parentId) {
      for (const f of files) await addAttachment(module, parentId, f);
      await reload();
    } else {
      onPendingChange?.([...(pending ?? []), ...files]);
    }
  };

  const pickCamera = async () => {
    setSheet(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setMsg('कैमरा की अनुमति नहीं मिली'); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: false });
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    try {
      const a = res.assets[0];
      const name = a.fileName ?? `photo_${Date.now()}.jpg`;
      const uri = await persistPickedFile(a.uri, name);
      await addFiles([{ uri, name, mime: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? await fileSize(uri) }]);
    } finally { setBusy(false); }
  };

  const pickGallery = async () => {
    setSheet(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setMsg('गैलरी की अनुमति नहीं मिली'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: true, selectionLimit: 20,
    });
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    try {
      const files: PendingAttachment[] = [];
      for (const a of res.assets) {
        const name = a.fileName ?? `photo_${Date.now()}.jpg`;
        const uri = await persistPickedFile(a.uri, name);
        files.push({ uri, name, mime: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? await fileSize(uri) });
      }
      await addFiles(files);
    } finally { setBusy(false); }
  };

  const pickDocument = async () => {
    setSheet(false);
    const res = await DocumentPicker.getDocumentAsync({
      multiple: true, copyToCacheDirectory: true, type: ['application/pdf', 'image/*', '*/*'],
    });
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    try {
      const files: PendingAttachment[] = [];
      for (const a of res.assets) {
        const uri = await persistPickedFile(a.uri, a.name);
        files.push({ uri, name: a.name, mime: a.mimeType ?? 'application/octet-stream', size: a.size ?? 0 });
      }
      await addFiles(files);
    } finally { setBusy(false); }
  };

  const open = async (it: Item) => {
    try { await openFile(it.uri, it.mime); } catch { setMsg('यह फ़ाइल फ़ोन में नहीं मिली'); }
  };

  const share = async (it: Item) => {
    setMenuFor(null);
    try {
      if (!(await Sharing.isAvailableAsync())) { setMsg('साझा करना इस फ़ोन पर उपलब्ध नहीं'); return; }
      await Sharing.shareAsync(it.uri, { mimeType: it.mime || undefined });
    } catch { setMsg('साझा नहीं हो सका'); }
  };

  const remove = async (it: Item) => {
    setConfirmFor(null);
    if (saved && it.id) {
      await deleteAttachment(it.id);
      if (it.source !== 'office') await FileSystem.deleteAsync(it.uri, { idempotent: true }).catch(() => {});
      await reload();
    } else {
      onPendingChange?.((pending ?? []).filter((p) => p.uri !== it.uri));
      await FileSystem.deleteAsync(it.uri, { idempotent: true }).catch(() => {});
    }
    setMsg('हटा दिया गया');
  };

  const tileStyle = { width: '31.5%' as const, marginBottom: 10 };
  const thumb = { height: 96, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' as const };

  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Paperclip size={15} color={C.mutedForeground} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.mutedForeground }}>संलग्न कागज़ ({items.length})</Text>
        </View>
        <Pressable onPress={() => setSheet(true)} hitSlop={8} accessibilityLabel="कागज़ जोड़ें">
          <Text style={{ fontSize: 14, fontWeight: '700', color: ACC }}>+ जोड़ें</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: '2.75%', marginTop: 10 }}>
        {items.map((it) => (
          <View key={it.id ?? it.uri} style={tileStyle}>
            <Pressable onPress={() => void open(it)} onLongPress={() => setMenuFor(it)} delayLongPress={350}>
              {isImageMime(it.mime) ? (
                <View style={thumb}>
                  <Image source={{ uri: it.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {it.source === 'office' ? (
                    <View style={{ position: 'absolute', left: 5, top: 5, backgroundColor: '#1F4E79', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 10 }}>कार्यालय</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={[thumb, { backgroundColor: colorScheme === 'dark' ? '#3B1F22' : '#FEF2F2', alignItems: 'center', justifyContent: 'center', gap: 2 }]}>
                  <FileText size={26} color={colorScheme === 'dark' ? '#FCA5A5' : '#B91C1C'} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colorScheme === 'dark' ? '#FCA5A5' : '#B91C1C' }}>{extLabel(it)}</Text>
                  {it.size ? <Text style={{ fontSize: 11, color: C.mutedForeground }}>{sizeLabel(it.size)}</Text> : null}
                </View>
              )}
            </Pressable>
            <Text numberOfLines={1} style={{ fontSize: 11, color: C.mutedForeground, marginTop: 3, textAlign: 'center' }}>{it.name}</Text>
          </View>
        ))}
        <View style={tileStyle}>
          <Pressable onPress={() => setSheet(true)} disabled={busy} accessibilityLabel="फ़ोटो या PDF जोड़ें">
            <View style={[thumb, { borderWidth: 2, borderStyle: 'dashed', borderColor: ACC, alignItems: 'center', justifyContent: 'center', gap: 2 }]}>
              {busy ? <ActivityIndicator color={ACC} /> : <Plus size={24} color={ACC} />}
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: ACC }}>फ़ोटो / PDF</Text>
            </View>
          </Pressable>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: C.mutedForeground }}>
        {items.length ? 'दबाएँ = खोलें · दबाकर रखें = साझा करें / हटाएँ' : 'प्रार्थना पत्र / आदेश की फ़ोटो या PDF यहाँ रखें'}
      </Text>
      {msg ? <Text style={{ fontSize: 12.5, color: ACC, marginTop: 4, fontWeight: '600' }}>{msg}</Text> : null}

      {/* Add sheet */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0007' }} onPress={() => setSheet(false)} />
        <View style={{ backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18 + NAV_BAR_INSET }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 10 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.foreground, marginBottom: 4 }}>कागज़ जोड़ें</Text>
          {[
            { key: 'cam', icon: <Camera size={20} color="#15803D" />, bg: '#DCFCE7', title: 'कैमरा से फ़ोटो', sub: 'कागज़ की फ़ोटो — फ़ोन में जगह बचाने को छोटी करके रखी जाएगी', on: pickCamera },
            { key: 'gal', icon: <ImageIcon size={20} color="#1D4ED8" />, bg: '#DBEAFE', title: 'गैलरी से फ़ोटो', sub: 'एक साथ कई फ़ोटो चुन सकते हैं', on: pickGallery },
            { key: 'doc', icon: <FileText size={20} color="#B91C1C" />, bg: '#FEE2E2', title: 'PDF / फ़ाइल', sub: 'WhatsApp / फ़ोन में रखी PDF', on: pickDocument },
          ].map((o, i) => (
            <Pressable key={o.key} onPress={() => void o.on()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: C.border }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: o.bg, alignItems: 'center', justifyContent: 'center' }}>{o.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.foreground }}>{o.title}</Text>
                  <Text style={{ fontSize: 12, color: C.mutedForeground }}>{o.sub}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* Long-press menu */}
      <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0007' }} onPress={() => setMenuFor(null)} />
        <View style={{ backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 + NAV_BAR_INSET }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: C.foreground, marginBottom: 6 }}>{menuFor?.name}</Text>
          <Pressable onPress={() => menuFor && void share(menuFor)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 }}>
              <Share2 size={20} color={C.foreground} />
              <Text style={{ fontSize: 15, color: C.foreground }}>साझा करें</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => { const it = menuFor; setMenuFor(null); setConfirmFor(it); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 }}>
              <Trash2 size={20} color={C.destructive} />
              <Text style={{ fontSize: 15, color: C.destructive }}>हटाएँ</Text>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* Delete confirm */}
      <Modal visible={!!confirmFor} transparent animationType="fade" onRequestClose={() => setConfirmFor(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0007' }} onPress={() => setConfirmFor(null)} />
        <View style={{ backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 + NAV_BAR_INSET }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.foreground }}>
            {confirmFor && isImageMime(confirmFor.mime) ? 'फ़ोटो हटाएँ?' : 'फ़ाइल हटाएँ?'}
          </Text>
          {confirmFor?.source === 'office' ? (
            <View style={{ backgroundColor: colorScheme === 'dark' ? '#3A2414' : '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', borderRadius: 12, padding: 10, marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: colorScheme === 'dark' ? '#FDBA74' : '#9A3412' }}>
                ⚠️ यह कागज़ कार्यालय से आया है। हटाने पर सिर्फ़ आपके फ़ोन से हटेगा, कार्यालय में बना रहेगा।
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: C.mutedForeground, marginTop: 6 }}>यह कागज़ फ़ोन से हट जाएगा।</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable style={{ flex: 1 }} onPress={() => setConfirmFor(null)}>
              <View style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.foreground }}>रद्द करें</Text>
              </View>
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => confirmFor && void remove(confirmFor)}>
              <View style={{ backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>हाँ, हटाएँ</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
