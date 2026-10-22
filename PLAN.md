# Lorebook Studio - Build Plan

Status: Foundation, editor depth, and interoperability export (v0.5)
Updated: 2026-10-22

## 1. Summary

Lorebook Studio is a local-first web utility for writing, organizing, and exchanging lorebooks used by LLM roleplay frontends such as SillyTavern and Chub. It should feel quiet and fast: a readable dark workspace, no account, no backend, and no ceremony between opening the tool and editing an entry.

The current build is a working multi-book editor with frontend-targeted exchange. It can import native projects, SillyTavern World Info, Chub lorebooks, and `lorebook_v3` character books; export the active book as native, SillyTavern World Info v2, or Chub JSON; preview imports; and create a local pre-import backup before replacement.

## 2. Goals

- Make entry authoring pleasant enough to use for long sessions.
- Preserve entry semantics accurately when importing and exporting.
- Keep the tool local-first and dependency-light.
- Support multiple lorebooks inside one project without making single-book work feel heavy.
- Stay legible: strong contrast, clear focus states, restrained visual noise.
- Be keyboard friendly and responsive down to phone widths.

## 3. Non-goals for v1

- Replacing a roleplay frontend or running model inference.
- Embedding a chat client.
- Account systems, cloud sync, or collaboration.
- Image generation or character card artwork editing.
- Emulating every activation rule at runtime. The editor captures settings; consumers apply them.

## 4. Current Foundation (v0.5)

### What works

- One local project containing multiple lorebooks.
- Lorebook create, rename, switch, and delete.
- Editable book descriptions stored with each lorebook and previewed in the sidebar.
- Book-level validation for empty content, repeated or overlapping keys, missing keys on non-constant entries, and insertion-order collisions, with jump-to-entry issue links.
- Entry create, select, edit, duplicate, and delete.
- Search across title, content, trigger keys, and secondary keys.
- Entry fields: title, trigger keys, secondary keys, content, enabled state, always-on, selective, case sensitivity, whole-word matching, insertion order, position, and trigger probability.
- Live character, word, and approximate token counts.
- Debounced localStorage autosave with a save-state indicator and unload flush.
- Native project JSON import and full-project backup export.
- Single-book export to native, SillyTavern World Info v2, and Chub JSON.
- Chub, SillyTavern World Info, and character-book import through format adapters.
- Import preview with detected format, file name, book and entry counts, and adapter warnings.
- Automatic pre-import backup with saved backup metadata and one-click restore.
- Collision-free numeric UID allocation on export.
- Imported unknown book and entry fields preserved per source format and restored only when exporting back to that format.
- Session undo/redo for edits, structural changes, bulk actions, reordering, duplication, project replacement, import, and backup restore.
- Drag reordering in manual order plus keyboard reordering with `Alt+ArrowUp`/`Alt+ArrowDown`.
- Multi-select with `Ctrl/Cmd+click` and `Shift+click`, plus bulk enable, disable, delete, and clear actions.
- Sort modes: manual order, title, insertion order, last edited, and enabled first. The preference persists locally.
- Compact entry ID badges use source IDs when available and a stable compact fallback for native entries.
- Destructive actions behind a styled confirmation dialog.
- Keyboard shortcuts: `/` search, `Alt+N` new entry, `Ctrl/Cmd+S` save, `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` redo.
- Responsive layout with a stacked sidebar/editor arrangement on narrow screens.
- Sample "Aurora Vale" project so the interface is meaningful on first run.

### Known gaps

- Character card containers, standalone character-book export, Chub wrapper variants beyond `lorebook_v3` import, and RisuAI-native exports are not supported yet.
- Chub and SillyTavern advanced fields are preserved from matching source files but are not editable in the UI.
- Export warnings are supported by the adapter contract, but current serializers do not yet emit lossy-field warnings.
- Import currently replaces the project; merge and append strategies are not implemented.
- Duplicate source UIDs within a manually edited import are not remapped before normalization.
- Undo history is session-only and is not restored after reload.
- Drag reordering is limited to manual order with no active search, because reordering a filtered subset is ambiguous.
- Token count is an estimate of `ceil(characters / 4)`, not a real tokenizer.
- No lint configuration or committed automated browser test suite yet.
- The sample project appears on first run; there is no onboarding flow or sample reset.

### File map

