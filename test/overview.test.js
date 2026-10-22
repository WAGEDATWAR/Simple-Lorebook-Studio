import assert from "node:assert/strict";
import test from "node:test";
import { buildBookOverview } from "../src/overview.js";
import { createProject } from "../src/schema.js";

function createBook(entries) {
  return createProject({
    books: [{
      name: "Overview Book",
      entries
    }]
  }).books[0];
}

test("summarizes entries, tokens, and key coverage", () => {
  const book = createBook([
    { id: "entry_one", title: "One", content: "12345678", keys: ["Alpha", "alpha", "beta"] },
    { id: "entry_two", title: "Two", content: "1234", keys: ["beta"], enabled: false },
    { id: "entry_three", title: "Three", content: "", constant: true, keys: [] },
    { id: "entry_four", title: "Four", content: "1234", keys: [] }
  ]);
  const overview = buildBookOverview(book);

  assert.equal(overview.entries, 4);
  assert.equal(overview.enabled, 3);
  assert.equal(overview.disabled, 1);
  assert.equal(overview.alwaysOn, 1);
  assert.equal(overview.covered, 2);
  assert.equal(overview.missingKeys, 1);
  assert.equal(overview.coverage, 0.5);
  assert.equal(overview.uniqueKeys, 2);
  assert.equal(overview.sharedKeys, 1);
  assert.deepEqual(overview.totals, { chars: 16, words: 3, tokens: 4 });
  assert.deepEqual(overview.enabledTotals, { chars: 12, words: 2, tokens: 3 });
  assert.equal(overview.averageTokens, 1);
  assert.deepEqual(overview.longestEntry, {
    id: "entry_one",
    title: "One",
    chars: 8,
    tokens: 2
  });
});

test("returns zeroed metrics for an empty book", () => {
  const overview = buildBookOverview(createBook([]));

  assert.equal(overview.entries, 0);
  assert.equal(overview.coverage, 0);
  assert.equal(overview.uniqueKeys, 0);
  assert.equal(overview.averageTokens, 0);
  assert.equal(overview.longestEntry, null);
  assert.deepEqual(overview.totals, { chars: 0, words: 0, tokens: 0 });
});
