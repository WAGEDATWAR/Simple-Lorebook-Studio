import {
  copyPreservedFields,
  createUidAllocator,
  getEntryItems,
  hasOwn,
  isRecord,
  mapPositionToNumber,
  normalizeLorebook,
  resolveLorebook
} from "./helpers.js";

const ENTRY_DEFAULTS = {
  selectiveLogic: 0,
  addMemo: false,
  excludeRecursion: false,
  preventRecursion: false,
  delayUntilRecursion: false,
  depth: 4,
  group: "",
  groupOverride: false,
  groupWeight: 100,
  automationId: "",
  role: 0,
  vectorized: false,
  sticky: 0,
  cooldown: 0,
  delay: 0,
  matchPersonaDescription: false,
  matchCharacterDescription: false,
  matchCharacterPersonality: false,
  matchCharacterDepthPrompt: false,
  matchScenario: false,
  matchCreatorNotes: false
};

function looksLikeWorldInfo(items) {
  return items.some(({ entry }) => isRecord(entry) && (
    hasOwn(entry, "key")
    || hasOwn(entry, "keysecondary")
    || hasOwn(entry, "comment")
    || hasOwn(entry, "disable")
    || hasOwn(entry, "uid")
  ));
}

export const sillyTavernAdapter = {
  id: "sillytavern",
  label: "SillyTavern World Info",
  exportLabel: "SillyTavern World Info v2",
  exportDescription: "A World Info v2 JSON file compatible with SillyTavern.",
  exportFilenameSuffix: "sillytavern-world-info",
  capabilities: {
    bookExport: true,
    preservesUnknownFields: true
  },
  detect(input) {
    if (!isRecord(input) || Array.isArray(input.books)) {
      return 0;
    }

    const resolved = resolveLorebook(input);

    if (!resolved) {
      return 0;
    }

    const book = resolved.book;
    const items = getEntryItems(book.entries);

    if (!items.length) {
      return hasOwn(book, "scan_depth") || hasOwn(book, "token_budget") ? 2 : 0;
    }

    if (!looksLikeWorldInfo(items)) {
      return 0;
    }

    let score = 4;

    if (items.some(({ entry }) => isRecord(entry) && hasOwn(entry, "key") && !hasOwn(entry, "keys"))) {
      score += 2;
    }

    if (items.some(({ entry }) => isRecord(entry) && hasOwn(entry, "disable"))) {
      score += 1;
    }

    if (items.some(({ entry }) => isRecord(entry) && hasOwn(entry, "keysecondary"))) {
      score += 1;
    }

    return score;
  },
  parse(input, options = {}) {
    return normalizeLorebook(input, {
      formatId: this.id,
      formatLabel: this.label,
      filename: options.filename
    });
  },
  serialize(book) {
    if (!isRecord(book) || !Array.isArray(book.entries)) {
      return { ok: false, error: "There is no lorebook to export." };
    }

    const allocateUid = createUidAllocator();
    const entries = {};
    const bookFields = copyPreservedFields(book.extensions, this.id);

    for (const entry of book.entries) {
      const uid = allocateUid(entry);
      const probability = Math.min(100, Math.max(0, Math.trunc(entry.probability ?? 100)));
      const serialized = {
        ...ENTRY_DEFAULTS,
        ...copyPreservedFields(entry.extensions, this.id),
        uid,
        key: [...entry.keys],
        keysecondary: [...entry.secondaryKeys],
        comment: entry.title,
        content: entry.content,
        constant: entry.constant,
        selective: entry.selective,
        order: entry.order,
        position: mapPositionToNumber(entry.position),
        disable: !entry.enabled,
        probability,
        useProbability: probability < 100,
        caseSensitive: entry.caseSensitive,
        matchWholeWords: entry.matchWholeWords
      };

      if (!isRecord(serialized.extensions)) {
        serialized.extensions = {};
      }

      entries[String(uid)] = serialized;
    }

    const output = {
      ...bookFields,
      name: book.name,
      description: book.description,
      entries
    };

    if (!hasOwn(output, "scan_depth")) {
      output.scan_depth = 4;
    }

    if (!hasOwn(output, "token_budget")) {
      output.token_budget = 2048;
    }

    if (!hasOwn(output, "recursive_scanning")) {
      output.recursive_scanning = false;
    }

    return {
      ok: true,
      data: output,
      warnings: []
    };
  }
};
