import assert from "node:assert/strict";
import { sleep } from "./harness.mjs";

async function dismissOnboarding(page) {
  await sleep(120);

  if (await page.evaluate('Boolean(document.querySelector("#onboarding-dialog")?.open)')) {
    await page.click("#onboarding-sample");
    await page.waitFor('!document.querySelector("#onboarding-dialog")?.open');
  }
}

async function resetApp(page) {
  page.clearErrors();
  await page.resetStorage();
  await page.waitFor('document.querySelector("#book-name")?.value');
  await dismissOnboarding(page);
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

async function addChipKey(page, selector, value) {
  await page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    input.focus();
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    return true;
  })()`);
}

async function pasteChipKeys(page, selector, text) {
  await page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    input.focus();
    const data = new DataTransfer();
    data.setData("text", ${JSON.stringify(text)});
    input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    return true;
  })()`);
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
    name: "shows first-run onboarding and can start empty",
    async run(page) {
      page.clearErrors();
      await page.resetStorage();
      await page.waitFor('document.querySelector("#onboarding-dialog")?.open');
      await page.click("#onboarding-empty");
      await page.waitFor('!document.querySelector("#onboarding-dialog")?.open');
      await page.waitFor('document.querySelector("#book-name")?.value === "Untitled Lorebook"');
      await page.waitFor('document.querySelectorAll(".entry-card").length === 0');
      await page.waitFor('document.querySelector("#sample-badge")?.hidden === true');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "shows a sample badge and clears it after an edit",
    async run(page) {
      await resetApp(page);
      await page.waitFor('document.querySelector("#sample-badge")?.hidden === false');
      await page.click("#add-entry-btn");
      await page.waitFor('document.querySelector("#sample-badge")?.hidden === true');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "resets to the sample project",
    async run(page) {
      await resetApp(page);
      await page.click("#sample-badge");
      await page.waitFor('document.querySelector("#sample-dialog")?.open');
      await page.click("#sample-reset");
      await page.waitFor('!document.querySelector("#sample-dialog")?.open');
      await page.waitFor('document.querySelector("#book-name")?.value === "Aurora Vale"');
      await page.waitFor('document.querySelector("#sample-badge")?.hidden === false');
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
      await page.waitFor('document.querySelectorAll(".entry-card:not(.is-pinned)").length === 1');
      const title = await page.evaluate('document.querySelector(".entry-card:not(.is-pinned) .entry-card-title").textContent');
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
      await page.waitFor('document.querySelectorAll(".entry-card:not(.is-pinned)").length === 3');

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
    name: "tags entries and filters by tag",
    async run(page) {
      await resetApp(page);

      await addChipKey(page, "#entry-tags-input", "location");
      await addChipKey(page, "#entry-tags-input", "city");
      await page.waitFor('document.querySelectorAll("#entry-tags .key-chip").length === 2');

      await page.evaluate(`(() => {
        const cards = [...document.querySelectorAll(".entry-card")];
        cards[1].click();
        return true;
      })()`);
      await page.waitFor('document.querySelector("#entry-title").value === "Mara Voss"');
      await addChipKey(page, "#entry-tags-input", "npc");
      await page.waitFor('document.querySelectorAll("#tag-filters [data-tag]").length === 3');

      await page.click('#tag-filters [data-tag="npc"]');
      await page.waitFor('document.querySelectorAll(".entry-card").length === 1');
      const title = await page.evaluate('document.querySelector(".entry-card-title").textContent');
      assert.equal(title, "Mara Voss");

      await page.click('#tag-filters [data-tag="npc"]');
      await page.waitFor('document.querySelectorAll(".entry-card").length === 3');

      await page.waitFor('document.querySelector("#save-state")?.dataset.state === "saved"');
      await page.reload();
      await page.waitFor('document.querySelector("#entry-title")?.value === "Mara Voss"');
      await page.waitFor('document.querySelectorAll("#entry-tags .key-chip").length === 1');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "highlights search matches and explains them",
    async run(page) {
      await resetApp(page);

      await setValue(page, "#entry-search", "mara");
      await page.waitFor('document.querySelectorAll(".entry-card:not(.is-pinned)").length === 1');
      const highlight = await page.evaluate('document.querySelector(".entry-card:not(.is-pinned) .entry-card-title mark")?.textContent ?? ""');
      assert.equal(highlight.toLowerCase(), "mara");
      const why = await page.evaluate('document.querySelector(".entry-card:not(.is-pinned) .entry-card-match")?.textContent ?? ""');
      assert.match(why, /title/);

      await setValue(page, "#entry-search", "lanterns");
      await page.waitFor('document.querySelectorAll(".entry-card:not(.is-pinned)").length === 1');
      const contentWhy = await page.evaluate('document.querySelector(".entry-card:not(.is-pinned) .entry-card-match")?.textContent ?? ""');
      assert.match(contentWhy, /content/);
      const titleMark = await page.evaluate('Boolean(document.querySelector(".entry-card:not(.is-pinned) .entry-card-title mark"))');
      assert.equal(titleMark, false);
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "keeps the active entry visible when filtered out",
    async run(page) {
      await resetApp(page);
      const activeId = await page.evaluate('document.querySelector(".entry-card.is-active").dataset.entryId');

      await setValue(page, "#entry-search", "mara");
      await page.waitFor('document.querySelectorAll(".entry-card").length === 2');
      const pinned = await page.evaluate('document.querySelector(".entry-card.is-pinned")?.dataset.entryId ?? ""');
      assert.equal(pinned, activeId);
      const count = await page.evaluate('document.querySelector("#entry-count").textContent');
      assert.equal(count, "1/3");

      await setValue(page, "#entry-search", "");
      await page.waitFor('document.querySelectorAll(".entry-card").length === 3');
      const stillPinned = await page.evaluate('Boolean(document.querySelector(".entry-card.is-pinned"))');
      assert.equal(stillPinned, false);
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
    name: "edits trigger keys as chips with paste support",
    async run(page) {
      await resetApp(page);
      await page.waitFor('document.querySelectorAll("#entry-keys .key-chip").length === 3');

      await addChipKey(page, "#entry-keys-input", "harbor");
      await page.waitFor('document.querySelectorAll("#entry-keys .key-chip").length === 4');

      await pasteChipKeys(page, "#entry-keys-input", "alpha, beta\ngamma");
      await page.waitFor('document.querySelectorAll("#entry-keys .key-chip").length === 7');

      await page.evaluate('document.querySelector("#entry-keys .key-chip-remove").click(); true');
      await page.waitFor('document.querySelectorAll("#entry-keys .key-chip").length === 6');

      await addChipKey(page, "#entry-keys-input", "/[bad/");
      await page.waitFor('document.querySelectorAll("#entry-keys .key-chip").length === 7');
      const invalid = await page.evaluate('Boolean(document.querySelector("#entry-keys .key-chip.is-regex-invalid"))');
      assert.equal(invalid, true);

      await page.waitFor('document.querySelector("#save-state")?.dataset.state === "saved"');
      await page.reload();
      await page.waitFor('document.querySelector("#book-name")?.value');
      await page.waitFor('document.querySelectorAll("#entry-keys .key-chip").length === 7');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "sets insertion order for selected entries",
    async run(page) {
      await resetApp(page);
      const firstId = await page.evaluate('document.querySelector(".entry-card").dataset.entryId');
      await pressKey(page, `[data-entry-id="${firstId}"]`, "ArrowDown", { ctrl: true });
      await page.waitFor('document.querySelector("#bulk-bar")?.hidden === false');

      await page.evaluate(`(() => {
        const input = document.querySelector("#bulk-order-input");
        input.value = "500";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`);
      await page.click("#bulk-order-apply");
      await page.waitFor('document.querySelector("#entry-order")?.value === "500"');

      await page.click("#bulk-order-up");
      await page.waitFor('document.querySelector("#entry-order")?.value === "510"');

      await page.evaluate(`(() => {
        const cards = [...document.querySelectorAll(".entry-card")];
        cards[1].click();
        return true;
      })()`);
      await page.waitFor('document.querySelector("#entry-order")?.value === "510"');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "keeps local UI preferences across reloads",
    async run(page) {
      await resetApp(page);
      await page.evaluate(`(() => {
        const select = document.querySelector("#entry-sort");
        select.value = "title";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`);
      await page.waitFor('document.querySelector("#entry-sort")?.value === "title"');

      await page.reload();
      await page.waitFor('document.querySelector("#book-name")?.value');
      await page.waitFor('document.querySelector("#entry-sort")?.value === "title"');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "reports local storage usage in the export dialog",
    async run(page) {
      await resetApp(page);
      await page.click("#export-btn");
      await page.waitFor('document.querySelector("#export-dialog")?.open');
      await page.waitFor('document.querySelector("#storage-usage-backend").textContent === "IndexedDB"');
      const project = await page.evaluate('document.querySelector("#storage-usage-project").textContent');
      assert.match(project, /B|KB|MB/);
      const total = await page.evaluate('document.querySelector("#storage-usage-total").textContent');
      assert.ok(total.length > 0);
      await page.click("#export-cancel");
      await page.waitFor('!document.querySelector("#export-dialog")?.open');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "exports a standalone character book",
    async run(page) {
      await resetApp(page);
      await page.click("#export-btn");
      await page.waitFor('document.querySelector("#export-dialog")?.open');
      await page.waitFor('document.querySelector(\'#export-options [data-export-format="characterbook"]\')');

      await page.click('#export-options [data-export-format="characterbook"]');
      await page.waitFor('!document.querySelector("#export-dialog")?.open');
      const toast = await page.evaluate('document.querySelector(".toast")?.textContent ?? ""');
      assert.match(toast, /Character book/);
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "reminds about backups and records an export",
    async run(page) {
      await resetApp(page);
      await page.evaluate(`(() => {
        localStorage.setItem("lorebook-studio:last-backup:v1", String(Date.now() - 8 * 24 * 60 * 60 * 1000));
        localStorage.removeItem("lorebook-studio:backup-reminder-snooze:v1");
        return true;
      })()`);
      await page.reload();
      await page.waitFor('document.querySelector("#book-name")?.value');
      await page.waitFor('document.querySelector("#backup-reminder")?.hidden === false');

      await page.click("#backup-reminder-export-btn");
      await page.waitFor('document.querySelector("#backup-reminder")?.hidden === true');
      const last = await page.evaluate('Number(localStorage.getItem("lorebook-studio:last-backup:v1"))');
      assert.ok(Date.now() - last < 60000);
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
      await page.waitFor('document.querySelector(".toast")?.textContent.includes("Appended")');

      const state = await appState(page);
      assert.deepEqual(state.books, ["Aurora Vale", "Harbor Secrets"]);
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
    name: "shows real token counts from the worker",
    async run(page) {
      await resetApp(page);
      await page.waitFor('!document.querySelector("#entry-stat-tokens").textContent.startsWith("~")');
      const tokens = await page.evaluate('document.querySelector("#entry-stat-tokens").textContent');
      assert.match(tokens, /^\d[\d,]*$/);

      await page.click("#overview-btn");
      await page.waitFor('document.querySelector("#overview-dialog")?.open');
      await page.waitFor('!document.querySelector("#overview-tokens").textContent.startsWith("~")');
      await page.click("#overview-close");
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "warns when a book exceeds its token budget",
    async run(page) {
      await resetApp(page);
      await setValue(page, "#book-token-budget", "10");
      await page.waitFor('document.querySelector("#book-budget-status")?.classList.contains("is-over")');
      const status = await page.evaluate('document.querySelector("#book-budget-status").textContent');
      assert.match(status, /Over budget/);

      await page.click("#overview-btn");
      await page.waitFor('document.querySelector("#overview-dialog")?.open');
      await page.waitFor('document.querySelector("#overview-budget")?.classList.contains("is-over")');
      const budget = await page.evaluate('document.querySelector("#overview-budget").textContent');
      assert.match(budget, /over/);
      await page.click("#overview-close");
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "simulates context activation",
    async run(page) {
      await resetApp(page);
      await page.click("#simulation-btn");
      await page.waitFor('document.querySelector("#simulation-dialog")?.open');

      await setValue(page, "#simulation-input", "Mara Voss, the harbormaster, walks the harbor at dusk.");
      await page.waitFor('document.querySelectorAll(".simulation-item").length === 2');

      const summary = await page.evaluate('document.querySelector("#simulation-summary").textContent');
      assert.match(summary, /activate/);
      const output = await page.evaluate('document.querySelector(".simulation-output")?.textContent ?? ""');
      assert.match(output, /Aurora Vale clings/);
      const skipped = await page.evaluate('document.querySelector(".simulation-skipped summary")?.textContent ?? ""');
      assert.match(skipped, /Not activated/);

      await page.evaluate('document.querySelector(".simulation-item-title").click(); true');
      await page.waitFor('!document.querySelector("#simulation-dialog")?.open');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "filters validation issues by type",
    async run(page) {
      await resetApp(page);
      await page.click("#add-entry-btn");
      await page.waitFor('document.querySelectorAll(".entry-card").length === 4');
      await page.click("#validation-btn");
      await page.waitFor('document.querySelector("#validation-dialog")?.open');
      await page.waitFor('document.querySelectorAll(".validation-issue").length >= 2');

      const total = await page.evaluate('document.querySelectorAll(".validation-issue").length');

      await page.click('[data-validation-filter="emptyContent"]');
      await page.waitFor('document.querySelectorAll(".validation-issue").length === 1');
      const type = await page.evaluate('document.querySelector(".validation-issue-type").textContent');
      assert.equal(type, "Empty content");

      await page.click("[data-validation-all]");
      await page.waitFor(`document.querySelectorAll(".validation-issue").length === ${total}`);
      await page.click("#validation-close");
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "checks project data integrity",
    async run(page) {
      await resetApp(page);
      await page.evaluate('document.querySelector("#about-btn").click(); true');
      await page.waitFor('document.querySelector("#about-dialog")?.open');
      await page.click("#about-integrity-btn");
      await page.waitFor('document.querySelector("#integrity-dialog")?.open');
      await page.waitFor('document.querySelector("#integrity-summary").textContent.includes("No integrity issues")');

      const disabled = await page.evaluate('document.querySelector("#integrity-repair").disabled');
      assert.equal(disabled, true);

      await page.click("#integrity-close");
      await page.waitFor('!document.querySelector("#integrity-dialog")?.open');
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "opens and runs commands from the command palette",
    async run(page) {
      await resetApp(page);
      await page.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }))');
      await page.waitFor('document.querySelector("#command-dialog")?.open');

      await setValue(page, "#command-input", "overview");
      await page.waitFor('document.querySelectorAll(".command-option").length === 1');
      const title = await page.evaluate('document.querySelector(".command-option-title").textContent');
      assert.equal(title, "Overview");

      await page.evaluate(`(() => {
        const input = document.querySelector("#command-input");
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        return true;
      })()`);
      await page.waitFor('document.querySelector("#overview-dialog")?.open');
      await page.waitFor('!document.querySelector("#command-dialog")?.open');
      await page.click("#overview-close");
      assert.deepEqual(page.errors, []);
    }
  },
  {
    name: "opens the About panel and getting-started guide",
    async run(page) {
      await resetApp(page);
      await page.click("#about-btn");
      await page.waitFor('document.querySelector("#about-dialog")?.open');
      await page.waitFor('document.querySelector("#about-version").textContent.startsWith("Version ")');

      const version = await page.evaluate('document.querySelector("#about-version").textContent');
      const meta = await page.evaluate('document.querySelector("meta[name=\\"app-version\\"]").content');
      assert.ok(version.includes(meta));

      const privacy = await page.evaluate('document.querySelector(".about-privacy").textContent');
      assert.match(privacy, /local-first/);
      const formats = await page.evaluate('document.querySelector("#about-export-formats").textContent');
      assert.match(formats, /Character book/);

      await page.click("#about-guide-btn");
      await page.waitFor('document.querySelector("#guide-dialog")?.open');
      const steps = await page.evaluate('document.querySelectorAll(".guide-steps li").length');
      assert.ok(steps >= 5);
      await page.click("#guide-close");
      await page.waitFor('!document.querySelector("#guide-dialog")?.open');
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
