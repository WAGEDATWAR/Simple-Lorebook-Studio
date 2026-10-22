import { slugify } from "../utils.js";
import { chubAdapter } from "./chub.js";
import { isRecord } from "./helpers.js";
import { nativeAdapter } from "./native.js";
import { sillyTavernAdapter } from "./sillytavern.js";

const adapters = [nativeAdapter, chubAdapter, sillyTavernAdapter];

export const EXPORT_FORMATS = adapters
  .filter((adapter) => adapter.capabilities?.bookExport)
  .map((adapter) => ({
    id: adapter.id,
    label: adapter.exportLabel || adapter.label,
    description: adapter.exportDescription || "",
    capabilities: { ...adapter.capabilities }
  }));

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
    formatId: candidates[0].adapter.id,
    format: parsed.format || candidates[0].adapter.label,
    capabilities: { ...candidates[0].adapter.capabilities }
  };
}

export function serializeLorebook(formatId, book) {
  const adapter = adapters.find((candidate) => candidate.id === formatId);

  if (!adapter?.serialize) {
    return { ok: false, error: "That export format isn't available." };
  }

  const serialized = adapter.serialize(book);

  if (!serialized.ok) {
    return serialized;
  }

  const suffix = adapter.exportFilenameSuffix || adapter.id;
  const filename = `${slugify(book.name)}-${suffix}.json`;

  return {
    ...serialized,
    formatId: adapter.id,
    label: adapter.exportLabel || adapter.label,
    filename,
    capabilities: { ...adapter.capabilities },
    warnings: serialized.warnings || []
  };
}
