# Requirements Document

## 1. Application Overview

**Application Name**: InvestSuite AI Copilot

**Application Description**: An intelligent investigation assistant mobile app for police officers. Provides AI-powered support for investigation, legal research, court work, documentation, beat policing, preventive action, official writing, automated document field extraction, and format filling. Features include AI chat interaction with structured responses and drafting, intelligent ranked fuzzy search with typo tolerance across departmental records, fuzzy-aware text highlighting, typo-tolerant autocomplete suggestions, predictive search ranking, cohesive light/dark theming across all UI components including format fill banners and pills, format auto-fill with compact inline editable workspace pills, and an OCR document scanning service (ocr-extract-fields) utilizing the Gemini API with dynamic model auto-discovery and warm-instance model caching to extract Hindi and English form field values directly into departmental records (such as Prarthna Patra, Mukadma, and GD). Chat history and record queries operate locally without mandatory login.

---

## 2. Users and Usage Scenarios

**Target Users**:
- Police officers conducting investigations
- Officers requiring legal research and procedural guidance
- Officers preparing court-related documents, formats, and filings
- Officers drafting official records (FIR, Case Diary, Arrest Memo, GD, Seizure Memo, Prarthna Patra, official format templates, etc.)
- Officers digitizing handwritten complaints, printed notices, identity documents, and application forms
- Officers searching case records, legal knowledge, and beat/halka records with flexible matching

**Core Usage Scenarios**:
- Officer asks investigation or legal questions via natural language chat and receives structured guidance with legal provisions and actionable checklists
- Officer opens a document format fill form where workspace values (Police Station, District, Officer Name, etc.) are pre-populated as interactive pills, allowing immediate inline editing with compact text inputs without navigating away from the form
- Officer operates format fill screens in either light or dark mode with auto-filled pills and missing workspace warning banners dynamically matching active theme colors
- Officer scans or uploads an image of a Hindi/English complaint or identity document in Prarthna Patra, Mukadma, or GD entry modules, triggering automated field extraction to populate form values
- Officer searches departmental records (Mukadma, GD, Nyayalay, Prarthna Patra, Knowledge base, Halka) with typos or partial keywords, receiving accurately ranked results with matched terms highlighted
- Officer types in input forms with autocomplete inputs adhering to the active light/dark theme and receiving typo-tolerant suggestions based on field history
- Officer performs predictive search in Halka beat management with immediate ranked recommendations
- Officer drafts official notices or memos using pre-built action prompts or custom queries
- Officer reviews, copies, or shares investigation guidance while retaining offline access to local records and chat history

---

## 3. Page Structure and Functional Description

### 3.1 Page Structure

```
InvestSuite AI Copilot
├── Chat Screen (Main Copilot)
│   ├── Chat Header
│   ├── Message List
│   ├── Quick Action Prompts
│   └── Input Bar
├── Search & Module Screens
│   ├── Global & Module Search (Mukadma, GD, Nyayalay, Prarthna Patra)
│   ├── Knowledge Base (Index & Detail List)
│   └── Halka / Beat Search (Predictive Search & Results)
├── Document Entry & Formats
│   ├── Record Form Inputs (Mukadma, GD, Prarthna Patra)
│   ├── Format Fill Screen
│   │   ├── Missing Workspace Notice Banner (Themed)
│   │   ├── Auto-Filled Workspace Pills (Themed, Inline Editable)
│   │   └── Format Template Fields
│   ├── OCR Scan Trigger & Image Picker
│   └── OCR Field Extraction Preview & Confirmation Sheet
├── Chat History Screen
│   ├── History List
│   └── New Chat Action
├── Common Input Components
│   ├── Autocomplete Input (Themed & Typo-Tolerant)
│   └── Highlighted Text Display (Fuzzy Highlight Support)
└── Settings Screen
    ├── Theme Preferences (Light, Dark, System Default)
    ├── Search Settings (Typo Tolerance Toggle)
    └── Data Management (Clear Chat History)
```

### 3.2 Chat Screen (Main)

**Chat Header**:
- Displays application title 「InvestSuite AI Copilot」
- Navigation menu providing access to Chat History, Records Search, and Settings

**Message List**:
- Vertical scrollable message stream distinguishing user and AI messages
- User message: right-aligned with distinct visual container
- AI message: left-aligned with Markdown formatting (headings, numbered lists, bullet lists)
- Action buttons per AI message: Copy to clipboard and system Share sheet trigger
- Loading indicator during response generation

