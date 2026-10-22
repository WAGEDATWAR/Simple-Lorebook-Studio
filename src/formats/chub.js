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
  exportLabel: "Chub lorebook",
  exportDescription: "A standalone Chub lorebook with both common field variants.",
  exportFilenameSuffix: "chub-lorebook",
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
        ...copyPreservedFields(entry.extensions, this.id),
        uid,
        key: [...entry.keys],
        keys: [...entry.keys],
        keysecondary: [...entry.secondaryKeys],
        secondary_keys: [...entry.secondaryKeys],
        comment: entry.title,
        name: entry.title,
        content: entry.content,
        order: entry.order,
        insertion_order: entry.order,
        position: mapPositionToNumber(entry.position),
        disable: !entry.enabled,
        enabled: entry.enabled,
        constant: entry.constant,
        selective: entry.selective,
        caseSensitive: entry.caseSensitive,
        case_sensitive: entry.caseSensitive,
        matchWholeWords: entry.matchWholeWords,
        match_whole_words: entry.matchWholeWords,
        probability,
        useProbability: probability < 100
      };

      if (!isRecord(serialized.extensions)) {
        serialized.extensions = {};
      }

      entries[String(uid)] = serialized;
    }

    return {
      ok: true,
      data: {
        ...bookFields,
        name: book.name,
        description: book.description,
        entries
      },
      warnings: []
    };
  }
};
