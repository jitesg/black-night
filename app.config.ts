// app.config.ts — dynamic Expo config that extends app.json.
// Used for fields the static app.json schema doesn't recognise
// (e.g. a versionCode taken from the CI build number).
// Expo prebuild reads this file with full priority over app.json.
import type { ConfigContext, ExpoConfig } from 'expo/config';
import base from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...base.expo,
  android: {
    ...base.expo.android,
    // Edge-to-edge is always on from Android 16, so the old
    // edgeToEdgeEnabled flag is no longer needed (prebuild warned about it).
    // CI sets ANDROID_VERSION_CODE to the build number so each APK is a
    // newer version than the last and installs as an update.
    versionCode: Number(process.env.ANDROID_VERSION_CODE) || base.expo.android.versionCode,
  },
});
