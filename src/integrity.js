import { createSourceIdAllocator } from "./formats/helpers.js";
import { createProject } from "./schema.js";
import { createId } from "./utils.js";

function countDuplicates(values) {
  const counts = new Map();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.values()].filter((count) => count > 1).length;
}

function uniqueId(candidate, used, prefix) {
  const preferred = typeof candidate === "string" && candidate ? candidate : createId(prefix);

  if (!used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }

  let next = createId(prefix);

  while (used.has(next)) {
    next = createId(prefix);
  }

  used.add(next);
  return next;
}

export function checkProjectIntegrity(project) {
  if (!Array.isArray(project?.books)) {
    return {
      ok: false,
      problems: [{ code: "project", label: "Project data is unreadable", count: 1 }]
    };
  }

  const bookIds = [];
  const entryIds = [];
  const problems = [];
  let missingEntries = 0;
  let duplicateSourceIds = 0;

  for (const book of project.books) {
    bookIds.push(book?.id);

    if (!Array.isArray(book?.entries)) {
      missingEntries += 1;
      continue;
    }

    const sourceIds = new Set();

    for (const entry of book.entries) {
      entryIds.push(entry?.id);

      const sourceId = entry?.extensions?.sourceId;

      if (sourceId !== undefined && sourceId !== null && String(sourceId).trim()) {
        const key = String(sourceId);

        if (sourceIds.has(key)) {
          duplicateSourceIds += 1;
        }

        sourceIds.add(key);
      }
    }
  }

  const duplicateBookIds = countDuplicates(bookIds);
  const duplicateEntryIds = countDuplicates(entryIds);
  const activeBookMissing = Boolean(project.activeBookId)
    && !project.books.some((book) => book.id === project.activeBookId);
  const activeEntryMissing = Boolean(project.activeEntryId)
    && !project.books.some((book) => (book.entries ?? []).some((entry) => entry.id === project.activeEntryId));

  if (duplicateBookIds) {
    problems.push({ code: "duplicateBookIds", label: "Duplicate lorebook IDs", count: duplicateBookIds });
  }

  if (duplicateEntryIds) {
    problems.push({ code: "duplicateEntryIds", label: "Duplicate entry IDs", count: duplicateEntryIds });
  }

  if (duplicateSourceIds) {
    problems.push({ code: "duplicateSourceIds", label: "Duplicate source UIDs", count: duplicateSourceIds });
  }

  if (missingEntries) {
    problems.push({ code: "missingEntries", label: "Lorebooks without an entry list", count: missingEntries });
  }

  if (activeBookMissing) {
    problems.push({ code: "activeBookMissing", label: "Active lorebook reference is missing", count: 1 });
  }

  if (activeEntryMissing) {
    problems.push({ code: "activeEntryMissing", label: "Active entry reference is missing", count: 1 });
  }

  return { ok: problems.length === 0, problems };
}

export function repairProject(project) {
  const books = Array.isArray(project?.books) ? project.books : [];
  const usedBookIds = new Set();
  const usedEntryIds = new Set();

  const repairedBooks = books.map((book) => {
    const source = book && typeof book === "object" ? book : {};
    const allocateSourceId = createSourceIdAllocator();
    const entries = (Array.isArray(source.entries) ? source.entries : []).map((entry) => {
      const entrySource = entry && typeof entry === "object" ? entry : {};
      const extensions = { ...(entrySource.extensions ?? {}) };
      const sourceId = extensions.sourceId;

      if (sourceId !== undefined && sourceId !== null && String(sourceId).trim()) {
        const allocated = allocateSourceId(sourceId, sourceId);

        if (allocated.remapped) {
          extensions.sourceIdRemappedFrom = allocated.original;
        }

        extensions.sourceId = allocated.id;
      }

      return { ...entrySource, id: uniqueId(entrySource.id, usedEntryIds, "entry"), extensions };
    });

    return { ...source, id: uniqueId(source.id, usedBookIds, "book"), entries };
  });

  return createProject({ ...project, books: repairedBooks });
}
