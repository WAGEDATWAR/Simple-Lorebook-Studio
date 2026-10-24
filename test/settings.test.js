import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTEXT_WINDOW_PRESETS,
  DEFAULT_TOKEN_SETTINGS,
  TOKENIZER_PRESETS,
  getContextWindowPreset,
  getTokenizerPreset,
  normalizeTokenSettings
} from "../src/settings.js";

test("publishes tokenizer and context window presets", () => {
  assert.deepEqual(TOKENIZER_PRESETS.map((preset) => preset.id), ["cl100k", "o200k"]);
  assert.equal(TOKENIZER_PRESETS[1].encoding, "o200k");
  assert.ok(CONTEXT_WINDOW_PRESETS.some((preset) => preset.value === 8192));
  assert.deepEqual(DEFAULT_TOKEN_SETTINGS, { tokenizer: "cl100k", contextWindow: 8192 });
});

test("normalizes unknown token settings to defaults", () => {
  assert.deepEqual(normalizeTokenSettings(null), DEFAULT_TOKEN_SETTINGS);
  assert.deepEqual(normalizeTokenSettings({ tokenizer: "bogus", contextWindow: 999 }), DEFAULT_TOKEN_SETTINGS);
  assert.deepEqual(normalizeTokenSettings({ tokenizer: "o200k", contextWindow: 32768 }), {
    tokenizer: "o200k",
    contextWindow: 32768
  });
});

test("resolves tokenizer and context window presets", () => {
  assert.equal(getTokenizerPreset("o200k").detail, "o200k_base");
  assert.equal(getTokenizerPreset("unknown").id, "cl100k");
  assert.equal(getContextWindowPreset(4096).label, "4K");
  assert.equal(getContextWindowPreset(123), null);
});
