import { parseProject } from "./format.js";
import { SCHEMA_VERSION } from "./schema.js";
import { createSampleProject } from "./sample.js";

export const STORAGE_KEY = "lorebook-studio:project:v1";

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
    const payload = {
      version: SCHEMA_VERSION,
      activeBookId: state.activeBookId,
      activeEntryId: state.activeEntryId,
      books: state.books
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
