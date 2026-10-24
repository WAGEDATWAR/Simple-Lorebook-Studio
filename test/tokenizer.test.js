import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encode as encodeCl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { encode as encodeO200k } from "gpt-tokenizer/encoding/o200k_base";
import { createSampleProject } from "../src/sample.js";
import { CL100K_PATTERN, O200K_PATTERN, createEncoder, parseRanks } from "../src/tokenizer/bpe.js";
import { estimateTokens } from "../src/tokenizer/client.js";

const cl100k = createEncoder(
  parseRanks(readFileSync(new URL("../src/tokenizer/data/cl100k_base.tiktoken", import.meta.url), "utf8")),
  CL100K_PATTERN
);
const o200k = createEncoder(
  parseRanks(readFileSync(new URL("../src/tokenizer/data/o200k_base.tiktoken", import.meta.url), "utf8")),
  O200K_PATTERN
);

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

test("parses the vendored cl100k and o200k ranks", () => {
  assert.ok(cl100k.size > 100000, `expected >100000 cl100k ranks, got ${cl100k.size}`);
  assert.ok(o200k.size > 190000, `expected >190000 o200k ranks, got ${o200k.size}`);
});

test("matches cl100k token counts for a corpus", () => {
  for (const text of corpus) {
    const expected = encodeCl100k(text).length;
    const actual = cl100k.count(text);

    assert.equal(actual, expected, `mismatch for ${JSON.stringify(text.slice(0, 60))}: ${actual} !== ${expected}`);
  }
});

test("matches o200k token counts for a corpus", () => {
  for (const text of corpus) {
    const expected = encodeO200k(text).length;
    const actual = o200k.count(text);

    assert.equal(actual, expected, `mismatch for ${JSON.stringify(text.slice(0, 60))}: ${actual} !== ${expected}`);
  }
});

test("matches token counts for the sample project", () => {
  const project = createSampleProject();

  for (const book of project.books) {
    for (const entry of book.entries) {
      assert.equal(cl100k.count(entry.content), encodeCl100k(entry.content).length, `cl100k mismatch for ${entry.title}`);
      assert.equal(o200k.count(entry.content), encodeO200k(entry.content).length, `o200k mismatch for ${entry.title}`);
    }
  }
});

test("estimates tokens when the worker is unavailable", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
});
