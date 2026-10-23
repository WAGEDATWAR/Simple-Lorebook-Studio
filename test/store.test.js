import assert from "node:assert/strict";
import test from "node:test";
import { createProject } from "../src/schema.js";
import {
  addEntry,
  adjustEntriesOrder,
  canRedo,
  canUndo,
  deleteEntries,
  duplicateEntry,
  getActiveBook,
  getActiveEntry,
  getEntryFilters,
  getSelectedEntryIds,
  getState,
  getTagFilters,
  initStore,
  moveEntry,
  redo,
  replaceProject,
  selectEntryRange,
  setActiveEntry,
  setEntriesEnabled,
  setEntriesOrder,
  setEntryFilters,
  setSortMode,
  setTagFilters,
  toggleEntryFilter,
  toggleEntrySelection,
  toggleTagFilter,
  undo,
  updateActiveBookDescription,
  updateActiveBookTags,
  updateActiveEntry
} from "../src/store.js";
import { sortEntries } from "../src/ui/sidebar.js";

function createTestProject() {
  return createProject({
    books: [
      {
        name: "Test Book",
        entries: [
          {
            id: "entry_1",
            title: "Bravo",
            content: "Second alphabetically",
            keys: ["bravo"],
            order: 20,
            updatedAt: 200,
            extensions: { source: "chub", sourceId: "7" }
          },
          {
            id: "entry_2",
            title: "Alpha",
            content: "First alphabetically",
            keys: ["alpha"],
            order: 10,
            updatedAt: 300,
            enabled: false
          },
          {
            id: "entry_3",
            title: "Charlie",
            content: "Third alphabetically",
            keys: ["charlie"],
            order: 30,
            updatedAt: 100
          }
        ]
      }
    ]
  });
}

test("undoes and redoes entry edits", () => {
  initStore(createTestProject());
  updateActiveEntry({ title: "Bravo edited" });

  assert.equal(canUndo(), true);
  assert.equal(getActiveEntry().title, "Bravo edited");
  assert.equal(undo(), true);
  assert.equal(getActiveEntry().title, "Bravo");
  assert.equal(canRedo(), true);
  assert.equal(redo(), true);
  assert.equal(getActiveEntry().title, "Bravo edited");
});

test("edits the active book description with undo", () => {
  initStore(createTestProject());
  updateActiveBookDescription("A quiet harbor archive.");

  assert.equal(getActiveBook().description, "A quiet harbor archive.");
  assert.equal(undo(), true);
  assert.equal(getActiveBook().description, "");
  assert.equal(redo(), true);
  assert.equal(getActiveBook().description, "A quiet harbor archive.");
});

test("duplicates entries without reusing source identity", () => {
  initStore(createTestProject());
  const copy = duplicateEntry("entry_1");
  const book = getActiveBook();

  assert.ok(copy);
  assert.equal(book.entries.length, 4);
  assert.equal(book.entries[1].id, copy.id);
  assert.equal(copy.title, "Bravo (copy)");
  assert.equal(getState().activeEntryId, copy.id);
  assert.equal(copy.extensions.sourceId, undefined);
  assert.equal(copy.extensions.duplicatedFromSourceId, "7");

  assert.equal(undo(), true);
  assert.equal(getActiveBook().entries.length, 3);
  assert.equal(redo(), true);
  assert.equal(getActiveBook().entries.length, 4);
});

test("tracks multi-selection and clears it when sorting changes", () => {
  initStore(createTestProject());
  setActiveEntry("entry_1");
  toggleEntrySelection("entry_2");

  assert.deepEqual(new Set(getSelectedEntryIds()), new Set(["entry_1", "entry_2"]));

  selectEntryRange(["entry_2", "entry_3"], "entry_2");
  assert.deepEqual(new Set(getSelectedEntryIds()), new Set(["entry_2", "entry_3"]));

  setSortMode("title");
  assert.deepEqual(getSelectedEntryIds(), []);
  assert.equal(getState().ui.sortMode, "title");
});

test("applies bulk enable and delete actions with undo", () => {
  initStore(createTestProject());
  const ids = getActiveBook().entries.map((entry) => entry.id);

  assert.equal(setEntriesEnabled(ids, false), 2);
  assert.equal(getActiveBook().entries.every((entry) => !entry.enabled), true);

  setActiveEntry("entry_1");
  assert.equal(deleteEntries(["entry_1", "entry_3"]), 2);
  assert.deepEqual(getActiveBook().entries.map((entry) => entry.id), ["entry_2"]);
  assert.equal(getState().activeEntryId, "entry_2");

  assert.equal(undo(), true);
  assert.equal(getActiveBook().entries.length, 3);
  assert.equal(getActiveBook().entries.every((entry) => !entry.enabled), true);
});

