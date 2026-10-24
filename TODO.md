# TODO

Priorities: P0 = next release blocker, P1 = high value, P2 = later.
Status: `[ ]` open, `[~]` in progress, `[x]` done.
Effort: `[Low]`, `[Medium]`, `[High]`, `[Very High]` (rough implementation size). Track an effort value for every item added.

`Next Up` is the active, continuously updated work list and contains only unfinished items, ordered by value per effort (quick, high-leverage work first). When an item is finished it is archived into the relevant topic section below.

## Foundation (v0.1, complete)

- [x] [High] Static application shell with dark visual system.
- [x] [High] Canonical project, book, and entry schema.
- [x] [Medium] Multi-book project state with create, rename, switch, delete.
- [x] [Medium] Entry create, select, edit, and delete.
- [x] [Medium] Core entry fields and injection settings.
- [x] [Low] Search across title, content, and keys.
- [x] [Low] Live character, word, and approximate token counts.
- [x] [Medium] Debounced localStorage autosave and save status.
- [x] [Medium] Native project JSON import and export.
- [x] [Low] Confirmation dialog for destructive actions.
- [x] [Low] Toasts for import, export, save, and delete feedback.
- [x] [Medium] Responsive layout verified at 1440 px and 390 px.
- [x] [Low] Basic keyboard shortcuts and accessible labels.
- [x] [Low] Sample project for first-run demonstration.
- [x] [Low] Syntax check script and zero-dependency dev server.

## Next Up

- [ ] [P1] [High] Add a performance benchmark for large books and virtualization if needed.
- [ ] [P1] [Very High] Replace the character/4 estimate with a real tokenizer running in a worker, and add a token budget field with warnings when a book exceeds it.
- [ ] [P1] [High] Add a context simulation view showing likely activation order and injected text.

## Editor and Authoring

- [x] [P1] [Medium] Add entry duplication and reordering.
- [x] [P1] [High] Add undo/redo for edits and structural changes.
- [x] [P1] [Low] Expose the stored book description in the interface.
- [x] [P1] [High] Add a validation panel for empty content, duplicate keys, missing keys on non-constant entries, and order collisions.
- [x] [P1] [Medium] Replace the comma-separated key inputs with editable key chips while keeping paste support.
- [x] [P1] [Medium] Add multi-select and bulk enable, disable, and delete.
- [x] [P1] [Low] Add bulk insertion-order changes for selected entries.
- [x] [P1] [Medium] Add sort modes: manual, title, insertion order, last edited, and enabled state.
- [x] [P1] [Low] Add accessible reordering with `Alt+ArrowUp` and `Alt+ArrowDown` in manual order.
- [x] [P1] [Medium] Add built-in entry templates and a template picker.
- [ ] [P2] [Medium] Add a "duplicate as template" flow for custom reusable entries.
- [x] [P1] [Medium] Support regex keys with validation and a plain-text fallback.
- [x] [P2] [High] Add a diff view when replacing imported entries and when comparing revision snapshots.
- [x] [P2] [Medium] Add an import merge mode that reuses the diff view.
- [x] [P2] [Low] Add a notes or author-only field separate from injected content.
- [ ] [P2] [Medium] Add configurable word/character/token limits per entry.
- [ ] [P2] [Medium] Support markdown preview for content if the target frontends interpret it consistently.
- [ ] [P2] [Low] Add per-entry color or tag labels for visual grouping.
- [ ] [P2] [Medium] Add a "peek" preview showing the text as it would be injected.
- [ ] [P1] [High] Add bulk find and replace across entries with a preview diff before applying.
- [ ] [P1] [High] Add duplicate, merge, and split lorebook actions (the entry-level duplicate exists; books do not).
- [ ] [P1] [Low] Add issue-type filtering by clicking the issue-type counts in the validation dialog.
- [ ] [P2] [Low] Add bulk tag assignment (add/remove tags) for selected entries.
- [ ] [P2] [Medium] Suggest trigger keys from the title and content, and offer one-click add.
- [ ] [P2] [Medium] Add configurable default entry properties (always on, selective, case sensitive, match whole words) for new entries.
- [ ] [P2] [High] Add entry links/references such as `[[Entry Title]]` with validation for broken links.

