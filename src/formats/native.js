import { APP_ID, createProject } from "../schema.js";
import { isRecord } from "./helpers.js";

export const nativeAdapter = {
  id: "native",
  label: "Lorebook Studio project",
  detect(input) {
    if (!isRecord(input)) {
      return 0;
    }

    if (input.app === APP_ID) {
      return 20;
    }

    return Array.isArray(input.books) ? 10 : 0;
  },
  parse(input) {
    if (!Array.isArray(input.books)) {
      return { ok: false, error: "That file doesn't look like a Lorebook Studio project." };
    }

    if (!input.books.length) {
      return { ok: false, error: "That project contains no lorebooks." };
    }

    return {
      ok: true,
      project: createProject(input),
      format: this.label,
      warnings: []
    };
  }
};
