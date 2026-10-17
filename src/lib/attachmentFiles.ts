/**
 * attachmentFiles.ts — save and open user-picked attachment files.
 *
 * Android notes:
 *  - DocumentPicker copies files into the cache folder, which Android may
 *    clear at any time. persistPickedFile() copies them into the app's
 *    documents folder so attachments survive.
 *  - A browser view can't open file:// paths on Android, so openFile()
 *    hands the file to an installed viewer app (PDF reader, gallery, …)
 *    and falls back to the share sheet when none is installed.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

const ATTACHMENTS_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}attachments/`
  : null;

// Lets the viewer app read the file we hand it.
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/** Copies a picked file to permanent app storage; returns the new URI. */
export async function persistPickedFile(uri: string, name: string): Promise<string> {
  if (process.env.EXPO_OS === 'web' || !ATTACHMENTS_DIR) return uri;
  try {
    await FileSystem.makeDirectoryAsync(ATTACHMENTS_DIR, { intermediates: true }).catch(() => null);
    const safeName = name.replace(/[^\w.\-]+/g, '_') || 'file';
    const dest = `${ATTACHMENTS_DIR}${Date.now()}_${safeName}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri; // keep the original if the copy fails
  }
}

/** Opens a local or remote file in the most suitable app. */
export async function openFile(uri: string, mimeType?: string): Promise<void> {
  if (process.env.EXPO_OS === 'web' || /^https?:/i.test(uri)) {
    await WebBrowser.openBrowserAsync(uri);
    return;
  }

  if (process.env.EXPO_OS === 'android') {
    if (uri.startsWith('file://')) {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error('File not found on this device');
    }
    const data = uri.startsWith('content://') ? uri : await FileSystem.getContentUriAsync(uri);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data,
        type: mimeType || '*/*',
        flags: FLAG_GRANT_READ_URI_PERMISSION,
      });
      return;
    } catch {
      // No app can view this type — fall through to the share sheet.
    }
  }

  await Sharing.shareAsync(uri, mimeType ? { mimeType } : undefined);
}
