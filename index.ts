// App entry. The reminder background task must be defined before the app
// starts so Android can run it while the app is closed.
// Selectable text everywhere — must run before any screen imports Text.
import './src/lib/perfLog';
import './src/lib/selectableText';
// (not in the "InvestSuite कार्यालय" build — it has no reminders)
if (process.env.EXPO_PUBLIC_APP_VARIANT !== 'office') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./src/lib/reminderBackgroundTask');
}
// after the task above (an `import` here would be hoisted above the `if`)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('expo-router/entry');
