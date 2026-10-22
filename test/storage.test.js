import assert from "node:assert/strict";
import test from "node:test";
import { createProject } from "../src/schema.js";

const memory = new Map();
let failWrites = false;

globalThis.localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    if (failWrites) {
      throw new Error("Quota exceeded");
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
  getProjectBackupInfo,
  loadProject,
  loadProjectBackup,
  saveProject,
  saveProjectBackup
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

test("saves and reloads the current project", () => {
  memory.clear();
  const state = createState("Saved Book", "Saved Entry");

  assert.equal(saveProject(state), true);

  const loaded = loadProject();
  assert.equal(loaded.books[0].name, "Saved Book");
  assert.equal(loaded.books[0].entries[0].title, "Saved Entry");
});

test("stores and restores a pre-import backup", () => {
  memory.clear();
  const original = createState("Original Book", "Original Entry");
  const replacement = createState("Replacement Book", "Replacement Entry");

  const saved = saveProjectBackup(original, "Before importing replacement.json");

  assert.equal(saved.ok, true);

  saveProject(replacement);
  const info = getProjectBackupInfo();

  assert.equal(info.ok, true);
  assert.equal(info.books, 1);
  assert.equal(info.entries, 1);
  assert.match(info.reason, /replacement\.json/);

  const restored = loadProjectBackup();

  assert.equal(restored.ok, true);
  assert.equal(restored.project.books[0].name, "Original Book");
  assert.equal(restored.project.books[0].entries[0].title, "Original Entry");
  assert.equal(loadProject().books[0].name, "Replacement Book");
});

test("reports unreadable backups without replacing the project", () => {
  memory.clear();
  localStorage.setItem(BACKUP_KEY, "{not valid json");

  assert.equal(getProjectBackupInfo().ok, false);
  assert.equal(loadProjectBackup().ok, false);
});

test("reports backup write failures", () => {
  memory.clear();
  failWrites = true;
  const result = saveProjectBackup(createState("Unsaved Book", "Entry"), "Quota test");
  failWrites = false;

  assert.equal(result.ok, false);
  assert.match(result.error, /could not be saved/);
});
