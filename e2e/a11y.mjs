import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startStaticServer } from "../scripts/serve.mjs";
import { launchBrowser, Page } from "./harness.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixture = resolve(root, "test", "fixtures", "sillytavern-world-info.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dismissOnboarding(page) {
  await sleep(120);

  if (await page.evaluate('Boolean(document.querySelector("#onboarding-dialog")?.open)')) {
    await page.click("#onboarding-sample");
    await page.waitFor('!document.querySelector("#onboarding-dialog")?.open');
  }
}

const states = [
  { name: "onboarding dialog", keepOnboarding: true, setup: async () => {} },
  { name: "workspace", setup: async () => {} },
  { name: "command palette", setup: async (page) => {
    await page.click("#command-btn");
    await page.waitFor('document.querySelector("#command-dialog")?.open');
  } },
  { name: "export dialog", setup: async (page) => {
    await page.click("#export-btn");
    await page.waitFor('document.querySelector("#export-dialog")?.open');
    await page.waitFor('document.querySelector("#storage-usage-backend").textContent !== "—"');
  } },
  { name: "validation dialog", setup: async (page) => {
    await page.click("#validation-btn");
    await page.waitFor('document.querySelector("#validation-dialog")?.open');
  } },
  { name: "overview dialog", setup: async (page) => {
    await page.click("#overview-btn");
    await page.waitFor('document.querySelector("#overview-dialog")?.open');
  } },
  { name: "history dialog", setup: async (page) => {
    await page.click("#history-btn");
    await page.waitFor('document.querySelector("#history-dialog")?.open');
    await page.waitFor('document.querySelector("#history-count")');
  } },
  { name: "template dialog", setup: async (page) => {
    await page.click("#template-btn");
    await page.waitFor('document.querySelector("#template-dialog")?.open');
  } },
  { name: "about dialog", setup: async (page) => {
    await page.click("#about-btn");
    await page.waitFor('document.querySelector("#about-dialog")?.open');
  } },
  { name: "global search dialog", setup: async (page) => {
    await page.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }))');
    await page.waitFor('document.querySelector("#global-search-dialog")?.open');
    await page.evaluate(`(() => {
      const input = document.querySelector("#global-search-input");
      input.value = "harbor";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await page.waitFor('document.querySelectorAll(".global-search-item").length > 0');
  } },
  { name: "integrity dialog", setup: async (page) => {
    await page.click("#about-btn");
    await page.waitFor('document.querySelector("#about-dialog")?.open');
    await page.click("#about-integrity-btn");
    await page.waitFor('document.querySelector("#integrity-dialog")?.open');
    await page.waitFor('document.querySelector("#integrity-summary").textContent.length > 0');
  } },
  { name: "guide dialog", setup: async (page) => {
    await page.click("#about-btn");
    await page.waitFor('document.querySelector("#about-dialog")?.open');
    await page.click("#about-guide-btn");
    await page.waitFor('document.querySelector("#guide-dialog")?.open');
  } },
  { name: "confirm dialog", setup: async (page) => {
    await page.click("#delete-entry-btn");
    await page.waitFor('document.querySelector("#confirm-dialog")?.open');
  } },
  { name: "import diff dialog", setup: async (page) => {
    await page.setFileInput("#import-input", [fixture]);
    await page.waitFor('document.querySelector("#diff-dialog")?.open');
  } }
];

const AXE_RUN = `(async () => {
  const results = await window.axe.run(document);
  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" "))
  }));
})()`;

async function loadAxe() {
  try {
    return await readFile(resolve(root, "node_modules", "axe-core", "axe.min.js"), "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const axeSource = await loadAxe();

  if (!axeSource) {
    console.error("axe-core is not installed. Run: npm install");
    process.exitCode = 1;
    return;
  }

  const { server, port } = await startStaticServer({ root });
  const baseUrl = `http://127.0.0.1:${port}/`;
  let browser = null;
  let page = null;
  const found = new Map();
  const blocked = { critical: 0, serious: 0, moderate: 0, minor: 0 };

  try {
    browser = await launchBrowser();
    page = await Page.open(browser.port);
    await page.navigate(baseUrl);
    await page.setViewport(1440, 900);
    await page.client.send("Page.addScriptToEvaluateOnNewDocument", { source: axeSource });

    for (const state of states) {
      page.clearErrors();
      await page.resetStorage();
      await page.waitFor('document.querySelector("#book-name")?.value');

      if (!state.keepOnboarding) {
        await dismissOnboarding(page);
      }

      await state.setup(page);

      const violations = await page.evaluate(AXE_RUN);
      let count = 0;

      for (const violation of violations) {
        for (const target of violation.nodes) {
          count += 1;
          const key = `${violation.id}|${target}`;

          if (!found.has(key)) {
            found.set(key, {
              id: violation.id,
              impact: violation.impact ?? "minor",
              help: violation.help,
              target,
              states: new Set()
            });
          }

          found.get(key).states.add(state.name);
        }
      }

      console.log(`${count === 0 ? "ok" : "!!"} - ${state.name}: ${count} violation${count === 1 ? "" : "s"}`);
    }
  } finally {
    page?.close();
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }

  const unique = [...found.values()].sort((left, right) => (
    ["critical", "serious", "moderate", "minor"].indexOf(left.impact)
    - ["critical", "serious", "moderate", "minor"].indexOf(right.impact)
  ));

  for (const violation of unique) {
    blocked[violation.impact] += 1;
  }

  if (unique.length) {
    console.log("\nUnique violations:");
    for (const violation of unique) {
      console.log(`- [${violation.impact}] ${violation.id} — ${violation.help}`);
      console.log(`    ${violation.target}  (${[...violation.states].join(", ")})`);
    }
  }

  console.log(`\nUnique total: ${unique.length} (critical ${blocked.critical}, serious ${blocked.serious}, moderate ${blocked.moderate}, minor ${blocked.minor}).`);

  if (blocked.critical || blocked.serious) {
    console.error("Accessibility audit failed: fix critical and serious violations.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
