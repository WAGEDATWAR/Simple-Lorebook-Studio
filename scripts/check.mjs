import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const roots = ["src", "test", "scripts", "e2e"];
const extensions = new Set([".js", ".mjs"]);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collect(path));
    } else if (extensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

const files = [];

for (const name of roots) {
  files.push(...await collect(resolve(root, name)));
}

files.sort();

const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });

  if (result.status !== 0) {
    failures.push({ file, output: (result.stderr || result.stdout || "").trim() });
  }
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`Syntax error: ${failure.file}`);
    console.error(failure.output);
  }

  console.error(`\n${failures.length} of ${files.length} files failed the syntax check.`);
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed for ${files.length} files.`);
}
