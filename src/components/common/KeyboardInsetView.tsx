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

export function KeyboardInsetView({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
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
