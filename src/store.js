import { createBook, createEntry } from "./schema.js";

const HISTORY_LIMIT = 60;
const HISTORY_GROUP_MS = 900;
const SORT_MODES = new Set(["manual", "title", "order", "updated", "enabled"]);

let state = null;
let past = [];
let future = [];
let lastHistoryKey = "";
let lastHistoryAt = 0;
let selectedEntryIds = new Set();
let selectionAnchorId = null;

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function snapshot() {
  return {
    activeBookId: state.activeBookId,
    activeEntryId: state.activeEntryId,
    books: clone(state.books)
  };
}

function restore(snapshotValue) {
  state.activeBookId = snapshotValue.activeBookId;
  state.activeEntryId = snapshotValue.activeEntryId;
  state.books = clone(snapshotValue.books);
  ensureSelections();
}

function captureHistory(key = "", coalesce = true) {
  if (!state) {
    return;
  }

  const now = Date.now();

  if (coalesce && key && key === lastHistoryKey && now - lastHistoryAt < HISTORY_GROUP_MS) {
    lastHistoryAt = now;
    future = [];
    return;
  }

  past.push(snapshot());

  if (past.length > HISTORY_LIMIT) {
    past.shift();
  }

  future = [];
  lastHistoryKey = key;
  lastHistoryAt = now;
}

function resetHistory() {
  past = [];
  future = [];
  lastHistoryKey = "";
  lastHistoryAt = 0;
}

function validEntryIds() {
  return new Set((getActiveBook()?.entries ?? []).map((entry) => entry.id));
}

function normalizeSelection() {
  const validIds = validEntryIds();
  selectedEntryIds = new Set([...selectedEntryIds].filter((id) => validIds.has(id)));

  if (selectionAnchorId && !validIds.has(selectionAnchorId)) {
    selectionAnchorId = null;
  }
}

function nextCopyTitle(title, entries) {
  const base = title.trim() || "Untitled entry";
  const first = `${base} (copy)`;

  if (!entries.some((entry) => entry.title === first)) {
    return first;
  }

  let index = 2;

  while (entries.some((entry) => entry.title === `${base} (copy ${index})`)) {
    index += 1;
  }

  return `${base} (copy ${index})`;
}

export function initStore(project) {
  state = project;
  resetHistory();
  clearSelection();
  ensureSelections();
  return state;
}

export function getState() {
  return state;
}

export function canUndo() {
  return past.length > 0;
}

export function canRedo() {
  return future.length > 0;
}

export function undo() {
  if (!past.length) {
    return false;
  }

  future.push(snapshot());
  restore(past.pop());
  lastHistoryKey = "";
  lastHistoryAt = 0;
  return true;
}

export function redo() {
  if (!future.length) {
    return false;
  }

  past.push(snapshot());
  restore(future.pop());
  lastHistoryKey = "";
  lastHistoryAt = 0;
  return true;
}

export function getActiveBook() {
  if (!state) {
    return null;
  }

  return state.books.find((book) => book.id === state.activeBookId) ?? state.books[0] ?? null;
}

export function getActiveEntry() {
  const book = getActiveBook();

  if (!book) {
    return null;
  }

  return book.entries.find((entry) => entry.id === state.activeEntryId) ?? null;
}

export function getSelectedEntryIds() {
  return [...selectedEntryIds];
}

export function getSelectionAnchorId() {
  return selectionAnchorId;
}

export function isEntrySelected(id) {
  return selectedEntryIds.has(id);
}

export function clearSelection() {
  selectedEntryIds = new Set();
  selectionAnchorId = null;
}

export function toggleEntrySelection(id) {
  if (!validEntryIds().has(id)) {
    return false;
  }

  if (!selectedEntryIds.size && state.activeEntryId && state.activeEntryId !== id) {
    selectedEntryIds.add(state.activeEntryId);
  }

  if (selectedEntryIds.has(id)) {
    selectedEntryIds.delete(id);

    if (selectionAnchorId === id) {
      selectionAnchorId = selectedEntryIds.has(state.activeEntryId)
        ? state.activeEntryId
        : [...selectedEntryIds].at(-1) ?? null;
    }
  } else {
    selectedEntryIds.add(id);
    selectionAnchorId = id;
  }

  if (!selectedEntryIds.size) {
    selectionAnchorId = null;
  }

  return selectedEntryIds.has(id);
}

