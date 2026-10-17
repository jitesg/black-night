# Requirements Document

## 1. Application Overview

**Application Name**: InvestSuite AI Copilot

**Application Description**: An intelligent offline legal and procedural investigation assistant mobile application for police officers. The application provides statutory lookups (BNS 2023, BNSS 2023, BSA 2023), Schedule I offence classifications, Knowledge module documentation (DGP Circulars and SOPs), FIR / Case management, and AI Copilot assistance. This update (Task L30 - SOP Library Part 2) introduces a structured multi-block SOP viewer with in-document search and fallback rendering, an interactive and persistent SOP Checklist tab with Case linking, and checklist quick-action access via AI Copilot `SOP_LOOKUP` responses.

---

## 2. Users and Usage Scenarios

**Target Users**:
- Investigating police officers following step-by-step crime-scene and investigation checklists for specific cases or general procedures.
- Supervisory officers verifying procedural adherence against standard checklists and investigating officers' recorded notes.

**Core Usage Scenarios**:
- **Viewing Structured SOP Content**: An officer opens an SOP detail screen to view structured blocks (headings, steps, do/don't tables, crime-type accordions, flowchart steps, forms, and law chips) with sticky in-SOP keyword search.
- **Executing and Tracking Checklists**: An officer selects a specific registered Case (or general mode 「बिना केस (सामान्य)」) in the SOP Checklist tab, checks off procedural steps, filters mandatory steps (✱), adds step notes, and tracks overall completion progress.
- **Accessing SOP Checklists from Case Detail**: An officer views associated SOP checklists directly from the Case Detail screen and adds new SOPs to the case.
- **Direct Copilot Checklist Access**: An officer asks Copilot for investigation guidance and taps 「चेकलिस्ट खोलें」 directly from the `SOP_LOOKUP` response to launch the corresponding interactive checklist.

---

## 3. Page Structure and Functional Description

### 3.1 Page Structure

```
InvestSuite AI Copilot
├── Navigation & Drawer
├── Knowledge Module
│   ├── Knowledge Category List Screen (SOP Category Badge Count: 38)
│   └── SOP Category Screen
│       ├── Subcategory Filter Chips
│       ├── SOP Search Bar
│       ├── SOP Entry List
│       └── SOP Detail Screen
│           ├── Header (Title, EN Subtitle, Source Chip, Page Number, Law & Circular Chips)
│           ├── Sticky In-SOP Search Bar (Keyword highlight and block filtering)
│           ├── Tab 1: 'विवरण' (Structured Block Viewer / Fallback Text Viewer)
│           └── Tab 2: 'चेकलिस्ट' (Interactive Step Checklist & Case Selector)
├── Law Library Module (Statute Lookup & Section Detail)
├── FIR / Case Management Module
│   └── Case Detail Screen
│       └── SOP Checklist Section (List of active checklists + '+ SOP जोड़ें' button)
└── AI Copilot Module
    └── AI Copilot Chat Screen (SOP_LOOKUP with 'पूरा SOP खोलें' and 'चेकलिस्ट खोलें' actions)
```

### 3.2 Structured SOP Viewer ('विवरण' Tab)

- **Data Source & Asset Management (`tasks/sop_struct_1.json`, `tasks/sop_struct_2.json`)**:
  - Stored as bundled read-only static JSON assets (loaded lazily on demand and cached in memory, not as database rows).
  - SOP Struct 1 contains 31 SOPs (`src: \"b1\" | \"b2\"`), SOP Struct 2 contains 5 SOPs (`src: \"b3\"`).
  - Fallback mechanism: If structured asset data is absent or fails to load for a given record, the screen falls back to the plain-text viewer.

- **Header Components**:
  - SOP Hindi title and English subtitle (`en`).
  - Source badge (`src`) and original booklet page reference: 「पृष्ठ <pages> (मूल पुस्तिका)」.
  - Law cross-reference chips (`laws`): Displays `- [Old Law] → [New Law]` chips routing to the relevant statute section in Law Library.
  - Circular reference chips (`circ`): Displays 「DG n/YYYY」; taps navigate to circular detail if ID exists; renders disabled chip with 「ऐप में नहीं」 if ID is null.
  - Sticky in-SOP search bar: Allows case-insensitive Hindi and English searching, filtering matching blocks and highlighting query matches in real time.

- **Block Kind Rendering Support**:
  - `text`: Bold label with formatted paragraph body.
  - `steps`: Section heading (`title`), numbered items, indented sub-bullets; mandatory steps (`must: 1`) marked with 「✱ ज़रूरी」 badge; prohibited items (`dont: 1`) styled in red tint with 「✗」.
  - `form`: Heading rows with checkbox-style field items (e.g., missing-person proforma).
  - `intro`: Introductory styled text.
  - `cards`: Informational card list with bold titles and descriptions.
  - `points`: Bulleted text point lists.
  - `dd`: Two-column comparison table (「करें ✓」 in green and 「न करें ✗」 in red) with supporting row images.
  - `crimetypes`: Collapsible accordion sections (first accordion expanded by default) containing items and figures.
  - `steps` (b3): Numbered accordion sections.
  - `evtype`: Evidence cards with badges for साक्ष्य (Evidence), अपराध (Offence), and पैकिंग (Packaging).
  - `table`: Horizontally scrollable data table with sticky first column and table note.
  - `note`: Highlighted amber caution box.
  - `law`: Statutory reference list with figures.
  - `devices`: Device cards with titles, descriptions, and device images.
  - `two`: Two-column comparison block.
  - `dd2`: Distinct green 「करें」 and red 「न करें」 stacked lists.
  - `flow`: Vertical process flow diagram with directional connectors.
  - `terms`: Glossary block with bold terms and definitions.
  - Unknown block kinds: Render any contained string values as fallback bullet points without crashing.

- **Image Handling**:
  - Blocks referencing figures/images render an image container.
  - If the target image record is not present in local database storage, display a placeholder container showing 「फोटो उपलब्ध नहीं」 alongside the caption.

- **Performance & Virtualization**:
  - Content rendered with list virtualization or lazy-loaded accordions to ensure rapid opening (<500 ms for multi-block SOPs).
  - No horizontal page scroll permitted, except within designated `table` block containers.

### 3.3 Interactive SOP Checklist ('चेकलिस्ट' Tab)

- **Checklist Structure & Data Source**:
  - Step data sourced from in-memory SOP index (`sop_index.json`).
  - Checklist state persisted locally in database table `sop_checklist`:
    - Schema: `id` (PK), `sop_id`, `case_id` (NULLABLE), `step_id`, `done` (0/1), `note` (TEXT), `updated_at`.
    - Unique constraint: `UNIQUE(sop_id, IFNULL(case_id, ''), step_id)`.
  - Checklist progress and state persisted separately per (SOP, Case) tuple and across application restarts.

- **UI Controls & Functionality**:
  - Case Selector dropdown (「केस चुनें」): Allows selecting from existing registered cases or selecting 「बिना केस (सामान्य)」 for standalone procedures.
  - Progress Bar: Displays dynamic progress text: 「x / N पूरे」 with visual completion indicator.
  - Mandatory Filter Toggle: 「सिर्फ ✱ ज़रूरी」 toggle to filter and view only mandatory steps (`must: 1`).
  - Step List:
    - Group headers based on step category (`step.g`).
    - Step item: Interactive checkbox, step text.
    - Step indicators: Mandatory steps highlighted with 「✱ ज़रूरी」; cautionary steps (`dont: 1`) prefixed with 「ध्यान: ...」.
    - Step Note: Option to add, view, or edit a short text note per step.
  - Reset Action: 「रीसेट」 button with confirmation dialog to clear all checked items and notes for the selected SOP and case context.

### 3.4 Case Detail Screen Integration

- **SOP Checklist Section**:
  - Adds a dedicated row/section 「SOP चेकलिस्ट」 within existing Case Detail screen.
  - Lists all SOP checklists initiated for that specific case alongside their completion progress (e.g., 「3 / N」).
  - Tapping an item navigates directly to that SOP's Checklist tab with the case pre-selected.
  - Provides a 「+ SOP जोड़ें」 button opening an SOP picker modal with keyword search and crime-type filter chips.

### 3.5 AI Copilot Integration

- **`SOP_LOOKUP` Response Enhancement**:
  - In addition to the existing 「पूरा SOP खोलें」 action button, renders a 「चेकलिस्ट खोलें」 action button.
  - Tapping 「चेकलिस्ट खोलें」 navigates directly to the Checklist tab of the matched SOP.

---

## 4. Business Rules and Logic

1. **Data Isolation & Read-Only Source**: Structured SOP asset files (`tasks/sop_struct_1.json`, `tasks/sop_struct_2.json`) are bundled read-only static files. Checklist execution state is stored in the local SQLite database.
2. **Case Independence**: Checking off steps or adding notes under one case does not affect checklist states for other cases or the standalone 「बिना केस (सामान्य)」 context.
3. **Viewer Graceful Fallback**: If structured JSON data for a specific SOP ID or Knowledge ID is missing, corrupted, or unsupported, the viewer seamlessly displays the plain-text SOP description.
4. **Non-destructive Migration**: Introduction of the `sop_checklist` table operates via standard database migration without altering or dropping existing tables, case records, or statutory databases.
5. **Offline Operation**: All block rendering, search highlighting, checklist tracking, and Copilot navigation execute fully on-device without internet access.

---

## 5. Exceptions and Edge Cases

| Scenario | Handling |
|---|---|
| Structured SOP asset missing or unreadable | SOP Detail screen automatically falls back to rendering L29 plain-text viewer |
| Block kind in structured JSON is unrecognized | Parses and renders all text strings found within the block as bullet points without crashing |
| Image reference ID has no data in local database | Displays a neat grey placeholder showing 「फोटो उपलब्ध नहीं」 with the image caption |
| Case linked to active checklists is deleted | Checklist records retain consistency; orphaned checklist entries are safely ignored or pruned |
| Reset confirmed on checklist | Clears all completion flags (`done = 0`) and notes for that specific SOP and case combination only |
| In-SOP search yields no matching text | Displays clear empty search state while keeping search input active |

---

## 6. Acceptance Criteria

1. Structured SOP assets `tasks/sop_struct_1.json` (31 SOPs) and `tasks/sop_struct_2.json` (5 SOPs) load and cache on demand without database insertion.
2. SOP Detail screen displays two functional tabs: 「विवरण」 (Structured Viewer) and 「चेकलिस्ट」 (Checklist).
3. Structured Viewer correctly renders all specified block types (`steps`, `cards`, `dd`, `crimetypes`, `evtype`, `table`, `flow`, `form`, `terms`) and falls back to plain-text viewer if structured data is absent.
4. In-SOP search bar filters matching blocks and highlights searched terms in Hindi and English.
5. Missing images render a grey placeholder box with 「फोटो उपलब्ध नहीं」 and caption without throwing errors.
6. Checklist tab displays case selector (including 「बिना केस (सामान्य)」), progress bar 「x / N पूरे」, 「सिर्फ ✱ ज़रूरी」 toggle, mandatory badges (✱), cautionary notes (ध्यान), and note-taking capability.
7. Checking steps in Case A does not affect checked steps in Case B or 「बिना केस (सामान्य)」, and state persists across app relaunches.
8. Case Detail screen displays the 「SOP चेकलिस्ट」 section listing linked checklists with progress, and allows attaching new SOPs via 「+ SOP जोड़ें」.
9. AI Copilot `SOP_LOOKUP` responses include the 「चेकलिस्ट खोलें」 button, opening the corresponding SOP Checklist tab.
10. All operations execute offline with clean TypeScript validation and zero regressions on statutory/circular data.

---

## 7. Out of Scope for This Release

- Custom user-created SOP templates or editable SOP text definitions (reserved for SOP Part 3).
- Binary image asset bundle preloading (Task L31).
- External export or PDF generation of filled checklists.