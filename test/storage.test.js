import assert from "node:assert/strict";
import test from "node:test";
import { createProject } from "../src/schema.js";

const memory = new Map();
let failWrites = false;
let writesBeforeFailure = null;

function createQuotaError() {
  const error = new Error("Quota exceeded");
  error.name = "QuotaExceededError";
  return error;
}

globalThis.localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    if (failWrites || writesBeforeFailure === 0) {
      throw createQuotaError();
    }

    if (writesBeforeFailure !== null) {
      writesBeforeFailure -= 1;
    }

    memory.set(key, String(value));
  },
  removeItem(key) {
    memory.delete(key);
  },
  clear() {
    memory.clear();
  }
};

const {
  BACKUP_KEY,
  REVISION_KEY_PREFIX,
  getProjectBackupInfo,
  getRevisions,
  getStorageUsage,
  loadProject,
  loadProjectBackup,
  loadRevision,
  saveProject,
  saveProjectBackup,
  saveProjectDetailed,
  saveRevision
} = await import("../src/storage.js");

function createState(name, title) {
  return createProject({
    activeEntryId: null,
    books: [{
      name,
      description: `${name} description`,
      entries: [{
        title,
        content: `${title} content`
      }]
    }]
  });
}

test("saves and reloads the current project", async () => {
  memory.clear();
  const state = createState("Saved Book", "Saved Entry");

  assert.equal(await saveProject(state), true);

  const loaded = await loadProject();
  assert.equal(loaded.books[0].name, "Saved Book");
  assert.equal(loaded.books[0].entries[0].title, "Saved Entry");
});

test("stores and restores a pre-import backup", async () => {
  memory.clear();
  const original = createState("Original Book", "Original Entry");
  const replacement = createState("Replacement Book", "Replacement Entry");

  const saved = await saveProjectBackup(original, "Before importing replacement.json");

  assert.equal(saved.ok, true);

  await saveProject(replacement);
  const info = await getProjectBackupInfo();

  assert.equal(info.ok, true);
  assert.equal(info.books, 1);
  assert.equal(info.entries, 1);
  assert.match(info.reason, /replacement\.json/);

  const restored = await loadProjectBackup();

  assert.equal(restored.ok, true);
  assert.equal(restored.project.books[0].name, "Original Book");
  assert.equal(restored.project.books[0].entries[0].title, "Original Entry");
  assert.equal((await loadProject()).books[0].name, "Replacement Book");
});

test("reports storage usage", async () => {
  memory.clear();
  const state = createState("Usage Book", "Entry");
  await saveProject(state);
  await saveRevision(state, "Snapshot");

  const usage = await getStorageUsage();

  assert.equal(usage.ok, true);
  assert.equal(usage.backend, "localstorage");
  assert.ok(usage.projectBytes > 0);
  assert.equal(usage.revisionCount, 1);
  assert.ok(usage.revisionBytes > 0);
  assert.equal(usage.usage, null);
  assert.equal(usage.quota, null);
});

test("reports unreadable backups without replacing the project", async () => {
  memory.clear();
  localStorage.setItem(BACKUP_KEY, "{not valid json");

  assert.equal((await getProjectBackupInfo()).ok, false);
  assert.equal((await loadProjectBackup()).ok, false);
});

test("reports backup write failures", async () => {
  memory.clear();
  failWrites = true;
  const result = await saveProjectBackup(createState("Unsaved Book", "Entry"), "Quota test");
  failWrites = false;

  assert.equal(result.ok, false);
  assert.match(result.error, /could not be saved/);
});

test("reports a detailed quota failure for project saves", async () => {
  memory.clear();
  failWrites = true;
  const result = await saveProjectDetailed(createState("Unsaved Book", "Entry"));
  failWrites = false;

  assert.equal(result.ok, false);
  assert.equal(result.quotaExceeded, true);
});

test("saves, deduplicates, and restores revisions", async () => {
  memory.clear();
  const state = createState("Revision Book", "First title");
  const first = await saveRevision(state, "Before edits");

  assert.equal(first.ok, true);
  assert.equal(first.revision.books, 1);
  assert.equal(first.revision.entries, 1);

  const duplicate = await saveRevision(state, "Unchanged");
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.skipped, true);

  state.books[0].entries[0].title = "Second title";
  const second = await saveRevision(state, "After edits");
  assert.equal(second.ok, true);

  const history = (await getRevisions()).revisions;
  assert.equal(history.length, 2);
  assert.equal(history[0].reason, "After edits");
  assert.equal(history[1].reason, "Before edits");

  const restoredFirst = await loadRevision(first.revision.id);
  const restoredSecond = await loadRevision(second.revision.id);

  assert.equal(restoredFirst.ok, true);
  assert.equal(restoredFirst.project.books[0].entries[0].title, "First title");
  assert.equal(restoredSecond.ok, true);
  assert.equal(restoredSecond.project.books[0].entries[0].title, "Second title");
});

test("keeps only the newest revisions", async () => {
  memory.clear();
  const state = createState("Trimmed Book", "Entry 0");
  const revisions = [];

  for (let index = 0; index < 14; index += 1) {
    state.books[0].entries[0].title = `Entry ${index}`;
    revisions.push(await saveRevision(state, `Snapshot ${index}`));
  }

  const history = (await getRevisions()).revisions;

  assert.equal(history.length, 12);
  assert.equal(history[0].reason, "Snapshot 13");
  assert.equal(localStorage.getItem(`${REVISION_KEY_PREFIX}${revisions[0].revision.id}`), null);
  assert.notEqual(localStorage.getItem(`${REVISION_KEY_PREFIX}${revisions[2].revision.id}`), null);
});

test("reports unreadable revisions", async () => {
  memory.clear();
  localStorage.setItem(`${REVISION_KEY_PREFIX}broken`, "{not valid json");

  const result = await loadRevision("broken");

  assert.equal(result.ok, false);
  assert.match(result.error, /isn't valid JSON|unreadable/);
});

test("reports revision write failures and removes partial payloads", async () => {
  memory.clear();
  writesBeforeFailure = 1;
  const result = await saveRevision(createState("Unsaved Revision", "Entry"), "Quota test");
  writesBeforeFailure = null;

  assert.equal(result.ok, false);
  assert.match(result.error, /could not be saved/);
  assert.deepEqual((await getRevisions()).revisions, []);
  assert.equal(
    [...memory.keys()].some((key) => key.startsWith(REVISION_KEY_PREFIX)),
    false
  );
});

test("caps revision storage by size", async () => {
  memory.clear();
  const state = createState("Large Book", "Entry");
  state.books[0].entries[0].content = "x".repeat(260_000);
  const revisions = [];

  for (let index = 0; index < 10; index += 1) {
    state.books[0].entries[0].title = `Entry ${index}`;
    revisions.push(await saveRevision(state, `Large ${index}`));
  }

  const history = (await getRevisions()).revisions;

  assert.equal(history.length, 5);
  assert.equal(history[0].reason, "Large 9");
  assert.equal(localStorage.getItem(`${REVISION_KEY_PREFIX}${revisions[0].revision.id}`), null);
  assert.notEqual(
    localStorage.getItem(`${REVISION_KEY_PREFIX}${revisions.at(-1).revision.id}`),
    null
  );
});

test("rejects a snapshot that exceeds the revision budget", async () => {
  memory.clear();
  const state = createState("Huge Book", "Entry");
  state.books[0].entries[0].content = "x".repeat(1_600_000);

  const result = await saveRevision(state, "Too large");

  assert.equal(result.ok, false);
  assert.match(result.error, /too large/);
  assert.deepEqual((await getRevisions()).revisions, []);
});