export function selectEntryRange(ids, anchorId = null) {
  const validIds = validEntryIds();
  selectedEntryIds = new Set(ids.filter((id) => validIds.has(id)));

  if (anchorId && validIds.has(anchorId)) {
    selectionAnchorId = anchorId;
  } else if (selectionAnchorId && !validIds.has(selectionAnchorId)) {
    selectionAnchorId = null;
  }

  if (!selectedEntryIds.size) {
    selectionAnchorId = null;
  } else if (!selectionAnchorId || !selectedEntryIds.has(selectionAnchorId)) {
    selectionAnchorId = [...selectedEntryIds][0];
  }
}

export function ensureSelections() {
  if (!state) {
    return;
  }

  if (!state.ui || typeof state.ui !== "object") {
    state.ui = {};
  }

  if (typeof state.ui.searchQuery !== "string") {
    state.ui.searchQuery = "";
  }

  if (!SORT_MODES.has(state.ui.sortMode)) {
    state.ui.sortMode = "manual";
  }

  if (!state.books.length) {
    state.books.push(createBook({ name: "Untitled Lorebook" }));
  }

  const activeBook = state.books.find((book) => book.id === state.activeBookId) ?? state.books[0];
  state.activeBookId = activeBook.id;

  if (!activeBook.entries.some((entry) => entry.id === state.activeEntryId)) {
    state.activeEntryId = activeBook.entries[0]?.id ?? null;
  }

  normalizeSelection();
}

export function setActiveBook(id) {
  const book = state.books.find((item) => item.id === id);

  if (!book) {
    return;
  }

  state.activeBookId = book.id;
  state.activeEntryId = book.entries[0]?.id ?? null;
  clearSelection();
}

export function setActiveEntry(id) {
  const book = getActiveBook();

  if (book?.entries.some((entry) => entry.id === id)) {
    state.activeEntryId = id;
  }
}

export function setSortMode(mode) {
  if (!SORT_MODES.has(mode)) {
    return;
  }

  if (state.ui.sortMode !== mode) {
    state.ui.sortMode = mode;
    clearSelection();
  }
}

export function addBook() {
  captureHistory("add-book", false);
  const book = createBook({ name: "Untitled Lorebook" });
  state.books.push(book);
  state.activeBookId = book.id;
  state.activeEntryId = null;
  clearSelection();
  return book;
}

export function renameActiveBook(name) {
  const book = getActiveBook();

  if (!book) {
    return null;
  }

  const nextName = String(name);

  if (book.name === nextName) {
    return book;
  }

  captureHistory(`rename-book:${book.id}`);
  book.name = nextName;
  book.updatedAt = Date.now();
  return book;
}

export function updateActiveBookDescription(description) {
  const book = getActiveBook();

  if (!book) {
    return null;
  }

  const nextDescription = String(description);

  if (book.description === nextDescription) {
    return book;
  }

  captureHistory(`edit-book-description:${book.id}`);
  book.description = nextDescription;
  book.updatedAt = Date.now();
  return book;
}

export function deleteBook(id = state.activeBookId) {
  const index = state.books.findIndex((book) => book.id === id);

  if (index === -1) {
    return null;
  }

  captureHistory("delete-book", false);
  const [removed] = state.books.splice(index, 1);

  if (!state.books.length) {
    state.books.push(createBook({ name: "Untitled Lorebook" }));
  }

  if (!state.books.some((book) => book.id === state.activeBookId)) {
    state.activeBookId = state.books[0].id;
    state.activeEntryId = state.books[0].entries[0]?.id ?? null;
  }

  clearSelection();
  return removed;
}

export function addEntry() {
  const book = getActiveBook();

  if (!book) {
    return null;
  }

  captureHistory("add-entry", false);
  const highestOrder = book.entries.reduce((highest, entry) => Math.max(highest, entry.order), 0);
  const entry = createEntry({ order: highestOrder + 10 });
  book.entries.push(entry);
  book.updatedAt = Date.now();
  state.activeEntryId = entry.id;
  clearSelection();
  return entry;
}

