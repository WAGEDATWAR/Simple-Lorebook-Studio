import assert from "node:assert/strict";
import { sleep } from "./harness.mjs";

async function resetApp(page) {
  page.clearErrors();
  await page.resetStorage();
  await page.waitFor('document.querySelector("#book-name")?.value');
}

async function appState(page) {
  return page.evaluate(`(() => ({
    book: document.querySelector("#book-name")?.value ?? "",
    books: [...document.querySelectorAll("#book-select option")].map((option) => option.textContent),
    entries: document.querySelectorAll(".entry-card").length,
    saveState: document.querySelector("#save-state")?.dataset.state ?? ""
  }))()`);
}

async function setValue(page, selector, value) {
  await page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
}

async function setChecked(page, selector, checked) {
  await page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    input.checked = ${checked};
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
}

async function importFile(page, path) {
  await page.setFileInput("#import-input", [path]);
  await page.waitFor('document.querySelector("#diff-dialog")?.open');
}

async function readIndexedDbProject(page) {
  return page.evaluate(`(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("lorebook-studio");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction("keyval", "readonly");
      const request = transaction.objectStore("keyval").get("lorebook-studio:project:v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      value: typeof value === "string" ? value : "",
      localStorageProject: localStorage.getItem("lorebook-studio:project:v1")
    };
  })()`);
}

