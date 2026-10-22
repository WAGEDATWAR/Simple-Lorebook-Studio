import { parseProject } from "./format.js";
import { SCHEMA_VERSION } from "./schema.js";
import { createSampleProject } from "./sample.js";

export const STORAGE_KEY = "lorebook-studio:project:v1";
export const BACKUP_KEY = "lorebook-studio:pre-import-backup:v1";

function createProjectPayload(state) {
  return {
    version: SCHEMA_VERSION,
    activeBookId: state.activeBookId,
    activeEntryId: state.activeEntryId,
    books: state.books
  };
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