export function duplicateEntry(id = state.activeEntryId) {
  const book = getActiveBook();
  const sourceIndex = book?.entries.findIndex((entry) => entry.id === id) ?? -1;

  if (!book || sourceIndex === -1) {
    return null;
  }

  const source = book.entries[sourceIndex];
  captureHistory("duplicate-entry", false);
  const extensions = clone(source.extensions ?? {});

  if (extensions.sourceId) {
    extensions.duplicatedFromSourceId = extensions.sourceId;
    delete extensions.sourceId;
  }

  const {
    id: sourceId,
    createdAt,
    updatedAt,
    ...entryFields
  } = source;
  const copy = createEntry({
    ...entryFields,
    title: nextCopyTitle(source.title, book.entries),
    extensions
  });

  book.entries.splice(sourceIndex + 1, 0, copy);
  book.updatedAt = Date.now();
  state.activeEntryId = copy.id;
  clearSelection();
  return copy;
}

export function updateActiveEntry(patch) {
  const entry = getActiveEntry();
  const book = getActiveBook();

  if (!entry || !book) {
    return null;
  }

  const fields = Object.keys(patch);

  if (!fields.some((field) => entry[field] !== patch[field])) {
    return entry;
  }

  captureHistory(`${entry.id}:${fields.sort().join(",")}`);
  Object.assign(entry, patch, { updatedAt: Date.now() });
  book.updatedAt = Date.now();
  return entry;
}

export function deleteActiveEntry() {
  const book = getActiveBook();
  const entry = getActiveEntry();

  if (!book || !entry) {
    return null;
  }

  captureHistory("delete-entry", false);
  const index = book.entries.findIndex((item) => item.id === entry.id);
  book.entries.splice(index, 1);
  const nextEntry = book.entries[index] ?? book.entries[index - 1] ?? null;
  state.activeEntryId = nextEntry?.id ?? null;
  book.updatedAt = Date.now();
  clearSelection();
  return entry;
}

export function deleteEntries(ids) {
  const book = getActiveBook();

  if (!book) {
    return 0;
  }

  const targets = new Set(ids);
  const removed = book.entries.filter((entry) => targets.has(entry.id));

  if (!removed.length) {
    return 0;
  }

  captureHistory("delete-entries", false);
  const activeRemoved = targets.has(state.activeEntryId);
  const firstIndex = book.entries.findIndex((entry) => targets.has(entry.id));
  book.entries = book.entries.filter((entry) => !targets.has(entry.id));
  book.updatedAt = Date.now();

  if (activeRemoved) {
    const nextIndex = Math.min(firstIndex, book.entries.length - 1);
    state.activeEntryId = book.entries[nextIndex]?.id ?? null;
  }

  clearSelection();
  return removed.length;
}

export function setEntriesEnabled(ids, enabled) {
  const book = getActiveBook();

  if (!book) {
    return 0;
  }

  const targets = new Set(ids);
  const changed = book.entries.filter((entry) => targets.has(entry.id) && entry.enabled !== enabled);

  if (!changed.length) {
    return 0;
  }

  captureHistory(`bulk-enabled:${enabled}`, false);
  const now = Date.now();

  for (const entry of changed) {
    entry.enabled = enabled;
    entry.updatedAt = now;
  }

  book.updatedAt = now;
  return changed.length;
}

export function moveEntry(sourceId, targetId, place = "before") {
  const book = getActiveBook();

  if (!book || sourceId === targetId) {
    return false;
  }

  const sourceIndex = book.entries.findIndex((entry) => entry.id === sourceId);

  if (sourceIndex === -1) {
    return false;
  }

  captureHistory("move-entry", false);
  const [entry] = book.entries.splice(sourceIndex, 1);
  const targetIndex = book.entries.findIndex((item) => item.id === targetId);

  if (targetIndex === -1) {
    book.entries.splice(sourceIndex, 0, entry);
    return false;
  }

  const insertIndex = place === "after" ? targetIndex + 1 : targetIndex;
  book.entries.splice(insertIndex, 0, entry);
  book.updatedAt = Date.now();
  return true;
}

export function setSearchQuery(query) {
  const nextQuery = String(query);

  if (state.ui.searchQuery !== nextQuery) {
    clearSelection();
  }

  state.ui.searchQuery = nextQuery;
}

export function replaceProject(project) {
  captureHistory("replace-project", false);
  state = project;
  clearSelection();
  ensureSelections();
  return state;
}
