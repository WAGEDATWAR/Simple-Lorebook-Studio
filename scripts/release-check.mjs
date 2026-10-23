import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const problems = [];

const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const version = manifest.version;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  problems.push(`package.json version "${version}" is not a plain semantic version.`);
}

let changelog = "";

try {
  changelog = await readFile(resolve(root, "CHANGELOG.md"), "utf8");
} catch {
  problems.push("CHANGELOG.md is missing.");
}

if (changelog && !changelog.includes(`## [${version}]`)) {
  problems.push(`CHANGELOG.md has no "## [${version}]" entry.`);
}

const tagResult = spawnSync("git", ["tag", "--points-at", "HEAD"], { cwd: root, encoding: "utf8" });

if (tagResult.status === 0) {
  const tags = tagResult.stdout.split(/\r?\n/).map((tag) => tag.trim()).filter(Boolean);
  const releaseTags = tags.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));

  if (releaseTags.length && !releaseTags.includes(`v${version}`)) {
    problems.push(`HEAD is tagged ${releaseTags.join(", ")} but package.json is ${version}.`);
  }
}

if (problems.length) {
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }

  console.error("\nRelease check failed.");
  process.exitCode = 1;
} else {
  console.log(`Release check passed for ${version}.`);
}
