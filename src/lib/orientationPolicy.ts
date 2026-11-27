/**
 * Orientation policy (owner, option ख — "phone खड़ा, tablet घूमे"). app.json now says "orientation": "default" (the old
 * "portrait" locked every device, tablets too). Here, at start-up and whenever the screen size changes (a foldable opened /
 * closed): a phone is locked to portrait (as before), a large screen is unlocked (portrait + landscape).
 * Imported once from the root index.ts (both apps). Any error → nothing happens (the app simply follows the manifest).
 */
import { Dimensions, Platform } from 'react-native';
import { isLargeScreen } from './screenSize';

let lastLarge: boolean | null = null;

async function apply(): Promise<void> {
  if (Platform.OS === 'web') return;
  const { width, height } = Dimensions.get('screen');
  const large = isLargeScreen(width, height);
  if (large === lastLarge) return;
  lastLarge = large;
  try {
    const SO = await import('expo-screen-orientation');
    if (large) await SO.unlockAsync();
    else await SO.lockAsync(SO.OrientationLock.PORTRAIT_UP);
  } catch {
    lastLarge = null; // try again on the next size change
  }
}

try {
  void apply();
  Dimensions.addEventListener('change', () => { void apply(); });
} catch { /* never block start-up */ }

export {};