**Quick Action Prompts**:
- Horizontal scrollable row containing standard prompt chips:
  + 「Draft FIR」
  + 「Draft Arrest Memo」
  + 「Draft Seizure Memo」
  + 「Explain BNSS Section」
  + 「Investigation Checklist」
  + 「Court Procedure」
- Tapping prompt automatically fills the input bar and submits the query

**Input Bar**:
- Multiline text input expanding up to 4 lines
- Send trigger disabled when input field is empty

**AI System Prompt Specification**:
- Configured to act as an authoritative police investigation assistant
- Delivers structured responses covering: Summary, Detailed Explanation, Relevant Legal Provisions (BNSS/BNS/Evidence Act), Investigation Checklist, Documents/Formats Required, Practical Tips, Important Precautions, and Conclusion
- Enforces strict factual integrity without fabricating provisions

### 3.3 Search and Module Screens

**Module Records Search (Mukadma, GD, Nyayalay, Prarthna Patra)**:
- Search bar accepting free-text queries with typo-tolerant fuzzy matching
- Result list displaying matched records ranked strictly by similarity and relevance score in descending order
- Match highlighting: matching word segments highlighted within record titles and summaries according to typo-tolerance rules

**Knowledge Base Search (Index and List Views)**:
- Search interface covering legal sections, reference guides, and standard operating procedures
- Fuzzy-aware highlight segments displayed in search results

**Halka / Beat Search Screen**:
- Search interface for beat officers, areas, and contacts
- Predictive search functionality providing dynamic ranked candidate matches as the officer types, ordered by match score

### 3.4 Document Entry, Format Fill, & OCR Scanning Helper

**Format Fill Screen**:
- Displays official document format templates ready for entry and generation
- Missing Workspace Banner:
  + Shown when workspace defaults are absent
  + Styled dynamically according to active light/dark theme colors, without hardcoded static color values
- 「AUTO-FILLED FROM WORKSPACE」 Pills:
  + Displayed for pre-filled workspace attributes (Police Station, District, Officer Name, etc.)
  + Visual styling dynamically inherits the active light or dark theme mode
  + Editable in-place: tapping a pill switches it or reveals a compact inline text input directly on the form without redirecting the officer away from the screen
  + Changes made via inline text input update the active format document data immediately

**Module Record Forms (Prarthna Patra, Mukadma, GD)**:
- Form entry screens contain an 「Auto-fill via OCR Scan」 action trigger
- Allows capturing an image using the camera or picking an existing image from the device gallery

**OCR Field Extraction Preview & Review**:
- Displays scanning progress state while processing the image
- Presents extracted Hindi/English key-value pairs matching the target form required fields (such as Complainant Name, Accused Name, Address, Incident Date/Time, Act/Section, Subject, Summary of Complaint)
- Officer can review, edit, and confirm extracted fields before merging them into the active form inputs

### 3.5 Common Input and Text Components

**Autocomplete Input Component**:
- Used across data entry and query forms
- Visual styling dynamically inherits the active light or dark theme mode (consistent with entity group inputs), avoiding hardcoded contrasting palettes
- Suggestion dropdown provides historical suggestions matched against input using typo-tolerant fuzzy comparison based on user settings

**Highlight Text Component**:
- Renders matched character segments with visual emphasis
- Supports exact match highlighting and typo-tolerant fuzzy segment highlighting across search result views

### 3.6 Chat History Screen

**History List**:
- Displays past conversation sessions sorted with newest first
- Shows conversation title and creation date
- Tapping an entry loads the full conversation into the Chat Screen
- Empty state illustration and prompt when no history exists

**New Chat Trigger**:
- Opens a clean, empty conversation session

### 3.7 Settings Screen

**Preferences**:
- Theme selection: Light, Dark, or System Default
- Search preferences: Typo tolerance sensitivity configuration
- Clear chat history action with confirmation prompt

---

## 4. Business Rules and Logic

### 4.1 Format Fill and Workspace Data Rules

**Inline Editing of Workspace Auto-Filled Values**:
- Workspace pills for Police Station, District, Officer Name, and related attributes must allow immediate inline editing
- Editing must not trigger a full page navigation, modal dismissal, or form reset; it operates via compact inline text inputs embedded directly in the form flow
- Updated values are preserved in the current format session for generation

