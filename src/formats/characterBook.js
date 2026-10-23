import { copyPreservedFields, isRecord } from "./helpers.js";

const CHARACTER_BOOK_POSITIONS = new Set(["before_char", "after_char"]);

export const characterBookAdapter = {
  id: "characterbook",
  label: "Character book",
  exportLabel: "Character book",
  exportDescription: "A standalone character_book JSON for embedding in SillyTavern character cards.",
  exportFilenameSuffix: "character-book",
  capabilities: {
    bookExport: true,
    preservesUnknownFields: true
  },
  detect() {
    // Character-book import is handled by the Chub adapter; this adapter is export-only.
    return 0;
  },
  serialize(book) {
    if (!isRecord(book) || !Array.isArray(book.entries)) {
      return { ok: false, error: "There is no lorebook to export." };
    }

    const warnings = [];
    const bookFields = copyPreservedFields(book.extensions, this.id);
    let fallbackPositions = 0;

    const entries = book.entries.map((entry, index) => {
      const supported = CHARACTER_BOOK_POSITIONS.has(entry.position);

      if (!supported) {
        fallbackPositions += 1;
      }

      const serialized = {
        ...copyPreservedFields(entry.extensions, this.id),
        id: index,
        keys: [...entry.keys],
        secondary_keys: [...entry.secondaryKeys],
        content: entry.content,
        name: entry.title,
        comment: entry.title,
        enabled: entry.enabled,
        constant: entry.constant,
        selective: entry.selective,
        insertion_order: entry.order,
        priority: entry.order,
        position: supported ? entry.position : "before_char",
        case_sensitive: entry.caseSensitive,
        match_whole_words: entry.matchWholeWords
      };

      if (!isRecord(serialized.extensions)) {
        serialized.extensions = {};
      }

      return serialized;
    });

    if (fallbackPositions) {
      warnings.push(`${fallbackPositions} ${fallbackPositions === 1 ? "entry used" : "entries used"} a position the character book format doesn't support and ${fallbackPositions === 1 ? "was" : "were"} exported as before the character.`);
    }

    return {
      ok: true,
      data: {
        ...bookFields,
        name: book.name,
        description: book.description,
        scan_depth: 4,
        token_budget: 2048,
        recursive_scanning: false,
        extensions: {},
        entries
      },
      warnings
    };
  }
};
