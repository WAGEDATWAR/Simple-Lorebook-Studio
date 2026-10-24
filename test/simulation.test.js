import assert from "node:assert/strict";
import test from "node:test";
import { createProject } from "../src/schema.js";
import { keyMatches, simulateContext } from "../src/simulation.js";

function createBook(entries) {
  return createProject({
    books: [{ name: "Simulation Book", entries }]
  }).books[0];
}

test("matches plain keys case-insensitively by default", () => {
  assert.equal(keyMatches("The Harbor is quiet.", "harbor"), true);
  assert.equal(keyMatches("The Harbor is quiet.", "Harbor"), true);
  assert.equal(keyMatches("The Harbor is quiet.", "harbour"), false);
});

test("respects case sensitivity and whole-word matching", () => {
  assert.equal(keyMatches("The harbor", "Harbor", { caseSensitive: true }), false);
  assert.equal(keyMatches("The Harbor", "Harbor", { caseSensitive: true }), true);
  assert.equal(keyMatches("harbormaster", "harbor", { matchWholeWords: true }), false);
  assert.equal(keyMatches("the harbor bells", "harbor", { matchWholeWords: true }), true);
});

test("matches regex keys", () => {
  assert.equal(keyMatches("a sword and a blade", "/sword|blade/i"), true);
  assert.equal(keyMatches("a shield", "/sword|blade/i"), false);
});

test("activates always-on entries and sorts by insertion order", () => {
  const book = createBook([
    { id: "entry_late", title: "Late", content: "Late", keys: ["harbor"], order: 50 },
    { id: "entry_always", title: "Always", content: "Always", constant: true, keys: [], order: 10 },
    { id: "entry_early", title: "Early", content: "Early", keys: ["harbor"], order: 20 }
  ]);
  const result = simulateContext(book, "The harbor bells ring.");

  assert.deepEqual(result.activated.map((item) => item.entry.id), ["entry_always", "entry_early", "entry_late"]);
  assert.equal(result.activated[0].reason, "alwaysOn");
  assert.deepEqual(result.activated[1].matchedKeys, ["harbor"]);
  assert.equal(result.injectedText, "Always\n\nEarly\n\nLate");
});

test("skips disabled, keyless, unmatched, and selective entries", () => {
  const book = createBook([
    { id: "entry_disabled", title: "Disabled", content: "x", keys: ["harbor"], enabled: false },
    { id: "entry_nokeys", title: "No keys", content: "x", keys: [] },
    { id: "entry_nomatch", title: "No match", content: "x", keys: ["dragon"] },
    { id: "entry_selective", title: "Selective", content: "x", keys: ["harbor"], secondaryKeys: ["storm"], selective: true }
  ]);
  const result = simulateContext(book, "The harbor is calm.");

  assert.equal(result.activated.length, 0);
  assert.deepEqual(
    result.skipped.map((item) => [item.entry.id, item.reason]),
    [
      ["entry_disabled", "disabled"],
      ["entry_nokeys", "noKeys"],
      ["entry_nomatch", "noMatch"],
      ["entry_selective", "selective"]
    ]
  );
});

test("activates selective entries when the secondary key matches", () => {
  const book = createBook([
    { id: "entry_selective", title: "Selective", content: "x", keys: ["harbor"], secondaryKeys: ["storm"], selective: true }
  ]);
  const result = simulateContext(book, "A storm rolls over the harbor.");

  assert.equal(result.activated.length, 1);
  assert.deepEqual(result.activated[0].matchedSecondary, ["storm"]);
});
