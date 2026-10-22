import {
  EXPORT_FORMATS,
  buildExport,
  downloadJson,
  parseProject,
  serializeLorebook
} from "./format.js";
import {
  addBook,
  addEntry,
  canRedo,
  canUndo,
  clearSelection,
  deleteActiveEntry,
  deleteBook,
  deleteEntries,
  duplicateEntry,
  getActiveBook,
  getActiveEntry,
  getSelectedEntryIds,
  getSelectionAnchorId,
  getState,
  initStore,
  moveEntry,
  redo,
  renameActiveBook,
  replaceProject,
  selectEntryRange,
  setActiveBook,
  setActiveEntry,
  setEntriesEnabled,
  setSearchQuery,
  setSortMode,
  toggleEntrySelection,
  undo,
  updateActiveEntry
} from "./store.js";
import {
  getProjectBackupInfo,
  loadProject,
  loadProjectBackup,
  saveProject,
  saveProjectBackup
} from "./storage.js";
import { renderEditor, syncEntryStats } from "./ui/editor.js";
import { confirmAction, toast } from "./ui/overlays.js";
import { renderSidebar } from "./ui/sidebar.js";
import { clamp } from "./utils.js";

const refs = {
  bookName: document.querySelector("#book-name"),
  saveState: document.querySelector("#save-state"),
  undoBtn: document.querySelector("#undo-btn"),
  redoBtn: document.querySelector("#redo-btn"),
  importBtn: document.querySelector("#import-btn"),
  exportBtn: document.querySelector("#export-btn"),
  importInput: document.querySelector("#import-input"),
  exportDialog: document.querySelector("#export-dialog"),
  exportBookName: document.querySelector("#export-book-name"),
  exportOptions: document.querySelector("#export-options"),
  exportCancelBtn: document.querySelector("#export-cancel"),
  backupStatus: document.querySelector("#backup-status"),
  restoreBackupBtn: document.querySelector("#restore-backup-btn"),
  bookSelect: document.querySelector("#book-select"),
  newBookBtn: document.querySelector("#new-book-btn"),
  deleteBookBtn: document.querySelector("#delete-book-btn"),
  entrySearch: document.querySelector("#entry-search"),
  entrySort: document.querySelector("#entry-sort"),
  entryCount: document.querySelector("#entry-count"),
  entryList: document.querySelector("#entry-list"),
  bulkBar: document.querySelector("#bulk-bar"),
  bulkCount: document.querySelector("#bulk-count"),
  bulkEnableBtn: document.querySelector("#bulk-enable-btn"),
  bulkDisableBtn: document.querySelector("#bulk-disable-btn"),
  bulkDeleteBtn: document.querySelector("#bulk-delete-btn"),
  bulkClearBtn: document.querySelector("#bulk-clear-btn"),
  addEntryBtn: document.querySelector("#add-entry-btn"),
  emptyAddBtn: document.querySelector("#empty-add-btn"),
  editorEmpty: document.querySelector("#editor-empty"),
  editorPane: document.querySelector("#editor-pane"),
  detailsPanel: document.querySelector("#details-panel"),
  detailsToggle: document.querySelector("#details-toggle"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyText: document.querySelector("#empty-text"),
  entryTitle: document.querySelector("#entry-title"),
  entryEnabled: document.querySelector("#entry-enabled"),
  duplicateEntryBtn: document.querySelector("#duplicate-entry-btn"),
  deleteEntryBtn: document.querySelector("#delete-entry-btn"),
  entryKeys: document.querySelector("#entry-keys"),
  entrySecondaryKeys: document.querySelector("#entry-secondary-keys"),
  entryContent: document.querySelector("#entry-content"),
  entryStatChars: document.querySelector("#entry-stat-chars"),
  entryStatWords: document.querySelector("#entry-stat-words"),
  entryStatTokens: document.querySelector("#entry-stat-tokens"),
  entryOrder: document.querySelector("#entry-order"),
  entryPosition: document.querySelector("#entry-position"),
  entryProbability: document.querySelector("#entry-probability"),
  entryProbabilityOutput: document.querySelector("#entry-probability-output"),
  entryConstant: document.querySelector("#entry-constant"),
  entrySelective: document.querySelector("#entry-selective"),
  entryCaseSensitive: document.querySelector("#entry-case-sensitive"),
  entryWholeWords: document.querySelector("#entry-whole-words")
};

let saveTimer = 0;
let saveFailed = false;

const DETAILS_STATE_KEY = "lorebook-studio:details-collapsed:v1";
const SORT_STATE_KEY = "lorebook-studio:sort:v1";
const SORT_MODES = new Set(["manual", "title", "order", "updated", "enabled"]);

let draggedEntryId = null;
let dropTargetId = null;
let dropPlace = "before";

function readSortMode() {
  try {
    const value = localStorage.getItem(SORT_STATE_KEY);
    return SORT_MODES.has(value) ? value : null;
  } catch {
    return null;
  }
}

function persistSortMode(mode) {
  try {
    localStorage.setItem(SORT_STATE_KEY, mode);
  } catch {
    return;
  }
}

function readDetailsState() {
  try {
    const value = localStorage.getItem(DETAILS_STATE_KEY);
    return value === null ? null : value === "1";
  } catch {
    return null;
  }
}

function setDetailsCollapsed(collapsed, persist = true) {
  refs.detailsPanel.classList.toggle("is-collapsed", collapsed);
  refs.detailsToggle.setAttribute("aria-expanded", String(!collapsed));
  const label = collapsed ? "Show entry details" : "Hide entry details";
  refs.detailsToggle.setAttribute("aria-label", label);
  refs.detailsToggle.title = label;

  if (persist) {
    try {
      localStorage.setItem(DETAILS_STATE_KEY, collapsed ? "1" : "0");
    } catch {
      return;
    }
  }
}

function setSaveState(mode) {
  refs.saveState.dataset.state = mode;
  const label = refs.saveState.querySelector(".save-label");
  label.textContent = mode === "saving" ? "Saving" : mode === "error" ? "Unsaved" : "Saved";
}

function updateDocumentTitle() {
  const book = getActiveBook();
  document.title = `${book?.name.trim() || "Untitled Lorebook"} — Lorebook Studio`;
}

function updateHistoryButtons() {
  refs.undoBtn.disabled = !canUndo();
  refs.redoBtn.disabled = !canRedo();
}

function renderAll() {
  const book = getActiveBook();
  refs.bookName.value = book?.name ?? "";
  renderSidebar(refs);
  renderEditor(refs);
  updateHistoryButtons();
  updateDocumentTitle();
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  setSaveState("saving");
  updateHistoryButtons();
  saveTimer = window.setTimeout(flushSave, 400);
}

function focusEntryCard(id) {
  const card = Array.from(refs.entryList.querySelectorAll("[data-entry-id]"))
    .find((element) => element.dataset.entryId === id);
  card?.focus({ preventScroll: true });
}

function scrollEntryCardIntoView(id) {
  const card = Array.from(refs.entryList.querySelectorAll("[data-entry-id]"))
    .find((element) => element.dataset.entryId === id);
  card?.scrollIntoView({ block: "nearest" });
}

function flushSave() {
  window.clearTimeout(saveTimer);
  const ok = saveProject(getState());
  setSaveState(ok ? "saved" : "error");

  if (!ok) {
    if (!saveFailed) {
      toast("Couldn't save locally. Your browser storage may be full.", "error");
    }
    saveFailed = true;
  } else {
    saveFailed = false;
  }

  return ok;
}

function createExportOption({ id, title, description, meta }) {
  const button = document.createElement("button");
  const main = document.createElement("span");
  const titleElement = document.createElement("span");
  const descriptionElement = document.createElement("span");
  const metaElement = document.createElement("span");

  button.type = "button";
  button.className = "export-option";
  button.dataset.exportFormat = id;
  main.className = "export-option-main";
  titleElement.className = "export-option-title";
  titleElement.textContent = title;
  descriptionElement.className = "export-option-desc";
  descriptionElement.textContent = description;
  metaElement.className = "export-option-meta";
  metaElement.textContent = meta;
  main.append(titleElement, descriptionElement);
  button.append(main, metaElement);

  return button;
}

function renderExportOptions() {
  const options = [
    createExportOption({
      id: "project",
      title: "Project backup",
      description: "Every lorebook and setting in one restorable file.",
      meta: "Project"
    }),
    ...EXPORT_FORMATS.map((format) => createExportOption({
      id: format.id,
      title: format.label,
      description: format.description,
      meta: "Book"
    }))
  ];

  refs.exportOptions.replaceChildren(...options);
}

function formatBackupDate(timestamp) {
  if (!timestamp) {
    return "unknown date";
  }

  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function refreshBackupStatus() {
  const info = getProjectBackupInfo();

  if (!info.ok) {
    refs.backupStatus.textContent = "No backup saved.";
    refs.restoreBackupBtn.disabled = true;
    return;
  }

  const bookLabel = `${info.books} ${info.books === 1 ? "lorebook" : "lorebooks"}`;
  const entryLabel = `${info.entries} ${info.entries === 1 ? "entry" : "entries"}`;
  refs.backupStatus.textContent = `${bookLabel} · ${entryLabel}\n${formatBackupDate(info.createdAt)}`;
  refs.restoreBackupBtn.disabled = false;
}

function openExportDialog() {
  const book = getActiveBook();

  if (!book) {
    toast("There is no lorebook to export.", "error");
    return;
  }

  renderExportOptions();
  refreshBackupStatus();
  refs.exportBookName.textContent = `${book.name.trim() || "Untitled Lorebook"} · ${book.entries.length} ${book.entries.length === 1 ? "entry" : "entries"} · book exports use the active lorebook`;
  refs.exportDialog.showModal();
}

function handleExport(formatId) {
  const book = getActiveBook();

  if (!book) {
    toast("There is no lorebook to export.", "error");
    return;
  }

  if (formatId === "project") {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(buildExport(getState()), `lorebook-studio-project-${stamp}.json`);
    refs.exportDialog.close();
    toast("Project backup exported", "success");
    return;
  }

  const exported = serializeLorebook(formatId, book);

  if (!exported.ok) {
    toast(exported.error, "error");
    return;
  }

  downloadJson(exported.data, exported.filename);
  refs.exportDialog.close();
  toast(`Exported ${book.name.trim() || "Untitled Lorebook"} as ${exported.label}`, "success");

  if (exported.warnings.length) {
    toast(exported.warnings[0]);
  }
}

async function handleRestoreBackup() {
  const backup = loadProjectBackup();

  if (!backup.ok) {
    toast(backup.error, "error");
    return;
  }

  const bookCount = backup.project.books.length;
  const entryCount = backup.project.books.reduce((total, book) => total + book.entries.length, 0);
  refs.exportDialog.close();

  const accepted = await confirmAction({
    title: "Restore pre-import backup?",
    message: "This replaces the current project. You can undo the restore afterward.",
    details: [
      { label: "Backup from", value: formatBackupDate(backup.createdAt) },
      { label: "Lorebooks", value: String(bookCount) },
      { label: "Entries", value: String(entryCount) }
    ],
    confirmLabel: "Restore backup",
    tone: "primary"
  });

  if (!accepted) {
    return;
  }

  replaceProject(backup.project);
  clearSearch();
  const sortMode = readSortMode();

  if (sortMode) {
    setSortMode(sortMode);
  }

  renderAll();
  flushSave();
  toast("Pre-import backup restored", "success");
}

function clearSearch() {
  refs.entrySearch.value = "";
  setSearchQuery("");
}

function readKeys(value) {
  return value
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

function visibleEntryIds() {
  return Array.from(refs.entryList.querySelectorAll("[data-entry-id]"))
    .map((element) => element.dataset.entryId);
}

function activateEntryCard(id, { toggle = false, range = false } = {}) {
  const ids = visibleEntryIds();
  const clickedIndex = ids.indexOf(id);

  if (clickedIndex === -1) {
    return;
  }

  if (range) {
    const activeId = getState().activeEntryId;
    const anchorCandidate = getSelectionAnchorId() ?? activeId ?? id;
    const candidateIndex = ids.indexOf(anchorCandidate);
    const anchorIndex = candidateIndex === -1 ? clickedIndex : candidateIndex;
    const start = Math.min(anchorIndex, clickedIndex);
    const end = Math.max(anchorIndex, clickedIndex);
    selectEntryRange(ids.slice(start, end + 1), ids[anchorIndex]);
    setActiveEntry(id);
    renderSidebar(refs);
    renderEditor(refs);
    focusEntryCard(id);
    scheduleSave();
    return;
  }

  if (toggle) {
    toggleEntrySelection(id);
    renderSidebar(refs);
    focusEntryCard(id);
    return;
  }

  const changed = getState().activeEntryId !== id;
  clearSelection();

  if (changed) {
    setActiveEntry(id);
  }

  renderSidebar(refs);
  renderEditor(refs);
  focusEntryCard(id);

  if (changed) {
    scheduleSave();
  }
}

function canReorderEntries() {
  const state = getState();
  return state.ui.sortMode === "manual" && !state.ui.searchQuery.trim();
}

function clearDropIndicators() {
  dropTargetId = null;

  for (const card of refs.entryList.querySelectorAll(".is-drop-before, .is-drop-after")) {
    card.classList.remove("is-drop-before", "is-drop-after");
  }
}

function clearDragState() {
  clearDropIndicators();
  draggedEntryId = null;

  for (const card of refs.entryList.querySelectorAll(".is-dragging")) {
    card.classList.remove("is-dragging");
  }
}

function dropPlaceFor(event, card) {
  const rect = card.getBoundingClientRect();
  return event.clientY >= rect.top + rect.height / 2 ? "after" : "before";
}

function handleAddEntry() {
  clearSearch();
  addEntry();
  renderAll();
  refs.entryTitle.focus();
  scheduleSave();
}

function handleUndo() {
  if (!undo()) {
    return;
  }

  clearSelection();
  renderAll();
  scheduleSave();
}

function handleRedo() {
  if (!redo()) {
    return;
  }

  clearSelection();
  renderAll();
  scheduleSave();
}

function handleDuplicateEntry() {
  const copy = duplicateEntry();

  if (!copy) {
    return;
  }

  renderAll();
  scrollEntryCardIntoView(copy.id);
  refs.entryTitle.focus();
  refs.entryTitle.select();
  scheduleSave();
  toast("Entry duplicated", "success");
}

async function handleDeleteEntry() {
  const entry = getActiveEntry();

  if (!entry) {
    return;
  }

  const title = entry.title.trim() || "Untitled entry";
  const accepted = await confirmAction({
    title: "Delete entry?",
    message: `"${title}" will be permanently removed.`,
    confirmLabel: "Delete entry"
  });

  if (!accepted) {
    return;
  }

  deleteActiveEntry();
  clearSearch();
  renderAll();
  scheduleSave();
  toast("Entry deleted");
}

async function handleDeleteBook() {
  const book = getActiveBook();

  if (!book) {
    return;
  }

  const name = book.name.trim() || "Untitled Lorebook";
  const count = book.entries.length;
  const accepted = await confirmAction({
    title: "Delete lorebook?",
    message: `"${name}" and its ${count} ${count === 1 ? "entry" : "entries"} will be permanently removed.`,
    confirmLabel: "Delete lorebook"
  });

  if (!accepted) {
    return;
  }

  deleteBook(book.id);
  clearSearch();
  renderAll();
  scheduleSave();
  toast("Lorebook deleted");
}

function handleBulkEnabled(enabled) {
  const changed = setEntriesEnabled(getSelectedEntryIds(), enabled);

  if (!changed) {
    return;
  }

  renderAll();
  scheduleSave();
  toast(`${changed} ${changed === 1 ? "entry" : "entries"} ${enabled ? "enabled" : "disabled"}`, "success");
}

async function handleBulkDelete() {
  const ids = getSelectedEntryIds();

  if (!ids.length) {
    return;
  }

  const accepted = await confirmAction({
    title: `Delete ${ids.length} ${ids.length === 1 ? "entry" : "entries"}?`,
    message: `The selected ${ids.length === 1 ? "entry" : "entries"} will be permanently removed.`,
    confirmLabel: "Delete entries"
  });

  if (!accepted) {
    return;
  }

  deleteEntries(ids);
  renderAll();
  scheduleSave();
  toast(`${ids.length} ${ids.length === 1 ? "entry" : "entries"} deleted`);
}

async function handleImport(file) {
  if (!file) {
    return;
  }

  let text;

  try {
    text = await file.text();
  } catch {
    toast("Couldn't read that file.", "error");
    return;
  }

  const parsed = parseProject(text, { filename: file.name });

  if (!parsed.ok) {
    toast(parsed.error, "error");
    return;
  }

  const bookCount = parsed.project.books.length;
  const entryCount = parsed.project.books.reduce((total, book) => total + book.entries.length, 0);
  const accepted = await confirmAction({
    title: "Import preview",
    message: `"${file.name}" is ready to import. The current project will be saved as a local backup before it is replaced.`,
    details: [
      { label: "Format", value: parsed.format },
      { label: "File", value: file.name },
      { label: "Lorebooks", value: String(bookCount) },
      { label: "Entries", value: String(entryCount) }
    ],
    warnings: parsed.warnings || [],
    confirmLabel: "Import and replace"
  });

  if (!accepted) {
    return;
  }

  const backup = saveProjectBackup(getState(), `Before importing ${file.name}`);

  if (!backup.ok) {
    const proceed = await confirmAction({
      title: "Backup failed",
      message: "The current project could not be backed up. Importing will replace it without a recovery copy.",
      confirmLabel: "Import without backup"
    });

    if (!proceed) {
      return;
    }
  }

  replaceProject(parsed.project);

  const sortMode = readSortMode();

  if (sortMode) {
    setSortMode(sortMode);
  }

  clearSearch();
  renderAll();
  flushSave();
  toast(`Imported ${parsed.format}: ${entryCount} ${entryCount === 1 ? "entry" : "entries"}`, "success");

  if (backup.ok) {
    toast("Previous project saved as a pre-import backup");
  }
}

refs.newBookBtn.addEventListener("click", () => {
  addBook();
  clearSearch();
  renderAll();
  refs.bookName.focus();
  refs.bookName.select();
  scheduleSave();
});

refs.deleteBookBtn.addEventListener("click", () => {
  handleDeleteBook();
});

refs.bookSelect.addEventListener("change", (event) => {
  setActiveBook(event.target.value);
  clearSearch();
  renderAll();
  scheduleSave();
});

refs.bookName.addEventListener("input", (event) => {
  const name = event.target.value;
  renameActiveBook(name);
  const option = refs.bookSelect.selectedOptions[0];

  if (option) {
    option.textContent = name.trim() || "Untitled Lorebook";
  }

  updateDocumentTitle();
  scheduleSave();
});

refs.bookName.addEventListener("blur", () => {
  const name = refs.bookName.value.trim() || "Untitled Lorebook";
  refs.bookName.value = name;
  renameActiveBook(name);
  const option = refs.bookSelect.selectedOptions[0];

  if (option) {
    option.textContent = name;
  }

  updateDocumentTitle();
  scheduleSave();
});

refs.entrySearch.addEventListener("input", (event) => {
  setSearchQuery(event.target.value);
  renderSidebar(refs);
});

refs.entrySearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    clearSearch();
    renderSidebar(refs);
    refs.entrySearch.blur();
  }
});

