import assert from "node:assert/strict";
import test from "node:test";
import { createProject } from "../src/schema.js";
import { VALIDATION_LABELS, validateBook } from "../src/validation.js";

function createBook(entries) {
  return createProject({
    books: [{
      name: "Validation Book",
      entries
    }]
  }).books[0];
}

test("reports empty content and missing trigger keys", () => {
  const book = createBook([
    { id: "entry_empty", title: "Empty", content: "   ", keys: [], order: 10 },
    { id: "entry_constant", title: "Constant", content: "Always present", constant: true, keys: [], order: 20 }
  ]);
  const issues = validateBook(book);

  assert.deepEqual(
    issues.map((issue) => [issue.entryId, issue.code]),
    [
      ["entry_empty", "emptyContent"],
      ["entry_empty", "missingKeys"]
    ]
  );
  assert.equal(issues[0].label, VALIDATION_LABELS.emptyContent);
  assert.equal(issues[1].label, VALIDATION_LABELS.missingKeys);
});

test("reports case-insensitive duplicate keys across entries", () => {
  const book = createBook([
    { id: "entry_one", title: "One", content: "One", keys: ["Alpha", "shared"] },
    { id: "entry_two", title: "Two", content: "Two", keys: ["alpha", "shared"] }
  ]);
  const issues = validateBook(book).filter((issue) => issue.code === "duplicateKeys");

  assert.equal(issues.length, 2);
  assert.match(issues[0].message, /Alpha/);
  assert.match(issues[0].message, /shared/);
  assert.match(issues[1].message, /alpha/);
  assert.equal(issues[0].entryTitle, "One");
});

test("reports trigger keys repeated within one entry", () => {
  const book = createBook([
    { id: "entry_one", title: "Repeated", content: "Content", keys: ["echo", "Echo"] }
  ]);
  const issues = validateBook(book);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "duplicateKeys");
  assert.match(issues[0].message, /Repeated in this entry: echo/);
});

test("reports insertion-order collisions for every affected entry", () => {
  const book = createBook([
    { id: "entry_one", title: "One", content: "One", keys: ["one"], order: 50 },
    { id: "entry_two", title: "Two", content: "Two", keys: ["two"], order: 50 },
    { id: "entry_three", title: "Three", content: "Three", keys: ["three"], order: 60 }
  ]);
  const issues = validateBook(book).filter((issue) => issue.code === "orderCollision");

  assert.deepEqual(issues.map((issue) => issue.entryId), ["entry_one", "entry_two"]);
  assert.match(issues[0].message, /order 50 is shared by 2 entries/);
});

test("returns no issues for a complete book", () => {
  const book = createBook([
    { id: "entry_one", title: "One", content: "One", keys: ["one"], order: 10 },
    { id: "entry_two", title: "Two", content: "Two", keys: ["two"], order: 20 }
  ]);

  assert.deepEqual(validateBook(book), []);
  assert.deepEqual(validateBook(null), []);
});
