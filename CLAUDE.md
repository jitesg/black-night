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
  each sheet to fit 297mm (min 10pt, owner's choice; longer text flows to a 2nd page; no Kokila (phones) → line-height 1.5); margins 0.5 inch (12.7mm) all sides; used by formats/fill and DocumentEditor print preview. Tests `scripts/test_print_layout.ts`.
- केस डायरी लंबित alert: rules `src/lib/caseDiaryGap.ts` (day 7 after the last diary / FIR date, 9 AM daily,
  15-day warning; tests `scripts/test_case_diary_gap.ts`), scheduler `caseDiaryGapService.ts` (cancel + reschedule
  `kind: cd_gap`; run from syncAppNotifications and after case diary / FIR changes via lazy import in the repos),
  tap → `/(app)/mukadma/<firId>/case-diary` (root `_layout.tsx`), setting `notifCaseDiaryGap`, badge in mukadma list.
- Home bell → `(app)/notifications.tsx` (सूचनाएँ): cards `components/notifications/NoticeItem.tsx` (icon tile, title + time, body, extras: progress / meta / action from the card) built live from `src/lib/noticeCards.ts` (pure; केस डायरी लंबित,
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
- Search speed (owner): `matchNormalized` builds Hinglish sound keys only for English-letter words (Hindi queries were paying ~400 ms
  for them); knowledge search reads `getKnowledgeListForSearch()` (in-memory copy, re-read only when a cheap signature — row count,
  max updated_at, searched-text length, hidden ids — changes; skipped while SQLite `total_changes()` + `PRAGMA data_version` are unchanged;
  never sort it in place); `warmKnowledgeSearch()` runs on the first focus of the home / ज्ञानकोष search box (NOT at app start — that made the
  phone slow, owner) and only normalises (no sound keys), batches of 10; home `universalSearch` ignores stale results (`searchSeqRef`); indexes
  fir_accused(fir_id), case_diary_karyvahi(diary_id) in `_ensureIndexes`.
- Knowledge search = `src/lib/knowledgeSearchAll.ts` (`searchAllKnowledge`): knowledge entries + BNS/BNSS/BSA sections
  (`searchLaw`, section-like queries first) + फर्द + checklists + BNS संदर्भ rows; used by knowledge index and home.
  Law: `parseBareSectionNumber` ("धारा 103", "u/s 35(3)", १०३); Act screen filter understands it. bns-ref takes ?mode=&q=.
- Format layout marks (पहचान चिह्न): `src/lib/formatMarkers.ts` — line-start `[[पत्र]] [[शीर्षक]] [[सेवा में]] [[विषय]]
  [[पक्ष]] [[महोदय]] [[विवरण]] [[समापन]] [[गवाह]] [[संलग्नक]] (lines "item | signature") [[हस्ताक्षर]] [[बीच]] [[दाएँ]]
  [[दोनों ओर]] ("left | right") [[सूची]] (lines one per line, left, no indent; bodyBlock kind 'line')`. `[[तालिका]] a | b | c` = bordered table (one row per line, first row bold heading, data cells 60mm tall like the paper form — `(12mm)` before the first row changes it, `# …` = another heading row, a row without `|` spans the width; `parseTableBlock`; blank line ends it; bodyBlock kind 'table'; print/Word/editor round trip). Table extras: `[8/27/65]` after/before `(Nmm)` on the first row = column widths in %, `⏎` inside a cell = line break (print/Word/editor; editor <br> in a cell ↔ ⏎). `[[चित्र]] <name>` = picture (registry `src/lib/formatImages.ts` + generated base64 `formatImagesData.ts` via `scripts/gen_format_images.py`, PNGs in `assets/format-images/`; centred, fits text width × 175mm; Word via ImageRun + `base64ToBytes`; editor `<img data-fmt alt=name>`; dropped from plain text). Pictures: `फोटो-लाश-पुरुष`, `फोटो-लाश-महिला` (owner's drawings; chosen by मृतक/मृतका). A body paragraph right after a
  [[दाएँ]] line gets one blank line gap (प्रतिलिपि). Marked text skips the guessing parser (splitIntoSubLetters / parseIntoDocumentModel
  delegate). `generateReport` strips marks unless `{ keepMarkers: true }` (only formats/fill print + editor pipeline);
  editor HTML keeps them as `data-fmt` → `editorHtmlToMarkedText` in the DocumentEditor print; party lines "प्रथम/द्वितीय पक्ष" alone and "( बनाम- … )" are centred, bold, underlined (`isPartyHeading`); NK save passes the
  marked editor HTML. Done: the 5 `sys-fmt-bnss126-*` formats (seed_version 7; thanabhraman 9; beat + yaksh = 10 with the extra last sheet
  "सिपाही के लिए बीट सूचना"; originals in
  `docs/format-backups/bnss126_before_marks.json`). Owner approves each batch with an A4 preview. Tests
  `scripts/test_format_markers.ts`.
- 126/135 formats: "धारा 126/135 बीएनएस में चालानी" → "बीएनएसएस" in all six (owner; seed_version +1: beat/yaksh/mukadma 16, thanabhraman 15, ncr 13, prarthna 3).
  ग्राम line fix (owner; seed_version +1 again: beat/yaksh/mukadma 17, thanabhraman 16, ncr 14, prarthna 4): "के मध्य" is in the format text
  (before every {{Matter}}; "विवाद का कारण" defaults no longer start with "मध्य"), " ।" after every {{Matter}}, "{{secondparty}} के" added,
  "{{FirstParty}} के" (was की), "जांचक्रम में ग्राम {{village}}", village label "गाँव का नाम" + placeholder "जैसे: अघौरा (ग्राम न लिखें)",
  द्वित्तीय → द्वितीय, दिनांकदिनांक, double spaces. templateEngine `tidyRepeats` (end of generateReport, all formats): "ग्राम ग्राम" → "ग्राम",
  "मध्य मध्य" → "मध्य", "का का" → "का", "। ।" / "।।" → "।".
- Field hints (owner): `{"hint": "…"}` in a key's dropdown_options → a small blue "ⓘ भरने का तरीका जानें" button ABOVE the field; tap → floating
  box (Modal, measureInWindow, opens upwards near the bottom, 17px text, ✕ / tap outside closes) (`keyHint` / `FieldHint` in input.tsx;
  FormatKeyInput wraps every type; formats/fill + prarthna-patra fill-format put it above Person/AccusedGroupInput; never printed; a dropdown's
  list goes under "options"). Owner wanted it on every predefined format (58 formats / 982 fields) — done batch by batch with samples. Tool: `python3 scripts/hints/apply_hints.py <batch>`
  (batch modules in scripts/hints/: `wants(f)` + `hint(f, k)`, shared `common.py`; only fields without a hint, seed_version +1). A "sentence" field
  keeps its tip under "tip" (its "hint" is the card prompt; `keyHint(raw, fieldType)`). Done: GD (all 8 formats, 156 fields), फर्द (4 formats, 105 fields), केस डायरी + Narrative (15 formats, 237 fields), न्यायालय + प्रार्थना पत्र (12 formats, 232 fields). बाकी 6 "Any" formats (82 fields) too → ALL predefined format fields now have a hint (new fields: add one). Every field of the 6 bnss126 + 7 bnss170 formats has one (seed_version +1 each). 170 fixes too: " ।" after every
  {{Matter}} / {{Advice}}; kshetra-ek "{{Accused#inline}} का {{Matter}}" (default no longer starts with "का"); prarthna-ubhay
  "{{Matter}} । इस पर मुझ…" (was ", जिस पर"); Facts label without "(आखिर में । न लगाएँ)"; village placeholder.
  The two धारा 135(3) report letters have no संलग्नक block (owner) — signature moved to [[हस्ताक्षर]]
  (beat/yaksh 15, thanabhraman 14, mukadma 13, ncr 12, prarthna 2). The 170 formats' 135(3) letters never had one.
- Person/accused groups (`templateEngine.generateReport`): ONE person → no "आदि" right after `{{g.1.name}}`
  (`_dropAdiForSingleEntry`, Step 0.5) and address word "निवासी" (not नि0/नि0गण); 2+ people unchanged (numbering 1. 2.,
  नि0गण). `{{Key#list}}` = one person per line (shared address → "नि0गण <addr>" after the last name, else
  "निवासी <addr>" on each; one person also "1." — owner's choice), `{{Key#num}}` = usual prose but one person "1."
  (126/135 bodies). New tokens for the 170 BNSS formats: `#block` (shared address on its own line "निवासीगण …"),
  `#inline`, `#short` (name + father only, before "उपरोक्त"), `#count` (एक/दो/तीन…), `#n|one|many` — used under वादी and in the धारा 130 notices of the five 126/135
  formats (`[[सूची]] {{…#list}}`). Last sheet "चालानी का GD प्रारूप" in all five (beat/yaksh: below the सिपाही
  note on the same sheet; others a new sheet; opening line per format) — seed_version beat/yaksh 13, thanabhraman 12, mukadma/ncr 10. Tests `scripts/test_template_adi.ts`.
- Accused wanted status (judicial custody report): tokens `{{Key#summary}}` (groups नामजद / प्रकाश में आया / वांछित नहीं
  with है/हैं, आया/आये agreement, joined by "तथा"; नामजद = "मुकदमा उपरोक्त में … नामजद है तथा वांछित है", the others start once with
  "अब तक की तमामी विवेचना व साक्ष्य संकलन की कार्यवाही में" — owner's wording), `{{Key#wanted}}`, `{{Key#ifWanted|text}}` (`_applyGroupStatus`, Step -1);
  AccusedGroupInput shows the per-accused "स्थिति" picker only when the format text contains `{{Key#` (unset =
  प्रकाश में आया). Tests `scripts/test_accused_status.ts`. Used by format `sys-fmt-nyayik-abhiraksha`
  "आत्मसमर्पण प्रा0पत्र पर आख्या (न्यायिक अभिरक्षा)" (Nyayalay, seed_version 2).
- 170/126/135 BNSS चालानी (गिरफ्तारी) — 7 formats `sys-fmt-bnss170-{mukadma,prv,prv-ubhay,prarthna,prarthna-ubhay,kshetra-ek,kshetra}`
  (BNSS Karyavahi, seed_version 1; built from the owner's sample letters, words corrected). एकपक्षीय = 170 letter + 135(3);
  उभयपक्षीय = 170 बनाम प्रथम पक्ष, 170 बनाम द्वितीय पक्ष, 135(3) × 2 (same body). Accused list `#block`, body `#inline` then
  `#short` + "उपरोक्त", "( बनाम- … )" centred/bold/underlined, checkbox `Remand` → bold 14 दिवस रिमांड निवेदन in the 170
  letter. Tests in `scripts/test_template_adi.ts`.
- `sys-fmt-samanya-patra` "सामान्य पत्र (किसी को भी)" (type Any): सेवा में (multiline), विषय, मज़मून (blank line = new
  para), closing, optional संलग्नक / दिनांक via `{{if:…}}`, signature right.
- `sys-fmt-vahan-flag` "चोरी वाहन को पोर्टल पर फ्लैग कराने हेतु पत्र (RTO)" (type Any; संलग्नक आर0सी0 + FIR copies).
- `sys-fmt-pp-fir-sanstuti` "प्रार्थना पत्र जांच — मुकदमा पंजीकृत करने की संस्तुति" (type Prarthna Patra).
- Field type "item_group" = rows with format-defined columns (`src/components/ui/ItemGroupInput.tsx`, config in key
  dropdown_options `{"columns":[{key,label,type:text|choice|check,options,default}],"addLabel"}`; validation: one row typed).
  Template tokens `{{each:Key?flag|row|sep}}` ({#}, {col}, {text~col}), `{{count:Key?flag|one|many}}`, `{{any:Key?flag|text}}`
  (`_applyItemTokens`, Step -3); also `{{none:Key?flag|text}}`, `{{sum:Key?flag|col}}` / `{{sum:…|col|00}}` (adds the column's numbers) and
  in an each-row `{?col|yes|no}` (per-row tick → word, e.g. अभियुक्त / अभियुक्ता; applied after the columns, so yes / no may hold {col} / {text~col}; `_closeSingle` keeps nested single braces together). Used by `sys-fmt-rto-dl-rc` "दुर्घटना — DL / RC की प्रमाणित प्रति हेतु पत्र (RTO)" (vehicles:
  भूमिका दुर्घटनाकारक/दुर्घटनाग्रस्त, driver, DL, ticks needDL/needRC → DL letter and/or RC letter; 1 row = owner wording).
- GD `sys-gd-fmt-wapsi` "वापसी उ0नि0 / तस्करा (हैडिंग सहित)" (seed_version 4, owner): heading line + content. doWapsi tick (default on) →
  "वापसी उ0नि0 व …" + the old वापसी body; off → "तस्करा बावत …" + "इस समय मुझ … द्वारा तस्करा अंकित किया जाता है कि –". 9 heading ticks
  h1–h9 (126/135 चालानी, 170/135 + नफर, वाहन, धारा घटोत्तरी/बढ़ोत्तरी, गिरफ्तारशुदा दाखिला, अवमुक्त, प्रकाश में, नामजदगी गलत), each with
  its fields (showIf) and its own content paragraph; heading parts joined by `{{seq:h|…| व }}` (named counter, separate from the body's
  सर्वप्रथम/तत्पश्चात); counts are 01–08 dropdowns (01 = singular); each tick has an optional `hNExtra` box appended to its
  paragraph, with a grey example (`{"placeholder":"जैसे: …"}` in dropdown_options → `keyPlaceholder` in input.tsx; never printed; also on the मु0अ0सं0 / धारा / नाम boxes) (seed_version 8). अग्रिम विवेचना धारा is worked out, not typed: `{{dhara+:h5Sec|h5Dhara|before|after}}` (पूर्व + नई) /
  `{{dhara-:h4Sec|h4Dhara|…}}` (पूर्व − हटाई) via `src/lib/dharaMath.ts` (same Act suffix → one list; unsure → sentence left out). Backup `docs/format-backups/gd_wapsi_v2_before_heading.json`.
- (older) वापसी उ0नि0 v2 (seed_version 3): pad dropdown, OfficerName universal, optional हमराह via `{{if:}}` (रवानगी रपट नं0 /
  रवानगी समय / वापसी समय removed — owner),
  one checkbox per activity (do*) → its paragraph; order words by `{{seq|सर्वप्रथम|तत्पश्चात…|वहाँ से…|…}}` (`_applySeqTokens`, after if);
  विवेचना paragraph has FIRNo/Sections fields. Old v1 in `docs/format-backups/gd_wapsi_v1.json`.
- GD `sys-gd-fmt-taskara` "तस्करा — पूछताछ / सुपुर्दगी" (replaced 5 old taskara formats; backup docs/format-backups/taskara_old_removed.json):
  dropdowns Stage (बैठाया / सुपुर्दगी) × Reason (मुकदमा / प्रार्थना पत्र / PRV / अन्य) → `{{if:Key=value|…}}`; fields shown only when
  needed via showIf; सुपुर्दगी: GiveMode one receiver (relation incl. दोस्त/पड़ोसी/गाँव के व्यक्ति) or item_group `Givers` per person.
- GD `sys-gd-fmt-abhiyukt-dakhila` "तस्करा / वापसी — अभियुक्त दाखिला": Mode (दूसरे अधिकारी लाये / मैं वापसी / थाने पर ही)
  × CaseType (मुकदमा / 170 BNSS चालानी) → heading line + opening; standard जामा तलाशी/जरावात/खाना/हवालात/ताला text, optional
  बरामदगी, चोट, हवालात मर्दाना/महिला, हुलिया item_group (`{text~col~after}`), free "विवरण गिरफ्तारी", सूचना की/के by relation;
  `{{Key#cnt}}` = 01/03 नफर.
- Field type "sentence" (card + coloured blanks, owner's idea): `src/lib/sentenceField.ts` (pure: config `{hint,cards:[{id,icon,label,text}],
  slots:{name:{label,title,type text|multiline|choice|date,default ("today"),optional,before,after,showIf,whenHidden,remember}},extraLabel}`,
  card text = template text with blanks `<<name>>` — never inside a {{…}} token), value JSON `{card,s,extra}` (old plain text used as is);
  templateEngine Step -4 `_applySentenceFields` (needs keyDefs with dropdown_options); UI `components/ui/SentenceFieldInput.tsx`
  (cards grid → chip row; yellow = to fill, green = filled, blue = choice; sheet with आज/कल and "पिछली बार लिखा" from localStorage);
  fill screens pass `allValues`/`allKeys` to FormatKeyInput for the preview. Used by अभियुक्त दाखिला `ArrestDetail` (8 cards, seed_version 3). No "GD का समय" field in GD formats (owner removed it).
- GD `sys-gd-fmt-vivechana-parivartan` "तस्करा — विवेचना में परिवर्तन (धारा / नाम)": optional वापसी opening (doWapsi, हमराह,
  शस्त्र मालखाना tick) + 4 ticks धारा बढ़ोत्तरी / घटोत्तरी / नाम प्रकाश में / नामजदगी गलत (each opens its fields); heading parts
  joined with "व" by `{{seq||व }}`; अग्रिम विवेचना धारा / बनाम optional.
- GD `sys-gd-fmt-vahan-dakhila` "वापसी व दाखिला वाहन": item_group Vehicles (भूमिका, प्रकार, संख्या, चेचिस, इंजन), `{{cnt:Vehicles?vno|}}`
  = 01/02 अदद, वाहन को/वाहनों को, खड़ा/खड़े कराये गये.
- GD `sys-gd-fmt-aaropi-avmukt` "तस्करा — आरोपी अवमुक्त (धारा 480(2) BNSS)": आरोपी list, गिरफ्तारी तिथि/आधार, नये तथ्य, अवकाश tick.
- `sys-fmt-medical-patra` "मेडिकल प्रपत्र / एक्स-रे / सप्लीमेंटरी / DNA हेतु पत्र (अस्पताल)" (type Any): Type dropdown (BHT / एक्स-रे
  [+ CT, देरी ticks] / सप्लीमेंटरी / DNA), Role (मजरूब… → plural मजरूबगण/अभियुक्तगण), item_group Persons (name, addr, age, MLC, CR).
- `sys-fmt-postmortem-33` "पोस्टमार्टम हेतु शव भेजने के कागज़ (RI पत्र, CMO पत्र, फार्म 33, नमूना सील)" (type Any, from the owner's
  फार्म 33 docx): 6 sheets — RI letter, CMO letter, फार्म संख्या-33 cover (RI signs; PM no. blank), फोटो लाश (form 379; picture by
  Gender मृतक/मृतका), नमूना सील (blank space, signature low), पुलिस फार्म 33 = two `[[तालिका]]` tables (5 + 4 columns) on one sheet.
- `sys-fmt-avkash-patra` "अवकाश प्रार्थना पत्र (आरक्षी / मुख्य आरक्षी / उ0नि0)" (type Any, owner's docx): `[[सूची]]` lines with
  blank (zero-width) lines between, संस्तुति table `(14mm)` + `#` heading + full-width note row, CO / थाना प्रभारी signature low; no प्रार्थी block (owner).
- `sys-fmt-vehicle-technical-inspection` "वाहन तकनीकी निरीक्षण रिपोर्ट हेतु आवेदन" v3 (type Prarthna Patra — owner moved it from Nyayalay):
  to प्रतिसार निरीक्षक; item_group Vehicles (role दुर्घटनाकारक/दुर्घटनाग्रस्त/सम्बन्धित, vtype, vno) — 1 vehicle inline, 2+ = "02 वाहनों" + [[सूची]];
  VehiclePlace (खड़ा/खड़े), optional Mobile. Old v2 in `docs/format-backups/vehicle_technical_inspection_v2.json`.
- `sys-fmt-vehicle-release` "वाहन अवमुक्त कराये जाने हेतु आख्या (दुर्घटनाकारक / दुर्घटनाग्रस्त / बरामदशुदा / सीजशुदा)" v3 (Nyayalay):
  item_group Vehicles (role 5 options, vtype, vno — no chassis/engine, owner), KeptAt, Tech dropdown (हो चुका है / नहीं हुआ है /
  आवश्यकता नहीं; no date), Objection (कोई आपत्ति नहीं / आपत्ति है + ObjReason via showIf); no प्रार्थी line (owner). Old v2 in
  `docs/format-backups/vehicle_release_v2.json`.
- `sys-fmt-victim-age-certificate` "आयु प्रमाण-पत्र हेतु विद्यालय को पत्र (पीड़ित / अभियुक्त / बाल अपचारी / अन्य)" v3 (type Prarthna Patra,
  owner moved it): Role (पीड़ित/अभियुक्त/बाल अपचारी/वादी/गवाह/व्यक्ति) × Gender (लड़का/लड़की → पीड़िता, अभियुक्ता, वादिनी, छात्र/छात्रा),
  Head प्रधानाध्यापक/प्रधानाचार्य, optional age / सत्र / कक्षा (sentence shortens), JJ Act 2015 धारा 94 line. Old v2 in docs/format-backups/.
- Fields that appear only when needed (option values must not contain "/" — it means "or"): `{"showIf":"Key=A/B & doX & !doY"}` in a key's dropdown_options (dropdown list under
  "options"); `src/lib/formatShowIf.ts` (`isKeyVisible`), used by the 3 fill screens + the केस डायरी कार्यवाही panel + validation (hidden = not required).
- प्रार्थना पत्र report screen (`prarthna-patra/[ppId]/report.tsx`): every type except बीट सूचना / NCR (those = take-action) uses the inline flow
  (full petition details, "रिपोर्ट लगाएं", "प्रारूप से जोड़ें") — `REPORT_PETITION_TYPES` now also has थाना प्रार्थना पत्र / RTI / अन्य (owner);
  an old HTML report is turned into plain text for the inline box.
- `sys-fmt-pp-janta-darshan-aakhya` "जनता दर्शन / शिकायत प्रकोष्ठ प्रार्थना पत्र — जांच आख्या (14 बिन्दु)" (Prarthna Patra, owner's docx):
  bold header lines via `**…**` in [[सूची]] (supported in list lines too), optional गवाह / Lat / Long, doNoAction tick, बिन्दु ticks
  p1–p11 each opening `pNText` (showIf) → "✓ – विवरण" in the printed list. Owner's file has 11 points under a "14 बिन्दु" heading.
- Field type "multi_choice" = checklist with several ticks (`FormatKeyMultiChoiceInput` in input.tsx; options like a dropdown
  in dropdown_options, {value,label}; value = ticked values in option order joined by ", " — `src/lib/multiChoice.ts`, tests
  `scripts/test_multi_choice.ts`). Used by `Vivad` "विवाद का प्रकार" (the 16 सामान्य कारण of SOP शारीरिक क्षति) in the
  प्रार्थना पत्र जांच formats → bold line "**विवाद का प्रकार – …**" (जनता दर्शन seed_version 2).
- `sys-fmt-bail-notice-aakhya` "बेल नोटिस आख्या (19 बिन्दु)" (Nyayalay, owner's scanned form): header [[सूची]] lines + one
  `[[तालिका]] (6mm) [7/30/63]` table, sub-points joined by ⏎; dropdowns AccStatus / Notice353 / CSStatus open their boxes; 10 group
  ticks (gDeath, gRecovery, gFsl, gDying, gInjury, gPocso, gScst, gWomen, gGang, gNdps) — unticked → "लागू नहीं।"; नोट line dots when blank.
- `sys-fmt-pp-jaanch-aakhya` "प्रार्थना पत्र जांच आख्या (पुलिस अधीक्षक / जिलाधिकारी / क्षेत्राधिकारी / थानाध्यक्ष)" (owner's RL docx files):
  To dropdown → सेवा में lines (Circle / ToOther via showIf), Avedak आवेदक/आवेदिका, doParties tick → bold [[पक्ष]] lines
  "1. आवेदक… 2. विपक्षी…" (noVip → निल), Vivad, Witness, Findings, doNoAction; left [[सूची]] दिनांक / अक्षांश / देशान्तर (each optional)
  above the [[हस्ताक्षर]] (optional मो0नं0). `sys-fmt-pp-samadhan-diwas` "समाधान दिवस प्रार्थना पत्र — जांच आख्या": bold-label
  [[सूची]] header (संदर्भ संख्या optional, तहसील, आवेदक, प्रतिपक्षी/निल, विवाद का कारण, विवाद का प्रकार, जाँचकर्ता, मो0, lat/long) +
  "( जांच का विवरण ) –" paragraph.
- `sys-fmt-notice-35-3-bnss` "धारा 35(3) BNSS — पुलिस द्वारा उपस्थिति के लिये नोटिस (पावती सहित)" (Case Diary, owner's docx; FIRNo/Sections
  default @FIR.*): one justified bold-label header paragraph, notice para (appear date/time bold), 10 शर्तें [[सूची]] (10th = OtherCond or
  "कोई नहीं।"), [[दाएँ]] officer block, पावती, [[दोनों ओर]] signatures; blank optional fields → ".........."; spacing by zero-width
  [[सूची]] lines (3 before the officer block, 1 before पावती, 3 before the last signature line — owner).
- `sys-fmt-bayan-183-patra` "पीड़िता — 183 BNSS बयान (दर्ज कराने व अवलोकन) तथा CWC सुपुर्दगी पत्र (तीनों एक साथ)" (Case Diary, owner's docx +
  text): ticks doL1/doL2/doL3 (default all on) → up to 3 letters (one sheet each); Law बीएनएसएस/सीआरपीसी → 183/180 or 164/161; Rel पुत्र →
  पीड़ित/निवासी else पीड़िता/निवासिनी; CWC letter: Minor, optional Receiver (one person: माता / पिता / रिश्तेदार + RecvRelation / केयर टेकर)
  → custody paragraph + [[संलग्नक]] (3 items) with the signature; fixed subject "…सर्वोत्तम हित एवं कल्याण… सुपुर्दगी आदेश…" (owner).
- Format type "Fard" (फर्द, owner): FormatType union, every FORMAT_TYPES list, SYS_CATEGORIES, colours (brown #92400E / #FBBF24),
  i18n format.type.fard, moduleLabel → फर्द. NK / प्रार्थना पत्र pickers still load only 'BNSS Karyavahi'.
- 60(1) फर्द v6 (owner, the फर्द steps): one paragraph per step — 1 मौजूदगी, 2 मुखबिर की सूचना, 3 चल देना, 4 स्थान पर आना, 5 पहचान,
  6 पकड़ना, 7 नाम पता, 8 जामा तलाशी, 9 लाइसेन्स तलब, 10 गिरफ्तारी, 11 सूचना, अंत; field labels start with the step number. New keys:
  `JamaTalashi` (item_group, startEmpty: by / who = type 'ref' → Accused names as chips / how = multiline, endWith "।") → "अभियुक्त(ा) X की
  जामा तलाशी Y द्वारा ली गयी तो …", none → the old plain line; `ArrestPahar` (dropdown समय से/सुबह/दिन/शाम/रात, paharFrom ArrestTime;
  hint "अपने आप: रात (समय 21.30 से)") → "… बजे रात में"; रात → "टार्च की रोशनी में" in steps 5 and 6. Engine: `src/lib/formatDerived.ts`
  (`deriveFormatValues` first thing in generateReport; tests `scripts/test_format_derived.ts`). Times are 24-hour. v5 in docs/format-backups/.
- `sys-fmt-fard-60-1-daru` "60(1) आबकारी अधिनियम फर्द बरामदगी व गिरफ्तारी (एक या अधिक अभियुक्त / अभियुक्ता)" v6 (type Fard — was BNSS Karyavahi, owner's docx) —
  **the base pattern for all future फर्द (owner)**: item_group `Accused` (name, rel, father, addr, age, mahila tick, cqty, ctype, litre,
  carry = choice हाथ / पैंट-लोअर-जीन्स की दाहिनी-बायीं जेब / शर्ट / पीछे की जेब / बगल, inform); one man / one woman / many wording via
  `{{count:…|{{any:…?mahila|F}}{{none:…?mahila|M}}|MANY}}`; heading containers `{{each}}` + `{{sum:Accused|litre}}`; per-row
  `{?mahila|अभियुक्ता|अभियुक्त}`; LadyConstable used when any row is महिला; opening "थाना हाजा से रवाना होकर देखभाल क्षेत्र, रोकथाम
  जुर्म जरायम… में मामूर", witness search + आपस में जामा तलाशी lines (owner). Old v3 in `docs/format-backups/fard_60_1_daru_v3.json`.
- `sys-fmt-fard-peedita-baramadgi` "फर्द बरामदगी पीड़िता / पीड़ित (मुकदमा सम्बन्धित — मुखबिर की सूचना पर)" (type Fard, owner's sample 64/2025, same
  step-per-paragraph pattern as 60(1) v6): VictimType लड़की / लड़का switches every word (पीड़िता/पीड़ित, खड़ी/खड़ा, पुत्री-पत्नी chips or पुत्र;
  लड़का hides LadyConstable — नाम पता by the officer, "पुलिस अभिरक्षा"); MatchBy (फोटो / परिजनों से पहचान / नाम पता); Pahar from RecoveryTime
  (टार्च at night); सूचना InformRel + "वादी मुकदमा" tick + name / mobile (@FIR complainant). FIRNo / Sections from @FIR.
- फर्द rule (owner): a फर्द can have several accused, each with their own recovered things; a thing is मुकदमे का माल (its own
  मु0अ0सं0 / धारा), अवैध शस्त्र, or अभियुक्त की अपनी चीज़ (→ "निजी वस्तु है, जिसे कब्जे पुलिस में लिया गया"). Engine pieces
  (formatDerived.ts + templateEngine): item_group column `flags` (choice → isCase/isArms/isOwn), `fallback` (empty → form value),
  per-row column `showIf` (ItemGroupInput), group `groupInto` (items joined into Accused[].found), `copy` (form values into rows — a row
  can't hold {{Key}}: "{Key}" inside "{{Key}}" is eaten by the row filler), `weight` (kg + gm → "01 किलो 200 ग्राम" + total), token
  `{{uniq:…}}` (each, duplicates once).
- `sys-fmt-fard-maal-masruka-shastra` "फर्द बरामदगी माल मसरुका / अवैध शस्त्र व गिरफ्तारी (एक या अधिक अभियुक्त)" (Fard, owner's 37/24 sample):
  Accused cards (+ say) and Items cards (who chip, what, from, kind; case/dhara fallback FIRNo/Sections; arms, said, chamber, huliya,
  source); heading lists case + arms items and each मु0अ0सं0 once (uniq) + arms धारा; per-accused जामा तलाशी line; licence line per weapon.
- `sys-fmt-fard-ndps` "फर्द बरामदगी अवैध मादक पदार्थ … NDPS एक्ट (धारा 50 सहित)" (Fard, owner's 8/20 sample): Drug dropdown (गांजा →
  oblique गांजे via if) + Dhara; Accused cards with look / where / carry / plan / extra / kg / gm / source; TotalWt from `weight`; धारा 50
  consent + GazOfficer / GazMobile / GazResult; रात → "व रात्रि का वक्त होने की वजह से"; ArrestDate for after midnight; ई-साक्ष्य / Light.
- केस डायरी formats (owner, started): `sys-fmt-cd-nirikshan-ghatnasthal` "निरीक्षण घटना स्थल (नक्शा नजरी व ई-साक्ष्य वीडियोग्राफी)" v2 (Case Diary,
  plain text — no layout marks): Pointer वादी / अन्य (OtherName + optional OtherDetail → first mention full, later "<name> उपरोक्त"),
  Where साथ लेकर गये / घटना स्थल पर मौजूद (only the first adds "…को साथ लेकर घटना स्थल आया।"), PLACEOFINCIDENT (@FIR.ghatnasthal), Mark (A),
  item_group Dirs (दिशा choice + what), LAT/LONG type decimal (default 26. / 81.), ESakshya की गयी (+ required number SID) / तकनीकी समस्या /
  नहीं लिखना. Old v1 in `docs/format-backups/cd_nirikshan_ghatnasthal_v1.json`.
- `sys-fmt-cd-medical-avlokan` "मेडिकल अवलोकन — MLC / इमरजेंसी रजिस्टर / एक्स-रे / BHT (1 से 3 व्यक्ति)" (Case Diary, plain text, owner's samples):
  fixed person slots p1..p3 (p2On / p3On ticks, p3On shown only with p2On) — role chips, name, rel, father, addr, age; per person ticks
  pNMlc / pNEr / pNXray / pNBht open their boxes (showIf). Output grouped by document: MLCs (with "थाना कार्यालय से … प्राप्त हुआ है" intro,
  डॉक्टर की राय, MlcWeapon), इमरजेंसी रजिस्टर, एक्स-रे, then one BHT intro (मजरूब / मजरूबगणों by count via nested ifs) + BHT paras.
  Supplementary not yet (owner: later as a 5th tick).
- `sys-fmt-cd-doctor-bayan` "चिकित्सक (डॉक्टर) का बयान — मजरूब / पीड़ित के मेडिकल / इलाज के सम्बन्ध में" (Case Diary, plain text, owner's
  sample): up to 2 doctors (d2On) — Hosp, Name, Post, Who chips, Search tick (तलाश… मौजूद मिले), Shown (what was shown), item_group dNPat
  (role, name, bharti tick → "…से … तक भर्ती कर दवा-इलाज" else "…का मेडिकल परीक्षण", from, to, inj), Extra, Close + "यही मेरा बयान है।";
  2nd doctor opens "तत्पश्चात मैं …".
- `sys-fmt-cd-panchayatnama-pm-avlokan` "पंचायतनामा / पोस्टमार्टम — अवलोकन व सभी बयान (पंच, उ0नि0, आरक्षी, चिकित्सक)" (Case Diary, plain text,
  owner's samples; generator `scripts/build_panchayatnama_pm.py`, tests `scripts/test_panchayatnama_pm.ts`): 6 ticks doPan / doPm / doBayanSI /
  doBayanCo / doBayanPanch / doBayanDoc (each prints its part; only-PM wording "की मूल … प्राप्त हुई है जिसका"); Panch = item_group (mahila, own
  text; `copy` Story1/Story2/BodyPlace/DName); docMahila, doViscera, optional DocInjury. `tidyRepeats` drops blank lines at the very top.
  All 6 चरण done. चरण 6 (bell): `src/lib/pmBayan.ts` (pure; tests `scripts/test_pm_bayan.ts`) — pending = पंचायतनामा part done (not 'old') and < 6/6;
  base = PanDate in last_values_json, else the pan tick day; due from day 7 (`PM_BAYAN_AFTER_DAYS`), red from day 15. सूचनाएँ card kind 'pm'
  ("पंचनामा बयान", progress n/6, route FIR karyvahi tab, filter chip) via noticeRepo `getPmBayanRows`; phone alert `pmBayanService.ts`
  (`kind: pm_bayan`, 9 AM daily summary, data.route; setting notifPmBayan; resync from setKaryvahiSubSteps + syncAppNotifications).
  चरण 5 done (instant filling): saving the PM format stores its values in fir_karyvahi.last_values_json (entry `pmValues` → applyPmPartsFromEntry);
  FormatFillPanel (केस डायरी कार्यवाही) opening the PM format merges `getPmPrefill(firId)` = `prefillPmValues(last, map)` (last values; only parts
  still left ticked; all 6 done → format's own ticks) after the context defaults, before a draft.
  चरण 4 done: `pmPendingInfo(k)` (null unless PM and < 6/6) → card badge "⏳ लंबित · n/6" + "बाकी: …" line (karyvahi tab; its लंबित filter /
  top count already follow isKaryvahiDone), Add Entry karyvahi list chip "⏳ n/6 · m बाकी", pending-actions chip + बाकी line (done = isKaryvahiDone).
  चरण 3 done: done rule `isKaryvahiDone` (PM karyvahi = 6/6, others execution_count > 0) — used by recalcExecutionCount (is_completed) and the
  karyvahi tab (card / ring / filters / diary queue). Format save in add-case-diary-karyvahi: entry `pmParts` (from doPan… via
  `partsFromFormatValues`; another format → []) → `applyPmPartsFromEntry(firId, karyvahiId, entryId, parts, getParchaNumber())` (entry's karyvahi, else
  the FIR's first PM karyvahi; ticks carry entryId + पर्चा). deleteEntry / deleteCaseDiary → `clearPmPartsForEntries` (lazy import). One-time migration
  `v360_pm_substeps_legacy` (_layout MIGRATIONS): PM karyvahis written before → all 6 "पहले से".
  चरण 2 done: karyvahi card checklist — `src/lib/karyvahiSubSteps.ts` (pure; tests `scripts/test_karyvahi_sub_steps.ts`): 6 parts pan/pm/si/co/panch/doc
  (formatKey doPan…), `isPmKaryvahi` = step_code RTA_PM_DEATH / ABS_INQUEST_PM / CHM_INQUEST_PM / MUR_INQUEST / DWD_INQUEST_SDM or a name with
  पंचनामा/पंचायतनामा + पोस्टमार्टम/शव परीक्षण (not जब्ती/बरामदगी); column fir_karyvahi.sub_steps_json (`setKaryvahiSubSteps`); card (tabs)/karyvahi.tsx
  `PmSubStepsPanel`: "चेकलिस्ट n/6" + bar (amber → green at 6/6), rows tap = manual tick, "पर्चा NN" note, "बाकी n लिखें →" opens DiaryActionSheet.
  Default karyvahi (owner option ख, death cases only): already seeded by the crime-type playbooks — nothing extra added.
- घटनास्थल = ONE card "घटनास्थल निरीक्षण" (owner): `src/lib/karyvahiSubSteps.ts` is now generic — `ChecklistDef` (PM_DEF, SCENE_DEF), `checklistOf(k)`,
  `checklistForFormat(id)`; steps may be `optional` (progress / done / pending chips count required parts only; card shows "+ वैकल्पिक n/m"). SCENE_DEF:
  nir / sur / photo optional (narrative or a tick by hand), esakshya + naksha required; format `sys-fmt-cd-nirikshan-ghatnasthal` ticks nir + naksha
  always and esakshya when ESakshya = की गयी / तकनीकी समस्या (note "तकनीकी समस्या"). New FIRs: the default "ई-साक्ष्य ऐप से वीडियोग्राफी" card and the
  playbook cards `SCENE_MERGED_STEP_CODES` (COM_SCENE_SECURE/PHOTO, COM_SITE_PLAN, MUR_SCENE_SECURE/PHOTO, MUR_SITE_PLAN, ATM_SPOT) are not added (old FIRs
  keep theirs). Card "जानकारी" = `src/lib/sceneKnowledge.ts` (overview + ① निरीक्षण … ⑤ नक्शा नजरी built from the merged cards' texts; via
  resolveKnowledgeSections, Hindi). Entry save → `syncEntryChecklist(firId, karyvahiId, entryId, formatId, values, parcha)` (clears the entry's ticks
  everywhere, then ticks the matching card; keeps values for `getChecklistPrefill`). Migration `v370_scene_substeps_legacy` (written → 5/5 "पहले से").
  Bell: `src/lib/sceneAlert.ts` (tests `scripts/test_scene_alert.ts`; FIR date + 3 days, red from 7, only up to day 30), card kind 'scene' ("घटनास्थल"),
  `sceneAlertService.ts` (`kind: scene_gap`, setting notifSceneGap), noticeRepo `getSceneRows`.
- Merged cards (owner's list 2–10 + 12; 1 वादी बयान and 11 नकल चिक/रपट left for later): in a NEW FIR `mergeSeedItems` (karyvahiSubSteps.ts, pure,
  run in seedFIRKaryvahi) folds 2+ playbook cards of one def into ONE card (title, step_code CK_MED / CK_FSL / CK_ACC / CK_WPN / CK_CCTV / CK_WIT /
  CK_MOT / CK_DIG / CK_END, best priority; a single code stays as it was) and PM_DEF.mergeCodes (MUR_PM_SEND/REPORT, DWD_MEDICAL_CAUSE, CHM_DEATH_CAUSE)
  into the FIR's पंचनामा card (+ optional part "शव पोस्टमार्टम हेतु भेजा"); column fir_karyvahi.merged_codes keeps the folded codes. Old FIRs unchanged
  (defs match only the CK_* code / exact title). Parts carry `codes` (their folded cards) and `entryName`. Formats that tick: medical-avlokan →
  mlc/xray/final, doctor-bayan → dr, notice-35-3 → arrest, abhiyukt-bayan-35-3 → arrest + interrog, fard_jabti → FSL jabti, fard_baramadgi →
  अभियुक्त recovery (`moreFormats`, `partsForFormat`); instant filling only for `prefill` defs (PM, घटनास्थल).
  "हिस्सा चुनें" (part A): add-case-diary-karyvahi shows part chips under a checklist card → entry name = part's entryName (printed in the पर्चा),
  entry `ckPart` (from the name when a saved entry is reopened — `partByEntryName`), `ckDirty` → `syncEntryChecklist(…, pickedPart)`; a pick is a
  tick with `pick: true` — changing only the pick keeps the entry's format ticks (`removeEntryPicks`). "जानकारी": `src/lib/mergedKnowledge.ts`
  (overview + ①… per part with the folded cards' texts from all playbooks; folded extras on the PM card as "＋ …"), via resolveKnowledgeSections(…, card).
  No new bells for these (owner to decide).
- `sys-fmt-cd-abhiyukt-bayan-35-3` "अभियुक्त का बयान — 07 वर्ष या उससे कम सजा (धारा 35(3) BNSS नोटिस तामील सहित)" (Case Diary, plain text, owner's
  sample): item_group Accused (name, rel, father, addr, mobile, age, mahila, own) — one / woman / many wording like the 60(1) फर्द; Bailable
  tick; per-row "बयान अभियुक्त(ा) — …" para, own text or default "जुर्म से इंकार… सफाई जरिये अधिवक्ता… बता रहे / रही हैं" (nested {?own|…{?mahila|…}…}).
- `sys-fmt-cd-vahan-prapatra-avlokan` "वाहन प्रपत्र अवलोकन — आरसी / परमिट / इंश्योरेन्स / फिटनेस / प्रदूषण" (Case Diary, plain text, owner's lines):
  vehicle + owner typed once (VehNo, Chassis, Engine, OwnerName, s/o w/o d/o, father, address), one tick per document (doRC default on) opening
  its boxes; each document = its own line "अवलोकन आरसी.......... Reg No … ।" (+ " बाद अवलोकन संलग्न सीडी है।" by doCD); blank parts left out.
- `sys-fmt-bnss126-prarthna` "प्रार्थना पत्र जांच में 126/135 की कार्यवाही" = the मुकदमा one with आवेदक / नाम-पता / प्रा0 पत्र तिथि
  instead of FIRNO/SECTION (seed_version 1).
- Every धारा / Sections key in the predefined formats (SECTION / Sections / Section / hNSec / hNDhara / BadhSection / GhatSection /
  NewSections, 37 keys in 25 formats) is field_type "multiline" (owner; seed_version +1 each). New धारा keys: multiline too.
- Format field type "decimal" (FormatKeyInput → Input type 'decimal': digits + one "."; for अक्षांश / देशान्तर). "number" strips the "." — never use
  it for lat/long. ✕ / 📋 on every typed format box except date.
- Format field type "checkbox" (`FormatKeyCheckboxInput`, value "हाँ" / empty) + tokens `{{if:Key|text}}` /
  `{{ifnot:Key|text}}` (templateEngine `_applyIfTokens`, Step -2, inner tokens allowed). `**…**` in a [[विवरण]] paragraph =
  bold words (print/editor/Word; editor <b> in body → ** on the way back; stripped in plain text). Used by the 170 चालानी
  "14 दिवस रिमांड" tick.
- Format field type "dropdown" = option chips (`FormatKeyDropdownInput` in components/ui/input.tsx, options via
  `parseDropdownOptions`: JSON strings / {value,label} / comma list). Every `pad` (पद/रैंक) key is a dropdown
  उपनिरीक्षक / निरीक्षक (default उपनिरीक्षक) — seed (7 formats, seed_version bumped) + idempotent UPDATE in database.ts
  for formats made in the app.
- Formats → जनरेटेड रिपोर्ट (`formats/preview.tsx`): `GeneratedReportView wordExport` shows "Word (DOC) एक्सपोर्ट" instead of PDF (owner);
  unedited marked format → its editor HTML, else the edited content. Other screens keep PDF.
- हाल के कार्य (owner): every report generated from a predefined format is kept forever in table `report_records` (marked text +
  edited HTML; schema.ts) — saved from formats/fill (module = callingModule GD/NK or format_type), nyayalay / prarthna-patra
  fill-format and केस डायरी कार्यवाही (`saveReportRecord`; same format again within 15 min replaces it). Rules `src/lib/reportRecordCore.ts`
  (summary मु0अ0सं0 + person/vehicle, module labels, day groups; tests `scripts/test_report_records.ts`), repo `db/reportRecordRepo.ts`,
  screen `(app)/recent-tasks.tsx` (search, आज/इस हफ़्ते/सभी, खोलें/Word/हटाएँ), reopen = `reportRecordOpen.ts` → formats/preview via the
  bridge (recordId; edits saved by `updateReportRecordEdit`). Home "आज का सारांश": the old रिमाइंडर tile (opened मुकदमा) is now
  "हाल के कार्य" (आज / इस हफ़्ते counts). Plain text of `[[तालिका]]` rows drops the "(12mm)" / "#" helpers.
- Fill-screen drafts (owner): a format ALWAYS opens empty (defaults + workspace + FIR context only).
  Module path (formats/fill with callingModule GD/NK/KARYVAHI, nyayalay + prarthna-patra fill-format): half-filled form → AsyncStorage
  via `src/lib/fillDraft.ts` (scope + formatId + firId/docId/mode), offered by `DraftResumeBanner` ("अधूरा ड्राफ़्ट जारी रखें" / हटाएँ);
  back dialog "छोड़ें" deletes it, "ड्राफ्ट सेव करें" keeps it, a generated report deletes it. Direct path (Formats list, no
  callingModule): "ड्राफ्ट सेव करें" → `saveDraftRecord` = report_records row status 'draft' + values_json (columns via _ensureColumn),
  shown in हाल के कार्य as "अधूरा" → "आगे भरें" opens formats/fill?draftId=…; generating deletes the draft row. Home counts skip drafts.
  Universal-key pills (थाना / जनपद / नाम) on formats/fill: an edit goes into values AND autoValues; generate merges `{...values, ...autoValues}`
  so the pill text is what the report gets (workspace setting unchanged). केस डायरी कार्यवाही panel keeps its own in-screen draft.
- Report → Word: `src/lib/reportDocxExport.ts` (`buildReportDocx` mirrors renderLetterHtml: page per letter, Kokila 16pt,
  0.5in margins, marks/data-fmt honoured; `exportReportToDocx` → share sheet). निरोधात्मक: card long-press menu + editor
  header button via `src/lib/nirodhatmak/karyvahiDocx.ts`.
- निरोधात्मक card checklist (owner: simple only — no dates/alerts/filters): 3 ticks `KARYVAHI_CHECKLIST` in nirodhatmakRepo
  (चलानी प्रेषित / नोटिस प्राप्त / तामील), column `checklist_json`, `setKaryvahiChecklist`; rows hidden behind a "चेकलिस्ट n/3 ▾" button on the card (green ✓ at 3/3; closed on every visit; pending pill stays visible).
  "चलानी प्रेषण लंबित" until `prashit` is ticked: amber pill on the card, सूचनाएँ card kind 'nk' (bell count), and one
  9 AM summary alert per day from the day after the karyvahi date — rules `src/lib/nkChalani.ts` (tests
  `scripts/test_nk_chalani.ts`), scheduler `nkChalaniService.ts` (`kind: nk_chalani`, route /(app)/nirodhatmak; setting
  notifNkChalani; resync from repo create/delete/tick + syncAppNotifications).
  Card look = the home dashboard tiles (owner): THEME card surface; 2px line + faint tint by चलानी state (owner, design C): लंबित
  light red (#F87171 / #FEF3F3, dark #F8717199 / #292D24), प्रेषित light green (#4ADE80 / #F1FBF5, dark #4ADE8099 / #1C3526), follows the
  prashit tick at once (`onPrashit`); red module ring when selected, `shadow-sm shadow-black/5`,
  radius 16, padding 16; village 20px bold green #16A34A, type amber #D97706, dispute red, muted labels = mutedForeground, teal tinted badge.
  Search / Filter = design C (owner; same in हल्का): shared `components/common/FilterSheet.tsx` — `FilterSearchButton` (⚙︎ as SearchBar
  `trailing`, count badge), `ActiveFilterChips` (accent chips with ✕), `FilterSheet` (bottom sheet, one choice per group + सभी, सब हटाएँ /
  लागू करें (n)); THEME colours, accent = module colour (NK #DC2626, हल्का #0F766E). NK groups: प्रकार (DB query as before), तारीख आज/इस
  हफ़्ते/इस महीने/📅 तारीख चुनें (`range` + values from/to YYYY-MM-DD; से / तक boxes via FilterSheet `renderExtra` → `DateRangeBoxes` +
  DatePickerModal; only से = up to today, only तक = everything before; chip text via group `chipLabel`; `activeFilterCount(values, groups)`
  counts only group keys) + स्थिति चलानी लंबित/चेकलिस्ट अधूरी/पूरी (client side, `src/lib/nirodhatmak/nkFilter.ts`, tests `scripts/test_nk_filter.ts`);
  NK search box no longer collapsible. हल्का search (`halka/search.tsx`): प्रकार (6 types) filters the results (old quick chips that typed
  the type name removed); हल्का lists (`halka/analytics`): ग्राम पंचायत + प्रकार (badge) groups built from the rows.
  Design C everywhere (owner): मुकदमा (स्थिति + क्रम — sort is a `noAll` group with `defaultValue: 'newest'`), GD (one group = the old
  single filter), न्यायालय (स्थिति / तारीख / प्रकार), प्रार्थना पत्र (स्थिति / तारीख / प्रकार, accent #2D52B8), प्रारूप (filter with counts +
  System/User), ज्ञानकोष list (उप-श्रेणी, SOP with counts + System/User), चेकलिस्ट (System/User), जाँच गाइड (अपराध प्रकार); ज्ञानकोष
  home + फर्द = search only. No search box is `collapsible` any more. Same filter rules as before — only the UI moved into the sheet.
  Card ⋮ = small floating popup (Modal at the button, opens upwards near the bottom) संपादित/Word/हटाएं; press-and-hold = selection mode (header: सभी चुनें, batch Word export via
  `exportKaryvahisDocx` — one file, each report on a new page — and batch delete); back clears the selection.
- AI Copilot: no floating button any more. 🤖 header button — `CopilotHeaderBtn` auto-added by `AppHeader` on main
  modules (`isCopilotRoute`: mukadma/gd/nirodhatmak/nyayalay/prarthna-patra/knowledge, not add/edit/fill/select-format)
  and in `DashboardHeader` (home); opens via `src/lib/copilotStore.ts`; sheet mounted by `CopilotHost` (root layout,
  FIR layout with activeFirId).
- सूचनाएँ 🔔 in module headers (owner): `NoticeBellBtn` auto-added by `AppHeader` next to the 🤖 button (`isBellRoute` = isCopilotRoute +
  recent-tasks; not on add/edit/fill/editor screens), badge = `noticeBadgeCount(loadNoticeCards())` on focus → `/(app)/notifications`.
- Copilot online answers: `AIProviderManager.execute` → officer's own Gemini key if saved (`src/ai/geminiDirect.ts`:
  key in expo-sqlite localStorage `investsuite:gemini_api_key`, Settings → AI सहायक card; ListModels picks flash models,
  tries up to 3 on 404/429/503, joins non-thought parts, maxOutputTokens ≥ 4096, last 6 chat turns sent) else the
  Supabase `ai-copilot-provider` (MeDo-managed, NOT deployable from this repo; sandbox can't reach supabase.co).
  Failures carry a Hindi `error` → Copilot appends "⚠️ ऑनलाइन AI से जवाब नहीं मिला: …". Cloud only runs when
  setting aiReportGeneration is on.
- Text wrapper `src/lib/selectableText.tsx` (imported first in index.ts): selectable text app-wide (not inside
  Pressable/Touchables; on Android only text of 60+ chars by default — a selectable short label is drawn by a different
  text view than the one that measured it, wraps, and the 2nd line is hidden: "चेकलिस्ट प्रगति" → "चकालस्ट", builds 20–22); on Android: textBreakStrategy forced to 'highQuality' unless numberOfLines=1 + explicit
  'simple' ('simple' splits a letter from its matra → "चकालस्ट", hidden 2nd line — build 21 regression), and
  Hindi text (Devanagari in children) gets lineHeight ≥ 1.5×fontSize (also when includeFontPadding is off);
  maxFontSizeMultiplier 1.2 by default. Never use textBreakStrategy "simple" on text that can wrap.
- Dark mode: never hard-code a dark text colour ('#111827') on bg-card / bg-background — use className `text-foreground` and
  `...(selected ? { color: ACCENT } : {})` — NEVER `color: x ? A : undefined` (the undefined wiped the theme colour on the phone: केस डायरी
  कार्यवाही list names dark on dark, owner; all 9 such places changed) (fixed: crime-type + rank pickers in add-fir, karyvahi picker in add-case-diary-karyvahi,
  न्यायालय checklists, sys-format menu, प्रार्थना पत्र report rows + editor); light header strips → `bg-secondary`. view-case-diary
  actions (संपादित / Edit Entries / A4 / Export) sit in a wrapping row under the header (in the header they ran off-screen).
- Full-screen editor (DocumentEditor FullScreenModal) keyboard: on Android NO KeyboardAvoidingView resizing (it flickered when the keyboard
  opened / closed — owner) — `useEditorKeyboardPadding` pads by the keyboard height (grow-only while open, 0 on hide) and
  `suspendKeyboardInset()` stops the root KeyboardInsetView re-padding the hidden screen underneath while the editor is open. iOS keeps KAV.
- Pressable `style={({ pressed }) => …}` (function form) was ignored on the phone (सूचनाएँ card lost background, border and
  row layout, build 24) — use a plain style object (pressed look via onPressIn/onPressOut state) in new code.
- ✕ / 📋 in name, father / husband name and address boxes (owner): `useClearCopy` (`components/common/ClearCopyTools.tsx`; icons only
  when filled; clear → "मिटाया गया · वापस लाएँ" 5 s; copy → "कॉपी हुआ"). AutocompleteInput turns it on by default for FIELD_KEYS
  person_name / father_husband_name / address (person + accused group cards); `<Input clearCopy>` in प्रार्थना पत्र add and मुकदमा add-fir.
  Every typed format box too (owner): FormatKeyInput text/multiline → `clearCopy`, item_group text cells → `ItemTextCell` (ItemGroupInput).
- FIR वादी = one person card (owner, phase 1 of "FIR data fills every format"): `PersonGroupInput single` on mukadma/add-fir and the FIR
  details edit tab; FIR columns complainant_name / _relation / _father / _gender / _age / _jati / _mobile / _address (+ separate alt mobile);
  new columns via _ensureColumn (firs.complainant_father / _relation / _gender). Convert with `src/lib/firComplainant.ts`
  (`complainantToGroup` / `groupToComplainant`; old "+91…" mobiles → 10 digits; tests `scripts/test_fir_complainant.ts`).
  Phase 2 done: `src/lib/firFill.ts` (`firFillValue`, pure; tests `scripts/test_fir_fill.ts`) = the "@FIR.<field>" values used by
  contextDefaultResolver (FIR + accused loaded once): complainant_name/_father/_relation/_gender/_age/_age_years/_mobile/_address/_full,
  complainant_vadi (वादी/वादिनी), _peedit, _majroob_vadi, _mahila, _doctor_row (item_group row), fir_date / occurrence_date (dd.mm.yyyy),
  accused_rows (item_group JSON; FIR accused have no father/gender → blank, templates use `{?father|{rel} {father} |}`), accused1_name/_mobile.
  Fallback: `"@FIR.complainant_relation|पुत्री"` (used when empty / no FIR; screens without FIR context use `literalDefault`). Connected:
  183 बयान, मेडिकल अवलोकन, डॉक्टर बयान, अभियुक्त बयान, निरीक्षण घटना स्थल, 35(3) नोटिस (seed_version +1).
  Phase 3 done: FIR अभियुक्त like the वादी card — fir_accused columns father / relation / gender (_ensureColumn), shared UI
  `components/fir/AccusedIdentityFields.tsx` (सम्बन्ध chips → लिंग auto, पिता / पति, लिंग) on add-fir and the FIR details tab (details tab now
  edits accused + "+ अभियुक्त जोड़ें"; saved with the FIR). More @FIR fields: fir_datetime, occurrence_datetime, complainant_with_role
  ("वादिनी रेनू पत्नी धीरज"), accused1_* (name/father/relation/gender/address/age/mobile/full/abhiyukt/mahila), accused_names
  ("क, ख व ग"), accused_count / _co_count (01), accused_abhiyukt / accused_number, accused_cards (PersonGroupInput JSON),
  accused_group (AccusedGroupInput JSON, status नामजद). Markers set in 22 formats (all FIRNo / Sections keys, 170 मुकदमा वादी + अभियुक्त,
  न्यायिक अभिरक्षा / DCRB / GD dakhila + avmukt accused, बेल नोटिस अभियुक्त, वाहन फ्लैग TheftPlace…; an old literal default kept as fallback).
  `mergeContextDefaults` (empty FIR value never wipes a default card). "मुकदमा चुनें": `components/formats/FirPickBanner.tsx` on
  formats/fill (no firId), nyayalay + prarthna-patra fill-format when `hasFirMarkers`; pick → `applyPickedFir` fills only untouched
  fields (empty / opening value / last pick). Tests in `scripts/test_*.ts` must treat "@…" defaults as empty.
  Next (agreed): one-tap buttons.
- केस डायरी date/time (owner): `src/lib/caseDiaryTime.ts` (pure; tests `scripts/test_case_diary_time.ts`) — the FIRST diary opens with the FIR
  सूचना की तारीख (`newDiaryDefaultDate`; add-case-diary + the karyvahi quick "नई डायरी"), hint under the date; on that date the
  start time (or end time when no start) must not be before the FIR time_of_information (`checkDiaryTime`, in add-case-diary save; end
  before start is allowed — past midnight).
- FIR Case Diary tab header (`(tabs)/case-diary.tsx`): Export All / Add Diary are 38px icon-only buttons (green ⬇ / indigo +, labels in
  accessibilityLabel) — the text pills cut the tab title (owner).
- केस डायरी कार्यवाही screen (`add-case-diary-karyvahi.tsx`): ✕ on an entry (collapsed card or open form) → `askRemoveEntry`: empty entry removed at once,
  a filled one only after the "प्रविष्टि हटाएँ?" dialog (रद्द करें / हाँ, हटाएँ) — owner.
  Entry editors there and in edit-case-diary-entry pass `DocumentEditor noIndent` → print preview without the first-line paragraph indent
  (owner; other modules keep the indent).
- केस डायरी Word export + A4 प्रीव्यू = owner's "पर्चा" layout (sample docx 297/2025): `src/lib/caseDiaryParcha.ts` (pure; tests
  `scripts/test_case_diary_parcha.ts`) — per diary: yellow "पर्चा नं0 NN दिनाँक dd.mm.yyyy समय HH.MM से HH.MM बजे तक", "कार्यवाही- <names>"
  (पर्चा 01 adds मुकदमा साराशं, विवेचना ग्रहण), "दौरा- <places व …> ।" (none → थाना कार्यालय), blank, red "मुकदमा साराशः- " + the FIR's
  मुकदमा सारांश box exactly as typed (owner: the app builds nothing; empty box → no line and no "मुकदमा साराशं" in कार्यवाही-; old
  auto "मुकदमा सारांश:" narrative entries are skipped; new diaries no longer get that entry — nor the automatic opening line
  entry; old ones are skipped only when left exactly as the app wrote them, `isAutoOpening`); NOW (owner, again): a new diary starts with two narrative entries — `SARANSH_LABEL` "मुकदमा सारांश" (FIR box as typed,
  only when filled) + `OPENING_LABEL` "प्रारम्भिक पंक्ति" (`openingLine(no, prev)`), editable/removable; a diary that has them prints them
  (where they stand, red "मुकदमा साराशः- ", no 1.5 gap, not counted) instead of its own lines; diaries without them keep the auto lines; on those two entries the format button is locked (no ✕, no picker — `lockedLabel`; the name is how the पर्चा finds them), opening para
  (01: "…मुझ उ0नि0 को आवंटित…"; later: "…पर्चा नं0 0n दिनाँक … को किता कर सेवा मे प्रेषित किया जा चुका है…"), each entry "<red name>.......... text",
  NO closing line (owner removed it — the Narrative format `sys-fmt-cd-parcha-end` "पर्चा अंत" has it; seed_version 2: "तत्पश्चात मौके से रवाना होकर…"). No signature (owner), colours kept (owner).
  1.5 lines of space between two कार्यवाही / नैरेटिव entries (owner; para `gapBefore` → Word: empty Kokila para at 1.5 spacing, A4:
  margin-top 46.5px; A4 sheets cut after the last whole line of each paragraph so a gap never splits a line).
  Word: `caseDiaryParchaDocx.ts` (Kokila 18pt, justified, single spacing, 1 inch margins, all diaries in one flow); data via
  `loadParchaParas(firId, diaryId?)` in caseDiaryExport.ts. A4 button in view-case-diary → `CaseDiaryA4Preview` with `parchaHtml` (31px lines,
  sheets cut on line boundaries, "पृष्ठ n / N").
- Optimisation pass (owner, no behaviour change): 30 unreferenced files removed (unused rn-reusables `components/ui/*` like card/dialog/
  select/tabs…, ModuleHeader, ScreenHeader, ctx.tsx, formatColors, assertUniqueKeys, withRepoLogger, ConversationMemoryEngine) +
  186 unused import bindings (bundle module list checked identical via source map). Kept on purpose: `*Types.ts` (type-only), the
  @rn-primitives / react-native-ui-datepicker / @sentry/react-native deps (pnpm remove re-resolved other versions — needs a separate
  validated build). Indexes knowledge_entries(content_type, source). `src/lib/db/sqlIdent.ts` guards dynamic UPDATE column names
  (हल्का repos); `src/lib/webviewSafety.ts` (`onlyLocalWebViewNav`) on the print / A4 WebViews. Settings → सुरक्षा → "सुरक्षा जाँच"
  (`components/settings/SecurityCheckCard.tsx`, read-only). Per-screen ErrorBoundary on the 3 FIR tabs + knowledge note viewer
  (`<Name>WithBoundary` default exports). `src/lib/perfLog.ts` (first import in index.ts) → Dev options → Performance "Measured (real)"
  (`components/settings/RealPerfCard.tsx`: first screen ms, seed ms, last search ms, DB size, rows by content_type).
- App Lock locks only on app open / back-exit / background timeout; PIN set first.

## SOP library
- Seeds in `assets/seed/`: `sop_index.json`, `sop_struct_1.json`, `sop_struct_2.json`,
  `sop_explain_1.json` (owner's files, byte-for-byte — except owner-asked fixes: sop-up-b2-01 शारीरिक क्षति "सामान्य कारण"
  = 16 separate points in sop_struct_1 + sop_seed_1 (seed_version 2); sys-sop-fsl-coc परिभाषा = owner's simple-words text
  (sop_struct_2 intro block t with \n + •, sop_seed_2 description, seed_version 2); its प्रमुख शब्द = owner's 5 IO-view terms with the lead line in the terms block's optional `t` (TermsBlock shows it; seed_version 3); बुनियादी आधार + साक्ष्य का प्रलेखन = owner's numbered text as terms blocks (label + explanation; the 5 प्रलेखन points the owner's text didn't cover kept as label-only rows; seed_version 4; सूची-निर्माण, सुरक्षा एवं साक्ष्य प्रतिधारण = owner's text, 'two' block + lead line in optional `t` (TwoBlock shows it; seed_version 5); चेकलिस्ट: the 4 बुनियादी आधार steps replaced by the owner's IO checklist (19 steps `sop-fsl-coc.io1..19` in 6 groups, sop_index.json; entry `ci` = intro above the checklist, step `gi` = line under its group heading — SopChecklistTab)); files stay compact one-line JSON). Add future
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