async function pressKey(page, selector, key, { ctrl = false, shift = false, alt = false } = {}) {
  await page.evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    target.focus();
    target.dispatchEvent(new KeyboardEvent("keydown", {
      key: ${JSON.stringify(key)},
      bubbles: true,
      cancelable: true,
      ctrlKey: ${ctrl},
      metaKey: ${ctrl},
      shiftKey: ${shift},
      altKey: ${alt}
    }));
    return true;
  })()`);
}

export const scenarios = [
  {
    name: "boots with the sample project",
    async run(page) {
      await resetApp(page);
      const state = await appState(page);

      assert.equal(state.book, "Aurora Vale");
      assert.equal(state.entries, 3);
      assert.deepEqual(state.books, ["Aurora Vale"]);
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "creates, edits, and deletes an entry",
    async run(page) {
      await resetApp(page);
      await page.click("#add-entry-btn");
      await page.waitFor('document.querySelectorAll(".entry-card").length === 4');
      await setValue(page, "#entry-title", "E2E Entry");
      await setValue(page, "#entry-content", "Written by the end-to-end test.");
      await page.waitFor('document.querySelector("#save-state")?.dataset.state === "saved"');

      const saved = await page.evaluate('document.querySelector("#entry-title").value');
      assert.equal(saved, "E2E Entry");

      await page.click("#delete-entry-btn");
      await page.waitFor('document.querySelector("#confirm-dialog")?.open');
      await page.click("#confirm-accept");
      await page.waitFor('document.querySelectorAll(".entry-card").length === 3');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "filters entries with search",
    async run(page) {
      await resetApp(page);
      await setValue(page, "#entry-search", "Mara");
      await page.waitFor('document.querySelectorAll(".entry-card").length === 1');
      const title = await page.evaluate('document.querySelector(".entry-card-title").textContent');
      assert.equal(title, "Mara Voss");

      await setValue(page, "#entry-search", "");
      await page.waitFor('document.querySelectorAll(".entry-card").length === 3');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "filters entries by status and keys",
    async run(page) {
      await resetApp(page);

      await page.click('[data-filter="alwaysOn"]');
      await page.waitFor('document.querySelectorAll(".entry-card").length === 1');
      const alwaysOnTitle = await page.evaluate('document.querySelector(".entry-card-title").textContent');
      assert.equal(alwaysOnTitle, "Aurora Vale");

      await page.click('[data-filter="alwaysOn"]');
      await page.waitFor('document.querySelectorAll(".entry-card").length === 3');

      await page.click('[data-filter="enabled"]');
      await page.waitFor('document.querySelectorAll(".entry-card").length === 3');

      await page.click("#add-entry-btn");
      await page.waitFor('document.querySelectorAll(".entry-card").length === 4');
      await setChecked(page, "#entry-enabled", false);
      await page.waitFor('document.querySelectorAll(".entry-card").length === 3');

      await page.click('[data-filter="disabled"]');
      await page.waitFor('document.querySelectorAll(".entry-card").length === 1');
      const count = await page.evaluate('document.querySelector("#entry-count").textContent');
      assert.equal(count, "1/4");

      await page.click('[data-filter="missingKeys"]');
      await page.waitFor('document.querySelectorAll(".entry-card").length === 1');

      await page.click('[data-filter="disabled"]');
      await page.click('[data-filter="missingKeys"]');
      await page.waitFor('document.querySelectorAll(".entry-card").length === 4');

      const pressed = await page.evaluate('[...document.querySelectorAll("#entry-filters [data-filter]")].map((button) => button.getAttribute("aria-pressed"))');
      assert.deepEqual(pressed, ["false", "false", "false", "false"]);
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "navigates and restores focus in the entry list",
    async run(page) {
      await resetApp(page);
      const firstId = await page.evaluate('document.querySelector(".entry-card").dataset.entryId');
      await pressKey(page, `[data-entry-id="${firstId}"]`, "ArrowDown");
      await page.waitFor('document.querySelector("#entry-title").value === "Mara Voss"');

      let focused = await page.evaluate('document.activeElement.closest("[data-entry-id]")?.dataset.entryId ?? ""');
      let active = await page.evaluate('document.querySelector(".entry-card.is-active")?.dataset.entryId ?? ""');
      assert.equal(focused, active);

      await pressKey(page, `[data-entry-id="${active}"]`, "End");
      await page.waitFor('document.querySelector("#entry-title").value === "Tidebinding"');
      active = await page.evaluate('document.querySelector(".entry-card.is-active").dataset.entryId');
      await pressKey(page, `[data-entry-id="${active}"]`, "Home");
      await page.waitFor('document.querySelector("#entry-title").value === "Aurora Vale"');

      await page.click("#delete-entry-btn");
      await page.waitFor('document.querySelector("#confirm-dialog")?.open');
      await page.click("#confirm-accept");
      await page.waitFor('document.querySelectorAll(".entry-card").length === 2');
      focused = await page.evaluate('document.activeElement.closest("[data-entry-id]")?.dataset.entryId ?? ""');
      active = await page.evaluate('document.querySelector(".entry-card.is-active")?.dataset.entryId ?? ""');
      assert.equal(focused, active);

      await page.evaluate('document.querySelector("#history-btn").focus(); true');
      await page.click("#history-btn");
      await page.waitFor('document.querySelector("#history-dialog")?.open');
      await page.click("#history-close");
      await page.waitFor('!document.querySelector("#history-dialog")?.open');
      const restored = await page.evaluate('document.activeElement.id');
      assert.equal(restored, "history-btn");
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "stores the project in IndexedDB",
    async run(page) {
      await resetApp(page);
      const result = await readIndexedDbProject(page);
      assert.ok(result.value.includes("Aurora Vale"));
      assert.equal(result.localStorageProject, null);
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "migrates a localStorage project into IndexedDB",
    async run(page) {
      const seed = {
        version: 1,
        activeBookId: "book_migrate",
        activeEntryId: "entry_migrate",
        books: [{
          id: "book_migrate",
          name: "Migrated Book",
          description: "",
          entries: [{
            id: "entry_migrate",
            title: "Migrated Entry",
            keys: ["migrated"],
            content: "From localStorage",
            order: 10
          }]
        }]
      };

      await page.resetStorage({ seed });
      await page.waitFor('document.querySelector("#book-name")?.value === "Migrated Book"');
      const result = await readIndexedDbProject(page);
      assert.ok(result.value.includes("Migrated Book"));
      assert.equal(result.localStorageProject, null);
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "recovers from a failed local save",
    async run(page) {
      await resetApp(page);
      await page.evaluate(`(() => {
        const fail = () => {
          const error = new Error("Quota exceeded");
          error.name = "QuotaExceededError";
          throw error;
        };
        window.__originalSetItem = Storage.prototype.setItem;
        window.__originalPut = IDBObjectStore.prototype.put;
        Storage.prototype.setItem = fail;
        IDBObjectStore.prototype.put = fail;
        return true;
      })()`);

      const content = await page.evaluate('document.querySelector("#entry-content").value');
      await setValue(page, "#entry-content", `${content}\n\nUnsaved change`);
      await page.waitFor('!document.querySelector("#storage-banner")?.hidden');
      const message = await page.evaluate('document.querySelector("#storage-banner-message").textContent');
      assert.match(message, /storage is full/i);
      const saveState = await page.evaluate('document.querySelector("#save-state").dataset.state');
      assert.equal(saveState, "error");

      await page.click("#storage-retry-btn");
      await sleep(200);
      assert.equal(await page.evaluate('document.querySelector("#storage-banner").hidden'), false);

      await page.evaluate('Storage.prototype.setItem = window.__originalSetItem; IDBObjectStore.prototype.put = window.__originalPut; true');
      await page.click("#storage-retry-btn");
      await page.waitFor('document.querySelector("#storage-banner").hidden === true');
      await page.waitFor('document.querySelector("#save-state").dataset.state === "saved"');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "imports a SillyTavern file with the replace strategy",
    async run(page, context) {
      await resetApp(page);
      await importFile(page, context.fixture("sillytavern-world-info.json"));

      const initial = await page.evaluate(`(() => ({
        strategy: document.querySelector("#diff-controls select").value,
        summary: document.querySelector("#diff-summary").textContent
      }))()`);
      assert.equal(initial.strategy, "replace");
      assert.match(initial.summary, /\+1 book/);

      await page.click("#diff-accept");
      await page.waitFor('[...document.querySelectorAll("#book-select option")].some((option) => option.textContent === "Harbor Secrets")');
      const state = await appState(page);
      assert.deepEqual(state.books, ["Harbor Secrets"]);
      assert.equal(state.entries, 3);
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "appends an import to the existing project",
    async run(page, context) {
      await resetApp(page);
      await importFile(page, context.fixture("sillytavern-world-info.json"));
      await page.evaluate(`(() => {
        const select = document.querySelector("#diff-controls select");
        select.value = "append";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`);
      await page.waitFor('document.querySelector("#diff-controls select").value === "append"');
      await page.click("#diff-accept");
      await page.waitFor('document.querySelectorAll("#book-select option").length === 2');

      const state = await appState(page);
      assert.deepEqual(state.books, ["Aurora Vale", "Harbor Secrets"]);
      const toast = await page.evaluate('document.querySelector(".toast")?.textContent ?? ""');
      assert.match(toast, /Appended/);
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "merges an import by entry title",
    async run(page, context) {
      await resetApp(page);
      await importFile(page, context.fixture("native-merge.json"));
      await page.evaluate(`(() => {
        const select = document.querySelector("#diff-controls select");
        select.value = "merge";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`);
      await page.waitFor('document.querySelector("#diff-controls select").value === "merge"');
      await page.click("#diff-accept");
      await page.waitFor('document.querySelector(".toast")?.textContent.includes("Merged")');

      const state = await appState(page);
      assert.deepEqual(state.books, ["Aurora Vale"]);
      assert.equal(state.entries, 3);

      await page.evaluate(`(() => {
        const card = [...document.querySelectorAll(".entry-card")].find((item) => item.textContent.includes("Mara Voss"));
        card.click();
        return true;
      })()`);
      await page.waitFor('document.querySelector("#entry-title").value === "Mara Voss"');
      const content = await page.evaluate('document.querySelector("#entry-content").value');
      assert.equal(content, "Merged Mara content.");
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "compares revision snapshots",
    async run(page) {
      await resetApp(page);
      const original = await page.evaluate('document.querySelector("#entry-content").value');
      await setValue(page, "#entry-content", `${original}\n\nRevision baseline`);
      await page.click("#history-btn");
      await page.waitFor('document.querySelector("#history-dialog")?.open');
      await page.click("#history-save-btn");
      await page.waitFor('document.querySelector("[data-revision-compare]")');
      await page.click("#history-close");
      await page.waitFor('!document.querySelector("#history-dialog")?.open');

      await setValue(page, "#entry-content", `${original}\n\nRevision baseline\nRevision follow-up`);
      await page.click("#history-btn");
      await page.waitFor('document.querySelector("#history-dialog")?.open');
      await page.waitFor('document.querySelector("[data-revision-compare]")');
      await page.click("[data-revision-compare]");
      await page.waitFor('document.querySelector("#diff-dialog")?.open');
      const summary = await page.evaluate('document.querySelector("#diff-summary").textContent');
      assert.ok(summary.length > 0);

      await page.click("#diff-accept");
      await page.waitFor('!document.querySelector("#diff-dialog")?.open');
      await page.click("#history-close");
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "keeps the layout inside the viewport",
    async run(page, context) {
      await resetApp(page);

      for (const [width, height] of [[1440, 900], [390, 844], [320, 760]]) {
        await page.setViewport(width, height);
        await sleep(120);
        const overflow = await page.evaluate("document.documentElement.scrollWidth - window.innerWidth");
        assert.ok(overflow <= 0, `Expected no horizontal overflow at ${width}px, saw ${overflow}px.`);
      }

      await page.setViewport(320, 760);
      await importFile(page, context.fixture("sillytavern-world-info.json"));
      const dialog = await page.evaluate(`(() => {
        const element = document.querySelector("#diff-dialog");
        return {
          width: Math.round(element.getBoundingClientRect().width),
          viewport: window.innerWidth,
          overflow: document.documentElement.scrollWidth - window.innerWidth
        };
      })()`);
      assert.ok(dialog.width <= dialog.viewport);
      assert.ok(dialog.overflow <= 0);
      await page.click("#diff-cancel");
      assert.deepEqual(page.errors, []);
    }
  }
];
