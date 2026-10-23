import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EXPORT_FORMATS, buildExport, parseProject, serializeLorebook } from "../src/format.js";
import { createProject } from "../src/schema.js";

function readFixture(name) {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function canonicalProject(project) {
  return project.books.map((book) => ({
    name: book.name,
    description: book.description,
    entries: book.entries.map((entry) => ({
      title: entry.title,
      keys: entry.keys,
      secondaryKeys: entry.secondaryKeys,
      content: entry.content,
      enabled: entry.enabled,
      constant: entry.constant,
      selective: entry.selective,
      caseSensitive: entry.caseSensitive,
      matchWholeWords: entry.matchWholeWords,
      order: entry.order,
      position: entry.position,
      probability: entry.probability,
      sourceId: entry.extensions.sourceId
    }))
  }));
}

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

test("remaps duplicate source UIDs during import", () => {
  const imported = parseProject(JSON.stringify({
    name: "Duplicate UIDs",
    entries: {
      "1": {
        uid: 7,
        key: ["alpha"],
        comment: "Alpha",
        content: "Alpha content",
        order: 10
      },
      "2": {
        uid: 7,
        key: ["beta"],
        comment: "Beta",
        content: "Beta content",
        order: 20
      },
      "3": {
        uid: 8,
        key: ["gamma"],
        comment: "Gamma",
        content: "Gamma content",
        order: 30
      }
    }
  }));

  assert.equal(imported.ok, true);
  assert.deepEqual(
    imported.project.books[0].entries.map((entry) => entry.extensions.sourceId),
    ["7", "8", "9"]
  );
  assert.equal(imported.project.books[0].entries[1].extensions.sourceIdRemappedFrom, "7");
  assert.equal(imported.project.books[0].entries[2].extensions.sourceIdRemappedFrom, "8");
  assert.match(imported.warnings[0], /2 duplicate source UIDs were remapped/);

  const exported = serializeLorebook("sillytavern", imported.project.books[0]);

  assert.equal(exported.ok, true);
  assert.deepEqual(Object.keys(exported.data.entries), ["7", "8", "9"]);
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

test("round-trips a SillyTavern World Info fixture", () => {
  const imported = parseProject(readFixture("sillytavern-world-info.json"), {
    filename: "sillytavern-world-info.json"
  });

  assert.equal(imported.ok, true);
  assert.equal(imported.formatId, "sillytavern");
  assert.equal(imported.capabilities.bookExport, true);

  const book = imported.project.books[0];
  const exported = serializeLorebook("sillytavern", book);

  assert.equal(exported.ok, true);
  assert.equal(exported.filename, "harbor-secrets-sillytavern-world-info.json");
  assert.equal(exported.data.entries["3"].role, 2);
  assert.equal(exported.data.entries["3"].sticky, 3);
  assert.equal(exported.data.entries["3"].depth, 8);
  assert.equal(exported.data.entries["3"].useProbability, true);
  assert.equal(exported.data.entries["11"].position, 2);
  assert.equal(exported.data.entries["7"].disable, true);

  const restored = parseProject(JSON.stringify(exported.data), {
    filename: exported.filename
  });

  assert.equal(restored.ok, true);
  assert.equal(restored.formatId, "sillytavern");
  assert.deepEqual(canonicalProject(restored.project), canonicalProject(imported.project));
  assert.deepEqual(
    restored.project.books[0].extensions.sourceFields.extensions,
    imported.project.books[0].extensions.sourceFields.extensions
  );
});

test("round-trips a Chub lorebook fixture with dual fields", () => {
  const imported = parseProject(readFixture("chub-lorebook.json"), {
    filename: "chub-lorebook.json"
  });

  assert.equal(imported.ok, true);
  assert.equal(imported.formatId, "chub");

  const book = imported.project.books[0];
  const exported = serializeLorebook("chub", book);

  assert.equal(exported.ok, true);
  assert.equal(exported.filename, "dual-field-lorebook-chub-lorebook.json");
  assert.deepEqual(exported.data.entries["1"].keys, ["alpha"]);
  assert.deepEqual(exported.data.entries["1"].secondary_keys, ["beta"]);
  assert.equal(exported.data.entries["1"].insertion_order, 15);
  assert.equal(exported.data.entries["1"].priority, 8);
  assert.equal(exported.data.entries["1"].match_whole_words, true);
  assert.equal(exported.data.entries["5"].enabled, false);

  const restored = parseProject(JSON.stringify(exported.data), {
    filename: exported.filename
  });

  assert.equal(restored.ok, true);
  assert.equal(restored.formatId, "chub");
  assert.deepEqual(canonicalProject(restored.project), canonicalProject(imported.project));
  assert.equal(restored.project.books[0].entries[0].extensions.sourceFields.priority, 8);
  assert.deepEqual(
    restored.project.books[0].extensions.sourceFields.extensions,
    imported.project.books[0].extensions.sourceFields.extensions
  );
});

test("exports one active book as a native project and reimports it", () => {
  const imported = parseProject(readFixture("sillytavern-world-info.json"));
  const book = imported.project.books[0];
  const exported = serializeLorebook("native", book);

  assert.equal(exported.ok, true);
  assert.equal(exported.filename, "harbor-secrets-lorebook-studio.json");
  assert.equal(exported.data.books.length, 1);
  assert.equal(exported.data.books[0].name, "Harbor Secrets");

  const restored = parseProject(JSON.stringify(exported.data));

  assert.equal(restored.ok, true);
  assert.equal(restored.formatId, "native");
  assert.deepEqual(canonicalProject(restored.project), canonicalProject(imported.project));
});

test("keeps author notes in native data and out of interchange exports", () => {
  const project = createProject({
    books: [{
      name: "Notes Book",
      entries: [{
        title: "Harbor",
        keys: ["harbor"],
        content: "Public content",
        notes: "Private author notes",
        order: 10
      }]
    }]
  });
  const book = project.books[0];
  const sillyTavern = serializeLorebook("sillytavern", book);
  const chub = serializeLorebook("chub", book);
  const native = serializeLorebook("native", book);

  assert.equal(Object.values(sillyTavern.data.entries)[0].notes, undefined);
  assert.equal(Object.values(chub.data.entries)[0].notes, undefined);
  assert.equal(native.data.books[0].entries[0].notes, "Private author notes");
  assert.equal(buildExport(project).books[0].entries[0].notes, "Private author notes");

  const restored = parseProject(JSON.stringify(native.data));

  assert.equal(restored.ok, true);
  assert.equal(restored.project.books[0].entries[0].notes, "Private author notes");
});

test("exports a standalone character book and reimports it", () => {
  const imported = parseProject(readFixture("sillytavern-world-info.json"));
  const book = imported.project.books[0];
  const exported = serializeLorebook("characterbook", book);

  assert.equal(exported.ok, true);
  assert.equal(exported.filename, "harbor-secrets-character-book.json");
  assert.equal(exported.data.entries.length, book.entries.length);
  assert.equal(exported.data.entries[0].id, 0);
  assert.equal(exported.data.entries[0].insertion_order, book.entries[0].order);
  assert.ok(Array.isArray(exported.data.entries[0].keys));
  assert.equal(exported.data.scan_depth, 4);
  assert.equal(exported.data.token_budget, 2048);

  const restored = parseProject(JSON.stringify(exported.data));

  assert.equal(restored.ok, true);
  assert.equal(restored.formatId, "chub");
  assert.equal(restored.project.books[0].entries.length, book.entries.length);
  assert.equal(restored.project.books[0].entries[0].title, book.entries[0].title);
  assert.deepEqual(restored.project.books[0].entries[0].keys, book.entries[0].keys);
  assert.equal(restored.project.books[0].entries[0].content, book.entries[0].content);
});

test("falls back unsupported character book positions to before the character", () => {
  const project = createProject({
    books: [{
      name: "Depth Book",
      entries: [{ title: "Deep", keys: ["deep"], content: "Deep content", position: "at_depth", order: 5 }]
    }]
  });
  const exported = serializeLorebook("characterbook", project.books[0]);

  assert.equal(exported.ok, true);
  assert.equal(exported.data.entries[0].position, "before_char");
  assert.equal(exported.warnings.length, 1);
  assert.match(exported.warnings[0], /doesn't support/);
});

test("publishes export capabilities for every book format", () => {
  assert.deepEqual(
    EXPORT_FORMATS.map((format) => format.id),
    ["native", "chub", "sillytavern", "characterbook"]
  );

  for (const format of EXPORT_FORMATS) {
    assert.equal(format.capabilities.bookExport, true);
    assert.equal(format.capabilities.preservesUnknownFields, true);
  }
});

test("rejects unrelated JSON with a clear message", () => {
  const result = parseProject(JSON.stringify({ hello: "world" }));

  assert.equal(result.ok, false);
  assert.match(result.error, /isn't a supported lorebook/);
});
