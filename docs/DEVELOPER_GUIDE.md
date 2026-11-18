# InvestSuite — Developer Guide

A hand-over guide for a developer or company taking over this code base. It explains **what the app is, how the code is
organised, how the main parts work, and how to change them safely**. For the full feature-by-feature history (owner's
decisions, Android pitfalls already fixed, every format change) see `CLAUDE.md` at the repo root — it is the detailed log;
this file is the map.

---

## 1. What this is

**InvestSuite** is an offline-first Android app for Uttar Pradesh police investigating officers (उपनिरीक्षक / निरीक्षक). The UI
is in Hindi. It keeps the officer's case work on the phone and writes the official papers for them:

| Module (Hindi) | What it holds |
|---|---|
| मुकदमा (FIR) | Cases, accused, केस डायरी (case diary "पर्चा"), investigation steps (कार्यवाही) with checklists |
| प्रार्थना पत्र | Complaints / petitions to enquire, with the आख्या (enquiry report) |
| न्यायालय | Court papers (NBW, summons, bail notices …) and the reports sent back |
| निरोधात्मक | Preventive action (BNSS 126/135/170 चालानी) |
| GD | General-diary entries |
| हल्का | Beat area register: villages, people, shops, institutions |
| ज्ञानकोष | Law (BNS / BNSS / BSA), SOPs, regulations, court judgments, checklists, guides |
| प्रारूप | ~60 predefined report formats (letters, notices, फर्द …) + officer-made formats |
| रिमाइंडर / सूचनाएँ | Reminders and an in-app notification centre with phone alerts |

Everything is stored **on the phone** (SQLite). Only two things talk to a server: the optional AI Copilot (officer's own
Gemini key, or a Supabase function) and the second app below.

**InvestSuite कार्यालय** (office app) is a second app built **from the same repo** for the police-station office (CM / HM): it
sends petitions / court papers to officers through Supabase; InvestSuite picks them up. See `docs/office-app/`.

---

## 2. Tech stack

- **Expo SDK 55**, **React Native 0.83** (new architecture, Hermes), TypeScript
- **expo-router** (file-based navigation), **NativeWind v4** (Tailwind classes) + a `THEME` token object
- **expo-sqlite** (database), expo-notifications, expo-background-task, react-native-webview (rich editor, A4 preview)
- `docx` (Word export), i18next (`assets/i18n/hi.json`, `en.json`)
- Office app: `@supabase/supabase-js` (anonymous auth + Row-Level Security)
- Package manager: **pnpm**. Node 22.

---

## 3. Getting started

```bash
pnpm install
npx expo start            # Metro; open in a development build (see below)
```

The app uses native modules that are **not in Expo Go**. To run it on a phone/emulator you need a development build
(`npx expo run:android` with the Android SDK installed) or the release APK from CI (section 10).

Useful checks (run them before every push — section 9):

```bash
npx tsc --noEmit -p .
npx eslint <changed files>
CI=1 npx expo export --platform android --output-dir /tmp/export   # proves the JS bundle builds
```

---

## 4. Repository layout

```
index.ts                 App entry (package.json "main"): registers background tasks, then expo-router
app.config.ts / app.json Expo config; APP_VARIANT=office switches name / package / icon for the office app
plugins/                 Expo config plugins (e.g. high refresh rate)
assets/
  seed/                  Data shipped with the app: formats, knowledge, SOPs, regulations … (JSON)
  i18n/hi.json, en.json  UI strings
  format-info/, law-notes/, format-images/, sounds/, law/, reg/, ref/
src/
  app/                   SCREENS (expo-router). (app)/<module>/… = InvestSuite, office/ = office app
  components/            Reusable UI. ui/ = inputs & primitives, common/ = shared widgets, <module>/ = module parts
  lib/                   LOGIC. Pure rule files (no React, no DB) + services
  lib/db/                DATABASE: schema.ts, database.ts (open + migrations), seedManager.ts, one *Repo.ts per table group
  ai/                    AI Copilot (context builders, lookups for law / SOP / regulations / cases)
  context/               React contexts (App lock, current FIR)
  office/                Office-app code (API, sync, its own UI kit)
scripts/
  test_*.ts              Unit tests for the pure rule files (node --test)
  hints/, *.py           One-off data tools (format hints, docx → JSON)
docs/
  format-backups/        The old version of every predefined format before it was changed
  office-app/            Office app plan + Supabase SQL
supabase/                Edge functions used by the AI Copilot (managed outside this repo)
.github/workflows/build-apk.yml   CI that builds the APK
```

---

## 5. Architecture

