// App entry. The reminder background task must be defined before the app
// starts so Android can run it while the app is closed.
// Selectable text everywhere — must run before any screen imports Text.
import './src/lib/perfLog';
import './src/lib/selectableText';
// phone = portrait only, tablet / opened foldable = turns freely (owner, option ख)
import './src/lib/orientationPolicy';
// (not in the "InvestSuite कार्यालय" build — it has no reminders)
if (process.env.EXPO_PUBLIC_APP_VARIANT !== 'office') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./src/lib/reminderBackgroundTask');
  // कार्यालय कागज़ check every ~15–30 min (only does work while the phone is joined to a कार्यालय)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./src/office/officeBackgroundTask');
}
// after the task above (an `import` here would be hoisted above the `if`)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('expo-router/entry');
