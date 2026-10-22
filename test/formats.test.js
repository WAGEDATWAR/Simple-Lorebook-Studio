import assert from "node:assert/strict";
import test from "node:test";
import { buildExport, parseProject } from "../src/format.js";

test("imports dual-written Chub entries", () => {
  const result = parseProject(JSON.stringify({
    name: "Chub Book",
    description: "Dual-written fixture",
    scan_depth: 20,
    token_budget: 1024,
    extensions: { chub: true },
    entries: {
      "1": {
        uid: 1,
        key: ["alpha"],
        keys: ["alpha"],
        keysecondary: ["beta"],
        secondary_keys: ["beta"],
        comment: "Alpha",
        name: "Alpha",
        content: "Alpha content",
        order: 15,
        insertion_order: 15,
        priority: 8,
        position: 0,
        disable: false,
        enabled: true,
        selective: true,
        case_sensitive: false,
        extensions: { depth: 4 }
      }
    }
  }), { filename: "chub-fixture.json" });

  assert.equal(result.ok, true);
  assert.equal(result.format, "Chub lorebook");
  assert.equal(result.project.books[0].name, "Chub Book");
  assert.equal(result.project.books[0].entries.length, 1);

  const entry = result.project.books[0].entries[0];
  assert.equal(entry.title, "Alpha");
  assert.deepEqual(entry.keys, ["alpha"]);
  assert.deepEqual(entry.secondaryKeys, ["beta"]);
  assert.equal(entry.enabled, true);
  assert.equal(entry.order, 15);
  assert.equal(entry.position, "before_char");
  assert.equal(entry.extensions.source, "chub");
  assert.equal(entry.extensions.sourceId, "1");
  assert.equal(entry.extensions.sourceFields.priority, 8);
  assert.deepEqual(entry.extensions.sourceFields.extensions, { depth: 4 });
});

test("imports SillyTavern World Info fields", () => {
  const result = parseProject(JSON.stringify({
    name: "SillyTavern Book",
    scan_depth: 4,
    entries: {
      "7": {
        uid: 7,
        key: ["alpha", "beta"],
        keysecondary: ["gamma"],
        comment: "Alpha entry",
        content: "Alpha content",
        constant: false,
        selective: true,
        selectiveLogic: 1,
        order: 42,
        position: 1,
        disable: true,
        probability: 55,
        useProbability: true,
        caseSensitive: true,
        matchWholeWords: true,
        depth: 6
      }
    }
  }));

  assert.equal(result.ok, true);
  assert.equal(result.format, "SillyTavern World Info");

  const entry = result.project.books[0].entries[0];
  assert.equal(entry.title, "Alpha entry");
  assert.deepEqual(entry.keys, ["alpha", "beta"]);
  assert.deepEqual(entry.secondaryKeys, ["gamma"]);
  assert.equal(entry.enabled, false);
  assert.equal(entry.position, "after_char");
  assert.equal(entry.order, 42);
  assert.equal(entry.probability, 55);
  assert.equal(entry.caseSensitive, true);
  assert.equal(entry.matchWholeWords, true);
  assert.equal(entry.extensions.sourceFields.depth, 6);
  assert.equal(entry.extensions.sourceFields.selectiveLogic, 1);
});

test("imports lorebook_v3 character books", () => {
  const result = parseProject(JSON.stringify({
    spec: "lorebook_v3",
    data: {
      name: "Card Book",
      entries: [
        {
          id: 3,
          name: "Card Entry",
          keys: ["one"],
          secondary_keys: ["two"],
          content: "Card content",
          enabled: false,
          insertion_order: 12,
          priority: 9,
          position: "after_char",
          case_sensitive: true,
          extensions: { depth: 3 }
        }
      ]
    }
  }));

  assert.equal(result.ok, true);
  assert.equal(result.format, "Character book");
  assert.equal(result.project.books[0].name, "Card Book");

  const entry = result.project.books[0].entries[0];
  assert.equal(entry.title, "Card Entry");
  assert.deepEqual(entry.keys, ["one"]);
  assert.deepEqual(entry.secondaryKeys, ["two"]);
  assert.equal(entry.enabled, false);
  assert.equal(entry.order, 12);
  assert.equal(entry.position, "after_char");
  assert.equal(entry.caseSensitive, true);
  assert.equal(entry.extensions.sourceId, "3");
});

test("round-trips native projects with source metadata", () => {
  const imported = parseProject(JSON.stringify({
    name: "Roundtrip Book",
    extensions: { chub: true },
    entries: {
      "1": {
        uid: 1,
        key: ["alpha"],
        keys: ["alpha"],
        comment: "Alpha",
        name: "Alpha",
        content: "Alpha content",
        order: 10,
        insertion_order: 10,
        position: 0,
        disable: false,
        enabled: true,
        extensions: { depth: 4 }
      }
    }
  }));

  const restored = parseProject(JSON.stringify(buildExport(imported.project)));

  assert.equal(restored.ok, true);
  assert.equal(restored.format, "Lorebook Studio project");
  assert.deepEqual(restored.project.books[0].extensions, imported.project.books[0].extensions);
  assert.deepEqual(restored.project.books[0].entries[0].extensions, imported.project.books[0].entries[0].extensions);
});

test("rejects unrelated JSON with a clear message", () => {
  const result = parseProject(JSON.stringify({ hello: "world" }));

  assert.equal(result.ok, false);
  assert.match(result.error, /isn't a supported lorebook/);
});