### 5.1 Screens and navigation
`src/app` is the route tree (expo-router). `src/app/_layout.tsx` is the root: it opens the database, runs the seed and
one-time migrations, starts notification syncing, and renders either InvestSuite (`(app)/…`) or the office app
(`IS_OFFICE`). Each module folder holds its list screen (`index.tsx`), add/edit (`add.tsx`), detail (`[id]/index.tsx`)
and flows (`select-format`, `fill-format`, `report` …). The header is `components/ui/ds/AppHeader.tsx`.

### 5.2 Data layer
- `src/lib/db/schema.ts` — `CREATE TABLE` statements.
- `src/lib/db/database.ts` — opens the DB; **new columns are added with `_ensureColumn(...)`** (idempotent, safe on old
  phones). Never edit an existing column in place; add a new one.
- `src/lib/db/*Repo.ts` — all SQL lives here; screens never write SQL. Soft delete (`deleted_at`) everywhere.
- Search: `src/lib/searchUtils.ts` (Hindi-aware normalising; a loose SQL pre-filter, then an exact check in JS).

### 5.3 Seed data
`assets/seed/*.json` is loaded by `src/lib/db/seedManager.ts`. Each row has a `seed_version`: on app update a row is
replaced when the bundled `seed_version` is higher. **When you change a seeded row (e.g. a format), bump its
`seed_version`**, otherwise phones keep the old copy. Rows removed from the seed are soft-deleted on phones.

### 5.4 Styling and theme
- Colours come from `THEME` (`src/lib/theme.ts`, light + dark) or NativeWind classes (`bg-card`, `text-foreground` …).
  Dark-mode variables live under `.dark:root` in `src/global.css`. Avoid hard-coded text colours on card backgrounds.
- Hindi text needs extra line height and careful wrapping on Android — `src/lib/selectableText.tsx` patches `Text`
  app-wide. Read the "Android lessons" part of `CLAUDE.md` before touching text, keyboards or modals.

### 5.5 Notifications
Rules are pure (`deadlineAlerts.ts`, `caseDiaryGap.ts`, `reminderPlanner.ts` …); `*Service.ts` files cancel and reschedule
phone alerts from them. The in-app bell list is built by `src/lib/noticeCards.ts`.

---

## 6. The format engine (the heart of the app)

Most of the value is in **predefined formats**: an officer fills a few boxes and gets a ready letter / notice / फर्द.

| Piece | Where |
|---|---|
| Format definitions (title, type, template text `vivran`, keys) | `assets/seed/formats_seed.json` |
| Fill screens | `src/app/(app)/formats/fill.tsx`, `prarthna-patra/fill-format.tsx`, `nyayalay/fill-format.tsx`, case-diary panel |
| One input per key (all field types) | `src/components/ui/input.tsx` (`FormatKeyInput`) + `PersonGroupInput`, `ItemGroupInput`, … |
| Template → text | `src/lib/templateEngine.ts` (`generateReport`) |
| Values worked out before rendering (dates, days, person cards, tidy-up) | `src/lib/formatDerived.ts` (`deriveFormatValues`) |
| Layout marks (`[[सेवा में]]`, `[[तालिका]]` …) → print / Word / editor | `src/lib/formatMarkers.ts`, `printLayout.ts`, `reportDocxExport.ts` |
| Rich editor (WebView) + A4 preview | `src/components/common/DocumentEditor.tsx` |

**Template tokens** (in `vivran`): `{{Key}}`, `{{if:Key|text}}` / `{{ifnot:…}}`, `{{if:Key=value|…}}`, person-group
tokens `{{Key#list}}` / `#inline` / `#name` …, item-group tokens `{{each:…}}` / `{{count:…}}` / `{{sum:…}}`, sequence
words `{{seq|…}}`. The exact grammar is documented next to each step in `templateEngine.ts` and in `CLAUDE.md`.

**Key options** live in a key's `dropdown_options` JSON, e.g. `hint` (the "ⓘ कैसे भरें?" tip), `placeholder`, `showIf`
(show only when another answer matches), `options` (dropdown), `expand` (person card → old keys), `oneLine`,
`court` / `sewa` (name suggestions), `withDistrict`, `daysFrom` / `daysTo`.

