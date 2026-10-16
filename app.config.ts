// app.config.ts — dynamic Expo config that extends app.json.
// Used for fields the static app.json schema doesn't recognise
// (e.g. android.edgeToEdgeEnabled, introduced in Expo SDK 52+).
// Expo prebuild reads this file with full priority over app.json.
import type { ConfigContext, ExpoConfig } from 'expo/config';
import base from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...base.expo,
  android: {
    ...base.expo.android,
    // Opt into edge-to-edge mode on Android 15 (API 35+).
    // Without this, WindowInsetsCompat is not activated and
    // useSafeAreaInsets() returns 0 for bottom on gesture-nav devices.
    edgeToEdgeEnabled: true,
  },
});