refs.addEntryBtn.addEventListener("click", handleAddEntry);
refs.emptyAddBtn.addEventListener("click", handleAddEntry);

refs.entryList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-entry-id]");

  if (!card) {
    return;
  }

  activateEntryCard(card.dataset.entryId, {
    toggle: event.ctrlKey || event.metaKey,
    range: event.shiftKey
  });
});

refs.entryList.addEventListener("keydown", (event) => {
  const card = event.target.closest("[data-entry-id]");

  if (!card) {
    return;
  }

  const id = card.dataset.entryId;

  if (!event.altKey && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    activateEntryCard(id, {
      toggle: event.ctrlKey || event.metaKey,
      range: event.shiftKey
    });
    return;
  }

  if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();

    if (!canReorderEntries()) {
      toast("Switch to Manual order and clear search to reorder entries.");
      return;
    }

    const ids = visibleEntryIds();
    const index = ids.indexOf(id);
    const targetIndex = index + (event.key === "ArrowUp" ? -1 : 1);

    if (index === -1 || targetIndex < 0 || targetIndex >= ids.length) {
      return;
    }

    const place = event.key === "ArrowUp" ? "before" : "after";

    if (!moveEntry(id, ids[targetIndex], place)) {
      return;
    }

    setActiveEntry(id);
    renderSidebar(refs);
    renderEditor(refs);
    focusEntryCard(id);
    scheduleSave();
  }
});

