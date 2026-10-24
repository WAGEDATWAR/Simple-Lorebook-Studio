# Changelog

All notable changes to Lorebook Studio are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to the version in `package.json`.

## [Unreleased]

## [0.7.4] - 2026-10-22

### Added

- Configurable tokenizer presets (cl100k_base and o200k_base) with a token settings dialog, plus context window presets used for context-window usage in the overview and simulation.

## [0.7.3] - 2026-10-22

### Added

- Global search across all lorebooks (`Ctrl/Cmd+Shift+F`), grouped by lorebook with a jump to the matching entry.
- A QoL and Polish backlog section in `TODO.md`.

## [0.7.2] - 2026-10-22

### Added

- Clickable validation category counts that filter the issue list by type.
- A data-integrity check and repair tool for duplicate IDs, duplicate source UIDs, dangling references, and missing or orphaned snapshot data.

## [0.7.1] - 2026-10-22

### Added

- An append-only schema migration framework that upgrades stored and imported projects to the current schema version on load, and warns about projects from a newer version.
- A first-run onboarding dialog plus a "Sample" badge that resets to the sample project or starts an empty one.

## [0.7.0] - 2026-10-22

### Added

- A context simulation view that previews which entries activate for pasted context, in insertion order, with matched keys, per-entry tokens, the combined injected text, and the reasons inactive entries stayed inactive.

## [0.6.2] - 2026-10-22

### Added

- Real cl100k_base tokenizer running in a web worker, replacing the `chars / 4` estimate for entry, book, and overview token counts, with an estimate fallback before the worker is ready.
- A per-book token budget with over-budget warnings in the lorebook-information section and the overview.

## [0.6.1] - 2026-10-22

### Added

- A repeatable axe-core accessibility audit (`npm run a11y`) covering the workspace and every dialog, wired into CI.

### Fixed

- Accessibility: removed invalid `list` roles from key and tag chip containers, gave the page a level-one heading, and corrected the Issues button accessible name.

## [0.6.0] - 2026-10-22

### Added

- Command palette (`Ctrl/Cmd+K`) for entry, book, sort, filter, layout, file, and help actions.
- About panel with the app version, supported formats, local storage usage, and a local-first privacy statement.
- Getting-started guide dialog and `docs/getting-started.md`.
- An `app-version` meta tag in `index.html`, verified by `release:check`.

## [0.5.9] - 2026-10-22

### Added

- Standalone character-book export alongside the native, SillyTavern, and Chub targets.
- Import size and schema limits (25 MB, 1000 lorebooks, 50,000 entries) with clear rejection messages.

### Changed

- A lint rule now forbids `innerHTML`, `insertAdjacentHTML`, and `document.write` in source, guaranteeing imported data is rendered as text.
- Reorganized `TODO.md`: `Next Up` now tracks only active work with effort values, finished items are archived into topic sections, and a Suggestions section was added.

## [0.5.8] - 2026-10-22

### Added

- File System Access API support for opening and saving project files, with topbar Open/Save controls and `Ctrl+O`/`Ctrl+Shift+S`.
- A periodic backup reminder with an export shortcut and a three-day snooze.
- Storage usage reporting in the export dialog.

### Fixed

- The IndexedDB migration no longer clears unrelated `lorebook-studio:*` localStorage keys, so UI preferences, layout, and backup timestamps survive reloads.

## [0.5.7] - 2026-10-22

### Added

- Tags for entries and lorebooks, edited as chips, shown as card badges, and filterable from the sidebar.
- Search match highlighting plus a per-card note explaining which fields matched.
- A pinned "Current" card that keeps the active entry visible when search or filters hide it.

## [0.5.6] - 2026-10-22

### Added

- Editable key chips for trigger and secondary keys, with paste support, Backspace removal, and double-click editing.
- Regex-key support with editor highlighting, validation, and a plain-text fallback for invalid patterns.
- Bulk insertion-order controls for selected entries.

## [0.5.5] - 2026-10-22

### Changed

- Moved project, backup, and revision persistence to IndexedDB with a one-time migration from localStorage and a localStorage fallback.

## [0.5.4] - 2026-10-22

### Added

- Entry-list keyboard navigation with arrow keys, Home, End, and Enter/Space.
- Focus restoration after entry/book deletion and dialog dismissal, plus scroll and focus preservation across re-renders.
- A storage-failure banner with export and retry actions.
- A beforeunload warning and unsaved-state tracking when local saves fail.

## [0.5.3] - 2026-10-22

### Added

- Committed browser end-to-end test harness with Chrome DevTools Protocol and a CI job.
- Dependency-free syntax, lint, and format scripts.
- Release/versioning convention and changelog.
- Sidebar filters for enabled, disabled, always-on, and missing-key entries.
- Key collision detection and unreachable enabled-entry detection in the validation panel.

## [0.5.2] - 2026-10-22

### Added

- Reusable project, book, entry, and line diff engine.
- Diff review dialog for imports and revision snapshots.
- Import merge strategies: replace, append to matching lorebooks, and merge by title.
- Live import strategy selector with diff, message, and confirm-label updates.
- Inline revision delta chips and per-snapshot comparison.

### Changed

- Import preview now reviews the resulting project state before applying it.
- Revision history compares each snapshot against the previous one.

## [0.5.0] - 2026-10-22

### Added

- SillyTavern World Info v2 and Chub lorebook import/export with lossless unknown-field preservation.
- `lorebook_v3` character-book import.
- Collision-free UID allocation on export and duplicate source-UID remapping on import.
- Import preview with warnings and an automatic pre-import backup.
- Book descriptions, validation panel, and overview metrics.
- Local revision history with manual and automatic snapshots.
- Undo/redo, duplication, multi-select, bulk actions, and drag/keyboard reordering.
- Library sidebar resize, collapse, and persisted layout.
- GitHub Actions CI running syntax checks and unit tests.

## [0.4.0] - 2026-10-22

### Added

- Canonical project, book, and entry schema.
- Native project import/export, single-book export, and pre-import backups.
- Search, autosave, sample project, and the dark application shell.
