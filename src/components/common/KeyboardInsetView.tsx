/**
 * KeyboardInsetView — keeps focused inputs above the Android keyboard.
 *
 * Android 15+ draws the app edge-to-edge, and in that mode the system no
 * longer resizes the window when the keyboard opens (adjustResize has no
 * effect). Screens without their own KeyboardAvoidingView ended up with
 * inputs hidden behind the keyboard.
 *
 * It also keeps every screen above the navigation bar (bottom inset).
 *
 * This wrapper restores the old "resize" behaviour app-wide: on Android it
 * adds bottom padding equal to the keyboard height while the keyboard is
 * open. Existing KeyboardAvoidingViews re-measure on layout change, so they
 * settle to zero extra offset instead of doubling up. Modals are separate
 * windows and keep using their own KeyboardAvoidingView.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

// A full-screen editor Modal handles the keyboard itself. While it is open the screen underneath must
// not re-pad on every keyboard change: that re-laid out the whole (hidden) FIR screen at the same moment
// as the editor, and the editor flickered when the keyboard opened / closed (owner).
let suspendCount = 0;
const resumeListeners = new Set<() => void>();
export function suspendKeyboardInset(): () => void {
  suspendCount += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    suspendCount = Math.max(0, suspendCount - 1);
    if (suspendCount === 0) resumeListeners.forEach((f) => f());
  };
}

export function KeyboardInsetView({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      if (suspendCount > 0) return;
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    // Back from a Modal: the keyboard is closed by then (or was the Modal's) — start clean.
    const resume = () => setKeyboardHeight(Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0);
    resumeListeners.add(resume);
    return () => {
      show.remove();
      hide.remove();
      resumeListeners.delete(resume);
    };
  }, []);

  // The app is drawn edge-to-edge, so the screens would sit behind the
  // navigation bar (back / home buttons). Keep them above it at all times;
  // with the keyboard open, pad by the keyboard (RN reports its height minus
  // the navigation bar, so add that back). Screens therefore must NOT add
  // insets.bottom again — only Modals (separate windows) still need it.
  const paddingBottom = keyboardHeight > 0 ? keyboardHeight + insets.bottom : insets.bottom;
  const { colorScheme } = useColorScheme();

  return <View style={{ flex: 1, paddingBottom, backgroundColor: THEME[colorScheme ?? 'light'].background }}>{children}</View>;
}