refs.entryList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-entry-id]");

  if (!card || !canReorderEntries()) {
    event.preventDefault();
    return;
  }

  draggedEntryId = card.dataset.entryId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedEntryId);
  card.classList.add("is-dragging");
});

refs.entryList.addEventListener("dragover", (event) => {
  if (!draggedEntryId) {
    return;
  }

  const card = event.target.closest("[data-entry-id]");

  if (!card || !refs.entryList.contains(card)) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";

  if (card.dataset.entryId === draggedEntryId) {
    clearDropIndicators();
    return;
  }

  const place = dropPlaceFor(event, card);

  if (dropTargetId === card.dataset.entryId && dropPlace === place) {
    return;
  }

  clearDropIndicators();
  dropTargetId = card.dataset.entryId;
  dropPlace = place;
  card.classList.add(place === "after" ? "is-drop-after" : "is-drop-before");
});

refs.entryList.addEventListener("dragleave", (event) => {
  if (!refs.entryList.contains(event.relatedTarget)) {
    clearDropIndicators();
  }
});

refs.entryList.addEventListener("drop", (event) => {
  if (!draggedEntryId) {
    return;
  }

  event.preventDefault();

  const card = event.target.closest("[data-entry-id]");
  const targetId = card?.dataset.entryId ?? dropTargetId;
  const place = card ? dropPlaceFor(event, card) : dropPlace;
  const sourceId = draggedEntryId;
  clearDragState();

  if (!targetId || targetId === sourceId || !moveEntry(sourceId, targetId, place)) {
    return;
  }

  setActiveEntry(sourceId);
  renderSidebar(refs);
  renderEditor(refs);
  focusEntryCard(sourceId);
  scheduleSave();
});

