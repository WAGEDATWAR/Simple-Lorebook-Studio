import { parseProject } from "./format.js";
import { SCHEMA_VERSION } from "./schema.js";
import { createSampleProject } from "./sample.js";
import { createId } from "./utils.js";

export const STORAGE_KEY = "lorebook-studio:project:v1";
export const BACKUP_KEY = "lorebook-studio:pre-import-backup:v1";
export const REVISIONS_KEY = "lorebook-studio:revisions:v1";
export const REVISION_KEY_PREFIX = "lorebook-studio:revision:v1:";

const REVISION_LIMIT = 12;
const REVISION_CHAR_BUDGET = 1_500_000;

function createProjectPayload(state) {
  return {
    version: SCHEMA_VERSION,
    activeBookId: state.activeBookId,
    activeEntryId: state.activeEntryId,
    books: state.books
  };
}

function revisionKey(id) {
  return `${REVISION_KEY_PREFIX}${id}`;
}

function hashText(text) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

function countProject(project) {
  return {
    books: project.books.length,
    entries: project.books.reduce((total, book) => (
      total + (Array.isArray(book.entries) ? book.entries.length : 0)
    ), 0)
  };
}

function readRevisionIndex() {
  try {
    const raw = localStorage.getItem(REVISIONS_KEY);

    if (!raw) {
      return [];
    }

    const revisions = JSON.parse(raw);

    if (!Array.isArray(revisions)) {
      return [];
    }

    return revisions.filter((revision) => (
      revision
      && typeof revision.id === "string"
      && Number.isFinite(revision.createdAt)
    ));
  } catch {
    return [];
  }
}

function trimRevisions(revisions) {
  const kept = [];
  let totalBytes = 0;

  for (const revision of revisions) {
    if (kept.length >= REVISION_LIMIT) {
      break;
    }

    const bytes = Number.isFinite(revision.bytes) ? revision.bytes : 0;

    if (kept.length && totalBytes + bytes > REVISION_CHAR_BUDGET) {
      break;
    }

    kept.push(revision);
    totalBytes += bytes;
  }

  return kept;
}

function readBackupPayload() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);

    if (!raw) {
      return { ok: false, error: "No pre-import backup is available." };
    }

    const payload = JSON.parse(raw);

    if (!payload || typeof payload !== "object" || !payload.project || !Array.isArray(payload.project.books)) {
      return { ok: false, error: "The pre-import backup is unreadable." };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, error: "The pre-import backup is unreadable." };
  }
}

export function loadProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const result = parseProject(raw);

      if (result.ok) {
        return result.project;
      }
    }
  } catch {
    return createSampleProject();
  }

  return createSampleProject();
}

export function saveProject(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createProjectPayload(state)));
    return true;
  } catch {
    return false;
  }
}

export function getRevisions() {
  return {
    ok: true,
    revisions: readRevisionIndex()
  };
}

export function saveRevision(state, reason = "Manual snapshot") {
  const project = createProjectPayload(state);
  const serialized = JSON.stringify(project);
  const signature = hashText(serialized);
  const revisions = readRevisionIndex();
  const latest = revisions[0] ?? null;

  if (latest?.signature === signature) {
    return {
      ok: true,
      skipped: true,
      revision: latest,
      error: "No changes since the last revision."
    };
  }

  if (serialized.length > REVISION_CHAR_BUDGET) {
    return {
      ok: false,
      error: "This project is too large for a local snapshot. Export a project backup instead."
    };
  }

  const id = createId("revision");
  const createdAt = Date.now();
  const counts = countProject(project);
  const revision = {
    id,
    createdAt,
    reason: String(reason).trim().slice(0, 120) || "Snapshot",
    books: counts.books,
    entries: counts.entries,
    signature,
    bytes: serialized.length
  };
  const nextRevisions = trimRevisions([revision, ...revisions]);
  const keptIds = new Set(nextRevisions.map((item) => item.id));
  const removed = revisions.filter((item) => !keptIds.has(item.id));

  try {
    localStorage.setItem(revisionKey(id), serialized);
    localStorage.setItem(REVISIONS_KEY, JSON.stringify(nextRevisions));
  } catch {
    try {
      localStorage.removeItem(revisionKey(id));
    } catch {
      return { ok: false, error: "The revision could not be saved." };
    }

    return { ok: false, error: "The revision could not be saved. Browser storage may be full." };
  }

  for (const item of removed) {
    try {
      localStorage.removeItem(revisionKey(item.id));
    } catch {
      continue;
    }
  }

  return { ok: true, revision };
}

export function loadRevision(id) {
  try {
    const raw = localStorage.getItem(revisionKey(id));

    if (!raw) {
      return { ok: false, error: "That revision is no longer available." };
    }

    const parsed = parseProject(raw);

    if (!parsed.ok) {
      return { ok: false, error: parsed.error || "That revision is unreadable." };
    }

    return {
      ok: true,
      project: parsed.project
    };
  } catch {
    return { ok: false, error: "That revision is unreadable." };
  }
}

export function saveProjectBackup(state, reason = "") {
  try {
    const createdAt = Date.now();
    const payload = {
      version: SCHEMA_VERSION,
      createdAt,
      reason: String(reason),
      project: createProjectPayload(state)
    };

    localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
    return { ok: true, createdAt };
  } catch {
    return { ok: false, error: "The pre-import backup could not be saved." };
  }
}

export function getProjectBackupInfo() {
  const result = readBackupPayload();

  if (!result.ok) {
    return result;
  }

  const { payload } = result;
  const books = payload.project.books.length;
  const entries = payload.project.books.reduce((total, book) => (
    total + (Array.isArray(book.entries) ? book.entries.length : 0)
  ), 0);

  return {
    ok: true,
    createdAt: Number(payload.createdAt) || null,
    reason: typeof payload.reason === "string" ? payload.reason : "",
    books,
    entries
  };
}

export function loadProjectBackup() {
  const result = readBackupPayload();

  if (!result.ok) {
    return result;
  }

  const { payload } = result;
  const parsed = parseProject(JSON.stringify(payload.project));

  if (!parsed.ok) {
    return { ok: false, error: parsed.error || "The pre-import backup is unreadable." };
  }

  return {
    ok: true,
    project: parsed.project,
    createdAt: Number(payload.createdAt) || null,
    reason: typeof payload.reason === "string" ? payload.reason : ""
  };
}