### How to change or add a predefined format
1. Copy the current version of the format into `docs/format-backups/<name>_before_<change>.json`.
2. Edit it in `assets/seed/formats_seed.json` (keep the file's formatting: `json.dumps(..., ensure_ascii=False, indent=2)`).
3. Give every new key a `hint`; never name a key `State` / `District` / `PoliceStation` / `OfficerName` unless it really
   is that workspace setting (those are filled from settings automatically).
4. **Bump `seed_version`** of the format.
5. Add / extend a test in `scripts/test_*.ts` that renders the format with sample values.
6. Run the checks in section 9.

---

## 7. Conventions

- **Rules in pure files, with tests.** Anything that decides something (a wording rule, a ranking, a date rule) goes into a
  small file in `src/lib/` with no React and no DB, and gets a `scripts/test_<name>.ts`. Screens only wire it up.
- **One shared component per pattern.** Search + filter (`components/common/FilterSheet.tsx`), the rich editor,
  person cards, the "प्रारूप चुनें" helpers (`components/formats/FormatPickExtras.tsx`) … reuse them instead of copying.
- **Comments say why.** Each new block starts with a short comment: what it does and which owner request it serves.
- **Strings** go in `assets/i18n/hi.json` (see "Known gaps" — some older screens still have Hindi literals in code).
- **Lists with a search box** must set `keyboardShouldPersistTaps="handled"` (otherwise the first tap only closes the
  keyboard).
- **Modals / sheets** pad the bottom by `NAV_BAR_INSET`; screens must not add the bottom inset again.
- Commit messages: one clear line of what changed and why.

---

## 8. Testing

Unit tests are plain Node tests on the pure rule files:

```bash
# one file
node --experimental-strip-types --test scripts/test_format_derived.ts
# all of them
for f in scripts/test_*.ts; do node --experimental-strip-types --test "$f" || echo "FAILED: $f"; done
```

Some tests import files that use path aliases or Expo-only modules; those tests register a tiny module-resolve hook at
the top (copy it from `scripts/test_template_adi.ts`). There are no UI / end-to-end tests yet — check screens on a phone.

---

## 9. Checks before every push

1. `npx tsc --noEmit -p .` (no new errors in the files you touched)
2. `npx eslint <changed files>` (no errors)
3. The related `scripts/test_*.ts` pass
4. `CI=1 npx expo export --platform android --output-dir /tmp/export` succeeds

If you run `npx expo prebuild` locally, delete the generated `android/` folder afterwards and restore the
`package.json` scripts it rewrites.

---

## 10. Building and releasing

- APKs are built only in CI: `.github/workflows/build-apk.yml` (run it from the Actions tab, "Run workflow").
  Inputs: `abis` (`arm64-v8a` by default; add `armeabi-v7a` for old 32-bit phones) and `variant`
  (`investsuite` or `office`).
- The workflow runs `expo prebuild`, builds the release APK and attaches it to a GitHub release `apk-build-<run number>`
  (`InvestSuite.apk` / `InvestSuite-Karyalay.apk`).
- Release builds silence `console.log` (`src/lib/debugLogStore.ts`).

---

## 11. Security notes

- Case data never leaves the phone except what the officer exports / shares himself.
- App lock (PIN) — `src/context/AppLockContext.tsx`.
- AI Copilot: the officer's Gemini key is kept in on-device storage only; cloud use is behind a setting.
- Office app: only the Supabase **publishable** key is in the code (`src/office/config.ts`); data access is protected by
  Row-Level Security (`docs/office-app/sql/`). Never commit a Supabase secret / service-role key or DB password.
- WebViews are locked to local content (`src/lib/webviewSafety.ts`); dynamic SQL column names go through
  `src/lib/db/sqlIdent.ts`.

---

## 12. Known gaps / technical debt

Honest list of what a new team should know:

1. `CLAUDE.md` is a long Hindi/English working log, not structured documentation — use this guide first.
2. Some screens still come from the original MeDo AI-builder export: large files (e.g. `components/ui/input.tsx`),
   occasional hard-coded colours and English strings.
3. Tests do not yet run automatically on every push (only the APK build runs in CI).
4. Keep `en.json` in step with `hi.json` (same keys, same `{{placeholders}}`; checked complete on 18/11/2026).
5. A few hidden leftovers of removed features remain: `FirPeopleButton` / `FirPeopleContext` (no longer rendered; still wired in the
   fill screens and the case-diary panel) and the unused `PPPeopleButton` component (its context is still used). The old `ocr.*` strings
   were removed.
6. Many screens still have Hindi text written directly in the components (~1,300 places incl. data lists) instead of i18n keys, so the
   English mode is partly Hindi. Being moved to `hi.json` / `en.json` module by module.
7. No UI / end-to-end tests.

---

## 13. Where to look next

- `CLAUDE.md` — every feature, owner decision and Android lesson, with file names (search it for a feature's name).
- `docs/office-app/` — office app plan and Supabase setup.
- `docs/format-backups/` — previous version of each changed format.
- `scripts/test_*.ts` — executable examples of how each rule behaves.
