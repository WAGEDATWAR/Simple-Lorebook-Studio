import { clamp, createId } from "./utils.js";

export const APP_ID = "lorebook-studio";
export const SCHEMA_VERSION = 1;

export const POSITIONS = [
  { value: "before_char", label: "Before character" },
  { value: "after_char", label: "After character" },
  { value: "before_an", label: "Before author's note" },
  { value: "after_an", label: "After author's note" },
  { value: "at_depth", label: "At depth" }
];

const POSITION_VALUES = new Set(POSITIONS.map((position) => position.value));

function normalizeExtensions(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeKeyList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((key) => String(key).trim())
    .filter(Boolean);
}

export function createEntry(patch = {}) {
  const now = Date.now();

  return {
    id: typeof patch.id === "string" && patch.id ? patch.id : createId("entry"),
    title: typeof patch.title === "string" ? patch.title : "",
    keys: normalizeKeyList(patch.keys),
    secondaryKeys: normalizeKeyList(patch.secondaryKeys),
    content: typeof patch.content === "string" ? patch.content : "",
    enabled: patch.enabled !== false,
    constant: patch.constant === true,
    selective: patch.selective === true,
    caseSensitive: patch.caseSensitive === true,
    matchWholeWords: patch.matchWholeWords === true,
    order: Number.isFinite(patch.order) ? clamp(Math.round(patch.order), 0, 9999) : 100,
    position: POSITION_VALUES.has(patch.position) ? patch.position : "before_char",
    probability: Number.isFinite(patch.probability) ? clamp(Math.round(patch.probability), 0, 100) : 100,
    createdAt: Number.isFinite(patch.createdAt) ? patch.createdAt : now,
    updatedAt: Number.isFinite(patch.updatedAt) ? patch.updatedAt : now,
    extensions: normalizeExtensions(patch.extensions)
  };
}

export function createBook(patch = {}) {
  const now = Date.now();

  return {
    id: typeof patch.id === "string" && patch.id ? patch.id : createId("book"),
    name: typeof patch.name === "string" ? patch.name : "Untitled Lorebook",
    description: typeof patch.description === "string" ? patch.description : "",
    entries: Array.isArray(patch.entries) ? patch.entries.map((entry) => createEntry(entry)) : [],
    createdAt: Number.isFinite(patch.createdAt) ? patch.createdAt : now,
    updatedAt: Number.isFinite(patch.updatedAt) ? patch.updatedAt : now,
    extensions: normalizeExtensions(patch.extensions)
  };
}

export function createProject(patch = {}) {
  const books = Array.isArray(patch.books) ? patch.books.map((book) => createBook(book)) : [];
  const activeBook = books.find((book) => book.id === patch.activeBookId) ?? books[0] ?? null;
  const activeEntry = activeBook?.entries.find((entry) => entry.id === patch.activeEntryId)
    ?? activeBook?.entries[0]
    ?? null;

  return {
    version: SCHEMA_VERSION,
    activeBookId: activeBook?.id ?? null,
    activeEntryId: activeEntry?.id ?? null,
    ui: { searchQuery: "" },
    books
  };
}
