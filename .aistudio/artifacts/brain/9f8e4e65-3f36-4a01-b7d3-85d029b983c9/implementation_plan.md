# NoteVault Cloud — Personal Cloud Notes Vault

A personal document and study-notes management platform that connects directly to Google Drive, turning collections of PDFs, DOCX files, Samsung Notes (`.sdocx`), and exam prep materials into an organized, instant-search knowledge vault without storing heavy files in application storage.

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural decisions below have been aligned with your preferences and design constitution:

- **Confirmed Decision 1 (Sample Library Preset)**: Loaded with a curated multi-format study vault (PDFs, DOCX, Samsung Notes `.sdocx`, RRB/SSC exam papers, bioscience & medical notes, mathematics formula sheets) for instant testing before scanning large personal Google Drive folders.
- **Confirmed Decision 2 (Visual Aesthetic & Theme)**: Minimalist Notion Monochrome with crisp zinc/slate surfaces (`#FFFFFF` light / `#09090B` dark), subtle 1px borders, zero-pill metadata typography with middle-dot separators, and high-density scannability.
- **Confirmed Decision 3 (Gemini Study Intelligence)**: Multi-turn study tutor and formula recall engine featuring `gemini-4-argon` with high-thinking reasoning (`thinkingLevel: ThinkingLevel.HIGH`) for complex derivations and STEM problems, `gemini-3.8-flash` for multi-turn chat and summaries, and `gemini-3.1-flash-lite` for fast smart metadata extraction.
- **Confirmed Decision 4 (Science Skill Integration)**: Grounding and quick-reference inspection for bioscience, biochemistry, and pharmacology study notes, linking concepts to NCBI/PubMed, PubChem, and UniProt scientific databases.
- **Confirmed Decision 5 (Zero Heavy Storage Guarantee)**: Google Drive remains the sole file storage and source of truth. NoteVault Cloud stores only lightweight metadata, maintaining sub-millisecond local queries.

---

## 1. Overview & Core Concept

- **What It Does**: NoteVault Cloud provides an interface over Google Drive for students and professionals managing study collections (e.g. 96 GB+). It provides lightning-fast search, custom taxonomy (Exam, Subject, Topic, Year, Tags), in-browser PDF reader, specialized Samsung Notes handling, Drive sync, and an AI study companion.
- **Target Audience**: Students preparing for competitive exams (RRB NTPC, SSC, Banking, UPSC), STEM and medical/biology learners, and researchers with thousands of mixed-format documents.
- **Key Value**: Eliminates navigating deep Google Drive folder hierarchies; instantly surfaces "what do I have?", "what did I study recently?", and "where is this formula/topic?", while opening or downloading original files directly from Drive.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Onboarding & Connection Flow**:
   - Welcome Hero: *"Your Notes. Your Drive. One Beautiful Library."*
   - Transparent Security & Architecture Explainer: Visualizing how files remain strictly in Google Drive while only lightweight metadata is indexed.
   - Root Folder Selector: Pick a specific notes directory (e.g., `/Test Notes` or `/Exam Vault`) or explore the pre-loaded multi-format sample vault.
   - Animated Scan Progress: Live counter of discovered files, folders, PDFs, DOCX, and Samsung Notes.
2. **Dashboard & Quick Access**:
   - Time-aware greeting (`Good morning 👋`) and universal search bar (`/` keyboard shortcut).
   - Quick Metric Strip: Total files, PDFs, Samsung Notes, Documents, and total tracked storage.
   - *"Continue Learning"* (Recently Opened) carousel with last reading positions.
   - *"Recently Added"* and *"Storage Breakdown by Format"* charts.
3. **Library & Document Exploration**:
   - Views: Grid view (card previews with unboxed metadata), List view (dense tabular layout with tabular numbers), and Compact view.
   - Smart Filters: File format (PDF, DOCX, Samsung Note, PPTX, TXT), Exam, Subject, Topic, Year, and Favorites.
   - File Details Sheet/Drawer: Full metadata inspector, tags, drive folder path, direct action buttons.
