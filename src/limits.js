export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_IMPORT_BOOKS = 1000;
export const MAX_IMPORT_ENTRIES = 50000;

function formatLimit(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function checkImportText(text) {
  const bytes = typeof text === "string" ? text.length : 0;

  if (bytes > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: `That file is too large (about ${formatLimit(bytes)}). The import limit is ${formatLimit(MAX_IMPORT_BYTES)}.`
    };
  }

  return { ok: true };
}

export function checkProjectLimits(project) {
  const books = Array.isArray(project?.books) ? project.books.length : 0;

  if (books > MAX_IMPORT_BOOKS) {
    return {
      ok: false,
      error: `That project has too many lorebooks (${books}). The limit is ${MAX_IMPORT_BOOKS}.`
    };
  }

  let entries = 0;

  for (const book of project?.books ?? []) {
    entries += Array.isArray(book?.entries) ? book.entries.length : 0;
  }

  if (entries > MAX_IMPORT_ENTRIES) {
    return {
      ok: false,
      error: `That project has too many entries (${entries}). The limit is ${MAX_IMPORT_ENTRIES}.`
    };
  }

  return { ok: true };
}
