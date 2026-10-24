const QUERY_FIELDS = [
  { key: "title", label: "title", read: (entry) => entry.title },
  { key: "content", label: "content", read: (entry) => entry.content },
  { key: "notes", label: "notes", read: (entry) => entry.notes ?? "" },
  { key: "keys", label: "keys", read: (entry) => entry.keys.join(", ") },
  { key: "secondaryKeys", label: "secondary keys", read: (entry) => entry.secondaryKeys.join(", ") },
  { key: "tags", label: "tags", read: (entry) => (entry.tags ?? []).join(", ") }
];

export function analyzeEntryQuery(entry, query) {
  const needle = String(query ?? "").trim().toLowerCase();

  if (!needle) {
    return { matched: true, fields: [] };
  }

  const fields = QUERY_FIELDS
    .filter((field) => String(field.read(entry)).toLowerCase().includes(needle))
    .map((field) => field.label);

  return { matched: fields.length > 0, fields };
}

export function searchProject(project, query) {
  const needle = String(query ?? "").trim().toLowerCase();
  const groups = [];
  let total = 0;

  if (!needle) {
    return { query: needle, total, groups };
  }

  for (const book of project?.books ?? []) {
    const entries = [];

    for (const entry of book.entries ?? []) {
      const match = analyzeEntryQuery(entry, needle);

      if (match.matched) {
        entries.push({ entry, fields: match.fields });
        total += 1;
      }
    }

    if (entries.length) {
      groups.push({ book, entries });
    }
  }

  return { query: needle, total, groups };
}
