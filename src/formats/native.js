import { APP_ID, SCHEMA_VERSION, createProject } from "../schema.js";
import { isRecord } from "./helpers.js";

function createBookSnapshot(book) {
  return {
    ...book,
    entries: book.entries.map((entry) => ({
      ...entry,
      keys: [...entry.keys],
      secondaryKeys: [...entry.secondaryKeys]
    }))
  };
}

export const nativeAdapter = {
  id: "native",
  label: "Lorebook Studio project",
  exportLabel: "Lorebook Studio book",
  exportDescription: "A single-book Lorebook Studio file that keeps every canonical field.",
  exportFilenameSuffix: "lorebook-studio",
  capabilities: {
    bookExport: true,
    preservesUnknownFields: true
  },
  detect(input) {
    if (!isRecord(input)) {
      return 0;
    }

    if (input.app === APP_ID) {
      return 20;
    }

    return Array.isArray(input.books) ? 10 : 0;
  },
  parse(input) {
    if (!Array.isArray(input.books)) {
      return { ok: false, error: "That file doesn't look like a Lorebook Studio project." };
    }

    if (!input.books.length) {
      return { ok: false, error: "That project contains no lorebooks." };
    }

    return {
      ok: true,
      project: createProject(input),
      format: this.label,
      warnings: []
    };
  },
  serialize(book) {
    if (!isRecord(book) || !Array.isArray(book.entries)) {
      return { ok: false, error: "There is no lorebook to export." };
    }

    const snapshot = createBookSnapshot(book);

    return {
      ok: true,
      data: {
        app: APP_ID,
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        activeBookId: snapshot.id,
        activeEntryId: snapshot.entries[0]?.id ?? null,
        books: [snapshot]
      },
      warnings: []
    };
  }
};
