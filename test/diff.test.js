import assert from "node:assert/strict";
import test from "node:test";
import { diffProjects, diffText } from "../src/diff.js";
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
    extensions: extra.extensions ?? {}
  });
}

test("builds a line diff with unchanged, removed, and added lines", () => {
  const lines = diffText("one\ntwo\nthree", "one\nTWO\nthree");

  assert.deepEqual(lines.map((line) => [line.type, line.text]), [
    ["same", "one"],
    ["remove", "two"],
    ["add", "TWO"],
    ["same", "three"]
  ]);
  assert.deepEqual(lines.map((line) => line.beforeLine), [1, 2, null, 3]);
  assert.deepEqual(lines.map((line) => line.afterLine), [1, null, 2, 3]);
});

test("handles only added and only removed text", () => {
  assert.deepEqual(diffText("", "first\nsecond").map((line) => line.type), ["add", "add"]);
  assert.deepEqual(diffText("first\nsecond", "").map((line) => line.type), ["remove", "remove"]);
  assert.deepEqual(diffText("", ""), []);
});

test("reports added, removed, and changed books and entries", () => {
  const before = createProject({
    books: [
      book("Keep", [entry("Changed", "old"), entry("Removed", "gone")]),
      book("Removed Book", [entry("Old")])
    ]
  });
  const after = createProject({
    books: [
      book("Keep", [entry("Changed", "new"), entry("Added", "fresh")]),
      book("Added Book", [entry("New")])
    ]
  });
  const diff = diffProjects(before, after);

  assert.equal(diff.hasChanges, true);
  assert.deepEqual(diff.summary, {
    booksAdded: 1,
    booksRemoved: 1,
    booksChanged: 1,
    booksMetadataChanged: 0,
    booksUnchanged: 0,
    entriesAdded: 2,
    entriesRemoved: 2,
    entriesChanged: 1,
    entriesUnchanged: 0,
    fieldsChanged: 1
  });

  const keep = diff.books.find((item) => item.name === "Keep");
  const changed = keep.entries.find((item) => item.title === "Changed");
  const removed = keep.entries.find((item) => item.title === "Removed");
  const added = keep.entries.find((item) => item.title === "Added");

  assert.equal(changed.status, "changed");
  assert.deepEqual(changed.changes.map((change) => change.key), ["content"]);
  assert.deepEqual(changed.changes[0].lines.map((line) => line.type), ["remove", "add"]);
  assert.equal(removed.status, "removed");
  assert.equal(added.status, "added");
});

test("matches imported books and entries by name and source ID when IDs change", () => {
  const before = createProject({
    books: [book("Lore", [
      entry("Mara", "old", { id: "old_entry", extensions: { sourceId: "12" } })
    ], { id: "old_book" })]
  });
  const after = createProject({
    books: [book("Lore", [
      entry("Mara", "new", { id: "new_entry", extensions: { sourceId: "12" } })
    ], { id: "new_book" })]
  });
  const diff = diffProjects(before, after);

  assert.equal(diff.summary.booksAdded, 0);
  assert.equal(diff.summary.booksRemoved, 0);
  assert.equal(diff.summary.booksChanged, 1);
  assert.equal(diff.summary.entriesChanged, 1);
  assert.equal(diff.books[0].entries[0].status, "changed");
});

test("distinguishes book metadata changes from entry changes", () => {
  const before = createProject({ books: [book("Lore", [entry("Mara", "same")], { description: "old" })] });
  const after = createProject({ books: [book("Lore", [entry("Mara", "same")], { description: "new" })] });
  const diff = diffProjects(before, after);

  assert.equal(diff.summary.booksChanged, 1);
  assert.equal(diff.summary.booksMetadataChanged, 1);
  assert.equal(diff.summary.entriesChanged, 0);
  assert.equal(diff.books[0].changes[0].key, "description");
  assert.deepEqual(diff.books[0].changes[0].lines.map((line) => line.type), ["remove", "add"]);
});

test("treats an imported book with a new name as a replacement", () => {
  const before = createProject({ books: [book("Old")] });
  const after = createProject({ books: [book("New")] });
  const diff = diffProjects(before, after);

  assert.equal(diff.summary.booksAdded, 1);
  assert.equal(diff.summary.booksRemoved, 1);
  assert.equal(diff.summary.booksChanged, 0);
});

test("returns no changes for equivalent projects", () => {
  const project = createProject({ books: [book("Same", [entry("One", "text")])] });
  const diff = diffProjects(project, project);

  assert.equal(diff.hasChanges, false);
  assert.equal(diff.summary.booksUnchanged, 1);
  assert.equal(diff.summary.entriesUnchanged, 1);
  assert.equal(diff.summary.fieldsChanged, 0);
});