test("moves entries in the manual order with undo", () => {
  initStore(createTestProject());

  assert.equal(moveEntry("entry_2", "entry_1", "before"), true);
  assert.deepEqual(getActiveBook().entries.map((entry) => entry.id), ["entry_2", "entry_1", "entry_3"]);

  assert.equal(undo(), true);
  assert.deepEqual(getActiveBook().entries.map((entry) => entry.id), ["entry_1", "entry_2", "entry_3"]);
});

test("makes project replacement undoable", () => {
  initStore(createTestProject());

  const replacement = createProject({
    books: [{ name: "Imported", entries: [{ id: "entry_new", title: "New" }] }]
  });

  replaceProject(replacement);
  assert.equal(getActiveBook().name, "Imported");
  assert.equal(getActiveBook().entries[0].id, "entry_new");

  assert.equal(undo(), true);
  assert.equal(getActiveBook().name, "Test Book");
  assert.equal(getActiveBook().entries.length, 3);
});

test("sorts entries without mutating manual order", () => {
  const entries = createTestProject().books[0].entries;

  assert.deepEqual(sortEntries(entries, "manual").map((entry) => entry.id), ["entry_1", "entry_2", "entry_3"]);
  assert.deepEqual(sortEntries(entries, "title").map((entry) => entry.title), ["Alpha", "Bravo", "Charlie"]);
  assert.deepEqual(sortEntries(entries, "order").map((entry) => entry.order), [10, 20, 30]);
  assert.deepEqual(sortEntries(entries, "updated").map((entry) => entry.updatedAt), [300, 200, 100]);
  assert.deepEqual(sortEntries(entries, "enabled").map((entry) => entry.enabled), [true, true, false]);
  assert.deepEqual(entries.map((entry) => entry.id), ["entry_1", "entry_2", "entry_3"]);
});

test("sets and shifts insertion order for selected entries", () => {
  initStore(createTestProject());

  assert.equal(setEntriesOrder(["entry_1", "entry_2"], 500), 2);
  assert.equal(getActiveBook().entries.find((entry) => entry.id === "entry_1").order, 500);
  assert.equal(getActiveBook().entries.find((entry) => entry.id === "entry_2").order, 500);
  assert.equal(getActiveBook().entries.find((entry) => entry.id === "entry_3").order, 30);

  assert.equal(setEntriesOrder(["entry_1"], 500), 0);

  assert.equal(adjustEntriesOrder(["entry_1", "entry_3"], -20), 2);
  assert.equal(getActiveBook().entries.find((entry) => entry.id === "entry_1").order, 480);
  assert.equal(getActiveBook().entries.find((entry) => entry.id === "entry_3").order, 10);

  assert.equal(undo(), true);
  assert.equal(getActiveBook().entries.find((entry) => entry.id === "entry_1").order, 500);
  assert.equal(getActiveBook().entries.find((entry) => entry.id === "entry_3").order, 30);
});

test("updates book tags and tag filters", () => {
  initStore(createTestProject());

  updateActiveBookTags(["campaign", "campaign", "v2"]);
  assert.deepEqual(getActiveBook().tags, ["campaign", "v2"]);

  assert.deepEqual(getTagFilters(), []);
  assert.equal(toggleTagFilter("npc"), true);
  assert.deepEqual(getTagFilters(), ["npc"]);
  assert.equal(toggleTagFilter("npc"), false);
  assert.deepEqual(getTagFilters(), []);

  setTagFilters(["npc", "npc", "vip"]);
  assert.deepEqual(getTagFilters(), ["npc", "vip"]);
});

test("toggles entry filters with mutually exclusive status", () => {
  initStore(createTestProject());

  assert.deepEqual(getEntryFilters(), {
    enabled: false,
    disabled: false,
    alwaysOn: false,
    missingKeys: false
  });

  assert.equal(toggleEntryFilter("enabled"), true);
  assert.equal(getEntryFilters().enabled, true);

  assert.equal(toggleEntryFilter("disabled"), true);
  assert.equal(getEntryFilters().disabled, true);
  assert.equal(getEntryFilters().enabled, false);

  assert.equal(toggleEntryFilter("disabled"), false);
  assert.equal(getEntryFilters().disabled, false);

  assert.deepEqual(setEntryFilters({ enabled: true, disabled: true, alwaysOn: true, missingKeys: true }), {
    enabled: true,
    disabled: false,
    alwaysOn: true,
    missingKeys: true
  });

  assert.equal(toggleEntryFilter("unknown"), false);
});

test("adds an entry from template fields with the next manual order", () => {
  initStore(createTestProject());
  const entry = addEntry({
    title: "New location",
    keys: ["location name"],
    content: "## Overview\n",
    order: 1
  });

  assert.equal(entry.title, "New location");
  assert.deepEqual(entry.keys, ["location name"]);
  assert.equal(entry.order, 40);
  assert.equal(getActiveEntry().id, entry.id);
  assert.equal(canUndo(), true);
});