## Interoperability

- [x] [P0] [High] Build the format adapter layer with `detect`, `parse`, `serialize`, and warnings.
- [x] [P0] [High] Implement SillyTavern World Info v2 import and export.
- [x] [P0] [Medium] Add single-book export alongside the whole-project backup.
- [x] [P0] [Medium] Add an import preview stage and automatic pre-import backup.
- [x] [P0] [Medium] Verify exact field names and position enum values against current SillyTavern and Chub schemas.
- [x] [P0] [High] Preserve unknown imported fields in an extension bucket for lossless round-trips.
- [x] [P0] [Medium] Generate stable unique UIDs during export and avoid collisions during import.
- [x] [P0] [Medium] Report unsupported or lossy fields before import/export completes.
- [x] [P1] [High] Implement character book lorebook import and export.
- [x] [P1] [High] Implement Chub lorebook import and export using real exported files.
- [x] [P1] [Medium] Add format detection and a clear "unsupported file" message.
- [x] [P1] [High] Add import merge strategies: replace, append, merge by title.
- [x] [P1] [Medium] Preserve advanced SillyTavern fields such as recursion, depth, role, groups, sticky, cooldown, and scan depth.
- [x] [P1] [Low] Add filename conventions for book exports and project backups.
- [ ] [P2] [Very High] Support character card containers (PNG/CHARX) and embedded character books.
- [ ] [P2] [Medium] Add JSON/YAML plain-export options for scripting.
- [ ] [P2] [Medium] Add a schema reference page generated from the canonical model.
- [ ] [P2] [Low] Support drag-and-drop file import onto the app window.
- [ ] [P2] [Medium] Add a print/PDF export of a lorebook for offline review and editing passes.

## Organization and Search

- [x] [P1] [High] Add tags and/or folders for books and entries.
- [x] [P1] [Medium] Add filters for enabled, disabled, always-on, and entries missing keys.
- [x] [P1] [Medium] Highlight search matches and expose why an entry matched.
- [x] [P1] [Low] Keep search results stable when the active entry is filtered out.
- [x] [P1] [Medium] Add keyboard navigation in the entry list: arrow keys, Home, End, Enter.
- [x] [P1] [Medium] Preserve list scroll and focus across mutations and re-renders.
- [x] [P2] [Medium] Add a book-level overview with entry count, token totals, and key coverage.
- [ ] [P2] [Low] Add pinned or recent entries.
- [x] [P2] [Medium] Add overlapping key reports and key coverage summaries.
- [ ] [P1] [Medium] Add global search across all lorebooks, with results grouped by lorebook and a jump to the entry.
- [ ] [P2] [Medium] Add a regex search mode for the entry list, complementing regex keys.

## Context and Token Tools

- [x] [P1] [Medium] Show token counts per entry, per enabled set, and per book.
- [x] [P1] [Medium] Add key collision and unreachable-entry detection.
- [ ] [P2] [Medium] Add configurable model/tokenizer presets.
- [ ] [P2] [Medium] Add context window presets for common frontend configurations.
- [ ] [P2] [Medium] Add bulk operations based on token size.
- [ ] [P2] [Medium] Cache tokenization results per entry revision.

## Data and Persistence

- [x] [P0] [Medium] Add a local backup before destructive imports.
- [x] [P1] [High] Move project storage to IndexedDB with a migration from localStorage.
- [x] [P1] [Medium] Handle storage quota failures with clear recovery instructions and export shortcuts.
- [x] [P1] [High] Add revision history or automatic snapshots with restore.
- [x] [P1] [High] Add File System Access API support for opening and saving project files.
- [x] [P1] [Low] Add a periodic reminder to export a backup.
- [ ] [P1] [Medium] Add a custom `.lwproj` project file extension for project file exports and File System Access open/save, while still accepting `.json` on import.
- [ ] [P2] [Medium] Add optional project import/export of the full UI state.
- [ ] [P2] [Very High] Add cloud sync only if it can remain opt-in, private, and simple.
- [x] [P2] [Low] Add storage usage reporting.
- [ ] [P2] [High] Add encrypted local projects if sensitive content becomes a requirement.
- [ ] [P1] [High] Add a schema migration framework that upgrades older project versions instead of dropping unknown data.
- [ ] [P1] [Medium] Add a project data-integrity check and repair tool for corrupt or partially migrated local data.
- [ ] [P2] [Medium] Show a "what changed since your last session" summary on load.

