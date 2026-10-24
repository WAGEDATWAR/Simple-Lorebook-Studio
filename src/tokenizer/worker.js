import { CL100K_PATTERN, O200K_PATTERN, createEncoder, parseRanks } from "./bpe.js";

const ENCODINGS = {
  cl100k: { file: "cl100k_base.tiktoken", pattern: CL100K_PATTERN },
  o200k: { file: "o200k_base.tiktoken", pattern: O200K_PATTERN }
};

const encoders = new Map();

function loadEncoder(encoding) {
  const key = ENCODINGS[encoding] ? encoding : "cl100k";
  const config = ENCODINGS[key];

  if (!encoders.has(key)) {
    encoders.set(key, (async () => {
      const response = await fetch(new URL(`./data/${config.file}`, import.meta.url));

      if (!response.ok) {
        throw new Error(`Tokenizer data failed to load (${response.status}).`);
      }

      const text = await response.text();
      return createEncoder(parseRanks(text), config.pattern);
    })());
  }

  return encoders.get(key);
}

self.addEventListener("message", async (event) => {
  const data = event.data ?? {};

  if (!Array.isArray(data.texts)) {
    return;
  }

  try {
    const encoder = await loadEncoder(data.encoding);
    const counts = data.texts.map((text) => encoder.count(text));
    self.postMessage({ id: data.id, counts });
  } catch (error) {
    self.postMessage({ id: data.id, error: error?.message || "Tokenizer failed." });
  }
});