**Dynamic Theming for Format Banners and Pills**:
- The 'AUTO-FILLED FROM WORKSPACE' pills and missing workspace banner must dynamically resolve their background, text, and border colors from the active theme tokens (Light or Dark)
- Hardcoded background colors, static borders, and fixed warning palette values are prohibited

### 4.2 OCR Field Extraction Function (ocr-extract-fields)

**Endpoint Specification**:
- Interface: POST request accepting JSON payload: `{ imageBase64: string, mimeType: string, fields: Array<{ key: string, label: string }> }`
- Response format: `{ fields: Record<string, string> }`
- CORS: Enables Cross-Origin Resource Sharing headers on all incoming requests and preflight OPTIONS queries

**Input Validation Rules**:
- Permitted MIME types: strictly restricted to `image/jpeg`, `image/png`, and `image/webp`
- Maximum payload size: image Base64 data string must not exceed 8MB (8,000,000 characters)
- Target field definition: requires non-empty `fields` array containing valid `key` and `label` definitions for targeted form parameters

**Model Auto-Discovery & Caching Logic**:
- Dynamically discovers available Gemini models via the Gemini API model listing endpoint instead of relying on a hardcoded model name
- Filters models to those supporting `generateContent`, matching flash models while excluding vision-deprecated or experimental thinking variants
- Selects the newest available flash candidate, falling back to `gemini-2.0-flash` if model listing fails or yields no suitable candidate
- Caches the discovered model name per warm instance for 10 minutes (600,000 ms) to avoid redundant discovery requests on every scan
- Clears the cached model entry immediately if the active model encounters an API error, triggering fresh model discovery on subsequent invocation

**AI Processing & Extraction Rules**:
- Utilizes the auto-discovered Gemini model with the configured secret key (`GEMINI_API_KEY`)
- Configured with a system instruction and JSON response schema to extract form values from scanned documents, identity cards, handwritten notes, and official forms specifically formatted for Uttar Pradesh Police records
- Supports bilingual text comprehension across Hindi (Devanagari script) and English
- Matches extracted values directly to requested field keys and labels without guessing; returns empty strings for fields not found in the document image
- Preserves original spellings for proper nouns, names, and addresses as found in the scanned image

**Error Handling and Rate Limiting**:
- Validates presence of `GEMINI_API_KEY`; returns HTTP 500 server configuration error if missing
- Returns HTTP 400 with descriptive error on invalid payload structure, missing parameters, unsupported MIME types, or oversized image data
- If Gemini API returns rate limit or quota exhaustion (HTTP 429), endpoint returns an HTTP 502 status with a friendly rate limit retry message
- If Gemini API is unreachable or returns non-200 responses, endpoint clears cached model and returns HTTP 502 with error details
- If Gemini output cannot be parsed as JSON or returns empty content, returns HTTP 502

### 4.3 Theme Application Rules

**Consistent Color Tokens**:
- Form input elements including autocomplete inputs, workspace pills, and missing workspace banners must dynamically resolve colors based on the active color scheme (Light or Dark)
- Fixed or hardcoded distinct accent themes (such as dark gold palettes or static warning amber) are prohibited in shared form components, banners, and pills
- Backgrounds, borders, placeholder text, and dropdown suggestion menus must strictly mirror standard light/dark application tokens

### 4.4 Ranked Fuzzy Search and Matching Rules

**Scored Fuzzy Matching**:
- Search queries execute fuzzy comparison allowing an edit distance threshold (default distance of 1)
- Candidate results are assigned a numeric score reflecting string similarity, prefix match priority, and edit distance
- Search result lists in global search and individual modules must be sorted descending by match score

**Predictive Search in Halka**:
- As the user types in Halka search, predictive suggestions are generated and ordered dynamically by scored fuzzy relevance

**Typo-Tolerant Autocomplete Suggestions**:
- Field value history suggestion retrieval respects the application typo-tolerance setting
- When typo tolerance is enabled, suggestions within acceptable edit distance are returned alongside exact prefix matches

**Fuzzy Match Highlighting**:
- Highlight components calculate matched substring intervals corresponding to the search term
- When typo tolerance is active, fuzzy-matched segments are highlighted within text views across Mukadma, GD, Nyayalay, Prarthna Patra, Knowledge base, and Halka views

