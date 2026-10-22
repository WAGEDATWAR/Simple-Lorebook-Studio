# TODO

Priorities: P0 = next release blocker, P1 = high value, P2 = later.
Status: `[ ]` open, `[~]` in progress, `[x]` done.

## Foundation (v0.1, complete)

- [x] Static application shell with dark visual system.
- [x] Canonical project, book, and entry schema.
- [x] Multi-book project state with create, rename, switch, delete.
- [x] Entry create, select, edit, and delete.
- [x] Core entry fields and injection settings.
- [x] Search across title, content, and keys.
- [x] Live character, word, and approximate token counts.
- [x] Debounced localStorage autosave and save status.
- [x] Native project JSON import and export.
- [x] Confirmation dialog for destructive actions.
- [x] Toasts for import, export, save, and delete feedback.
- [x] Responsive layout verified at 1440 px and 390 px.
- [x] Basic keyboard shortcuts and accessible labels.
- [x] Sample project for first-run demonstration.
- [x] Syntax check script and zero-dependency dev server.

## Next Up

- [x] [P0] Build the format adapter layer with `detect`, `parse`, `serialize`, and warnings.
- [x] [P0] Implement SillyTavern World Info v2 import and export.
- [x] [P0] Add real fixture tests that export, re-import, and compare canonical snapshots.
- [x] [P0] Add single-book export alongside the whole-project backup.
- [x] [P0] Add an import preview stage and automatic pre-import backup.
- [x] [P1] Add automated tests for schema, store actions, and native format handling.
- [x] [P1] Add entry duplication and reordering.
- [x] [P1] Add undo/redo for edits and structural changes.
- [x] [P1] Expose the stored book description in the interface.
- [x] [P1] Add a validation panel for empty content, duplicate keys, missing keys on non-constant entries, and order collisions.

## Editor and Authoring

- [ ] [P1] Replace the comma-separated key inputs with editable key chips while keeping paste support.
- [x] [P1] Add multi-select and bulk enable, disable, and delete.
- [ ] [P1] Add bulk insertion-order changes for selected entries.
- [x] [P1] Add sort modes: manual, title, insertion order, last edited, and enabled state.
- [x] [P1] Add accessible reordering with `Alt+ArrowUp` and `Alt+ArrowDown` in manual order.
- [x] [P1] Add built-in entry templates and a template picker.
- [ ] [P2] Add a "duplicate as template" flow for custom reusable entries.
- [ ] [P1] Support regex keys with validation and a plain-text fallback.
- [ ] [P2] Add a diff view when replacing or merging imported entries.
- [x] [P2] Add a notes or author-only field separate from injected content.
- [ ] [P2] Add configurable word/character/token limits per entry.
- [ ] [P2] Support markdown preview for content if the target frontends interpret it consistently.
- [ ] [P2] Add per-entry color or tag labels for visual grouping.
- [ ] [P2] Add a "peek" preview showing the text as it would be injected.

## Interoperability

- [x] [P0] Verify exact field names and position enum values against current SillyTavern and Chub schemas.
- [x] [P0] Preserve unknown imported fields in an extension bucket for lossless round-trips.
- [x] [P0] Generate stable unique UIDs during export and avoid collisions during import.
- [x] [P0] Report unsupported or lossy fields before import/export completes.
- [~] [P1] Implement character book lorebook import and export. (import complete; standalone character-book export pending)
- [x] [P1] Implement Chub lorebook import and export using real exported files.
- [x] [P1] Add format detection and a clear "unsupported file" message.
- [ ] [P1] Add import merge strategies: replace, append, merge by title.
- [x] [P1] Preserve advanced SillyTavern fields such as recursion, depth, role, groups, sticky, cooldown, and scan depth.
- [x] [P1] Add filename conventions for book exports and project backups.
- [ ] [P2] Support character card containers (PNG/CHARX) and embedded character books.
- [ ] [P2] Add JSON/YAML plain-export options for scripting.
- [ ] [P2] Add a schema reference page generated from the canonical model.

## Organization and Search

- [ ] [P1] Add tags and/or folders for books and entries.
- [ ] [P1] Add filters for enabled, disabled, always-on, and entries missing keys.
- [ ] [P1] Highlight search matches and expose why an entry matched.
- [ ] [P1] Keep search results stable when the active entry is filtered out.
- [ ] [P1] Add keyboard navigation in the entry list: arrow keys, Home, End, Enter.
- [ ] [P1] Preserve list scroll and focus across mutations and re-renders.
- [x] [P2] Add a book-level overview with entry count, token totals, and key coverage.
- [ ] [P2] Add pinned or recent entries.
- [x] [P2] Add overlapping key reports and key coverage summaries.