refs.entryList.addEventListener("dragend", () => {
  clearDragState();
});

refs.entrySort.addEventListener("change", (event) => {
  const mode = event.target.value;
  setSortMode(mode);
  persistSortMode(getState().ui.sortMode);
  renderSidebar(refs);
});

refs.bulkEnableBtn.addEventListener("click", () => {
  handleBulkEnabled(true);
});

refs.bulkDisableBtn.addEventListener("click", () => {
  handleBulkEnabled(false);
});

refs.bulkDeleteBtn.addEventListener("click", () => {
  handleBulkDelete();
});

refs.bulkClearBtn.addEventListener("click", () => {
  clearSelection();
  renderSidebar(refs);
  refs.entryList.focus({ preventScroll: true });
});

refs.duplicateEntryBtn.addEventListener("click", () => {
  handleDuplicateEntry();
});

refs.entryTitle.addEventListener("input", (event) => {
  updateActiveEntry({ title: event.target.value });
  renderSidebar(refs);
  scheduleSave();
});

refs.entryEnabled.addEventListener("change", (event) => {
  updateActiveEntry({ enabled: event.target.checked });
  renderSidebar(refs);
  scheduleSave();
});

refs.entryKeys.addEventListener("input", (event) => {
  updateActiveEntry({ keys: readKeys(event.target.value) });
  renderSidebar(refs);
  scheduleSave();
});

