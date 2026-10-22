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
  updateActiveBookDescription,
  updateActiveEntry
} from "./store.js";
import {
  getProjectBackupInfo,
  getRevisions,
  loadProject,
  loadProjectBackup,
  loadRevision,
  saveProject,
  saveProjectBackup,
  saveRevision
} from "./storage.js";
import { buildBookOverview } from "./overview.js";
import { ENTRY_TEMPLATES, buildTemplatePatch, getEntryTemplate } from "./templates.js";
import { renderEditor, syncEntryStats } from "./ui/editor.js";
import { confirmAction, toast } from "./ui/overlays.js";
import { renderSidebar } from "./ui/sidebar.js";
import { clamp } from "./utils.js";
import { VALIDATION_LABELS, validateBook } from "./validation.js";

const refs = {
  workspace: document.querySelector(".workspace"),
  sidebar: document.querySelector("#sidebar"),
  sidebarContent: document.querySelector("#sidebar-content"),
  sidebarToggle: document.querySelector("#sidebar-toggle"),
  sidebarResizer: document.querySelector("#sidebar-resizer"),
  bookName: document.querySelector("#book-name"),
  bookDescription: document.querySelector("#book-description"),
  bookDescriptionPreview: document.querySelector("#book-description-preview"),
  saveState: document.querySelector("#save-state"),
  undoBtn: document.querySelector("#undo-btn"),
  redoBtn: document.querySelector("#redo-btn"),
  historyBtn: document.querySelector("#history-btn"),
  historyDialog: document.querySelector("#history-dialog"),
  historyCount: document.querySelector("#history-count"),
  historyStatus: document.querySelector("#history-status"),
  historyList: document.querySelector("#history-list"),
  historySaveBtn: document.querySelector("#history-save-btn"),
  historyCloseBtn: document.querySelector("#history-close"),
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
  overviewBtn: document.querySelector("#overview-btn"),
  overviewDialog: document.querySelector("#overview-dialog"),
  overviewSummary: document.querySelector("#overview-summary"),
  overviewEntries: document.querySelector("#overview-entries"),
  overviewEnabled: document.querySelector("#overview-enabled"),
  overviewTokens: document.querySelector("#overview-tokens"),
  overviewEnabledTokens: document.querySelector("#overview-enabled-tokens"),
  overviewKeys: document.querySelector("#overview-keys"),
  overviewCoverage: document.querySelector("#overview-coverage"),
  overviewMeterBar: document.querySelector("#overview-meter-bar"),
  overviewAlwaysOn: document.querySelector("#overview-always-on"),
  overviewMissingKeys: document.querySelector("#overview-missing-keys"),
  overviewSharedKeys: document.querySelector("#overview-shared-keys"),
  overviewAverage: document.querySelector("#overview-average"),
  overviewLongest: document.querySelector("#overview-longest"),
  overviewCloseBtn: document.querySelector("#overview-close"),
  validationBtn: document.querySelector("#validation-btn"),
  validationCount: document.querySelector("#validation-count"),
  validationDialog: document.querySelector("#validation-dialog"),
  validationSummary: document.querySelector("#validation-summary"),
  validationCategories: document.querySelector("#validation-categories"),
  validationIssues: document.querySelector("#validation-issues"),
  validationCloseBtn: document.querySelector("#validation-close"),
  entryList: document.querySelector("#entry-list"),
  templateBtn: document.querySelector("#template-btn"),
  templateDialog: document.querySelector("#template-dialog"),
  templateList: document.querySelector("#template-list"),
  templateCloseBtn: document.querySelector("#template-close"),
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
  entryNotes: document.querySelector("#entry-notes"),
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
const numberFormatter = new Intl.NumberFormat("en-US");

const DETAILS_STATE_KEY = "lorebook-studio:details-collapsed:v1";
const SIDEBAR_STATE_KEY = "lorebook-studio:sidebar-collapsed:v1";
const SIDEBAR_WIDTH_KEY = "lorebook-studio:sidebar-width:v1";
const SORT_STATE_KEY = "lorebook-studio:sort:v1";
const SORT_MODES = new Set(["manual", "title", "order", "updated", "enabled"]);
const AUTO_REVISION_INTERVAL_MS = 5 * 60 * 1000;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 460;
const SIDEBAR_RESIZE_STEP = 16;

let draggedEntryId = null;
let dropTargetId = null;
let dropPlace = "before";
let sidebarWidth = 0;
let sidebarWidthMode = "auto";
let sidebarDrag = null;

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

function readSidebarState() {
  try {
    const value = localStorage.getItem(SIDEBAR_STATE_KEY);
    return value === null ? null : value === "1";
  } catch {
    return null;
  }
}

function readSidebarWidth() {
  try {
    const value = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function persistSidebarWidth(width) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch {
    return;
  }
}

function getSidebarMaxWidth() {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth - 360));
}

