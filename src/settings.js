export const TOKENIZER_PRESETS = [
  {
    id: "cl100k",
    encoding: "cl100k",
    label: "GPT-3.5 Turbo, GPT-4, text-embedding-ada-002",
    detail: "cl100k_base"
  },
  {
    id: "o200k",
    encoding: "o200k",
    label: "GPT-4o, GPT-4.1, GPT-4.5, o1, o3",
    detail: "o200k_base"
  }
];

export const CONTEXT_WINDOW_PRESETS = [
  { value: 4096, label: "4K" },
  { value: 8192, label: "8K" },
  { value: 16384, label: "16K" },
  { value: 32768, label: "32K" },
  { value: 65536, label: "64K" },
  { value: 131072, label: "128K" },
  { value: 200000, label: "200K" }
];

export const DEFAULT_TOKEN_SETTINGS = {
  tokenizer: "cl100k",
  contextWindow: 8192
};

const TOKENIZER_IDS = new Set(TOKENIZER_PRESETS.map((preset) => preset.id));
const CONTEXT_WINDOW_VALUES = new Set(CONTEXT_WINDOW_PRESETS.map((preset) => preset.value));

export function normalizeTokenSettings(value) {
  const source = value && typeof value === "object" ? value : {};

  return {
    tokenizer: TOKENIZER_IDS.has(source.tokenizer) ? source.tokenizer : DEFAULT_TOKEN_SETTINGS.tokenizer,
    contextWindow: CONTEXT_WINDOW_VALUES.has(source.contextWindow)
      ? source.contextWindow
      : DEFAULT_TOKEN_SETTINGS.contextWindow
  };
}

export function getTokenizerPreset(id) {
  return TOKENIZER_PRESETS.find((preset) => preset.id === id) ?? TOKENIZER_PRESETS[0];
}

export function getContextWindowPreset(value) {
  return CONTEXT_WINDOW_PRESETS.find((preset) => preset.value === value) ?? null;
}
