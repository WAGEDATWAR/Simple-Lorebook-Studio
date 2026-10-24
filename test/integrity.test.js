import assert from "node:assert/strict";
import test from "node:test";
import { checkProjectIntegrity, repairProject } from "../src/integrity.js";
import { createProject } from "../src/schema.js";

function project(books, activeBookId = null, activeEntryId = null) {
  return { version: 2, activeBookId, activeEntryId, books };
}

test("reports no problems for a clean project", () => {
  const clean = createProject({
    books: [{
      id: "book_one",
      name: "Book",
      entries: [{ id: "entry_one", title: "Entry", keys: ["a"] }]
    }]
  });

  const report = checkProjectIntegrity(clean);

  assert.equal(report.ok, true);
  assert.deepEqual(report.problems, []);
});

test("detects duplicate book ids, entry ids, and source UIDs", () => {
  const broken = project([
    {
      id: "book_one",
      name: "A",
      entries: [
        { id: "entry_x", title: "X", extensions: { sourceId: "5" } },
        { id: "entry_x", title: "X2", extensions: { sourceId: "5" } }
      ]
    },
    { id: "book_one", name: "B", entries: [] }
  ]);
  const codes = checkProjectIntegrity(broken).problems.map((problem) => problem.code);

  assert.ok(codes.includes("duplicateBookIds"));
  assert.ok(codes.includes("duplicateEntryIds"));
  assert.ok(codes.includes("duplicateSourceIds"));
});

test("detects missing entry lists and dangling active references", () => {
  const broken = project([{ id: "book_one", name: "A" }], "book_missing", "entry_missing");
  const codes = checkProjectIntegrity(broken).problems.map((problem) => problem.code);

  assert.ok(codes.includes("missingEntries"));
  assert.ok(codes.includes("activeBookMissing"));
  assert.ok(codes.includes("activeEntryMissing"));
});

test("flags unreadable project data", () => {
  const report = checkProjectIntegrity({ books: null });

  assert.equal(report.ok, false);
  assert.equal(report.problems[0].code, "project");
});

test("repairs duplicate ids and source UIDs while preserving content", () => {
  const broken = project([
    {
      id: "book_one",
      name: "A",
      entries: [
        { id: "entry_x", title: "X", content: "c1", extensions: { sourceId: "5" } },
        { id: "entry_x", title: "X2", content: "c2", extensions: { sourceId: "5" } }
      ]
    },
    { id: "book_one", name: "B", entries: [] }
  ]);

  const repaired = repairProject(broken);

  assert.deepEqual(checkProjectIntegrity(repaired).problems, []);

  const entryIds = repaired.books.flatMap((book) => book.entries.map((entry) => entry.id));
  assert.equal(new Set(entryIds).size, entryIds.length);

  const bookIds = repaired.books.map((book) => book.id);
  assert.equal(new Set(bookIds).size, bookIds.length);

  const sourceIds = repaired.books[0].entries.map((entry) => entry.extensions.sourceId);
  assert.equal(new Set(sourceIds).size, sourceIds.length);
  assert.equal(repaired.books[0].entries[0].content, "c1");
  assert.equal(repaired.books[0].entries[1].content, "c2");
});