function applySidebarWidth(width, persist = false) {
  const next = Math.round(clamp(width, SIDEBAR_MIN_WIDTH, getSidebarMaxWidth()));
  sidebarWidth = next;
  refs.workspace.style.setProperty("--sidebar-width", `${next}px`);
  refs.sidebarResizer.setAttribute("aria-valuemin", String(SIDEBAR_MIN_WIDTH));
  refs.sidebarResizer.setAttribute("aria-valuemax", String(getSidebarMaxWidth()));
  refs.sidebarResizer.setAttribute("aria-valuenow", String(next));

  if (persist) {
    sidebarWidthMode = "manual";
    persistSidebarWidth(next);
  }

  return next;
}

function measureSidebarContentWidth() {
  const probe = document.createElement("div");
  const content = document.createElement("div");
  probe.className = "sidebar sidebar-probe";
  probe.setAttribute("aria-hidden", "true");
  content.className = "sidebar-content";

  for (const selector of [".sidebar-top", ".entry-list-head", ".sidebar-footer"]) {
    const source = refs.sidebar.querySelector(selector);

    if (!source) {
      continue;
    }

    const clone = source.cloneNode(true);
    clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    content.append(clone);
  }

  const preview = content.querySelector(".book-description-preview");
  const bookControls = content.querySelector(".book-controls");
  const bookMetaActions = content.querySelector(".book-meta-actions");

  if (preview) {
    preview.textContent = "Description preview";
  }

  if (bookControls) {
    bookControls.style.flexWrap = "nowrap";
  }

  if (bookMetaActions) {
    bookMetaActions.style.flexWrap = "nowrap";
  }

  probe.append(content);
  document.body.append(probe);

  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

function applyAutomaticSidebarWidth() {
  sidebarWidthMode = "auto";

  try {
    localStorage.removeItem(SIDEBAR_WIDTH_KEY);
  } catch {
    return applySidebarWidth(measureSidebarContentWidth());
  }

  applySidebarWidth(measureSidebarContentWidth());
}

function syncSidebarWidthToViewport() {
  if (sidebarDrag) {
    return;
  }

  applySidebarWidth(sidebarWidthMode === "auto" ? measureSidebarContentWidth() : readSidebarWidth() ?? sidebarWidth);
}

function setSidebarCollapsed(collapsed, persist = true) {
  refs.sidebar.classList.toggle("is-collapsed", collapsed);
  refs.workspace.classList.toggle("is-sidebar-collapsed", collapsed);
  refs.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  refs.sidebarResizer.hidden = collapsed;

  const label = collapsed ? "Expand library sidebar" : "Collapse library sidebar";
  refs.sidebarToggle.setAttribute("aria-label", label);
  refs.sidebarToggle.title = label;

  if (persist) {
    try {
      localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? "1" : "0");
    } catch {
      return;
    }
  }
}

