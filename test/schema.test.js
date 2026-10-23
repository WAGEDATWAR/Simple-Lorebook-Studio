import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_ID,
  SCHEMA_VERSION,
  createBook,
  createEntry,
  createProject,
  normalizeKeyList
} from "../src/schema.js";

test("normalizes key lists", () => {
  assert.deepEqual(normalizeKeyList([" alpha ", "", "beta", 7]), ["alpha", "beta", "7"]);
  assert.deepEqual(normalizeKeyList("alpha,beta"), []);
  assert.deepEqual(normalizeKeyList(null), []);
});

test("creates entries with defaults and clamps input", () => {
  const entry = createEntry({
    id: "entry_custom",
    title: 42,
    keys: [" alpha ", "alpha", ""],
    secondaryKeys: [" beta "],
    tags: [" npc ", "NPC", "location", ""],
    content: "Content",
    notes: "Author-only notes",
    enabled: false,
    constant: true,
    selective: true,
    caseSensitive: true,
    matchWholeWords: true,
    order: 50000,
    position: "invalid",
    probability: 150,
    createdAt: 100,
    updatedAt: 200,
    extensions: []
  });

  assert.equal(entry.id, "entry_custom");
  assert.equal(entry.title, "");
  assert.deepEqual(entry.keys, ["alpha", "alpha"]);
  assert.deepEqual(entry.secondaryKeys, ["beta"]);
  assert.deepEqual(entry.tags, ["npc", "location"]);
  assert.equal(entry.notes, "Author-only notes");
  assert.equal(entry.enabled, false);
  assert.equal(entry.constant, true);
  assert.equal(entry.selective, true);
  assert.equal(entry.caseSensitive, true);
  assert.equal(entry.matchWholeWords, true);
  assert.equal(entry.order, 9999);
  assert.equal(entry.position, "before_char");
  assert.equal(entry.probability, 100);
  assert.equal(entry.createdAt, 100);
  assert.equal(entry.updatedAt, 200);
  assert.deepEqual(entry.extensions, {});
});

test("creates entries with a generated id and lower bounds", () => {
  const entry = createEntry({
    order: -20,
    probability: -5
  });

  assert.match(entry.id, /^entry_/);
  assert.equal(entry.order, 0);
  assert.equal(entry.probability, 0);
  assert.equal(entry.notes, "");
  assert.equal(entry.enabled, true);
});

test("creates books with normalized entries and defaults", () => {
  const book = createBook({
    name: "Book",
    description: "Description",
    tags: [" campaign ", "Campaign", "v2"],
    entries: [{ id: "entry_one", title: "Entry" }],
    extensions: null
  });
  const fallback = createBook();

  assert.equal(book.name, "Book");
  assert.equal(book.description, "Description");
  assert.deepEqual(book.tags, ["campaign", "v2"]);
  assert.equal(book.entries[0].id, "entry_one");
  assert.equal(fallback.name, "Untitled Lorebook");
  assert.equal(fallback.description, "");
  assert.deepEqual(fallback.tags, []);
  assert.deepEqual(fallback.entries, []);
  assert.deepEqual(book.extensions, {});
});

test("creates projects with resolved active ids", () => {
  const project = createProject({
    activeBookId: "book_two",
    activeEntryId: "entry_two",
    books: [
      {
        id: "book_one",
        name: "One",
        entries: [
          { id: "entry_one", title: "One" },
          { id: "entry_two", title: "Two" }
        ]
      },
      {
        id: "book_two",
        name: "Two",
        entries: [{ id: "entry_three", title: "Three" }]
      }
    ]
  });

  assert.equal(project.version, SCHEMA_VERSION);
  assert.equal(project.activeBookId, "book_two");
  assert.equal(project.activeEntryId, "entry_three");
  assert.deepEqual(project.ui, { searchQuery: "" });
  assert.equal(project.books[1].entries[0].title, "Three");
});

test("falls back when project active ids are missing", () => {
  const project = createProject({
    books: [{
      id: "book_one",
      entries: [
        { id: "entry_one", title: "One" },
        { id: "entry_two", title: "Two" }
      ]
    }]
  });

  assert.equal(project.activeBookId, "book_one");
  assert.equal(project.activeEntryId, "entry_one");
});

test("creates an empty project when no books are supplied", () => {
  const project = createProject();

  assert.equal(project.version, SCHEMA_VERSION);
  assert.equal(project.activeBookId, null);
  assert.equal(project.activeEntryId, null);
  assert.deepEqual(project.books, []);
});

test("exposes the canonical app identity", () => {
  assert.equal(APP_ID, "lorebook-studio");
  assert.equal(SCHEMA_VERSION, 1);
});
