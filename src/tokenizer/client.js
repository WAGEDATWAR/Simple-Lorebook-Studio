const FLUSH_DELAY_MS = 60;
const CACHE_LIMIT = 20000;

export function estimateTokens(text) {
  const length = String(text ?? "").length;
  return length ? Math.ceil(length / 4) : 0;
}

export function createTokenizer({ onUpdate } = {}) {
  const cache = new Map();
  const pending = new Map();
  const inflight = new Map();
  let worker = null;
  let available = true;
  let ready = false;
  let flushTimer = 0;
  let nextId = 1;
  let encoding = "cl100k";

  function start() {
    if (worker || !available) {
      return;
    }

    try {
      worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    } catch {
      worker = null;
      available = false;
      return;
    }

    worker.addEventListener("message", (event) => {
      const data = event.data ?? {};
      const job = inflight.get(data.id);
      inflight.delete(data.id);

      if (data.error || !job || !Array.isArray(data.counts)) {
        return;
      }

      if (job.encoding !== encoding) {
        return;
      }

      job.texts.forEach((text, index) => {
        if (cache.size < CACHE_LIMIT) {
          cache.set(text, data.counts[index]);
        }
      });

      ready = true;
      onUpdate?.();
    });

    worker.addEventListener("error", () => {
      available = false;
      worker = null;
    });
  }

  function flush() {
    if (!worker || !pending.size) {
      return;
    }

    const texts = [...pending.keys()];
    pending.clear();
    const id = nextId;
    nextId += 1;
    inflight.set(id, { texts, encoding });
    worker.postMessage({ id, encoding, texts });
  }

  function schedule() {
    if (flushTimer) {
      return;
    }

    flushTimer = window.setTimeout(() => {
      flushTimer = 0;
      flush();
    }, FLUSH_DELAY_MS);
  }

  return {
    start,
    isReady: () => ready,
    isAvailable: () => available,
    getEncoding: () => encoding,
    setEncoding(next) {
      const value = next === "o200k" ? "o200k" : "cl100k";

      if (value === encoding) {
        return;
      }

      encoding = value;
      cache.clear();
      pending.clear();
      inflight.clear();
      ready = false;
      onUpdate?.();
    },
    count(text) {
      return cache.has(text) ? cache.get(text) : null;
    },
    request(text) {
      const value = String(text ?? "");

      if (!value || !worker || cache.has(value) || pending.has(value)) {
        return;
      }

      pending.set(value, true);
      schedule();
    }
  };
}
