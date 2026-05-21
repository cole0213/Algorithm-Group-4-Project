# Feature Specification — Portfolio Reviewer

> Last updated: 2026-05-21
> Full list of implemented features as of prototype-v2

---

## Table of Contents

1. [Portfolio Management](#1-portfolio-management)
2. [Spec Matching & Sorting](#2-spec-matching--sorting)
3. [Search](#3-search)
4. [Similar Sentence Detection](#4-similar-sentence-detection)
5. [Review Assistance](#5-review-assistance)
6. [View & UI](#6-view--ui)
7. [Data Management](#7-data-management)
8. [User Convenience](#8-user-convenience)
9. [Settings](#9-settings)

---

## 1. Portfolio Management

### 1-1. Add Portfolio
- **Supported formats**: `.pdf`, `.md`, `.txt` file upload, or direct text paste
- **File upload**: Drag-and-drop or click to select
- **Position type**: General / Frontend / Backend / Data AI — Solar LLM prompt branches per type
- **Applicant name**: Optional input (auto-set from filename if omitted)
- **Solar LLM parsing**: Uploaded portfolio is automatically standardized by Solar AI
- **Fallback**: If Solar parsing fails, automatically falls back to basic_parser
- **Upload progress**: 4-step indicator — Reading file → LLM parsing → Saving → Done
- **Parse debug info**: Elapsed time, token count, and truncation flag visible
- **Truncation warning**: ⚠ banner displayed on panel if source text exceeds 8,000 characters
- **Duplicate detection**: Warning shown on re-upload of same filename or name

### 1-2. Re-parse Portfolio
- Re-analyze an existing portfolio with Solar LLM without re-uploading the file
- Re-analyze button available inside the panel

### 1-3. Delete Portfolio
- Delete via ✕ button on sidebar item
- **Undo**: Toast notification with cancel button shown for 5 seconds after deletion

### 1-4. Rename
- Double-click a sidebar item → inline name edit (Enter to save, Esc to cancel)

---

## 2. Spec Matching & Sorting

### 2-1. Spec Matching Analysis
- Enter required specs (comma-separated) in the top bar and click `Analyze`
- **Algorithm**: Hash table O(1) skill matching + LCS DP match score calculation
- **Result**: Match rate (0–100%) per applicant, sidebar badge and panel highlight updated
- **Summary banner**: "M out of N applicants matched 70% or above" displayed after analysis (closable with ✕)

### 2-2. Custom Match Score Weights
- Adjust skill ratio / career years ratio / project count ratio via sliders
- Changes in the settings drawer are synced to backend weighted scoring

### 2-3. Sorting
- Sort dropdown in top bar: **Highest match** / **Most experience** / **Name (A–Z)**
- **Algorithm**: Custom sort (sort.py)

### 2-4. Match Rate Badge
- Match rate displayed on each sidebar item
- 70%+: green / 40–69%: orange / 39% or below: red / Not analyzed (0%): gray

---

## 3. Search

### 3-1. Global Keyword Search (cross mode)
- Input in the top search bar (300ms debounce)
- **Alias search**: `JS` → `JavaScript`, `py` → `Python`, etc. via alias hashmap
- **Typo tolerance**: Edit Distance for fuzzy keyword matching
- **BST search**: BST index-based search across all portfolios
- Applicants with no results are faded (opacity 0.4) in the sidebar

### 3-2. In-panel Search (intra mode)
- Individual search bar at the top of each portfolio panel
- Real-time highlight within that panel's text only
- Result count displayed + ▲▼ buttons to navigate previous/next match
- Auto-scrolls to first result

### 3-3. Search History
- Up to 8 recent search terms saved in localStorage
- Dropdown shown on search bar focus for quick reuse

### 3-4. Sidebar Name Filter
- Separate name search input at the top of the sidebar (independent from global search)
- ✕ button to clear instantly

---

## 4. Similar Sentence Detection

### 4-1. Automatic Detection
- **Algorithm**: Rabin-Karp sliding window for candidate extraction + LCS for similarity scoring
- Passages exceeding threshold are assigned a group color and highlighted in panels
- Detection scope: **All portfolios** or **Currently open panels only**

### 4-2. Display Control
- Toggle show/hide in the settings drawer
- Hide ON: similar passages faded to opacity 0.3 (not deleted)
- Per-panel show/hide button available independently

### 4-3. Diff Comparison Modal
- "⇄ Compare" button appears when exactly 2 panels are open
- Displays similar passages from both applicants side by side
- Solar AI diff and local algorithm diff distinguished by badge

### 4-4. Group Color Customization
- 6 groups × 9 color presets selectable
- `↻ Re-detect similar sentences` button

---

## 5. Review Assistance

### 5-1. Applicant Marking
- Mark each applicant as **Pass / Hold / Fail** from the sidebar item
- Selected via dropdown, permanently saved in localStorage
- Color-coded status: green / yellow / red

### 5-2. Bookmark
- ☆/★ button to bookmark an applicant
- Bookmarked items pinned to the top of the sidebar
- Saved in localStorage

### 5-3. Per-applicant Memo
- Textarea at the bottom of each portfolio panel
- Free-form review comments, auto-saved to localStorage

### 5-4. Blind Review Mode
- Toggle in settings drawer
- When ON, applicant names are hidden in the sidebar and panels
- Enables content-only evaluation free from unconscious bias

### 5-5. Added-at Timestamp
- `_added_at` timestamp automatically saved when a portfolio is added
- Displayed in the basic info section of the panel

---

## 6. View & UI

### 6-1. Portfolio Panel
- Up to 4 panels displayed side by side in the right area, flex: 1 dynamic split
- **Section accordion**: Basic info / Tech stack / Introduction / Projects / Awards — each collapsible independently
- **Skill tags**: Shows 5 by default, "Show more" button to expand all
- **Link button bar**: GitHub, Notion, LinkedIn, and other key URLs from the portfolio displayed as buttons at the top of the panel (platform emoji icons)
- **Solar badge**: "Solar" label + hover tooltip when parsed by Solar LLM
- **Code block rendering**: Code blocks in portfolios rendered as `<pre>` elements
- **Markdown bold and link** rendering

### 6-2. Raw Text View
- "View original →" button at the bottom of the panel
- Displays pre-standardization raw text in an overlay modal

### 6-3. Panel Fullscreen Mode
- ⊞/⊡ button to expand a single panel to full screen
- Esc to exit

### 6-4. Synchronized Scroll
- Toggle in the top-right of the panel area
- When ON, scrolling one panel proportionally scrolls all other panels

### 6-5. Skill Matrix
- ⊞ button in the top bar
- Grid table of all applicants × all skills
- Compare skill coverage at a glance, sorted by frequency

### 6-6. Dark Mode
- Toggle in settings drawer
- `body.dark` class + CSS variable override

### 6-7. Filter Panel (Sidebar)
- Expand filter panel inside the sidebar
- Filter conditions: **Minimum career years** / **Skill includes** / **Name includes** / **Added date range**

---

## 7. Data Management

### 7-1. Server Persistence
- `backend/session.json` auto-saved on every add, delete, or update
- Data retained after server restart

### 7-2. Browser Cache
- Stored in localStorage under key `portfolio-reviewer-cache`
- Cache data displayed immediately on page load → refreshed with latest data after backend responds
- Cache remains accessible even when backend is offline

### 7-3. Export
- Click ↓ button in the top bar
- Downloads all current session portfolios as a JSON file

### 7-4. Import
- Select JSON file via ↑ button in the top bar
- Choose **Overwrite** or **Merge** mode (confirm dialog)
- Duplicate IDs handled automatically

### 7-5. Job Posting → Auto Spec Extraction
- Paste a job posting text into the popup in the top bar
- Solar LLM parses it into `required` / `preferred` specs JSON
- Auto-fills the analysis input field

---

## 8. User Convenience

### 8-1. Toast Notifications
- Snackbar shown in the bottom-right on portfolio add / delete / import / re-analyze completion

### 8-2. Skeleton UI
- 3 shimmer placeholder cards shown during analysis, replaced by the actual list on completion

### 8-3. Empty State Screen
- When no portfolios exist, Sidebar and PortfolioArea show a guidance message with an add button

### 8-4. Panel Scroll Position Restore
- Scroll position is automatically restored when a panel is closed and reopened

### 8-5. Keyboard Shortcuts
- `Esc`: Close modal / drawer / panel

### 8-6. Name Tooltip
- When a name is truncated with an ellipsis in the sidebar, hovering shows the full name

---

## 9. Settings

Accessible via the `⚙` button (settings drawer):

| Setting | Default | Description |
|---------|---------|-------------|
| Skill highlight | ON | Highlight matched spec badges after analysis |
| Similar sentences | ON | Color-highlight similar passages across portfolios |
| Hide similar | OFF | Fade similar passages to opacity 0.3 |
| Sync scroll | OFF | Proportional scroll sync across panels |
| Link button bar | ON | Show link buttons at the top of each panel |
| Alias search | ON | Unified search for synonyms and typos (py, 파이선, etc.) |
| Blind review | OFF | Hide applicant names |
| Dark mode | OFF | Dark color theme |
| Match weight sliders | Equal | Adjust skill / career / project score ratios |
| Similar detection scope | All | All portfolios or open panels only |
| Group color customization | Preset | Change highlight color per similarity group |