| Path | Purpose |
| --- | --- |
| `index.html` | Static application shell, icons, dialog, toast region |
| `src/styles.css` | Design tokens, layout, components, responsive rules |
| `src/main.js` | Event wiring, save orchestration, shortcuts, import/export flow |
| `src/schema.js` | Canonical project/book/entry factories and position values |
| `src/store.js` | Project state, mutation actions, undo/redo, selection, and sorting mode |
| `src/storage.js` | Project localStorage load/save plus pre-import backup save/restore |
| `src/validation.js` | Book-level content, key, and insertion-order issue detection |
| `src/format.js` | Import entry point, project backup serialization, export registry, download helper |
| `src/formats/` | Detection, normalization, serialization, capabilities, and Chub, SillyTavern, and native adapters |
| `src/sample.js` | First-run demo project |
| `src/ui/sidebar.js` | Book switcher, search, sorting, selected/drag entry rendering |
| `src/ui/editor.js` | Editor population and statistics |
| `src/ui/overlays.js` | Confirmation dialog with details/warnings and toasts |
| `src/utils.js` | IDs, clamp, slugify |
| `test/formats.test.js` | Detection, field mapping, fixture round-trips, capabilities, and native serialization tests |
| `test/schema.test.js` | Normalization, defaults, clamping, and active-ID resolution tests |
| `test/validation.test.js` | Empty content, duplicate key, missing key, and order collision tests |
| `test/fixtures/` | Realistic SillyTavern and Chub interchange fixtures |
| `test/storage.test.js` | Project persistence and pre-import backup tests |
| `test/store.test.js` | History, description edits, duplication, selection, bulk actions, reordering, and sorting tests |
| `.github/workflows/ci.yml` | CI syntax checks and unit tests on pushes and pull requests |
| `scripts/serve.mjs` | Zero-dependency static dev server |
| `package.json` | Dev/check/test scripts |

### Run locally

```powershell
npm start
```

Open `http://localhost:4173`. The app has no build step and no runtime dependencies. Any static file server works, but ES modules require HTTP rather than `file://`.

## 5. Architecture

### Shape

Static single-page application using native ES modules. No framework, no bundler, no backend. The browser is the source of truth during a session; localStorage is the persistence layer.

```text
index.html
  -> src/main.js (orchestration + events)
       -> store.js (mutations + active selection)
            -> schema.js (normalization + factories)
       -> validation.js (book-level issue checks)
       -> storage.js -> format.js -> formats/ (detection + adapters)
       -> ui/{sidebar,editor,overlays}.js (targeted rendering)
```

### Data flow

1. User input updates the active entry or book through `store.js`.
2. Mutating actions capture a bounded project snapshot; rapid edits to the same field group coalesce into one history step.
3. The UI re-renders only the affected regions. Typing in the editor avoids replacing editor inputs.
4. A 400 ms debounced save writes the normalized project to localStorage and updates the header state.
5. Import parses, detects, and normalizes the file; the preview reports format and warnings. Confirmation creates a pre-import backup, then replaces project state, captures a history snapshot, and re-renders.
6. Export chooses either the full project backup or one active-book adapter, serializes it, and downloads it. Backup restore is available from the export dialog and is undoable through project replacement.

### Why vanilla

- Zero install friction and simple deployment.
- Every behavior is auditable in a small codebase.
- Canonical data model is independent of UI rendering.

The main risk is state/rendering complexity as the feature set grows. Revisit only if the editor grows interactions that are hard to express with targeted DOM updates. A framework migration is not a goal.

### Future extension points

- `formats/` adapters around the canonical schema.
- A tokenizer worker for counted tokens.
- IndexedDB repository for large projects and revision history.
- Virtualized entry lists for books with thousands of entries.
- A command palette and keyboard-driven navigation layer.

## 6. Canonical Data Model

### Project

```text
{
  version,
  activeBookId,
  activeEntryId,
  ui: { searchQuery, sortMode },
  books: Book[]
}
```

`ui` is session state and is not part of exported interchange formats. `sortMode` belongs to the current session state, while the chosen preference is also stored separately in localStorage. Selection state is session-only and lives in the store module.

### Book

```text
{
  id, name, description,
  entries: Entry[],
  createdAt, updatedAt
}
```

`description` is edited from a collapsible sidebar control and is included in native project backups.