4. **Specialized File Readers & Viewers**:
   - **PDF Document Viewer**: In-browser reading with page navigation, zoom controls, full-screen mode, outline navigation, and text search.
   - **Samsung Note (`.sdocx`) Handler**: Distinctive "Samsung Note" indicator, direct download trigger, "Open in Google Drive" shortcut, and clear notice regarding desktop/mobile Samsung Notes app compatibility.
   - **DOCX / Document Handler**: Formatted metadata viewer, file size, Drive web view link, and quick download.
5. **Gemini Study Companion & Bioscience Engine**:
   - Multi-turn conversation with chat history and role-based instruction.
   - Deep reasoning mode (`gemini-4-argon` with `ThinkingLevel.HIGH`) for complex mathematical derivations, reasoning puzzles, and scientific questions.
   - Science Reference Helper: Looks up biological pathways, chemical compounds, and PubMed literature citations for science notes.

### Visual Identity & Theme
- **Aesthetic Direction**: Minimalist Notion Monochrome with clean zinc surfaces.
- **Color Palette**:
  - Canvas: `#FFFFFF` (light) / `#09090B` (dark)
  - Secondary Surfaces: `#F4F4F5` (light) / `#18181B` (dark)
  - Hairline Borders: `1px solid #E4E4E7` (light) / `1px solid #27272A` (dark)
  - Typography: Pure black `#09090B` / crisp white `#FAFAFA`, with zinc secondary text (`#71717A`)
  - Accent: Deep charcoal/slate with subtle warm amber indicator for favorites and emerald for sync states.
- **Zero-Pill Discipline**:
  - All metadata (exam, subject, year, page count, file size) rendered as clean unboxed text separated by typographic middots (`·`).
  - Interactive filters use subtle segmented button groups (`bg-zinc-100 dark:bg-zinc-800`), not pill badges.
- **Typography**: Clean contemporary sans hierarchy with `tabular-nums` for all file sizes, dates, and counters.
- **Responsive Navigation**:
  - **Mobile (< 768px)**: Ergonomic thumb-zone bottom tab bar (Home, Library, Search, Favorites, AI Tutor), compact sticky top bar under 15% viewport height, and bottom sheet drawers for filters and details.
  - **Desktop (>= 768px)**: Collapsible sidebar navigation, right-hand file details drawer, and keyboard shortcut triggers (`/` for search, `G` for library, `F` for favorites).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Google Drive as the Single Source of Truth**
  - *Chosen Approach*: Files are streamed or opened directly from Google Drive via OAuth access tokens or web view URLs. The local database stores only metadata (ID, name, size, MIME type, exam, subject, tags).
  - *Why*: Storing 96 GB in an application database is cost-prohibitive and duplicates user files. Google Drive already provides 2 TB of reliable storage.
- **Decision 2: Client-Side Google OAuth with Server-Side Drive & Gemini Proxies**
  - *Chosen Approach*: Sign-in uses Firebase Auth with Google Drive scopes (`drive.readonly` and `drive.metadata.readonly`). API requests pass Bearer tokens through Next.js server proxy routes (`/api/drive/*`) to prevent exposing secrets.
  - *Why*: Respects AI Studio iframe constraints while guaranteeing least-privilege security.
- **Decision 3: Tiered Gemini Model Selection**
  - *Chosen Approach*:
    - `gemini-4-argon` with `thinkingLevel: ThinkingLevel.HIGH` for deep STEM reasoning and exam prep.
    - `gemini-3.8-flash` for general chat, Q&A, and document summarization.
    - `gemini-3.1-flash-lite` for instantaneous filename classification and auto-metadata suggestions.
  - *Why*: Delivers optimal speed for background scanning while providing deep analytical reasoning for study sessions.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NoteVault Cloud Client                          │
