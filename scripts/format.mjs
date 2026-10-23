import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const write = process.argv.includes("--write");
const roots = ["src", "test", "scripts", "e2e"];
const extensions = new Set([".js", ".mjs", ".css", ".html", ".json", ".yml", ".yaml"]);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collect(path));
    } else {
      files.push(path);
    }
  }

  return files;
}

function normalize(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  while (lines.length && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return `${lines.map((line) => line.replace(/[ \t]+$/, "")).join("\n")}\n`;
}

const files = [resolve(root, "index.html")];

for (const name of roots) {
  files.push(...await collect(resolve(root, name)));
}

const changed = [];

for (const file of files) {
  if (!extensions.has(extname(file))) {
    continue;
  }

  const original = await readFile(file, "utf8");
  const normalized = normalize(original);

  if (original === normalized) {
    continue;
  }

  changed.push(relative(root, file));

  if (write) {
    await writeFile(file, normalized);
  }
}

if (!changed.length) {
  console.log("Formatting is clean.");
} else if (write) {
  console.log(`Formatted ${changed.length} files.`);
} else {
  console.error("These files need formatting (run: npm run format):");

  for (const file of changed) {
    console.error(`  ${file}`);
  }

  process.exitCode = 1;
}
