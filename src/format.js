import { EXPORT_FORMATS, parseLorebookData, serializeLorebook } from "./formats/index.js";
import { APP_ID, SCHEMA_VERSION } from "./schema.js";

export { EXPORT_FORMATS, serializeLorebook };

export function parseProject(text, options = {}) {
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  return parseLorebookData(data, options);
}

export function buildExport(state) {
  return {
    app: APP_ID,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    activeBookId: state.activeBookId,
    activeEntryId: state.activeEntryId,
    books: state.books.map((book) => ({
      id: book.id,
      name: book.name,
      description: book.description,
      tags: [...(book.tags ?? [])],
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      extensions: { ...book.extensions },
      entries: book.entries.map((entry) => ({ ...entry }))
    }))
  };
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
