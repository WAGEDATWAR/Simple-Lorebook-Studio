import { parseProject } from "./format.js";
import { SCHEMA_VERSION } from "./schema.js";
import { createSampleProject } from "./sample.js";
import { createId } from "./utils.js";
import { createIndexedDbBackend, isIndexedDbAvailable, openDatabase } from "./storage/idb.js";

export const STORAGE_KEY = "lorebook-studio:project:v1";
export const BACKUP_KEY = "lorebook-studio:pre-import-backup:v1";
export const REVISIONS_KEY = "lorebook-studio:revisions:v1";
export const REVISION_KEY_PREFIX = "lorebook-studio:revision:v1:";

const REVISION_LIMIT = 12;
const REVISION_CHAR_BUDGET = 1_500_000;

let backend = null;
let backendName = "unavailable";
let writeChain = Promise.resolve();

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

function isQuotaError(error) {
  return error?.name === "QuotaExceededError"
    || error?.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || error?.code === 22
    || error?.code === 1014;
}

function enqueue(task) {
  const run = writeChain.then(task, task);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

function createLocalStorageBackend(storage = globalThis.localStorage) {
  return {
    name: "localstorage",
    async get(key) {
      return storage.getItem(key);
    },
    async set(key, value) {
      storage.setItem(key, value);
    },
    async remove(key) {
      storage.removeItem(key);
    },
    async keys() {
      return Object.keys(storage);
    }
  };
}

function getBackend() {
  if (!backend) {
    backend = createLocalStorageBackend();
    backendName = "localstorage";
  }

  return backend;
}

function listLocalStorageKeys() {
  try {
    return Object.keys(localStorage);
  } catch {
    return [];
  }
}

function isManagedKey(key) {
  return key === STORAGE_KEY
    || key === BACKUP_KEY
    || key === REVISIONS_KEY
    || key.startsWith(REVISION_KEY_PREFIX);
}

async function migrateFromLocalStorage(target) {
  const keys = listLocalStorageKeys().filter(isManagedKey);

  if (!keys.length) {
    return { migrated: 0, cleaned: 0 };
  }

  const existing = await target.get(STORAGE_KEY);

  if (existing !== null) {
    let cleaned = 0;

    for (const key of keys) {
      try {
        localStorage.removeItem(key);
        cleaned += 1;
      } catch {
        continue;
      }
    }

    return { migrated: 0, cleaned };
  }

  const copied = [];

  for (const key of keys) {
    let value = null;

    try {
      value = localStorage.getItem(key);
    } catch {
      value = null;
    }

    if (value === null) {
      continue;
    }

    try {
      await target.set(key, value);
      copied.push(key);
    } catch {
      continue;
    }
  }

  for (const key of copied) {
    try {
      localStorage.removeItem(key);
    } catch {
      continue;
    }
  }

  return { migrated: copied.length, cleaned: 0 };
}

export async function initStorage() {
  if (backend) {
    return { ok: true, backend: backendName, migration: null };
  }

  if (isIndexedDbAvailable()) {
    try {
      const database = await openDatabase();
      const idb = createIndexedDbBackend(database);
      const migration = await migrateFromLocalStorage(idb);
      backend = idb;
      backendName = "indexeddb";
      return { ok: true, backend: backendName, migration };
    } catch {
      backend = null;
    }
  }

  backend = createLocalStorageBackend();
  backendName = "localstorage";
  return { ok: true, backend: backendName, migration: null };
}

export function getStorageBackendName() {
  return backendName;
}

async function readRevisionIndex() {
  try {
    const raw = await getBackend().get(REVISIONS_KEY);

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

async function readBackupPayload() {
  try {
    const raw = await getBackend().get(BACKUP_KEY);

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

export async function loadProject() {
  try {
    const raw = await getBackend().get(STORAGE_KEY);

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

export async function saveProjectDetailed(state) {
  return enqueue(async () => {
    try {
      await getBackend().set(STORAGE_KEY, JSON.stringify(createProjectPayload(state)));
      return { ok: true, error: "", quotaExceeded: false };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Unknown storage error",
        quotaExceeded: isQuotaError(error)
      };
    }
  });
}

export async function saveProject(state) {
  return (await saveProjectDetailed(state)).ok;
}

export async function getRevisions() {
  return {
    ok: true,
    revisions: await readRevisionIndex()
  };
}

export async function saveRevision(state, reason = "Manual snapshot") {
  return enqueue(async () => {
    const project = createProjectPayload(state);
    const serialized = JSON.stringify(project);
    const signature = hashText(serialized);
    const revisions = await readRevisionIndex();
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
    const target = getBackend();

    try {
      await target.set(revisionKey(id), serialized);
      await target.set(REVISIONS_KEY, JSON.stringify(nextRevisions));
    } catch {
      try {
        await target.remove(revisionKey(id));
      } catch {
        return { ok: false, error: "The revision could not be saved." };
      }

      return { ok: false, error: "The revision could not be saved. Browser storage may be full." };
    }

    for (const item of removed) {
      try {
        await target.remove(revisionKey(item.id));
      } catch {
        continue;
      }
    }

    return { ok: true, revision };
  });
}

export async function loadRevision(id) {
  try {
    const raw = await getBackend().get(revisionKey(id));

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

export async function saveProjectBackup(state, reason = "") {
  return enqueue(async () => {
    try {
      const createdAt = Date.now();
      const payload = {
        version: SCHEMA_VERSION,
        createdAt,
        reason: String(reason),
        project: createProjectPayload(state)
      };

      await getBackend().set(BACKUP_KEY, JSON.stringify(payload));
      return { ok: true, createdAt };
    } catch {
      return { ok: false, error: "The pre-import backup could not be saved." };
    }
  });
}

export async function getProjectBackupInfo() {
  const result = await readBackupPayload();

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

export async function getStorageUsage() {
  const target = getBackend();
  let projectBytes = 0;
  let backupBytes = 0;
  let revisions = [];

  try {
    const raw = await target.get(STORAGE_KEY);
    projectBytes = raw ? raw.length : 0;
  } catch {
    projectBytes = 0;
  }

  try {
    const raw = await target.get(BACKUP_KEY);
    backupBytes = raw ? raw.length : 0;
  } catch {
    backupBytes = 0;
  }

  try {
    revisions = await readRevisionIndex();
  } catch {
    revisions = [];
  }

  const revisionBytes = revisions.reduce((total, revision) => (
    total + (Number.isFinite(revision.bytes) ? revision.bytes : 0)
  ), 0);
  let usage = null;
  let quota = null;

  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usage = Number.isFinite(estimate.usage) ? estimate.usage : null;
      quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
    } catch {
      usage = null;
    }
  }

  return {
    ok: true,
    backend: backendName,
    projectBytes,
    backupBytes,
    revisionCount: revisions.length,
    revisionBytes,
    usage,
    quota
  };
}

export async function loadProjectBackup() {
  const result = await readBackupPayload();

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
