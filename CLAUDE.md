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
- Edge-to-edge: `KeyboardInsetView` pads the root for the keyboard AND always by the bottom inset (screens stay above
  the navigation bar) — screens must not add `insets.bottom` again. Modals are separate windows: their outermost view
  pads by `NAV_BAR_INSET` (`src/lib/navBarInset.ts`).
- docx export: use `Packer.toBase64String` (no Node Buffer on device).
- expo-notifications needs typed triggers. Reminder sound = Android CHANNEL (immutable): one channel per sound (`reminder_v2_*`, `app_alerts_v2`); bundled sounds in `assets/sounds`; exact-alarm permissions in app.json.
- Reminders module (v3): `reminderPlanner.ts` (pure rules: main/early/nag/snooze, test with `node --experimental-strip-types`), `reminderService.ts` (DB ↔ alarms, resync on app start/foreground), `reminderNotifications.ts` (channels, settings intents), `reminderActions.ts` + `reminderBackgroundTask.ts` (snooze/done buttons work with app closed; task defined in root `index.ts`, which is package.json `main`). Screens: `reminders/index|add|health`.
- Picked files/photos: copy with `persistPickedFile` (cache can be cleared); open
  with `openFile` (ACTION_VIEW intent).
- Dialog buttons: `AlertDialogAction/Cancel` wrap labels in the themed Text.
- `plugins/withHighRefreshRate.js` requests the max display refresh rate.
- Release builds silence console.log/info/debug (`src/lib/debugLogStore.ts`).
- Report print layout (fixed A4): `src/lib/printLayout.ts` — `renderTextForPrint` (letters → one sheet per
  सेवा में letter; other text → `doc-plain` sheet: note/title/paras/signature), `LETTER_FIT_SCRIPT` shrinks
  each sheet to fit 297mm (min 10pt, owner's choice; longer text flows to a 2nd page); margins 0.5 inch (12.7mm) all sides; used by formats/fill and DocumentEditor print preview. Tests `scripts/test_print_layout.ts`.
- केस डायरी लंबित alert: rules `src/lib/caseDiaryGap.ts` (day 7 after the last diary / FIR date, 9 AM daily,
  15-day warning; tests `scripts/test_case_diary_gap.ts`), scheduler `caseDiaryGapService.ts` (cancel + reschedule
  `kind: cd_gap`; run from syncAppNotifications and after case diary / FIR changes via lazy import in the repos),
  tap → `/(app)/mukadma/<firId>/case-diary` (root `_layout.tsx`), setting `notifCaseDiaryGap`, badge in mukadma list.
- Home bell → `(app)/notifications.tsx` (सूचनाएँ): live cards from `src/lib/noticeCards.ts` (pure; केस डायरी लंबित,
  न्यायालय/प्रार्थना पत्र overdue or due in 3 days, reminders due today/missed; tests `scripts/test_notice_cards.ts`),
  data via `src/lib/db/noticeRepo.ts`; bell badge = `noticeBadgeCount`.
- न्यायालय / प्रार्थना पत्र phone alerts: plan `src/lib/deadlineAlerts.ts` (9 AM, 2/1/0 days before, High Court 5/3/1/0,
  then daily while overdue; text = the सूचनाएँ card at that time; tests `scripts/test_deadline_alerts.ts`),
  scheduler `deadlineAlertService.ts` (`kind: deadline`, data.route; settings notifCourtAlerts / notifDeadlines;
  resync from the repos' writes). Replaced the old English one-time court/petition alerts.
- App-icon badge `src/lib/appBadge.ts` (same count as the bell; scheduled alerts carry the projected count).
  Android `setBadgeCountAsync(0)` clears the whole tray — only called when nothing is showing.
- Search (owner's A B D F I): `src/lib/searchUtils.ts` — `searchNormalize` (NFD, nukta dropped, ँ→ं, Devanagari
  digits, punctuation), `matchesQuery`/`smartMatch` = every word anywhere (any order), `sqlWordFilter` = loose LIKE
  pre-filter (then refine in JS on the same fields), `buildHighlightSegments` per word. Repos (FIR, GD, नि0, न्यायालय,
  प्रार्थना पत्र, knowledge, halka, formats) use it; tests `scripts/test_search_utils.ts`. SearchBar: per-screen recent
  searches (`useRecentSearches`, key = route), instantSearch off → search on keyboard submit. Settings typoTolerance →
  `setSearchOptions` (store), highlightMatches → HighlightText. Home search: module chips, 5 per module + "सब देखें".
  Phase 2 (C E G H): Hinglish — English words (3+ letters) match Hindi by `soundKey` (consonant sound key; no SQL
  filter for them); suggestions while typing + "क्या आपका मतलब …?" (`src/lib/searchSuggest.ts` pure,
  `src/lib/db/searchSuggestRepo.ts` pool per route via `scopeForPath`; SearchBar prop `noResults`; setting
  smartSuggestions); FIR search includes accused + case diary text (`searchFirIdsByLinkedText` for the list),
  न्यायालय reports, प्रार्थना पत्र आख्या + कार्यवाही.
- Knowledge search = `src/lib/knowledgeSearchAll.ts` (`searchAllKnowledge`): knowledge entries + BNS/BNSS/BSA sections
  (`searchLaw`, section-like queries first) + फर्द + checklists + BNS संदर्भ rows; used by knowledge index and home.
  Law: `parseBareSectionNumber` ("धारा 103", "u/s 35(3)", १०३); Act screen filter understands it. bns-ref takes ?mode=&q=.
- Format layout marks (पहचान चिह्न): `src/lib/formatMarkers.ts` — line-start `[[पत्र]] [[शीर्षक]] [[सेवा में]] [[विषय]]
  [[पक्ष]] [[महोदय]] [[विवरण]] [[समापन]] [[गवाह]] [[संलग्नक]] (lines "item | signature") [[हस्ताक्षर]] [[बीच]] [[दाएँ]]
  [[दोनों ओर]] ("left | right")`. Marked text skips the guessing parser (splitIntoSubLetters / parseIntoDocumentModel
  delegate). `generateReport` strips marks unless `{ keepMarkers: true }` (only formats/fill print + editor pipeline);
  editor HTML keeps them as `data-fmt` → `editorHtmlToMarkedText` in the DocumentEditor print; NK save passes the
  marked editor HTML. Done: the 5 `sys-fmt-bnss126-*` formats (seed_version 7; beat + yaksh = 9 with the extra last sheet
  "सिपाही के लिए बीट सूचना"; originals in
  `docs/format-backups/bnss126_before_marks.json`). Owner approves each batch with an A4 preview. Tests
  `scripts/test_format_markers.ts`.
- Report → Word: `src/lib/reportDocxExport.ts` (`buildReportDocx` mirrors renderLetterHtml: page per letter, Kokila 16pt,
  0.5in margins, marks/data-fmt honoured; `exportReportToDocx` → share sheet). निरोधात्मक: card long-press menu + editor
  header button via `src/lib/nirodhatmak/karyvahiDocx.ts`.
- AI Copilot: no floating button any more. 🤖 header button — `CopilotHeaderBtn` auto-added by `AppHeader` on main
  modules (`isCopilotRoute`: mukadma/gd/nirodhatmak/nyayalay/prarthna-patra/knowledge, not add/edit/fill/select-format)
  and in `DashboardHeader` (home); opens via `src/lib/copilotStore.ts`; sheet mounted by `CopilotHost` (root layout,
  FIR layout with activeFirId).
- Text wrapper `src/lib/selectableText.tsx` (imported first in index.ts): selectable text app-wide (not inside
  Pressable/Touchables); on Android every Text gets textBreakStrategy 'simple' and lineHeight ≥ 1.4×fontSize
  (Hindi lines/matras were cut). Don't add per-screen workarounds for this.
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
- Hub `knowledge/cases.tsx` (card on top of the Court Judgment category list; moved out of the Law library), pure helpers + tests `src/lib/cases/caseCore.ts`,
  `scripts/test_cases.ts`. Viewer: tab 2 parses ✔ / ✘ / sub-headings (`parseSimpleItems`), sticky
  header shows "# headline" + "(Case — citation)"; related cases chip heading "बाद के निर्णय".
- Copilot CASE_LOOKUP `src/ai/caseLookup.ts` (full party name, alias list, or a name word next to a
  "ruling" cue; "कौन सा फ़ैसला …"). Law list chip "न्यायिक निर्णय" (TYPE_CHIPS in list.tsx).
