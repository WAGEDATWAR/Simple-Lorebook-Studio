import { SCHEMA_VERSION } from "./schema.js";

// Ordered, append-only list of schema migrations. Each entry upgrades project
// data from `from` to `to`. Never edit a released migration; add a new one.
const MIGRATIONS = [
  {
    from: 1,
    to: 2,
    description: "Backfill entry notes and tags plus book tags and token budget.",
    migrate(data) {
      return {
        ...data,
        version: 2,
        books: (Array.isArray(data.books) ? data.books : []).map(migrateBook)
      };
    }
  }
];

function migrateBook(book) {
  const source = book && typeof book === "object" ? book : {};
  const entries = Array.isArray(source.entries) ? source.entries.map(migrateEntry) : [];

  return {
    ...source,
    tags: Array.isArray(source.tags) ? source.tags : [],
    tokenBudget: Number.isFinite(source.tokenBudget) ? source.tokenBudget : 0,
    entries
  };
}

function migrateEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : {};

  return {
    ...source,
    notes: typeof source.notes === "string" ? source.notes : "",
    tags: Array.isArray(source.tags) ? source.tags : []
  };
}

export function isMigratableProject(data) {
  return Boolean(data)
    && typeof data === "object"
    && !Array.isArray(data)
    && Array.isArray(data.books);
}

function readVersion(data) {
  return Number.isFinite(data?.version) ? Math.max(1, Math.floor(data.version)) : 1;
}

export function migrateProjectData(data) {
  if (!isMigratableProject(data)) {
    return { data, applied: [], from: null, newer: false, isProject: false };
  }

  const from = readVersion(data);
  let current = data;
  const applied = [];

  for (const migration of MIGRATIONS) {
    if (readVersion(current) === migration.from) {
      current = migration.migrate(current);
      applied.push({ from: migration.from, to: migration.to, description: migration.description });
    }
  }

  return {
    data: { ...current, version: SCHEMA_VERSION },
    applied,
    from,
    newer: from > SCHEMA_VERSION,
    isProject: true
  };
}
