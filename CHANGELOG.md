# Changelog

All notable changes to Lorebook Studio are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to the version in `package.json`.

## [Unreleased]

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
