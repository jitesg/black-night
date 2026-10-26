// App entry. The reminder background task must be defined before the app
// starts so Android can run it while the app is closed.
// Selectable text everywhere — must run before any screen imports Text.
import './src/lib/selectableText';
import './src/lib/reminderBackgroundTask';
import 'expo-router/entry';