refs.entrySecondaryKeys.addEventListener("input", (event) => {
  updateActiveEntry({ secondaryKeys: readKeys(event.target.value) });
  renderSidebar(refs);
  scheduleSave();
});

refs.entryContent.addEventListener("input", (event) => {
  updateActiveEntry({ content: event.target.value });
  syncEntryStats(refs, event.target.value);
  scheduleSave();
});

refs.entryOrder.addEventListener("input", (event) => {
  if (event.target.value === "") {
    return;
  }

  const value = Number(event.target.value);

  if (Number.isFinite(value)) {
    updateActiveEntry({ order: clamp(Math.round(value), 0, 9999) });
    scheduleSave();
  }
});

refs.entryOrder.addEventListener("blur", () => {
  const entry = getActiveEntry();

  if (entry) {
    refs.entryOrder.value = String(entry.order);
  }
});

for (const button of refs.editorPane.querySelectorAll("[data-step]")) {
  button.addEventListener("click", () => {
    const entry = getActiveEntry();

    if (!entry) {
      return;
    }

    const nextOrder = clamp(entry.order + Number(button.dataset.step), 0, 9999);
    updateActiveEntry({ order: nextOrder });
    refs.entryOrder.value = String(nextOrder);
    scheduleSave();
  });
}

refs.entryPosition.addEventListener("change", (event) => {
  updateActiveEntry({ position: event.target.value });
  scheduleSave();
});

