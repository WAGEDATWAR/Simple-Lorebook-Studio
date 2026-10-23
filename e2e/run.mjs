import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startStaticServer } from "../scripts/serve.mjs";
import { launchBrowser, Page } from "./harness.mjs";
import { scenarios } from "./scenarios.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const resultsDir = resolve(root, "test-results", "e2e");

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function withTimeout(promise, ms, label) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Scenario timed out after ${ms}ms.`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function main() {
  const filters = process.argv.slice(2);
  const selected = filters.length
    ? scenarios.filter((scenario) => filters.some((filter) => scenario.name.includes(filter)))
    : scenarios;

  if (!selected.length) {
    console.error("No scenarios matched the provided filters.");
    process.exitCode = 1;
    return;
  }

  const { server, port } = await startStaticServer({ root });
  const baseUrl = `http://127.0.0.1:${port}/`;
  let browser = null;
  let page = null;
  let failures = 0;
  const startedAt = Date.now();

  try {
    browser = await launchBrowser();
    page = await Page.open(browser.port);
    await page.navigate(baseUrl);

    const context = {
      baseUrl,
      root,
      fixture: (name) => resolve(root, "test", "fixtures", name)
    };

    for (const scenario of selected) {
      try {
        await withTimeout(scenario.run(page, context), scenario.timeout ?? 30000, scenario.name);
        console.log(`ok - ${scenario.name}`);
      } catch (error) {
        failures += 1;
        console.error(`not ok - ${scenario.name}`);
        console.error(`  ${error.message}`);

        await mkdir(resultsDir, { recursive: true });
        await page.screenshot(resolve(resultsDir, `${slug(scenario.name)}.png`)).catch(() => {});
      }
    }
  } finally {
    page?.close();
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n${selected.length - failures}/${selected.length} scenarios passed in ${seconds}s`);

  if (failures) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
