import { getEntryItems, hasOwn, isRecord, normalizeLorebook, resolveLorebook } from "./helpers.js";

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
  }
};
