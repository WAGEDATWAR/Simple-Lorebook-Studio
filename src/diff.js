import { POSITIONS } from "./schema.js";

const POSITION_LABELS = new Map(POSITIONS.map((position) => [position.value, position.label]));

const BOOK_FIELDS = [
  { key: "name", label: "Name", kind: "text" },
  { key: "description", label: "Description", kind: "long" },
  { key: "tags", label: "Tags", kind: "list" }
];

const ENTRY_FIELDS = [
  { key: "title", label: "Title", kind: "text" },
  { key: "keys", label: "Trigger keys", kind: "list" },
  { key: "secondaryKeys", label: "Secondary keys", kind: "list" },
  { key: "tags", label: "Tags", kind: "list" },
  { key: "content", label: "Content", kind: "long" },
  { key: "notes", label: "Author notes", kind: "long" },
  { key: "enabled", label: "Enabled", kind: "boolean" },
  { key: "constant", label: "Always on", kind: "boolean" },
  { key: "selective", label: "Selective", kind: "boolean" },
  { key: "caseSensitive", label: "Case sensitive", kind: "boolean" },
  { key: "matchWholeWords", label: "Match whole words", kind: "boolean" },
  { key: "order", label: "Insertion order", kind: "number" },
  { key: "position", label: "Position", kind: "position" },
  { key: "probability", label: "Trigger chance", kind: "percent" }
];

function normalizeName(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function normalizeSourceId(entry) {
  const value = entry?.extensions?.sourceId;

  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function sameValue(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => String(value) === String(right[index]));
  }

  return Object.is(left, right);
}

function formatValue(field, value) {
  if (field.kind === "list") {
    return Array.isArray(value) && value.length ? value.join(", ") : "None";
  }

  if (field.kind === "boolean") {
    return value ? "On" : "Off";
  }

  if (field.kind === "position") {
    return POSITION_LABELS.get(value) ?? String(value ?? "Before character");
  }

  if (field.kind === "percent") {
    return `${Number(value) || 0}%`;
  }

  return String(value ?? "");
}

function createFieldChange(field, before, after) {
  return {
    key: field.key,
    label: field.label,
    kind: field.kind,
    before,
    after,
    beforeLabel: formatValue(field, before),
    afterLabel: formatValue(field, after),
    lines: field.kind === "long" ? diffText(before, after) : null
  };
}

function diffFields(before, after, fields) {
  const changes = [];

  for (const field of fields) {
    if (!sameValue(before?.[field.key], after?.[field.key])) {
      changes.push(createFieldChange(field, before?.[field.key], after?.[field.key]));
    }
  }

  return changes;
}

function pushLine(lines, type, text, beforeLine, afterLine) {
  lines.push({ type, text, beforeLine, afterLine });
}

function appendFallback(lines, beforeLines, afterLines, beforeStart, afterStart) {
  let beforeLine = beforeStart;
  let afterLine = afterStart;

  for (const text of beforeLines) {
    pushLine(lines, "remove", text, beforeLine, null);
    beforeLine += 1;
  }

  for (const text of afterLines) {
    pushLine(lines, "add", text, null, afterLine);
    afterLine += 1;
  }
}

function appendLcs(lines, beforeLines, afterLines, beforeStart, afterStart) {
  const width = afterLines.length + 1;
  const cells = (beforeLines.length + 1) * width;

  if (cells > 250000) {
    appendFallback(lines, beforeLines, afterLines, beforeStart, afterStart);
    return;
  }

  const table = new Uint32Array(cells);

  for (let beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
      const index = beforeIndex * width + afterIndex;

      if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
        table[index] = table[(beforeIndex + 1) * width + afterIndex + 1] + 1;
      } else {
        table[index] = Math.max(
          table[(beforeIndex + 1) * width + afterIndex],
          table[beforeIndex * width + afterIndex + 1]
        );
      }
    }
  }

  let beforeIndex = 0;
  let afterIndex = 0;
  let beforeLine = beforeStart;
  let afterLine = afterStart;

  while (beforeIndex < beforeLines.length && afterIndex < afterLines.length) {
    if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
      pushLine(lines, "same", beforeLines[beforeIndex], beforeLine, afterLine);
      beforeIndex += 1;
      afterIndex += 1;
      beforeLine += 1;
      afterLine += 1;
      continue;
    }

    const removeScore = table[(beforeIndex + 1) * width + afterIndex];
    const addScore = table[beforeIndex * width + afterIndex + 1];

    if (removeScore >= addScore) {
      pushLine(lines, "remove", beforeLines[beforeIndex], beforeLine, null);
      beforeIndex += 1;
      beforeLine += 1;
    } else {
      pushLine(lines, "add", afterLines[afterIndex], null, afterLine);
      afterIndex += 1;
      afterLine += 1;
    }
  }

  while (beforeIndex < beforeLines.length) {
    pushLine(lines, "remove", beforeLines[beforeIndex], beforeLine, null);
    beforeIndex += 1;
    beforeLine += 1;
  }

  while (afterIndex < afterLines.length) {
    pushLine(lines, "add", afterLines[afterIndex], null, afterLine);
    afterIndex += 1;
    afterLine += 1;
  }
}

