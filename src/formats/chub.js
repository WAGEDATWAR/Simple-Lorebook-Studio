import { getEntryItems, hasOwn, isRecord, normalizeLorebook, resolveLorebook } from "./helpers.js";

function isWrappedCharacterBook(input) {
  return isRecord(input)
    && (
      input.spec === "lorebook_v3"
      || (isRecord(input.data) && isRecord(input.data.character_book))
    );
}

function hasDualFields(items) {
  return items.some(({ entry }) => isRecord(entry) && (
    (hasOwn(entry, "key") && hasOwn(entry, "keys"))
    || (hasOwn(entry, "comment") && hasOwn(entry, "name"))
    || (hasOwn(entry, "order") && hasOwn(entry, "insertion_order"))
    || (hasOwn(entry, "keysecondary") && hasOwn(entry, "secondary_keys"))
  ));
}

export const chubAdapter = {
  id: "chub",
  label: "Chub lorebook",
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
    let score = 0;

    if (isRecord(book.extensions) && book.extensions.chub) {
      score = 10;
    } else if (isWrappedCharacterBook(input)) {
      score = 9;
    } else if (hasDualFields(items)) {
      score = 8;
    } else if (Array.isArray(book.entries) && items.some(({ entry }) => isRecord(entry) && (hasOwn(entry, "keys") || hasOwn(entry, "insertion_order")))) {
      score = 6;
    } else if (items.some(({ entry }) => isRecord(entry) && hasOwn(entry, "keys"))) {
      score = 4;
    }

    return score;
  },
  parse(input, options = {}) {
    const resolved = resolveLorebook(input);
    const isCharacterBook = isWrappedCharacterBook(input) || Array.isArray(resolved?.book.entries);

    return normalizeLorebook(input, {
      formatId: this.id,
      formatLabel: isCharacterBook ? "Character book" : this.label,
      filename: options.filename
    });
  }
};