## Context and Token Tools

- [ ] [P1] Replace the character/4 estimate with a real tokenizer running in a worker.
- [x] [P1] Show token counts per entry, per enabled set, and per book.
- [ ] [P1] Add a token budget field and warnings when a book exceeds it.
- [ ] [P1] Add a context simulation view showing likely activation order and injected text.
- [ ] [P1] Add key collision and unreachable-entry detection.
- [ ] [P2] Add configurable model/tokenizer presets.
- [ ] [P2] Add context window presets for common frontend configurations.
- [ ] [P2] Add bulk operations based on token size.
- [ ] [P2] Cache tokenization results per entry revision.

## Data and Persistence

- [x] [P0] Add a local backup before destructive imports.
- [ ] [P1] Move project storage to IndexedDB with a migration from localStorage.
- [ ] [P1] Handle storage quota failures with clear recovery instructions and export shortcuts.
- [x] [P1] Add revision history or automatic snapshots with restore.
- [ ] [P1] Add File System Access API support for opening and saving project files.
- [ ] [P1] Add a periodic reminder to export a backup.
- [ ] [P2] Add optional project import/export of the full UI state.
- [ ] [P2] Add cloud sync only if it can remain opt-in, private, and simple.
- [ ] [P2] Add storage usage reporting.
- [ ] [P2] Add encrypted local projects if sensitive content becomes a requirement.

## UI, UX, and Accessibility

- [x] [P1] Add collapsible or resizable panes and remember the chosen layout.
- [ ] [P1] Add a mobile library drawer instead of the fixed stacked sidebar if authoring on phones becomes common.
- [ ] [P1] Run an automated accessibility audit and fix all critical issues.
- [ ] [P1] Verify focus restoration after delete, book switch, and dialog dismissal.
- [ ] [P1] Add a proper unsaved-changes strategy for failed localStorage writes.
- [ ] [P1] Add an onboarding flow and a clear sample-project badge/reset.
- [ ] [P1] Add a command palette for quick actions.
- [ ] [P2] Add a light theme or theme tokens once the component set stabilizes.
- [ ] [P2] Add density options for compact entry lists.
- [ ] [P2] Add resizable text areas with remembered heights.
- [ ] [P2] Add helpful empty, error, and loading states for every async action.
- [ ] [P2] Add a keyboard shortcuts reference dialog.
- [ ] [P2] Add a focus mode that hides the sidebar while writing.
- [ ] [P2] Tune toast timing and prevent duplicate failure toasts.

## Engineering and QA

- [x] [P0] Choose and configure a test runner using the built-in Node test runner.
- [x] [P0] Add unit tests for normalization, mutations, native import/export, and format detection.
- [ ] [P0] Add browser end-to-end tests for CRUD, autosave, search, import/export, shortcuts, and dialogs.
- [ ] [P1] Add linting and formatting configuration.
- [~] [P1] Add CI running syntax checks, unit tests, and end-to-end tests. (GitHub Actions runs syntax checks and unit tests; browser E2E pending)
- [ ] [P1] Add explicit size and schema limits for imported files.
- [ ] [P1] Ensure all imported data is rendered as text and never injected as HTML.
- [ ] [P1] Add a performance benchmark for large books and virtualization if needed.
- [ ] [P2] Add TypeScript or JSDoc types if schema complexity grows.
- [ ] [P2] Add a release/versioning convention and changelog.
- [ ] [P2] Add offline support as a PWA.
- [ ] [P2] Add deployment automation to a static host.

## Product and Release

- [ ] [P1] Decide the primary v1 export target: standalone ST World Info, character book, or Chub.
- [ ] [P1] Write user documentation for creating and exporting a first lorebook.
- [ ] [P1] Add an About panel with version and supported formats.
- [ ] [P2] Decide the product name and visual identity if "Lorebook Studio" is temporary.
- [ ] [P2] Add an app icon set and social preview assets.
- [ ] [P2] Define a privacy statement: local-first, no analytics, no uploads.
- [ ] [P2] Plan a small beta with real SillyTavern and Chub users.
- [ ] [P2] Collect round-trip failures from real books and convert them into retrieval fixtures.