## UI, UX, and Accessibility

- [x] [P1] [High] Add auto-sized, resizable, and collapsible library and entry-detail sidebars with remembered layouts and wrapping controls.
- [ ] [P1] [Medium] Add a mobile library drawer instead of the fixed stacked sidebar if authoring on phones becomes common.
- [x] [P1] [Low] Verify focus restoration after delete, book switch, and dialog dismissal.
- [x] [P1] [Medium] Add a proper unsaved-changes strategy for failed localStorage writes.
- [ ] [P1] [Medium] Add an onboarding flow and a clear sample-project badge/reset.
- [x] [P1] [High] Run an automated accessibility audit and fix all critical issues.
- [x] [P1] [Medium] Add a command palette for quick actions.
- [ ] [P2] [Low] Hide field hint text while a field has content, showing it again only when the field is empty or focused.
- [ ] [P2] [Low] Add hover-based hint popup dialogs on desktop for fields and controls with longer explanations.
- [ ] [P2] [High] Add a light theme or theme tokens once the component set stabilizes.
- [ ] [P2] [Low] Add density options for compact entry lists.
- [ ] [P2] [Low] Add resizable text areas with remembered heights.
- [ ] [P2] [Medium] Add helpful empty, error, and loading states for every async action.
- [ ] [P2] [Low] Add a keyboard shortcuts reference dialog.
- [ ] [P2] [Low] Add a focus mode that hides the sidebar while writing.
- [ ] [P2] [Low] Tune toast timing and prevent duplicate failure toasts.

## Engineering and QA

- [x] [P0] [Low] Choose and configure a test runner using the built-in Node test runner.
- [x] [P0] [Medium] Add unit tests for normalization, mutations, native import/export, and format detection.
- [x] [P0] [Medium] Add real fixture tests that export, re-import, and compare canonical snapshots.
- [x] [P1] [Medium] Add automated tests for schema, store actions, and native format handling.
- [~] [P0] [High] Add browser end-to-end tests for CRUD, autosave, search, import/export, shortcuts, and dialogs. (Harness covers CRUD, autosave, search, import strategies, revisions, and responsive layout; export and shortcuts pending)
- [x] [P1] [Low] Add linting and formatting configuration.
- [x] [P1] [Low] Add CI running syntax checks, unit tests, and end-to-end tests.
- [x] [P1] [Low] Add explicit size and schema limits for imported files.
- [x] [P1] [Low] Ensure all imported data is rendered as text and never injected as HTML.
- [ ] [P2] [Very High] Add TypeScript or JSDoc types if schema complexity grows.
- [x] [P2] [Low] Add a release/versioning convention and changelog.
- [ ] [P2] [Medium] Add offline support as a PWA.
- [ ] [P2] [Low] Add deployment automation to a static host.

## Product and Release

- [x] [P1] [Medium] Release readiness: add an About panel with version, supported formats, and storage usage, a local-first privacy statement, and a first-lorebook getting-started guide.
- [ ] [P1] [Low] Decide the primary v1 export target: standalone ST World Info, character book, or Chub.
- [x] [P2] [Low] Decide the product name and visual identity: "Loreweaver".
- [ ] [P1] [High] Rename the product to Loreweaver across the UI, docs, package metadata, and export filenames, keeping stored data compatible.
- [ ] [P2] [Medium] Add an app icon set and social preview assets.
- [ ] [P2] [Medium] Plan a small beta with real SillyTavern and Chub users.
- [ ] [P2] [Medium] Collect round-trip failures from real books and convert them into retrieval fixtures.