function finishSidebarResize() {
  if (!sidebarDrag) {
    return;
  }

  const moved = sidebarDrag.moved;
  sidebarDrag = null;
  refs.workspace.classList.remove("is-resizing-sidebar");
  document.body.classList.remove("is-resizing-sidebar");

  if (moved) {
    sidebarWidthMode = "manual";
    persistSidebarWidth(sidebarWidth);
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

function updateBookDescriptionPreview(description) {
  const preview = String(description).replace(/\s+/g, " ").trim();
  refs.bookDescriptionPreview.textContent = preview || "Add a description";
  refs.bookDescriptionPreview.title = preview;
}

function renderAll() {
  const book = getActiveBook();
  refs.bookName.value = book?.name ?? "";
  refs.bookDescription.value = book?.description ?? "";
  updateBookDescriptionPreview(book?.description ?? "");
  renderSidebar(refs);
  renderEditor(refs);
  updateHistoryButtons();
  updateValidationIndicator();
  updateDocumentTitle();
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  setSaveState("saving");
  updateHistoryButtons();
  updateValidationIndicator();
  saveTimer = window.setTimeout(flushSave, 400);
}

function updateValidationIndicator() {
  const count = validateBook(getActiveBook()).length;
  const label = count
    ? `${count} ${count === 1 ? "validation issue" : "validation issues"}`
    : "No validation issues";

  refs.validationCount.textContent = String(count);
  refs.validationBtn.classList.toggle("has-issues", count > 0);
  refs.validationBtn.title = label;
  refs.validationBtn.setAttribute("aria-label", label);
}

function renderValidationDialog() {
  const issues = validateBook(getActiveBook());
  const entryCount = new Set(issues.map((issue) => issue.entryId)).size;

  refs.validationSummary.textContent = issues.length
    ? `${issues.length} ${issues.length === 1 ? "issue" : "issues"} across ${entryCount} ${entryCount === 1 ? "entry" : "entries"}.`
    : "No issues found. Empty content, duplicate keys, missing keys, and insertion-order collisions will appear here.";
  refs.validationCategories.replaceChildren();
  refs.validationIssues.replaceChildren();

  if (!issues.length) {
    const empty = document.createElement("div");
    empty.className = "validation-empty";
    empty.textContent = "Everything looks good.";
    refs.validationIssues.append(empty);
    refs.validationCategories.hidden = true;
    return;
  }

  for (const [code, label] of Object.entries(VALIDATION_LABELS)) {
    const count = issues.filter((issue) => issue.code === code).length;

    if (!count) {
      continue;
    }

    const chip = document.createElement("span");
    const value = document.createElement("strong");
    chip.className = "validation-chip";
    chip.append(document.createTextNode(`${label} `), value);
    value.textContent = String(count);
    refs.validationCategories.append(chip);
  }

  refs.validationCategories.hidden = false;
  const fragment = document.createDocumentFragment();

  for (const issue of issues) {
    const button = document.createElement("button");
    const head = document.createElement("span");
    const type = document.createElement("span");
    const entry = document.createElement("span");
    const message = document.createElement("span");

    button.type = "button";
    button.className = "validation-issue";
    button.dataset.entryId = issue.entryId;
    button.title = `Select ${issue.entryTitle}`;
    head.className = "validation-issue-head";
    type.className = "validation-issue-type";
    type.textContent = issue.label;
    entry.className = "validation-issue-entry";
    entry.textContent = issue.entryTitle;
    message.className = "validation-issue-message";
    message.textContent = issue.message;
    head.append(type, entry);
    button.append(head, message);
    fragment.append(button);
  }

  refs.validationIssues.append(fragment);
}

function openValidationDialog() {
  renderValidationDialog();
  refs.validationDialog.showModal();
}

function renderOverviewDialog() {
  const book = getActiveBook();
  const overview = buildBookOverview(book);
  const percent = Math.round(overview.coverage * 100);
  const bookName = book?.name?.trim() || "this lorebook";

  refs.overviewSummary.textContent = overview.entries
    ? `${overview.enabled} of ${overview.entries} ${overview.entries === 1 ? "entry" : "entries"} enabled in ${bookName}.`
    : "This lorebook has no entries yet.";
  refs.overviewEntries.textContent = numberFormatter.format(overview.entries);
  refs.overviewEnabled.textContent = numberFormatter.format(overview.enabled);
  refs.overviewTokens.textContent = `~${numberFormatter.format(overview.totals.tokens)}`;
  refs.overviewEnabledTokens.textContent = `~${numberFormatter.format(overview.enabledTotals.tokens)}`;
  refs.overviewKeys.textContent = numberFormatter.format(overview.uniqueKeys);
  refs.overviewCoverage.textContent = `${percent}%`;
  refs.overviewMeterBar.style.width = `${percent}%`;
  refs.overviewMeterBar.parentElement.setAttribute("aria-label", `Trigger key coverage: ${percent}%`);
  refs.overviewAlwaysOn.textContent = numberFormatter.format(overview.alwaysOn);
  refs.overviewMissingKeys.textContent = numberFormatter.format(overview.missingKeys);
  refs.overviewSharedKeys.textContent = numberFormatter.format(overview.sharedKeys);
  refs.overviewAverage.textContent = `~${numberFormatter.format(overview.averageTokens)} tokens`;
  refs.overviewLongest.replaceChildren();

  if (overview.longestEntry) {
    const name = document.createElement("span");
    name.textContent = overview.longestEntry.title;
    refs.overviewLongest.append(
      document.createTextNode("Longest entry: "),
      name,
      document.createTextNode(` (~${numberFormatter.format(overview.longestEntry.tokens)} tokens)`)
    );
  }
}

function openOverviewDialog() {
  renderOverviewDialog();
  refs.overviewDialog.showModal();
}

function jumpToValidationEntry(entryId) {
  refs.validationDialog.close();
  clearSearch();
  setActiveEntry(entryId);
  renderAll();
  scrollEntryCardIntoView(entryId);
  focusEntryCard(entryId);
  scheduleSave();
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
    maybeSaveRevision();
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

function recordRevision(reason) {
  return saveRevision(getState(), reason);
}

function setHistoryStatus(message, tone = "") {
  refs.historyStatus.textContent = message;
  refs.historyStatus.hidden = !message;
  refs.historyStatus.classList.toggle("is-error", tone === "error");
  refs.historyStatus.classList.toggle("is-success", tone === "success");
}

function maybeSaveRevision() {
  const latest = getRevisions().revisions[0] ?? null;

  if (!latest) {
    recordRevision("Initial snapshot");
    return;
  }

  if (Date.now() - latest.createdAt >= AUTO_REVISION_INTERVAL_MS) {
    recordRevision("Automatic snapshot");
  }
}

function renderHistoryDialog() {
  const revisions = getRevisions().revisions;
  const count = revisions.length;

  refs.historyCount.textContent = `${count} ${count === 1 ? "snapshot" : "snapshots"}`;
  refs.historyList.replaceChildren();

  if (!count) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No snapshots yet. Save one now or keep editing to create automatic snapshots.";
    refs.historyList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const revision of revisions) {
    const item = document.createElement("article");
    const info = document.createElement("div");
    const reason = document.createElement("span");
    const meta = document.createElement("span");
    const restore = document.createElement("button");
    const createdAt = formatBackupDate(revision.createdAt);

    item.className = "history-item";
    info.className = "history-item-info";
    reason.className = "history-item-reason";
    reason.textContent = revision.reason;
    meta.className = "history-item-meta";
    meta.textContent = `${createdAt} · ${revision.books} ${revision.books === 1 ? "lorebook" : "lorebooks"} · ${revision.entries} ${revision.entries === 1 ? "entry" : "entries"}`;
    restore.type = "button";
    restore.className = "btn";
    restore.dataset.revisionId = revision.id;
    restore.setAttribute("aria-label", `Restore snapshot: ${revision.reason}, ${createdAt}`);
    restore.textContent = "Restore";
    info.append(reason, meta);
    item.append(info, restore);
    fragment.append(item);
  }

  refs.historyList.append(fragment);
}

function openHistoryDialog() {
  setHistoryStatus("");
  renderHistoryDialog();

  if (!refs.historyDialog.open) {
    refs.historyDialog.showModal();
  }
}

async function handleRestoreRevision(id) {
  const revision = getRevisions().revisions.find((item) => item.id === id);
  const loaded = loadRevision(id);

  if (!loaded.ok) {
    refs.historyDialog.close();
    toast(loaded.error, "error");
    return;
  }

  refs.historyDialog.close();
  const accepted = await confirmAction({
    title: "Restore this revision?",
    message: "The current project will be replaced by the snapshot. Its current state will be saved as a revision first.",
    details: [
      { label: "Snapshot", value: revision?.reason ?? "Revision" },
      { label: "Created", value: formatBackupDate(revision?.createdAt) },
      { label: "Lorebooks", value: String(loaded.project.books.length) },
      {
        label: "Entries",
        value: String(loaded.project.books.reduce((total, book) => total + book.entries.length, 0))
      }
    ],
    confirmLabel: "Restore revision",
    tone: "primary"
  });

  if (!accepted) {
    openHistoryDialog();
    return;
  }

  const current = recordRevision("Before restoring a revision");

  if (!current.ok && !current.skipped) {
    const proceed = await confirmAction({
      title: "Snapshot failed",
      message: "The current project could not be saved as a revision. Restore anyway? You can undo the restore in this session.",
      confirmLabel: "Restore anyway"
    });

    if (!proceed) {
      openHistoryDialog();
      return;
    }
  }

  replaceProject(loaded.project);
  clearSearch();
  const sortMode = readSortMode();

  if (sortMode) {
    setSortMode(sortMode);
  }

  renderAll();
  flushSave();
  toast("Revision restored", "success");
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

function renderTemplateDialog() {
  refs.templateList.replaceChildren();
  const fragment = document.createDocumentFragment();

  for (const template of ENTRY_TEMPLATES) {
    const option = document.createElement("button");
    const info = document.createElement("span");
    const name = document.createElement("span");
    const description = document.createElement("span");
    const action = document.createElement("span");

    option.type = "button";
    option.className = "template-option";
    option.dataset.templateId = template.id;
    info.className = "template-option-info";
    name.className = "template-option-name";
    name.textContent = template.name;
    description.className = "template-option-description";
    description.textContent = template.description;
    action.className = "template-option-action";
    action.textContent = "Use";
    info.append(name, description);
    option.append(info, action);
    fragment.append(option);
  }

  refs.templateList.append(fragment);
}

function openTemplateDialog() {
  renderTemplateDialog();
  refs.templateDialog.showModal();
}

function handleTemplatePick(templateId) {
  const template = getEntryTemplate(templateId);
  const patch = buildTemplatePatch(template);

  if (!patch) {
    return;
  }

  refs.templateDialog.close();
  clearSearch();
  const entry = addEntry(patch);

  if (!entry) {
    return;
  }

  renderAll();
  refs.entryTitle.focus();
  refs.entryTitle.select();
  scheduleSave();
  toast(`${template.name} entry added`, "success");
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

  recordRevision(`Before importing ${file.name}`);
  replaceProject(parsed.project);

  const sortMode = readSortMode();

  if (sortMode) {
    setSortMode(sortMode);
  }

  clearSearch();
  renderAll();
  flushSave();
  recordRevision(`Imported ${file.name}`);
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

refs.bookDescription.addEventListener("input", (event) => {
  updateActiveBookDescription(event.target.value);
  updateBookDescriptionPreview(event.target.value);
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
refs.templateBtn.addEventListener("click", openTemplateDialog);

refs.templateCloseBtn.addEventListener("click", () => {
  refs.templateDialog.close();
});

refs.templateList.addEventListener("click", (event) => {
  const option = event.target.closest("[data-template-id]");

  if (option) {
    handleTemplatePick(option.dataset.templateId);
  }
});

refs.templateDialog.addEventListener("click", (event) => {
  if (event.target === refs.templateDialog) {
    refs.templateDialog.close();
  }
});

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

refs.entryNotes.addEventListener("input", (event) => {
  updateActiveEntry({ notes: event.target.value });
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

refs.historyBtn.addEventListener("click", openHistoryDialog);

refs.historySaveBtn.addEventListener("click", () => {
  const result = recordRevision("Manual snapshot");

  if (!result.ok) {
    setHistoryStatus(result.error, "error");
  } else if (result.skipped) {
    setHistoryStatus(result.error);
  } else {
    setHistoryStatus("Snapshot saved.", "success");
  }

  renderHistoryDialog();
});

refs.historyCloseBtn.addEventListener("click", () => {
  refs.historyDialog.close();
});

refs.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-revision-id]");

  if (button) {
    handleRestoreRevision(button.dataset.revisionId);
  }
});

refs.historyDialog.addEventListener("click", (event) => {
  if (event.target === refs.historyDialog) {
    refs.historyDialog.close();
  }
});

refs.detailsToggle.addEventListener("click", () => {
  setDetailsCollapsed(!refs.detailsPanel.classList.contains("is-collapsed"));
});

refs.sidebarToggle.addEventListener("click", () => {
  setSidebarCollapsed(!refs.sidebar.classList.contains("is-collapsed"));
});

refs.sidebarResizer.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || refs.sidebar.classList.contains("is-collapsed")) {
    return;
  }

  sidebarDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: refs.sidebar.getBoundingClientRect().width,
    moved: false
  };
  refs.sidebarResizer.setPointerCapture(event.pointerId);
  refs.workspace.classList.add("is-resizing-sidebar");
  document.body.classList.add("is-resizing-sidebar");
  event.preventDefault();
});

refs.sidebarResizer.addEventListener("pointermove", (event) => {
  if (!sidebarDrag || event.pointerId !== sidebarDrag.pointerId) {
    return;
  }

  const delta = event.clientX - sidebarDrag.startX;

  if (delta !== 0) {
    sidebarDrag.moved = true;
  }

  applySidebarWidth(sidebarDrag.startWidth + delta);
});

refs.sidebarResizer.addEventListener("pointerup", finishSidebarResize);
refs.sidebarResizer.addEventListener("pointercancel", finishSidebarResize);
refs.sidebarResizer.addEventListener("lostpointercapture", finishSidebarResize);

refs.sidebarResizer.addEventListener("keydown", (event) => {
  let next = null;

  if (event.key === "ArrowLeft") {
    next = sidebarWidth - (event.shiftKey ? SIDEBAR_RESIZE_STEP * 2 : SIDEBAR_RESIZE_STEP);
  } else if (event.key === "ArrowRight") {
    next = sidebarWidth + (event.shiftKey ? SIDEBAR_RESIZE_STEP * 2 : SIDEBAR_RESIZE_STEP);
  } else if (event.key === "Home") {
    next = SIDEBAR_MIN_WIDTH;
  } else if (event.key === "End") {
    next = getSidebarMaxWidth();
  }

  if (next === null) {
    return;
  }

  event.preventDefault();
  sidebarWidthMode = "manual";
  applySidebarWidth(next, true);
});

refs.sidebarResizer.addEventListener("dblclick", (event) => {
  event.preventDefault();
  applyAutomaticSidebarWidth();
});

window.addEventListener("resize", syncSidebarWidthToViewport);

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

refs.overviewBtn.addEventListener("click", openOverviewDialog);

refs.overviewCloseBtn.addEventListener("click", () => {
  refs.overviewDialog.close();
});

refs.overviewDialog.addEventListener("click", (event) => {
  if (event.target === refs.overviewDialog) {
    refs.overviewDialog.close();
  }
});

refs.validationBtn.addEventListener("click", openValidationDialog);

refs.validationCloseBtn.addEventListener("click", () => {
  refs.validationDialog.close();
});

refs.validationIssues.addEventListener("click", (event) => {
  const issue = event.target.closest("[data-entry-id]");

  if (issue) {
    jumpToValidationEntry(issue.dataset.entryId);
  }
});

refs.validationDialog.addEventListener("click", (event) => {
  if (event.target === refs.validationDialog) {
    refs.validationDialog.close();
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

const storedSidebarState = readSidebarState();
setSidebarCollapsed(storedSidebarState ?? false, false);

initStore(loadProject());

const initialSortMode = readSortMode();

if (initialSortMode) {
  setSortMode(initialSortMode);
}

renderAll();

const storedSidebarWidth = readSidebarWidth();

if (storedSidebarWidth === null) {
  applyAutomaticSidebarWidth();
} else {
  sidebarWidthMode = "manual";
  applySidebarWidth(storedSidebarWidth);
}

if (saveProject(getState())) {
  setSaveState("saved");
  maybeSaveRevision();
} else {
  setSaveState("error");
}
