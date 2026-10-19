# InvestSuite — notes for Claude

Police investigation assistant (Hindi/English), built with Expo SDK 55 / React Native 0.83
(new architecture, Hermes), expo-router, NativeWind v4, expo-sqlite. Originally exported
from the MeDo AI builder (v1.0.583); development now continues here.

## Working rules (from the owner)
- Talk to the owner in simple Hindi/Hinglish; they test on a real Android phone.
- Never change existing features unless asked.
- **Do NOT build an APK on your own.** Fix bugs, commit, push, then ASK
  "APK बनाऊँ?". Build only after a yes.
- Work on branch `claude/app-apk-build-upbmwa`.

## Building the APK (only when the owner says yes)
- Workflow: `.github/workflows/build-apk.yml` (prebuild → build worklets native lib
  first → `assembleRelease` → GitHub release `apk-build-<run_number>`).
- Start it with the GitHub MCP tool `actions_run_trigger` (method `run_workflow`,
  workflow `build-apk.yml`, ref `claude/app-apk-build-upbmwa`). Pushing a `build-*`
  tag also works, but tag pushes are blocked by the sandbox proxy.
- Takes ~15–20 min. Then send the link
  `https://github.com/jitesg/black-night/releases/download/apk-build-<n>/InvestSuite.apk`
  AND download it into the scratchpad and send the file (SendUserFile) — the owner
  sometimes can't download from GitHub on the phone.
- The Android SDK can't be downloaded in the sandbox; native code is only compiled in CI.

## Checks before every push
- `npx tsc --noEmit -p .` (filter to changed files), `npx eslint <files>`
- `CI=1 npx expo export --platform android --output-dir <scratchpad>/export`
- If you run `expo prebuild` locally, delete `android/` afterwards and restore
  package.json scripts (prebuild rewrites them) — keep the `expo-intent-launcher` dep.

## Android lessons already learned (don't regress)
- NativeWind dark vars must be under `.dark:root` in `src/global.css`.
- Edge-to-edge: `KeyboardInsetView` pads the root for the keyboard.
- docx export: use `Packer.toBase64String` (no Node Buffer on device).
- expo-notifications needs typed triggers. Reminder sound = Android CHANNEL (immutable): one channel per sound (`reminder_v2_*`, `app_alerts_v2`); bundled sounds in `assets/sounds`; exact-alarm permissions in app.json.
- Reminders module (v3): `reminderPlanner.ts` (pure rules: main/early/nag/snooze, test with `node --experimental-strip-types`), `reminderService.ts` (DB ↔ alarms, resync on app start/foreground), `reminderNotifications.ts` (channels, settings intents), `reminderActions.ts` + `reminderBackgroundTask.ts` (snooze/done buttons work with app closed; task defined in root `index.ts`, which is package.json `main`). Screens: `reminders/index|add|health`.
- Picked files/photos: copy with `persistPickedFile` (cache can be cleared); open
  with `openFile` (ACTION_VIEW intent).
- Dialog buttons: `AlertDialogAction/Cancel` wrap labels in the themed Text.
- `plugins/withHighRefreshRate.js` requests the max display refresh rate.
- Release builds silence console.log/info/debug (`src/lib/debugLogStore.ts`).
- App Lock locks only on app open / back-exit / background timeout; PIN set first.

## SOP library
- Seeds in `assets/seed/`: `sop_index.json`, `sop_struct_1.json`, `sop_struct_2.json`,
  `sop_explain_1.json` (owner's files, byte-for-byte). Add future
  `sop_explain_<n>.json` files to the list in `src/ai/sopExplain.ts`.
- Tasks done: L29, L30A (structured viewer), L30B (checklist), L32 (समझें tab).
  Photos (`sop_images` table, "part 3") not supplied yet — the फोटो tab stays hidden.
