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

test("reports empty content and unreachable enabled entries", () => {
  const book = createBook([
    { id: "entry_empty", title: "Empty", content: "   ", keys: [], order: 10 },
    { id: "entry_constant", title: "Constant", content: "Always present", constant: true, keys: [], order: 20 }
  ]);
  const issues = validateBook(book);

  assert.deepEqual(
    issues.map((issue) => [issue.entryId, issue.code]),
    [
      ["entry_empty", "emptyContent"],
      ["entry_empty", "unreachable"]
    ]
  );
  assert.equal(issues[0].label, VALIDATION_LABELS.emptyContent);
  assert.equal(issues[1].label, VALIDATION_LABELS.unreachable);
});

test("reports case-insensitive key collisions across entries", () => {
  const book = createBook([
    { id: "entry_one", title: "One", content: "One", keys: ["Alpha", "shared"] },
    { id: "entry_two", title: "Two", content: "Two", keys: ["alpha", "shared"] }
  ]);
  const issues = validateBook(book).filter((issue) => issue.code === "keyCollision");

  assert.equal(issues.length, 2);
  assert.equal(issues[0].entryTitle, "One");
  assert.match(issues[0].message, /shared/);
  assert.match(issues[0].message, /alpha/);
  assert.match(issues[0].message, /Two/);
  assert.equal(validateBook(book).filter((issue) => issue.code === "duplicateKeys").length, 0);
});

test("distinguishes unreachable enabled entries from disabled missing-key entries", () => {
  const book = createBook([
    { id: "entry_enabled", title: "Enabled", content: "Content", keys: [], enabled: true, order: 10 },
    { id: "entry_disabled", title: "Disabled", content: "Content", keys: [], enabled: false, order: 20 }
  ]);
  const issues = validateBook(book);

  assert.deepEqual(
    issues.map((issue) => [issue.entryId, issue.code]),
    [
      ["entry_enabled", "unreachable"],
      ["entry_disabled", "missingKeys"]
    ]
  );
});

test("reports invalid regex keys with a plain-text fallback note", () => {
  const book = createBook([
    { id: "entry_regex", title: "Regex", content: "Content", keys: ["/[unterminated/"], order: 10 },
    { id: "entry_valid", title: "Valid", content: "Content", keys: ["/sword|blade/i"], order: 20 }
  ]);
  const issues = validateBook(book).filter((issue) => issue.code === "invalidRegex");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].entryId, "entry_regex");
  assert.equal(issues[0].label, VALIDATION_LABELS.invalidRegex);
  assert.match(issues[0].message, /Treated as plain text/);
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
