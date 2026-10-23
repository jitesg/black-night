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

## UP Police Regulations (L35)
- Sidecar `assets/reg/reg_index.json` (509 paras, 87 done after L38) and seeds
  `assets/seed/reg_seed_<n>.json` (owner's files, byte-for-byte; 1–3 = 109+47+109 rows). New seed files are
  picked up automatically (`require.context` in `src/lib/regulations/regSeedFiles.ts`).
- Pure helpers + tests: `src/lib/regulations/regCore.ts`,
  `node --experimental-strip-types --test scripts/test_regulations.ts`.
- Hub `knowledge/regulations.tsx?act=uppr|pocso` (one screen per Act, opened from its own card in the Law library like BNS/BNSS/BSA); reader `components/knowledge/RegulationViewer.tsx`
  (content_type 'regulation', own error boundary → LawDetail fallback);
  Copilot `src/ai/regLookup.ts` (REG_LOOKUP).
- L36 POCSO Act 2012: `assets/seed/pocso_seed.json` + `assets/reg/pocso_index.json` (byte-for-byte),
  same viewer/hub/REG_LOOKUP. Act from id prefix (`sys-reg-pocso-` → 'धारा', `actOfId` in regCore);
  POCSO order by `compareSectionNo` (42 < 42A < 43). Sensitive: list/search show title only, share
  adds 'गोपनीय' prefix, never log description text.
- L37A महिला संरक्षण कानून: `assets/reg/women_index.json` (124 rows, 5 Acts) + seeds
  `assets/seed/women_seed_<act>.json` (pwdva 38, posh 31, itpa 30, dowry 14, irwa 11 — L37B done;
  new files are picked up by the glob). Ids `sys-reg-<act>-<no>`, '0' = 'अधिनियम एक नज़र में'.
  Act metadata in `ACT_META`/`WOMEN_ACTS` (regCore). Law library has one "महिला कानून" card →
  `regulations?act=women` (5 Act cards) → `?act=pwdva` etc. Examples tab: numbered cards,
  'वास्तविक निर्णय' / 'काल्पनिक उदाहरण' badges + filter. Sensitive like POCSO (`isSensitiveId`).

## BNS संदर्भ (Delhi Police BNS Handbook)
- `assets/ref/bns_compare.json` (595 rows, 144 BNS text keys; in memory via `src/lib/bnsRef/bnsCompare.ts`,
  not SQLite), `assets/seed/bns_ref_seed.json` (10 rows, content_type 'bns_ref', seeded via
  `bnsRefSeed.ts` in the same pipeline; opened in RegulationViewer), `assets/law/law_map.json` = v2
  (adds IPC 309 → BNS 226). Pure finder + tests: `bnsCore.ts`, `scripts/test_bns_ref.ts`.
- Screen `knowledge/bns-ref.tsx` (card in Law library); Law list chip "BNS संदर्भ";
  Copilot appends handbook rows for "IPC n"/"BNS n" (not for REG_LOOKUP) and sends them as context.
- Handbook cog/bail flags are unverified vs the BNSS First Schedule (see owner's discrepancy report).

## न्यायिक निर्णय (पुलिस) — case notes (L39)
- Seeds `assets/seed/cases_seed_<n>.json` (glob in `regSeedFiles.ts`; 1–3 = 21+20+20 = 61 rows) + sidecar `assets/reg/cases_index.json` (61 paras, 18 chapters, part 'CASE', merged in
  `regIndex.ts`). Rows `sys-case-<slug>`, content_type 'case_note', act 'case' in regCore.
- Hub `knowledge/cases.tsx` (Law library card), pure helpers + tests `src/lib/cases/caseCore.ts`,
  `scripts/test_cases.ts`. Viewer: tab 2 parses ✔ / ✘ / sub-headings (`parseSimpleItems`), sticky
  header shows "# headline" + "(Case — citation)"; related cases chip heading "बाद के निर्णय".
- Copilot CASE_LOOKUP `src/ai/caseLookup.ts` (full party name, alias list, or a name word next to a
  "ruling" cue; "कौन सा फ़ैसला …"). Law list chip "न्यायिक निर्णय" (TYPE_CHIPS in list.tsx).
