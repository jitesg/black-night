// app.config.ts — dynamic Expo config that extends app.json.
// Used for fields the static app.json schema doesn't recognise
// (e.g. a versionCode taken from the CI build number).
// Expo prebuild reads this file with full priority over app.json.
//
// Two apps from one repo (owner): APP_VARIANT=office builds "InvestSuite कार्यालय" — its own package id (installs
// next to InvestSuite), own name and scheme. The JS side reads EXPO_PUBLIC_APP_VARIANT (src/office/config.ts), so CI
// sets both. Nothing changes for InvestSuite when the variable is not set.
import type { ConfigContext, ExpoConfig } from 'expo/config';
import base from './app.json';

const OFFICE = process.env.APP_VARIANT === 'office';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...base.expo,
  ...(OFFICE ? { name: 'InvestSuite कार्यालय', scheme: 'investsuitekaryalay', icon: './assets/office/icon.png' } : {}),
  extra: { ...(base.expo as { extra?: Record<string, unknown> }).extra, appVariant: OFFICE ? 'office' : 'investsuite' },
  android: {
    ...base.expo.android,
    ...(OFFICE ? {
      package: `${base.expo.android.package}.karyalay`,
      // owner's choice B: badge + थाना भवन + कागज़ ✓ (source assets/office/icon.svg)
      adaptiveIcon: { foregroundImage: './assets/office/adaptive-icon.png', backgroundColor: '#1E3A5F' },
    } : {}),
    // Edge-to-edge is always on from Android 16, so the old
    // edgeToEdgeEnabled flag is no longer needed (prebuild warned about it).
    // CI sets ANDROID_VERSION_CODE to the build number so each APK is a
    // newer version than the last and installs as an update.
    versionCode: Number(process.env.ANDROID_VERSION_CODE) || base.expo.android.versionCode,
  },
});