### 4.5 Chat and AI Rules

**Context Maintenance**:
- Active chat sessions retain conversational context by including recent conversation history with each outgoing query
- Responses are parsed and rendered with structural Markdown elements

**Message Actions**:
- Copy action places clean text onto the device clipboard with confirmation feedback
- Share action invokes the native operating system sharing sheet

### 4.6 Data Storage Rules

**Local Persistence**:
- Chat conversations, format fill drafts, and field value history are persisted locally on the device
- Search indexes and historical suggestion stores operate locally for responsive offline access

---

## 5. Exceptions and Edge Cases

| Scenario | Handling |
|---|---|
| User edits auto-filled workspace pill inline and clears all text | Compact input allows empty entry; placeholder text indicates field requirement without blocking navigation |
| Device theme toggles while viewing Format Fill screen | Workspace pills and missing workspace banner immediately transition to active theme colors without losing entered inline edits |
| Missing workspace banner displayed in Dark mode | Banner renders with dark theme background, border, and text tokens instead of hardcoded bright or static warning colors |
| User uploads image with unsupported format (e.g. PDF, GIF, HEIC) for OCR | Client rejects image before request; displays alert indicating only JPEG, PNG, and WebP formats are supported |
| Uploaded image Base64 size exceeds 8MB | Client notifies user that document image exceeds 8MB size limit and requests a compressed image |
| Hardcoded or selected Gemini model returns 404 Not Found | Service model auto-discovery queries active models and selects available flash model; resets invalid cache on error |
| Gemini API responds with rate limit status (HTTP 429) | Edge function clears cache if necessary and responds with 502 status; app displays friendly message prompting user to retry shortly |
| Handwritten text in document is illegible or missing requested fields | Service returns empty strings for unidentifiable fields without guessing; client leaves corresponding inputs blank for manual officer input |
| Network disconnected during OCR extraction | Displays network error notification with option to retry once connection is restored |
| User enters query with multiple misspellings exceeding allowable edit distance | System returns nearest partial matches if available; otherwise displays empty result state with suggestion to refine query |
| Search term is empty | Clears search results, restores default recent list or placeholder guidance |
| Typo tolerance setting is disabled by user | Search, autocomplete, and highlighting revert strictly to exact prefix/substring matching |
| Autocomplete input rendered in Dark mode | Automatically applies dark theme surface, border, and text tokens without legacy styling artifacts |
| Predictive search yields zero score matches | Predictive dropdown remains hidden, leaving search input active |
| Network unavailable during AI Copilot query | Chat displays error prompt indicating no connection; local history and search remain fully accessible |
| Clipboard write permission restricted | Displays notice that clipboard access could not be completed |

---

## 6. Acceptance Criteria

1. Officer navigates to the Format Fill screen and views pre-populated 'AUTO-FILLED FROM WORKSPACE' pills (Police Station, District, Officer Name)
2. Officer taps an auto-filled pill, edits the text using the compact inline text input directly within the form, and verifies the revised value is retained without navigating away
3. Officer switches app theme between Light and Dark mode, verifying that the auto-filled pills and missing workspace banner dynamically apply matching theme tokens
4. Officer navigates to a record form (Prarthna Patra, Mukadma, or GD) and taps 「Auto-fill via OCR Scan」
5. Officer selects a scanned document image (JPEG, PNG, or WebP under 8MB) containing Hindi or English police complaint details
6. System invokes `ocr-extract-fields` edge function, which auto-discovers an active Gemini flash model (or uses cached model within 10-minute validity) and successfully extracts field values
7. Officer views the extracted fields in the review confirmation sheet and confirms insertion into the active record form
8. Officer enters a misspelled search keyword into Module Search, system returns matching records ranked by score descending with typo-tolerant fuzzy matching and matched text segments highlighted
9. Officer sends an investigation query in Chat Screen, system displays a formatted AI response with legal provisions and checklist

---

## 7. Out of Scope for This Release

- User account registration or cloud login mechanisms
- Cross-device cloud synchronization of chat history or local search indexes
- Voice input or audio recording transcription
- Direct video streaming analysis or live video OCR feeds
- Multi-language user interface localization outside standard English and Hindi support
- Direct real-time bidirectional integration with external central police database servers
- Manual reordering or drag-and-drop customization of quick action prompt chips
- Document file export to proprietary external formats
- In-app payment or subscription billing gateways