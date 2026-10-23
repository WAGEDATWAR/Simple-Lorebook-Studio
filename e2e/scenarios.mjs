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
