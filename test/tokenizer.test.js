import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { createSampleProject } from "../src/sample.js";
import { createEncoder, parseRanks } from "../src/tokenizer/bpe.js";
import { estimateTokens } from "../src/tokenizer/client.js";

const rankText = readFileSync(new URL("../src/tokenizer/data/cl100k_base.tiktoken", import.meta.url), "utf8");
const ranks = parseRanks(rankText);
const encoder = createEncoder(ranks);

const corpus = [
  "",
  "hello world",
  "Aurora Vale clings to the cliffs above the Cerulean Reach.",
  "don't we're I'll it's they've you'd",
  "don\u2019t we\u2019re I\u2019ll it\u2019s",
  "1234567 2024 3.14159",
  "a\n\nb",
  "  leading and trailing  ",
  "tab\tseparated\tvalues",
  "café naïve résumé",
  "\u65e5\u672c\u8a9e\u306e\u30c6\u30ad\u30b9\u30c8",
  "\ud83c\udf0a \ud83d\udd25 \ud83d\udcda",
  "Mara Voss \u2014 harbormaster",
  "function foo() { return 1; }",
  "const x = [1, 2, 3].map((n) => n * 2);",
  "The harbor bells ring twice: once for the returning fleet, and once for the things that follow it home.",
  "  \n  \n  ",
  "a".repeat(500),
  "word ".repeat(300),
  "Tidebinding is the practice of persuading the sea to hold a shape. Practitioners carve sigils into sea glass and hum a low, repeating note until the water answers.",
  "Keys: aurora vale, the vale, city; secondary: inner voice, thought",
  "Line one.\nLine two.\n\nLine four.",
  "MixedCASEand123numbers",
  "emoji in a sentence \ud83c\udf0a with words",
  "\u0000\u0001 control chars",
  "\\n literal backslash n",
  "https://example.com/path?query=value#fragment",
  "{\"key\": \"value\", \"nested\": {\"list\": [1, 2, 3]}}"
];

test("parses the vendored cl100k ranks", () => {
  assert.ok(ranks.size > 100000, `expected >100000 ranks, got ${ranks.size}`);
});

test("matches cl100k token counts for a corpus", () => {
  for (const text of corpus) {
    const expected = encode(text).length;
    const actual = encoder.count(text);

    assert.equal(actual, expected, `mismatch for ${JSON.stringify(text.slice(0, 60))}: ${actual} !== ${expected}`);
  }
});

test("estimates tokens when the worker is unavailable", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
});

test("matches cl100k token counts for the sample project", () => {
  const project = createSampleProject();

  for (const book of project.books) {
    for (const entry of book.entries) {
      assert.equal(encoder.count(entry.content), encode(entry.content).length, `mismatch for ${entry.title}`);
    }
  }
});