refs.entryProbability.addEventListener("input", (event) => {
  const value = clamp(Number(event.target.value), 0, 100);
  updateActiveEntry({ probability: value });
  refs.entryProbabilityOutput.textContent = `${value}%`;
  scheduleSave();
});

const checkboxBindings = [
  [refs.entryConstant, "constant"],
  [refs.entrySelective, "selective"],
  [refs.entryCaseSensitive, "caseSensitive"],
  [refs.entryWholeWords, "matchWholeWords"]
];

for (const [checkbox, field] of checkboxBindings) {
  checkbox.addEventListener("change", () => {
    updateActiveEntry({ [field]: checkbox.checked });
    renderSidebar(refs);
    scheduleSave();
  });
}

refs.deleteEntryBtn.addEventListener("click", () => {
  handleDeleteEntry();
});

refs.undoBtn.addEventListener("click", handleUndo);
refs.redoBtn.addEventListener("click", handleRedo);

refs.detailsToggle.addEventListener("click", () => {
  setDetailsCollapsed(!refs.detailsPanel.classList.contains("is-collapsed"));
});

refs.importBtn.addEventListener("click", () => {
  refs.importInput.click();
});

refs.importInput.addEventListener("change", async () => {
  const file = refs.importInput.files?.[0];

  try {
    await handleImport(file);
  } finally {
    refs.importInput.value = "";
  }
});

