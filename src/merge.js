import { createBook, createEntry, createProject } from "./schema.js";
import { createId } from "./utils.js";

export const IMPORT_STRATEGIES = [
  {
    value: "replace",
    label: "Replace project",
    description: "Discard the current project and use the imported file."
  },
  {
    value: "append",
    label: "Append to matching lorebooks",
    description: "Keep existing entries and add imported entries after them. Lorebooks are matched by name."
  },
  {
    value: "merge",
    label: "Merge by title",
    description: "Match lorebooks by name and entries by title. Matched entries are updated; new entries are added."
  }
];

const STRATEGY_VALUES = new Set(IMPORT_STRATEGIES.map((strategy) => strategy.value));

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeName(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function createIdAllocator(prefix, used) {
  return (candidate) => {
    const preferred = typeof candidate === "string" && candidate ? candidate : createId(prefix);

    if (!used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }

    let next = createId(prefix);

    while (used.has(next)) {
      next = createId(prefix);
    }

    used.add(next);
    return next;
  };
}

function copyEntry(entry, allocateEntryId) {
  return createEntry({
    ...clone(entry),
    id: allocateEntryId(entry?.id)
  });
}

function copyBook(book, allocateBookId, allocateEntryId) {
  return createBook({
    ...clone(book),
    id: allocateBookId(book?.id),
    entries: (book?.entries ?? []).map((entry) => copyEntry(entry, allocateEntryId))
  });
}

function findMatchingBook(books, name, matched) {
  const target = normalizeName(name);

  if (!target) {
    return -1;
  }

  return books.findIndex((book, index) => (
    !matched.has(index) && normalizeName(book?.name) === target
  ));
}

function findMatchingEntry(entries, title, matched) {
  const target = normalizeName(title);

  if (!target) {
    return -1;
  }

  return entries.findIndex((entry, index) => (
    !matched.has(index) && normalizeName(entry?.title) === target
  ));
}

function updateEntry(existing, incoming) {
  existing.title = incoming.title;
  existing.keys = [...incoming.keys];
  existing.secondaryKeys = [...incoming.secondaryKeys];
  existing.content = incoming.content;
  existing.notes = incoming.notes;
  existing.enabled = incoming.enabled;
  existing.constant = incoming.constant;
  existing.selective = incoming.selective;
  existing.caseSensitive = incoming.caseSensitive;
  existing.matchWholeWords = incoming.matchWholeWords;
  existing.order = incoming.order;
  existing.position = incoming.position;
  existing.probability = incoming.probability;
  existing.extensions = { ...existing.extensions, ...clone(incoming.extensions) };
  existing.updatedAt = Date.now();
}

function countEntries(books) {
  return (books ?? []).reduce((total, book) => total + (book?.entries?.length ?? 0), 0);
}

function finalizeProject(books, current, incoming, strategy) {
  const activeBookId = strategy === "replace"
    ? incoming.activeBookId
    : current.activeBookId;
  const resolvedBookId = books.some((book) => book.id === activeBookId)
    ? activeBookId
    : books[0]?.id ?? null;
  const activeBook = books.find((book) => book.id === resolvedBookId) ?? null;
  const requestedEntryId = strategy === "replace" ? incoming.activeEntryId : current.activeEntryId;
  const activeEntryId = activeBook?.entries.some((entry) => entry.id === requestedEntryId)
    ? requestedEntryId
    : activeBook?.entries[0]?.id ?? null;

  return createProject({
    books,
    activeBookId: resolvedBookId,
    activeEntryId
  });
}

export function mergeProject(current, incoming, strategy = "replace") {
  const selected = STRATEGY_VALUES.has(strategy) ? strategy : "replace";
  const incomingBooks = Array.isArray(incoming?.books) ? incoming.books : [];
  const stats = {
    booksAdded: 0,
    booksMatched: 0,
    entriesAdded: 0,
    entriesUpdated: 0
  };

  if (selected === "replace") {
    stats.booksAdded = incomingBooks.length;
    stats.entriesAdded = countEntries(incomingBooks);

    return {
      project: finalizeProject(clone(incomingBooks), current, incoming, "replace"),
      stats
    };
  }

  const books = clone(current?.books ?? []);
  const usedBookIds = new Set(books.map((book) => book.id));
  const usedEntryIds = new Set();

  for (const book of books) {
    for (const entry of book.entries ?? []) {
      usedEntryIds.add(entry.id);
    }
  }

  const allocateBookId = createIdAllocator("book", usedBookIds);
  const allocateEntryId = createIdAllocator("entry", usedEntryIds);
  const matchedBooks = new Set();

  for (const incomingBook of incomingBooks) {
    const matchIndex = findMatchingBook(books, incomingBook.name, matchedBooks);

    if (matchIndex === -1) {
      books.push(copyBook(incomingBook, allocateBookId, allocateEntryId));
      stats.booksAdded += 1;
      stats.entriesAdded += incomingBook.entries?.length ?? 0;
      continue;
    }

    matchedBooks.add(matchIndex);
    stats.booksMatched += 1;
    const target = books[matchIndex];

    if (selected === "append") {
      for (const entry of incomingBook.entries ?? []) {
        target.entries.push(copyEntry(entry, allocateEntryId));
        stats.entriesAdded += 1;
      }
    } else {
      const matchedEntries = new Set();

      for (const entry of incomingBook.entries ?? []) {
        const entryIndex = findMatchingEntry(target.entries, entry.title, matchedEntries);

        if (entryIndex === -1) {
          target.entries.push(copyEntry(entry, allocateEntryId));
          stats.entriesAdded += 1;
        } else {
          matchedEntries.add(entryIndex);
          updateEntry(target.entries[entryIndex], entry);
          stats.entriesUpdated += 1;
        }
      }
    }

    target.updatedAt = Date.now();
  }

  return {
    project: finalizeProject(books, current, incoming, selected),
    stats
  };
}
