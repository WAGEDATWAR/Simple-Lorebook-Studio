import assert from "node:assert/strict";
import test from "node:test";
import { parseProject } from "../src/format.js";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_BOOKS,
  MAX_IMPORT_ENTRIES,
  checkImportText,
  checkProjectLimits
} from "../src/limits.js";

test("rejects import text over the size limit", () => {
  const result = checkImportText("x".repeat(MAX_IMPORT_BYTES + 1));

  assert.equal(result.ok, false);
  assert.match(result.error, /too large/);
});

test("accepts import text within the size limit", () => {
  assert.equal(checkImportText("{}").ok, true);
});

test("rejects projects over the book limit", () => {
  const books = Array.from({ length: MAX_IMPORT_BOOKS + 1 }, (_, index) => ({ name: `Book ${index}` }));
  const result = checkProjectLimits({ books });

  assert.equal(result.ok, false);
  assert.match(result.error, /too many lorebooks/);
});

test("rejects projects over the entry limit", () => {
  const entries = Array.from({ length: MAX_IMPORT_ENTRIES + 1 }, () => ({ title: "Entry" }));
  const result = checkProjectLimits({ books: [{ name: "Big", entries }] });

  assert.equal(result.ok, false);
  assert.match(result.error, /too many entries/);
});

test("parseProject enforces the size limit before parsing", () => {
  const result = parseProject("x".repeat(MAX_IMPORT_BYTES + 1));

  assert.equal(result.ok, false);
  assert.match(result.error, /too large/);
});