refs.exportBtn.addEventListener("click", openExportDialog);

refs.exportCancelBtn.addEventListener("click", () => {
  refs.exportDialog.close();
});

refs.exportOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-export-format]");

  if (option) {
    handleExport(option.dataset.exportFormat);
  }
});

refs.restoreBackupBtn.addEventListener("click", () => {
  handleRestoreBackup();
});

refs.exportDialog.addEventListener("click", (event) => {
  if (event.target === refs.exportDialog) {
    refs.exportDialog.close();
  }
});

function isTypingTarget(target) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

document.addEventListener("keydown", (event) => {
  if (event.isComposing || document.querySelector("dialog[open]")) {
    return;
  }

  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (modifier && !event.altKey && key === "z") {
    event.preventDefault();

    if (event.shiftKey) {
      handleRedo();
    } else {
      handleUndo();
    }

    return;
  }

  if (modifier && !event.altKey && key === "y") {
    event.preventDefault();
    handleRedo();
    return;
  }

  if (event.key === "Escape" && !isTypingTarget(event.target) && getSelectedEntryIds().length) {
    clearSelection();
    renderSidebar(refs);
    return;
  }

  if (modifier && key === "s") {
    event.preventDefault();
    const ok = flushSave();

    if (ok) {
      toast("Project saved", "success");
    }

    return;
  }

  if (event.altKey && event.code === "KeyN") {
    event.preventDefault();
    handleAddEntry();
    return;
  }

  if (event.key === "/" && !modifier && !event.altKey && !isTypingTarget(event.target)) {
    event.preventDefault();
    refs.entrySearch.focus();
    refs.entrySearch.select();
  }
});

window.addEventListener("beforeunload", () => {
  saveProject(getState());
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveProject(getState());
  }
});

const storedDetailsState = readDetailsState();
setDetailsCollapsed(storedDetailsState ?? window.matchMedia("(max-width: 720px)").matches, false);

initStore(loadProject());

const initialSortMode = readSortMode();

if (initialSortMode) {
  setSortMode(initialSortMode);
}

renderAll();

if (saveProject(getState())) {
  setSaveState("saved");
} else {
  setSaveState("error");
}
