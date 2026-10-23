import assert from "node:assert/strict";
import test from "node:test";
import { filterCommands } from "../src/commands.js";

const commands = [
  { title: "New entry", hint: "Alt+N", keywords: ["add", "create"] },
  { title: "Export…", keywords: ["download", "save"] },
  { title: "Overview", keywords: ["stats", "tokens"] }
];

test("returns all commands for an empty query", () => {
  assert.equal(filterCommands(commands, "").length, 3);
});

test("matches by title, hint, and keywords", () => {
  assert.deepEqual(filterCommands(commands, "over").map((command) => command.title), ["Overview"]);
  assert.deepEqual(filterCommands(commands, "alt+n").map((command) => command.title), ["New entry"]);
  assert.deepEqual(filterCommands(commands, "download").map((command) => command.title), ["Export…"]);
});

test("is case-insensitive and trims the query", () => {
  assert.deepEqual(filterCommands(commands, "  EXPORT  ").map((command) => command.title), ["Export…"]);
});

test("returns an empty list when nothing matches", () => {
  assert.deepEqual(filterCommands(commands, "zzz"), []);
});
