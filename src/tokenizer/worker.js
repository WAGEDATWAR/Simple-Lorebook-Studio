import { createEncoder, parseRanks } from "./bpe.js";

let encoderPromise = null;

function loadEncoder() {
  if (!encoderPromise) {
    encoderPromise = (async () => {
      const url = new URL("./data/cl100k_base.tiktoken", import.meta.url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Tokenizer data failed to load (${response.status}).`);
      }

      const text = await response.text();
      return createEncoder(parseRanks(text));
    })();
  }

  return encoderPromise;
}

self.addEventListener("message", async (event) => {
  const data = event.data ?? {};

  if (!Array.isArray(data.texts)) {
    return;
  }

  try {
    const encoder = await loadEncoder();
    const counts = data.texts.map((text) => encoder.count(text));
    self.postMessage({ id: data.id, counts });
  } catch (error) {
    self.postMessage({ id: data.id, error: error?.message || "Tokenizer failed." });
  }
});
