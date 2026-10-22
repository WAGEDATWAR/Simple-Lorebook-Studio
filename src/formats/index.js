import { chubAdapter } from "./chub.js";
import { isRecord } from "./helpers.js";
import { nativeAdapter } from "./native.js";
import { sillyTavernAdapter } from "./sillytavern.js";

const adapters = [nativeAdapter, chubAdapter, sillyTavernAdapter];

export function parseLorebookData(input, options = {}) {
  if (!isRecord(input)) {
    return { ok: false, error: "That JSON file doesn't contain a lorebook." };
  }

  const candidates = adapters
    .map((adapter, index) => ({
      adapter,
      index,
      score: adapter.detect(input)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (!candidates.length) {
    return {
      ok: false,
      error: "That file isn't a supported lorebook. Try a Lorebook Studio project, SillyTavern World Info, or Chub lorebook."
    };
  }

  const parsed = candidates[0].adapter.parse(input, options);

  if (!parsed.ok) {
    return parsed;
  }

  return {
    ...parsed,
    format: parsed.format || candidates[0].adapter.label
  };
}
