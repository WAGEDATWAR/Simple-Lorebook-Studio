import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const roots = ["src", "test", "scripts", "e2e"];
const codeExtensions = new Set([".js", ".mjs"]);
const jsonExtensions = new Set([".json"]);
const debuggerPattern = new RegExp("\\bdebu" + "gger\\b");

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

function lintCode(file, text) {
  const problems = [];
  const lines = text.split("\n");
  const isSource = relative(root, file).startsWith(`src${sep}`);

  if (!text.endsWith("\n")) {
    problems.push("missing final newline");
  } else if (text.endsWith("\n\n")) {
    problems.push("extra blank line at the end of the file");
  }

  lines.forEach((line, index) => {
    const number = index + 1;

    if (/[ \t]+$/.test(line)) {
      problems.push(`line ${number}: trailing whitespace`);
    }

    if (/^\t/.test(line)) {
      problems.push(`line ${number}: tab indentation (use spaces)`);
    }

    if (/\bvar\s+[A-Za-z_$]/.test(line)) {
      problems.push(`line ${number}: use let or const instead of var`);
    }

    if (debuggerPattern.test(line)) {
      problems.push(`line ${number}: remove the debug statement`);
    }

    if (isSource && /console\.(log|info|debug)\s*\(/.test(line)) {
      problems.push(`line ${number}: remove the console statement`);
    }
  });

  return problems;
}

const files = [];

for (const name of roots) {
  files.push(...await collect(resolve(root, name)));
}

files.sort();

let checked = 0;
let failed = 0;

for (const file of files) {
  const extension = extname(file);

  if (!codeExtensions.has(extension) && !jsonExtensions.has(extension)) {
    continue;
  }

  checked += 1;
  const text = await readFile(file, "utf8");
  const problems = codeExtensions.has(extension) ? lintCode(file, text) : [];

  if (jsonExtensions.has(extension)) {
    try {
      JSON.parse(text);
    } catch (error) {
      problems.push(`invalid JSON: ${error.message}`);
    }
  }

  if (problems.length) {
    failed += 1;
    console.error(`\n${relative(root, file)}`);
    problems.forEach((problem) => console.error(`  ${problem}`));
  }
}

if (failed) {
  console.error(`\n${failed} of ${checked} files failed lint.`);
  process.exitCode = 1;
} else {
  console.log(`Lint passed for ${checked} files.`);
}
