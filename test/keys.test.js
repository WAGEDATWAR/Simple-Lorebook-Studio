import assert from "node:assert/strict";
import test from "node:test";
import { isRegexKey, parseRegexKey } from "../src/keys.js";

test("detects slash-delimited regex keys", () => {
  assert.equal(isRegexKey("/sword|blade/i"), true);
  assert.equal(isRegexKey("/^dragon/"), true);
  assert.equal(isRegexKey("sword"), false);
  assert.equal(isRegexKey("/"), false);
  assert.equal(isRegexKey("/foo/bar"), false);
});

test("compiles valid regex keys", () => {
  const parsed = parseRegexKey("/sword|blade/i");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.pattern, "sword|blade");
  assert.equal(parsed.flags, "i");
  assert.equal(parsed.regex.test("Sword"), true);
});

test("treats plain keys as literals", () => {
  const parsed = parseRegexKey("sword");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.regex, null);
  assert.equal(parsed.pattern, "sword");
});

test("reports invalid regex keys for plain-text fallback", () => {
  const parsed = parseRegexKey("/[unterminated/");

  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /Invalid regular expression/);
});
