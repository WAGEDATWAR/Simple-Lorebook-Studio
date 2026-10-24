import assert from "node:assert/strict";
import test from "node:test";
import { parseProject } from "../src/format.js";
import { isMigratableProject, migrateProjectData } from "../src/migrations.js";
import { SCHEMA_VERSION } from "../src/schema.js";

function versionOneProject() {
  return {
    app: "lorebook-studio",
    version: 1,
    activeBookId: "book_one",
    activeEntryId: "entry_one",
    books: [{
      id: "book_one",
      name: "Old Book",
      description: "",
      entries: [{
        id: "entry_one",
        title: "Old Entry",
        keys: ["old"],
        content: "Old content",
        order: 10
      }]
    }]
  };
}

test("recognizes migratable project data", () => {
  assert.equal(isMigratableProject({ books: [] }), true);
  assert.equal(isMigratableProject({ entries: {} }), false);
  assert.equal(isMigratableProject([]), false);
  assert.equal(isMigratableProject(null), false);
});

test("upgrades a version 1 project to the current schema", () => {
  const result = migrateProjectData(versionOneProject());

  assert.equal(result.isProject, true);
  assert.equal(result.from, 1);
  assert.equal(result.newer, false);
  assert.equal(result.applied.length, 1);
  assert.equal(result.data.version, SCHEMA_VERSION);
  assert.deepEqual(result.data.books[0].tags, []);
  assert.equal(result.data.books[0].tokenBudget, 0);
  assert.equal(result.data.books[0].entries[0].notes, "");
  assert.deepEqual(result.data.books[0].entries[0].tags, []);
  assert.equal(result.data.books[0].entries[0].title, "Old Entry");
});

test("treats unversioned project data as the baseline version", () => {
  const result = migrateProjectData({ books: [{ name: "Unversioned", entries: [] }] });

  assert.equal(result.from, 1);
  assert.equal(result.applied.length, 1);
  assert.equal(result.data.version, SCHEMA_VERSION);
});

test("leaves a current project unchanged and flags newer versions", () => {
  const current = migrateProjectData({ version: SCHEMA_VERSION, books: [] });
  assert.equal(current.applied.length, 0);
  assert.equal(current.newer, false);
  assert.equal(current.data.version, SCHEMA_VERSION);

  const newer = migrateProjectData({ version: SCHEMA_VERSION + 1, books: [] });
  assert.equal(newer.applied.length, 0);
  assert.equal(newer.newer, true);
});

test("does not migrate interchange data", () => {
  const data = { entries: { "1": { key: ["a"], content: "x" } } };
  const result = migrateProjectData(data);

  assert.equal(result.isProject, false);
  assert.equal(result.data, data);
});

test("parseProject upgrades a stored project and reports the migration", () => {
  const result = parseProject(JSON.stringify(versionOneProject()));

  assert.equal(result.ok, true);
  assert.equal(result.project.version, SCHEMA_VERSION);
  assert.deepEqual(result.project.books[0].tags, []);
  assert.ok(result.warnings.some((warning) => /Upgraded project schema 1/.test(warning)));
  assert.equal(result.migrations.length, 1);
});

test("parseProject warns about projects from a newer schema", () => {
  const result = parseProject(JSON.stringify({
    app: "lorebook-studio",
    version: SCHEMA_VERSION + 5,
    books: [{ name: "Future", entries: [] }]
  }));

  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((warning) => /newer version/.test(warning)));
});