export function diffText(before, after) {
  const beforeText = String(before ?? "");
  const afterText = String(after ?? "");

  if (beforeText === afterText) {
    return beforeText ? beforeText.split("\n").map((text, index) => ({
      type: "same",
      text,
      beforeLine: index + 1,
      afterLine: index + 1
    })) : [];
  }

  const beforeLines = beforeText ? beforeText.split("\n") : [];
  const afterLines = afterText ? afterText.split("\n") : [];
  let prefix = 0;

  while (
    prefix < beforeLines.length
    && prefix < afterLines.length
    && beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;

  while (
    suffix < beforeLines.length - prefix
    && suffix < afterLines.length - prefix
    && beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const lines = [];

  for (let index = 0; index < prefix; index += 1) {
    pushLine(lines, "same", beforeLines[index], index + 1, index + 1);
  }

  const beforeMiddle = beforeLines.slice(prefix, beforeLines.length - suffix);
  const afterMiddle = afterLines.slice(prefix, afterLines.length - suffix);

  appendLcs(lines, beforeMiddle, afterMiddle, prefix + 1, prefix + 1);

  for (let index = suffix; index > 0; index -= 1) {
    const line = beforeLines[beforeLines.length - index];
    pushLine(
      lines,
      "same",
      line,
      beforeLines.length - index + 1,
      afterLines.length - index + 1
    );
  }

  return lines;
}

function matchBooks(beforeBooks, afterBooks) {
  const matches = new Map();
  const usedBefore = new Set();

  for (let afterIndex = 0; afterIndex < afterBooks.length; afterIndex += 1) {
    const id = afterBooks[afterIndex]?.id;
    const beforeIndex = beforeBooks.findIndex((book, index) => (
      !usedBefore.has(index) && id && book?.id === id
    ));

    if (beforeIndex >= 0) {
      matches.set(afterIndex, beforeIndex);
      usedBefore.add(beforeIndex);
    }
  }

  for (let afterIndex = 0; afterIndex < afterBooks.length; afterIndex += 1) {
    if (matches.has(afterIndex)) {
      continue;
    }

    const name = normalizeName(afterBooks[afterIndex]?.name);

    if (!name) {
      continue;
    }

    const beforeCandidates = beforeBooks
      .map((book, index) => ({ book, index }))
      .filter((candidate) => !usedBefore.has(candidate.index) && normalizeName(candidate.book?.name) === name);
    const afterCandidates = afterBooks.filter((book, index) => (
      !matches.has(index) && normalizeName(book?.name) === name
    ));

    if (beforeCandidates.length === 1 && afterCandidates.length === 1) {
      matches.set(afterIndex, beforeCandidates[0].index);
      usedBefore.add(beforeCandidates[0].index);
    }
  }

  return matches;
}

function matchEntries(beforeEntries, afterEntries) {
  const matches = new Map();
  const usedBefore = new Set();

  function matchBy(readKey) {
    for (let afterIndex = 0; afterIndex < afterEntries.length; afterIndex += 1) {
      if (matches.has(afterIndex)) {
        continue;
      }

      const key = readKey(afterEntries[afterIndex]);

      if (!key) {
        continue;
      }

      const beforeCandidates = beforeEntries
        .map((entry, index) => ({ entry, index }))
        .filter((candidate) => !usedBefore.has(candidate.index) && readKey(candidate.entry) === key);
      const afterCandidates = afterEntries.filter((entry, index) => (
        !matches.has(index) && readKey(entry) === key
      ));

      if (beforeCandidates.length === 1 && afterCandidates.length === 1) {
        matches.set(afterIndex, beforeCandidates[0].index);
        usedBefore.add(beforeCandidates[0].index);
      }
    }
  }

  matchBy((entry) => (entry?.id ? String(entry.id) : ""));
  matchBy(normalizeSourceId);
  matchBy((entry) => normalizeName(entry?.title));

  return matches;
}

function createEntryDiff(beforeEntry, afterEntry) {
  if (!beforeEntry) {
    return {
      status: "added",
      title: afterEntry?.title?.trim() || "Untitled entry",
      before: null,
      after: afterEntry,
      changes: []
    };
  }

  if (!afterEntry) {
    return {
      status: "removed",
      title: beforeEntry.title?.trim() || "Untitled entry",
      before: beforeEntry,
      after: null,
      changes: []
    };
  }

  const changes = diffFields(beforeEntry, afterEntry, ENTRY_FIELDS);

  return {
    status: changes.length ? "changed" : "unchanged",
    title: afterEntry.title?.trim() || beforeEntry.title?.trim() || "Untitled entry",
    before: beforeEntry,
    after: afterEntry,
    changes
  };
}

function createBookDiff(beforeBook, afterBook) {
  if (!beforeBook) {
    return {
      status: "added",
      name: afterBook?.name?.trim() || "Untitled Lorebook",
      before: null,
      after: afterBook,
      changes: [],
      entries: (afterBook?.entries ?? []).map((entry) => createEntryDiff(null, entry))
    };
  }

  if (!afterBook) {
    return {
      status: "removed",
      name: beforeBook.name?.trim() || "Untitled Lorebook",
      before: beforeBook,
      after: null,
      changes: [],
      entries: (beforeBook.entries ?? []).map((entry) => createEntryDiff(entry, null))
    };
  }

  const changes = diffFields(beforeBook, afterBook, BOOK_FIELDS);
  const matches = matchEntries(beforeBook.entries ?? [], afterBook.entries ?? []);
  const usedBefore = new Set(matches.values());
  const entries = [];

  for (let afterIndex = 0; afterIndex < (afterBook.entries ?? []).length; afterIndex += 1) {
    const beforeIndex = matches.get(afterIndex);
    entries.push(createEntryDiff(
      beforeIndex === undefined ? null : beforeBook.entries[beforeIndex],
      afterBook.entries[afterIndex]
    ));
  }

  for (let beforeIndex = 0; beforeIndex < (beforeBook.entries ?? []).length; beforeIndex += 1) {
    if (!usedBefore.has(beforeIndex)) {
      entries.push(createEntryDiff(beforeBook.entries[beforeIndex], null));
    }
  }

  const changed = changes.length > 0 || entries.some((entry) => entry.status !== "unchanged");

  return {
    status: changed ? "changed" : "unchanged",
    name: afterBook.name?.trim() || beforeBook.name?.trim() || "Untitled Lorebook",
    before: beforeBook,
    after: afterBook,
    changes,
    entries
  };
}

function createSummary() {
  return {
    booksAdded: 0,
    booksRemoved: 0,
    booksChanged: 0,
    booksMetadataChanged: 0,
    booksUnchanged: 0,
    entriesAdded: 0,
    entriesRemoved: 0,
    entriesChanged: 0,
    entriesUnchanged: 0,
    fieldsChanged: 0
  };
}

export function diffProjects(beforeProject, afterProject) {
  const beforeBooks = Array.isArray(beforeProject?.books) ? beforeProject.books : [];
  const afterBooks = Array.isArray(afterProject?.books) ? afterProject.books : [];
  const matches = matchBooks(beforeBooks, afterBooks);
  const usedBefore = new Set(matches.values());
  const summary = createSummary();
  const books = [];

  function addBook(bookDiff) {
    books.push(bookDiff);

    if (bookDiff.status === "added") {
      summary.booksAdded += 1;
    } else if (bookDiff.status === "removed") {
      summary.booksRemoved += 1;
    } else if (bookDiff.status === "changed") {
      summary.booksChanged += 1;

      if (bookDiff.changes.length) {
        summary.booksMetadataChanged += 1;
      }
    } else {
      summary.booksUnchanged += 1;
    }

    summary.fieldsChanged += bookDiff.changes.length;

    for (const entry of bookDiff.entries) {
      if (entry.status === "added") {
        summary.entriesAdded += 1;
      } else if (entry.status === "removed") {
        summary.entriesRemoved += 1;
      } else if (entry.status === "changed") {
        summary.entriesChanged += 1;
      } else {
        summary.entriesUnchanged += 1;
      }

      summary.fieldsChanged += entry.changes.length;
    }
  }

  for (let afterIndex = 0; afterIndex < afterBooks.length; afterIndex += 1) {
    const beforeIndex = matches.get(afterIndex);
    addBook(createBookDiff(
      beforeIndex === undefined ? null : beforeBooks[beforeIndex],
      afterBooks[afterIndex]
    ));
  }

  for (let beforeIndex = 0; beforeIndex < beforeBooks.length; beforeIndex += 1) {
    if (!usedBefore.has(beforeIndex)) {
      addBook(createBookDiff(beforeBooks[beforeIndex], null));
    }
  }

  const hasChanges = (
    summary.booksAdded
    + summary.booksRemoved
    + summary.booksChanged
    + summary.entriesAdded
    + summary.entriesRemoved
    + summary.entriesChanged
  ) > 0;

  return {
    summary,
    books,
    hasChanges
  };
}
