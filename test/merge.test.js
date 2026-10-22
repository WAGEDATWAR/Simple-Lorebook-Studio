import assert from "node:assert/strict";
import test from "node:test";
import { mergeProject } from "../src/merge.js";
import { createEntry, createProject } from "../src/schema.js";

function book(name, entries = [], extra = {}) {
  return {
    id: extra.id ?? `book_${name}`,
    name,
    description: extra.description ?? "",
    entries,
    extensions: extra.extensions ?? {}
  };
}

function entry(title, content = "", extra = {}) {
  return createEntry({
    id: extra.id ?? `entry_${title}`,
    title,
    keys: extra.keys ?? [],
    secondaryKeys: extra.secondaryKeys ?? [],
    content,
    notes: extra.notes ?? "",
    enabled: extra.enabled ?? true,
    order: extra.order ?? 100,
    position: extra.position ?? "before_char",
    probability: extra.probability ?? 100,
    createdAt: extra.createdAt,
    extensions: extra.extensions ?? {}
  });
}

function project(books, activeBookId = null, activeEntryId = null) {
  return createProject({ books, activeBookId, activeEntryId });
}

test("replace returns the imported project and counts every book and entry", () => {
  const current = project([book("Alpha", [entry("A", "a")], { id: "book_alpha" })], "book_alpha");
  const incoming = project([
    book("Beta", [entry("B", "b"), entry("C", "c")], { id: "book_beta" }),
    book("Gamma", [entry("D", "d")], { id: "book_gamma" })
  ], "book_gamma", "entry_D");

  const result = mergeProject(current, incoming, "replace");

  assert.equal(result.project.books.length, 2);
  assert.equal(result.project.books[0].name, "Beta");
  assert.equal(result.project.activeBookId, "book_gamma");
  assert.equal(result.project.activeEntryId, "entry_D");
  assert.deepEqual(result.stats, {
    booksAdded: 2,
    booksMatched: 0,
    entriesAdded: 3,
    entriesUpdated: 0
  });
});

test("append keeps the current project and adds a new lorebook", () => {
  const current = project([book("Alpha", [entry("A", "a")], { id: "book_alpha" })], "book_alpha");
  const incoming = project([book("Beta", [entry("B", "b")], { id: "book_beta" })], "book_beta");

  const result = mergeProject(current, incoming, "append");

  assert.equal(result.project.books.length, 2);
  assert.equal(result.project.books[0].name, "Alpha");
  assert.equal(result.project.books[1].name, "Beta");
  assert.equal(result.project.books[1].entries[0].title, "B");
  assert.equal(result.project.activeBookId, "book_alpha");
  assert.equal(result.stats.booksAdded, 1);
  assert.equal(result.stats.booksMatched, 0);
  assert.equal(result.stats.entriesAdded, 1);
});

test("append adds imported entries to a lorebook matched by name", () => {
  const current = project([book("Alpha", [entry("A", "a", { id: "entry_a" })], { id: "book_alpha" })], "book_alpha");
  const incoming = project([
    book("alpha", [entry("A", "imported", { id: "entry_a" })], { id: "book_other" })
  ], "book_other");

  const result = mergeProject(current, incoming, "append");

  assert.equal(result.project.books.length, 1);
  assert.equal(result.project.books[0].entries.length, 2);
  assert.equal(result.project.books[0].entries[0].content, "a");
  assert.equal(result.project.books[0].entries[1].content, "imported");
  assert.notEqual(result.project.books[0].entries[1].id, "entry_a");
  assert.equal(result.stats.booksMatched, 1);
  assert.equal(result.stats.entriesAdded, 1);
  assert.equal(current.books[0].entries.length, 1);
});

test("merge updates entries matched by title and keeps their identity", () => {
  const current = project([
    book("Alpha", [
      entry("A", "old", { id: "entry_a", createdAt: 1000, extensions: { source: "chub", sourceId: "7" } }),
      entry("Keep", "keep", { id: "entry_keep" })
    ], { id: "book_alpha" })
  ], "book_alpha");

  const incoming = project([
    book("Alpha", [
      entry("A", "new", { id: "entry_other" }),
      entry("New", "brand new", { id: "entry_new" })
    ], { id: "book_beta" })
  ], "book_beta");

  const result = mergeProject(current, incoming, "merge");
  const alpha = result.project.books[0];
  const updated = alpha.entries.find((item) => item.title === "A");

  assert.equal(result.project.books.length, 1);
  assert.equal(alpha.entries.length, 3);
  assert.equal(updated.id, "entry_a");
  assert.equal(updated.content, "new");
  assert.equal(updated.createdAt, 1000);
  assert.equal(updated.extensions.source, "chub");
  assert.equal(updated.extensions.sourceId, "7");
  assert.ok(alpha.entries.some((item) => item.title === "Keep"));
  assert.ok(alpha.entries.some((item) => item.title === "New"));
  assert.equal(result.stats.entriesUpdated, 1);
  assert.equal(result.stats.entriesAdded, 1);
  assert.equal(result.project.activeBookId, "book_alpha");
});

test("merge adds a lorebook when no name matches", () => {
  const current = project([book("Alpha", [entry("A", "a")], { id: "book_alpha" })], "book_alpha");
  const incoming = project([book("Beta", [entry("B", "b")], { id: "book_beta" })], "book_beta");

  const result = mergeProject(current, incoming, "merge");

  assert.equal(result.project.books.length, 2);
  assert.equal(result.project.books[1].name, "Beta");
  assert.equal(result.stats.booksAdded, 1);
  assert.equal(result.stats.entriesAdded, 1);
});

test("merge never matches entries with empty titles", () => {
  const current = project([
    book("Alpha", [entry("", "existing", { id: "entry_existing" })], { id: "book_alpha" })
  ], "book_alpha");
  const incoming = project([
    book("Alpha", [entry("", "incoming", { id: "entry_incoming" })], { id: "book_beta" })
  ], "book_beta");

  const result = mergeProject(current, incoming, "merge");

  assert.equal(result.project.books[0].entries.length, 2);
  assert.equal(result.stats.entriesUpdated, 0);
  assert.equal(result.stats.entriesAdded, 1);
});

test("falls back to replace for an unknown strategy", () => {
  const current = project([book("Alpha", [entry("A", "a")], { id: "book_alpha" })], "book_alpha");
  const incoming = project([book("Beta", [entry("B", "b")], { id: "book_beta" })], "book_beta");

  const result = mergeProject(current, incoming, "unknown");

  assert.equal(result.project.books.length, 1);
  assert.equal(result.project.books[0].name, "Beta");
});