│                                                                        │
│   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  │
│   │  Bottom Nav /     │  │  Universal Search │  │  PDF & Document   │  │
│   │  Desktop Sidebar  │  │  & Smart Filter   │  │  Viewer (Canvas)  │  │
│   └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘  │
│             │                      │                      │            │
│             ▼                      ▼                      ▼            │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                 Local Metadata Store (IndexedDB / State)        │  │
│   │   • File Index (ID, mime, category, subject, exam, tags, size)  │  │
│   │   • Folder Hierarchy & Sync Timestamps                          │  │
│   │   • User Favorites, Reading History & Search Cache              │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│       Google Drive API        │               │   Next.js API & Gemini SDK    │
│  (OAuth 2.0 Bearer Token)     │               │                               │
│  • Folder Tree Discovery      │               │  • /api/gemini/chat           │
│  • Metadata Scan & Delta Sync │               │    (Argon Thinking / Flash)   │
│  • Direct File Streaming      │               │  • /api/gemini/classify       │
│  • Native Web View URLs       │               │  • /api/science/lookup        │
└───────────────────────────────┘               └───────────────────────────────┘
```

### Data Model Schema (`VaultFile`)
- `id`: string (Google Drive file ID)
- `name`: string
- `mimeType`: string
- `extension`: string (`pdf`, `docx`, `sdocx`, etc.)
- `sizeBytes`: number
- `folderId`: string
- `folderPath`: string
- `category`: string (e.g., "Exam Notes", "Reference", "Textbooks")
- `subject`: string (e.g., "Mathematics", "Reasoning", "General Science")
- `topic`: string (e.g., "Percentage", "Seating Arrangement", "Cell Biology")
- `exam`: string (e.g., "RRB NTPC", "SSC CGL", "UPSC")
- `year`: number | null
- `tags`: string[]
- `isFavorite`: boolean
- `lastOpenedAt`: string | null
- `readingProgress`: { currentPage: number; totalPages: number } | null
- `webViewLink`: string
- `downloadUrl`: string

---

## 5. Step-by-Step Implementation Sequence

1. **Step 1: Workspace & OAuth Setup**:
   - Initiate OAuth setup via `set_up_oauth` for `https://www.googleapis.com/auth/drive.readonly` and `https://www.googleapis.com/auth/drive.metadata.readonly`.
   - Configure Firebase Auth client initialization with in-memory token management.
2. **Step 2: Core State & Mock Study Vault Seed**:
   - Construct robust store with complete initial dataset (30+ realistic study documents across RRB NTPC, SSC, Science, and Samsung Notes).
   - Implement fast client-side fuzzy search across file names, subjects, topics, exams, tags, and years.
3. **Step 3: Responsive UI & Shell**:
   - Build Notion Monochrome design system with dark/light mode toggle.
   - Build desktop sidebar and mobile thumb-zone bottom navigation bar.
   - Build top bar adhering to the one-row 3-zone contract.
4. **Step 4: Library Views & Filtering**:
   - Build Grid, List, and Compact file views.
   - Build faceted filter drawer (format, exam, subject, tags, year, sort order).
   - Build file details drawer with editable metadata and tag assignment.
5. **Step 5: PDF Viewer & Samsung Note Experience**:
   - Build in-browser PDF reader with zoom, page flipping, search, and full-screen toggle.
   - Build specialized `.sdocx` handler with clear compatibility guidance, direct download, and Drive open link.
6. **Step 6: Gemini Study Assistant & Thinking Mode**:
   - Implement multi-turn chat endpoint using `@google/genai` server-side SDK.
   - Integrate `gemini-4-argon` with `thinkingLevel: ThinkingLevel.HIGH` for deep study queries.
   - Integrate Bioscience Science Skills helper for biology/chemistry exam notes.
7. **Step 7: Drive Sync Engine & Analytics**:
   - Build library folder scanner, delta sync simulation/live sync, and storage distribution analytics.
   - Verify compilation with `compile_applet`.