### Entry

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Internal identity; must survive edits |
| `title` | string | Author-facing name, maps to ST `comment` / character book `name` |
| `keys` | string[] | Primary trigger keys |
| `secondaryKeys` | string[] | Optional secondary keys |
| `content` | string | Injected text |
| `enabled` | boolean | Inverse of ST `disable` |
| `constant` | boolean | Always-on entry |
| `selective` | boolean | Selective matching flag |
| `caseSensitive` | boolean | Matching option |
| `matchWholeWords` | boolean | Matching option |
| `order` | number | Insertion order, 0-9999 |
| `position` | enum | `before_char`, `after_char`, `before_an`, `after_an`, `at_depth` |
| `probability` | number | Trigger chance, 0-100 |
| `createdAt` | number | Internal metadata |
| `updatedAt` | number | Internal metadata |

Internal names are intentionally readable and stable. Frontend quirks and numeric enums belong in adapters, not in the editor.

### Native format

The full-project backup uses a Lorebook Studio container:

```text
{
  app: "lorebook-studio",
  version: 1,
  exportedAt,
  activeBookId,
  activeEntryId,
  books: Book[]
}
```

Single-book native export uses the same container with one book and normalized active IDs. SillyTavern and Chub exports are standalone exchange files rather than native containers. Labels and documentation must stay explicit about the selected target.

## 7. Format Interoperability Plan

### Implemented targets

1. SillyTavern World Info JSON (standalone lorebook import and export).
2. Chub lorebook import and export.
3. `lorebook_v3` character-book import.
4. Native Lorebook Studio project backup plus single-book native export.

### Adapter contract

Each adapter provides:

- `detect(input)` - confidence that a parsed file belongs to this format.
- `parse(input)` - normalize into the canonical project/book/entry shape.
- `serialize(book)` - produce a valid single-book target payload.
- `capabilities` - declared import/export support and unknown-field preservation.
- `warnings` - actionable notes when data cannot round-trip, surfaced in import preview or export toasts.

Import pipeline:

```text
read file -> JSON parse -> detect -> adapter normalize -> validate -> preview/confirm -> backup -> canonical state
```

Export pipeline:

```text
canonical state -> choose project or active book -> map fields -> validate -> serialize -> download
```

### Field mapping

| Canonical | SillyTavern World Info | Chub |
| --- | --- | --- |
| `title` | `comment` | `comment` + `name` |
| `keys` | `key` | `key` + `keys` |
| `secondaryKeys` | `keysecondary` | `keysecondary` + `secondary_keys` |
| `content` | `content` | `content` |
| `enabled` | inverse of `disable` | `disable` + `enabled` |
| `constant` | `constant` | `constant` |
| `selective` | `selective` | `selective` |
| `order` | `order` | `order` + `insertion_order` |
| `position` | numeric `position` | numeric `position` |
| `probability` | `probability` + `useProbability` | `probability` + `useProbability` |
| `caseSensitive` | `caseSensitive` | `caseSensitive` + `case_sensitive` |
| `matchWholeWords` | `matchWholeWords` | `matchWholeWords` + `match_whole_words` |

Exported UIDs are allocated without collisions while retaining numeric source IDs when available. Unknown source fields are preserved in the canonical extension bucket and restored only when exporting back to the same source format. Advanced SillyTavern fields such as depth, role, groups, recursion, sticky, cooldown, and scan depth remain preserved rather than editable.

### Round-trip requirements

- Export, re-import, and compare canonical snapshots for realistic SillyTavern and Chub fixtures.
- Keep format detection and unknown-field restoration covered by tests.
- Preview format, counts, and warnings before destructive replacement.
- Create a local pre-import backup before replacement, with recoverability if backup storage fails.
- Treat single-book export as the primary flow and project bundles as backups.

## 8. UX and Visual Design

### Layout

```text
+------------------------------------------------------------------+
| brand | lorebook name | save state                  Import Export |
+----------------+-------------------------------------------------+
| lorebook switcher | entry name            Enabled   Delete      |
| search            | trigger keys | secondary keys               |
| entry list        | content + live statistics                    |
|                   | injection settings + option chips            |
| new entry         |                                             |
+----------------+-------------------------------------------------+
```

The sidebar is the library. The main pane is the document. There are no nested settings pages in the foundation.

### Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0b0d12` | App background |
| `--surface` | `#11151c` | Main panels |
| `--surface-sunken` | `#0e1118` | Inputs |
| `--surface-raised` | `#161b24` | Dialog, raised UI |
| `--border` | `#232936` | Default separators |
| `--text` | `#e9edf4` | Primary text (16.5:1 on background) |
| `--muted` | `#99a3b5` | Secondary text (7.2:1 on surface) |
| `--faint` | `#7c8799` | Hints and labels (5.0:1 on surface) |
| `--accent` | `#8fa8ff` | Selection, focus, primary actions (8.5:1 on background) |
| `--danger` | `#ff8795` | Destructive actions (8.0:1 on surface) |
| `--success` | `#7ee2b8` | Enabled/status accents |

Selected surfaces use accent tints rather than saturated fills. Borders carry structure. Shadows are reserved for dialogs and toasts.

### Typography

- System UI stack, no web-font dependency.
- 13-14 px for controls and body UI, 22 px for the entry title.
- 10.5 px uppercase labels with wide tracking for navigation and section structure.
- Content editing uses 14 px with 1.68 line height for sustained reading.
- Monospace only for counts, numeric values, and shortcut hints.

### Spacing and shape

- 4 px base rhythm; 12-26 px section spacing.
- 8 px controls, 12 px content surfaces, 16 px dialogs.
- 1 px borders at low contrast; stronger borders only on hover or focus.
- Subtle radial background glow provides depth without competing with text.

### Interaction patterns

- Autosave is the default; the header communicates Saving, Saved, or Unsaved.
- Destructive actions require confirmation; ordinary actions do not.
- Import confirmation is a preview with format, counts, and warnings. It creates a pre-import backup before replacement and leaves backup restore one click away in the export dialog.
- The export dialog offers a full project backup plus single-book native, SillyTavern, and Chub targets.
- Book descriptions live in a collapsible sidebar control with a one-line preview.
- The entry-list warning control summarizes validation issues; its dialog groups issues by type and makes each issue jump to the affected entry after clearing search.
- The active entry is visually anchored and mirrored in the editor.
- Multi-selected entries are distinct from the active entry; a bulk action bar appears only while a selection exists.
- Drag reordering is available in manual order without a search query. Each card also supports keyboard reordering.
- Entry cards show compact IDs, with the full internal ID exposed in a tooltip.
- Inline options are chips; grouped numeric/enumerated settings live in one injection row.
- Toasts confirm imports, exports, save failures, duplication, bulk changes, and deletions.
- Empty states explain the next action and expose the primary CTA.

### Accessibility

- Text colors meet WCAG AA for their intended sizes; muted and faint tokens are tested against their surface.
- Visible focus rings on controls; native dialog provides focus containment.
- Every input has a label; icon-only buttons have `aria-label` and titles.
- Save state, entry count, and bulk selection count use live regions.
- Entry controls have keyboard equivalents, including Enter/Space activation and `Alt+Arrow` reordering.
- `prefers-reduced-motion` disables animation.
- Imported strings are rendered with `textContent`; no imported HTML is executed.
- Planned: full keyboard navigation of the entry list, screen-reader pass, and automated axe checks.

### Responsive behavior

- Above 1000 px: 312 px library plus fluid editor.
- 1000 px and below: narrower library, two-column settings.
- 900 px and below: compact topbar, brand text hidden.
- 780 px and below: stacked sidebar (40 vh) above editor.
- 600 px and below: single-column fields, compact icon-only import/export.
- 430 px and below: save label hidden in the topbar, compact dialog padding, and hidden export-format meta pills.

## 9. Roadmap

### Phase 0 - Foundation (complete)

Deliverables: application shell, design system, canonical schema, local persistence, native CRUD, search, native project import/export, responsive layout, sample project.

Exit criteria: the app loads with no build step, edits persist across reloads, native export can be imported back, and destructive actions are guarded.

### Phase 1 - Editor depth

Completed: entry duplication, manual and sorted ordering, drag and keyboard reordering, multi-select bulk actions, session undo/redo, entry ID badges, editable book descriptions, and the validation panel.

Remaining: richer empty/search states, resizable panes, and full keyboard list navigation.

Exit criteria: a 100-entry book can be maintained without leaving the keyboard, and common editing mistakes are recoverable.

### Phase 2 - Interoperability

Completed: adapter contract with capabilities, SillyTavern World Info import/export, Chub import/export, `lorebook_v3` character-book import, collision-free UID export, import preview, field-level warnings, pre-import backup/restore, round-trip fixtures, and single-book/project export choices.

Remaining: standalone character-book export, character card containers, broader Chub wrapper coverage, and merge strategies.

Exit criteria: real lorebooks from both frontends round-trip without unintended data loss, and unsupported fields are reported before import.

### Phase 3 - Context intelligence

Deliverables: real tokenizer, token budget analysis, key collision detection, entry coverage report, context preview/simulation, bulk key editing, regex/advanced key support, templates.

Exit criteria: authors can see what a book will cost in context and catch overlapping or dead keys before play.

### Phase 4 - Scale and durability

Deliverables: IndexedDB storage, project files via File System Access API, broader automatic snapshots beyond pre-import backup, revision history, large-book virtualization, import merge strategies, export diff.

Exit criteria: a 2,000-entry book remains responsive and a corrupted or accidental import is recoverable.

### Phase 5 - Release polish

Deliverables: onboarding, command palette, additional themes, help documentation, accessibility audit, automated browser tests, deployment pipeline, version/about panel.

Exit criteria: a new user can create and export their first lorebook without external documentation.

## 10. Quality Bar and Verification

Current checks:

- `npm run check` validates every JavaScript module syntactically.
- `npm test` covers Chub, SillyTavern, character-book import, native and frontend fixture round-trips, capabilities, unsupported files, project persistence, pre-import backup/restore, history, description edits, duplication, selection, bulk actions, reordering, sorting, schema normalization, and validation. The suite currently passes 34 tests.
- GitHub Actions runs `npm run check` and `npm test` on pushes to `main` and pull requests.
- The static server returns correct module content types.
- Headless Chrome verified the export and validation dialogs at 1440, 390, and 320 px with no horizontal document or dialog overflow.
- Browser session checks covered project backup download, single-book SillyTavern export, import-preview details and warnings, automatic backup creation, backup restore, undoable project replacement, description editing and reload persistence, validation counts, issue filtering, and jump-to-entry.
- Visual review covered the export dialog, validation dialog, import preview, backup metadata, mobile dialog layout, focus, contrast, and empty space.

Planned checks:

- Broader Chub fixture coverage against additional real exported files.
- A committed browser end-to-end test suite for CRUD, autosave, import/export, shortcuts, and dialogs.
- Automated accessibility scan plus manual screen-reader pass.
- Performance target: smooth interaction with 1,000 entries and 500,000 characters in a project.

## 11. Technical Decisions and Risks

### Decisions

- Local-first, static hosting, no backend.
- Native canonical schema as the hub; formats are adapters.
- Dark-only v1. Light theme waits until tokens and components are stable.
- Native JSON project container for project backups; frontend adapters for single-book exchange.
- Single-book export is the primary authoring flow; full project export is a backup.
- Pre-import backups use the same native project container and remain restorable from the export dialog.
- Autosave with explicit status, not manual-save-only.

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Frontend schemas drift | Broken or lossy imports | Adapter isolation, fixtures, schema version checks |
| localStorage quota (~5 MB) | Failed saves with large books | Save-state error, IndexedDB migration, export backups |
| Destructive import | Data loss | Confirmation, preview phase, automatic pre-import backup |
| Approximate tokens mislead authors | Budget errors | Label as approximate; implement real tokenizer |
| Vanilla rendering complexity | UI bugs as features grow | Targeted renders, tests, small UI modules |
| Scope creep into a chat client | Diluted product | Keep non-goals explicit |

## 12. Immediate Next Steps

1. Add standalone character-book export and broaden Chub fixture coverage.
2. Add full keyboard navigation and import merge strategies.
3. Commit a browser end-to-end suite and extend CI to run it.
4. Move storage to IndexedDB and add broader automatic snapshots for large projects.
5. Add bulk insertion-order changes and replace comma-separated key inputs with editable chips.

## 13. Open Questions

- Which export is the primary target for the first release: standalone ST World Info, embedded character book, or Chub?
- Should a project remain multi-book, or should the app also open one file per book like a document editor?
- Which tokenizer should be bundled, and how should its payload size be managed?
- How much advanced SillyTavern metadata should be exposed in the UI versus preserved on import/export only?
- Are character card containers (PNG/CHARX) in scope, or only standalone lorebook files?
- What is the expected maximum book size for the first release?
