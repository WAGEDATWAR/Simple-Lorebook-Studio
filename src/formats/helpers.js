import { createProject } from "../schema.js";

const POSITION_MAP = new Map([
  [0, "before_char"],
  [1, "after_char"],
  [2, "before_an"],
  [3, "after_an"],
  [4, "at_depth"],
  ["before_char", "before_char"],
  ["after_char", "after_char"],
  ["before_an", "before_an"],
  ["after_an", "after_an"],
  ["at_depth", "at_depth"],
  ["before", "before_char"],
  ["after", "after_char"],
  ["an_top", "before_an"],
  ["an_bottom", "after_an"]
]);

const POSITION_TO_NUMBER = new Map([
  ["before_char", 0],
  ["after_char", 1],
  ["before_an", 2],
  ["after_an", 3],
  ["at_depth", 4]
]);

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const HANDLED_ENTRY_KEYS = new Set([
  "uid",
  "id",
  "key",
  "keys",
  "keysecondary",
  "secondary_keys",
  "comment",
  "name",
  "content",
  "disable",
  "enabled",
  "constant",
  "selective",
  "caseSensitive",
  "case_sensitive",
  "matchWholeWords",
  "match_whole_words",
  "order",
  "insertion_order",
  "insertorder",
  "position",
  "probability"
]);

export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function hasOwn(value, key) {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

export function readString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function readNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function readBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function readKeyList(value) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return list
    .map((key) => String(key).trim())
    .filter(Boolean);
}

export function mapPosition(value) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const mapped = POSITION_MAP.get(normalized);

    if (mapped) {
      return mapped;
    }

    if (normalized && Number.isFinite(Number(normalized))) {
      return POSITION_MAP.get(Number(normalized)) ?? null;
    }

    return null;
  }

  return POSITION_MAP.get(value) ?? null;
}

export function mapPositionToNumber(value) {
  return POSITION_TO_NUMBER.get(value) ?? 0;
}

export function copyPreservedFields(extensions, formatId) {
  const fields = extensions?.source === formatId ? extensions.sourceFields : null;

  if (!isRecord(fields)) {
    return {};
  }

  const result = {};

  for (const [key, value] of Object.entries(fields)) {
    if (!UNSAFE_KEYS.has(key)) {
      result[key] = value;
    }
  }

  return result;
}

export function createUidAllocator() {
  const used = new Set();

  return (entry) => {
    const sourceId = entry?.extensions?.sourceId;
    const parsed = Number(sourceId);
    let uid = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;

    while (used.has(uid)) {
      uid += 1;
    }

    used.add(uid);
    return uid;
  };
}

export function createSourceIdAllocator() {
  const used = new Set();

  return (value, fallback) => {
    const original = String(value ?? fallback ?? "").trim() || String(fallback ?? "");
    const parsed = Number(original);
    let id = original;

    if (Number.isInteger(parsed) && parsed >= 0) {
      let numeric = parsed;

      while (used.has(String(numeric))) {
        numeric += 1;
      }

      id = String(numeric);
    } else {
      let suffix = 2;

      while (used.has(id)) {
        id = `${original}~${suffix}`;
        suffix += 1;
      }
    }

    used.add(id);

    return {
      id,
      original,
      remapped: id !== original
    };
  };
}

export function resolveLorebook(input) {
  if (!isRecord(input)) {
    return null;
  }

  if (isRecord(input.data)) {
    if (isRecord(input.data.character_book)) {
      return { book: input.data.character_book, wrapper: input };
    }

    if (isRecord(input.data.lorebook)) {
      return { book: input.data.lorebook, wrapper: input };
    }

    if ((input.spec === "lorebook_v3" || input.type === "lorebook") && isEntryCollection(input.data.entries)) {
      return { book: input.data, wrapper: input };
    }
  }

  if (isRecord(input.character_book)) {
    return { book: input.character_book, wrapper: input };
  }

  if (isRecord(input.lorebook)) {
    return { book: input.lorebook, wrapper: input };
  }

  if (isEntryCollection(input.entries)) {
    return { book: input, wrapper: null };
  }

  return null;
}

export function isEntryCollection(value) {
  return Array.isArray(value) || isRecord(value);
}

export function getEntryItems(entries) {
  if (Array.isArray(entries)) {
    return entries.map((entry, index) => ({
      entry,
      sourceKey: String(index + 1)
    }));
  }

  if (isRecord(entries)) {
    return Object.entries(entries).map(([sourceKey, entry]) => ({
      entry,
      sourceKey
    }));
  }

  return [];
}

export function collectSourceFields(entry) {
  const fields = {};

  for (const [key, value] of Object.entries(entry)) {
    if (!HANDLED_ENTRY_KEYS.has(key) && !UNSAFE_KEYS.has(key)) {
      fields[key] = value;
    }
  }

  return fields;
}

function unwrapFilename(filename) {
  if (!filename) {
    return "";
  }

  return String(filename)
    .split(/[\\/]/)
    .pop()
    .replace(/\.json$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function wrapLabel(value) {
  return typeof value === "string" ? value : "";
}

function normalizeEntry(entry, sourceKey, formatId, warnings, allocateSourceId) {
  const characterBookKeys = readKeyList(entry.keys);
  const secondaryCharacterBookKeys = readKeyList(entry.secondary_keys);
  const keys = characterBookKeys.length ? characterBookKeys : readKeyList(entry.key);
  const secondaryKeys = secondaryCharacterBookKeys.length
    ? secondaryCharacterBookKeys
    : readKeyList(entry.keysecondary);
  const title = wrapLabel(entry.name) || wrapLabel(entry.comment) || keys.join(", ");
  const enabled = hasOwn(entry, "disable")
    ? entry.disable !== true
    : readBoolean(entry.enabled, true);
  const rawPosition = entry.position;
  const position = mapPosition(rawPosition);
  const order = readNumber(entry.order, entry.insertion_order, entry.insertorder, entry.priority);
  const probability = readNumber(entry.probability);
  const useProbability = !hasOwn(entry, "useProbability") || entry.useProbability !== false;
  const sourceId = allocateSourceId(entry.uid ?? entry.id ?? sourceKey, sourceKey);

  if (sourceId.remapped) {
    warnings.sourceIds += 1;
  }

  if (rawPosition !== undefined && rawPosition !== null && !position) {
    warnings.positions += 1;
  }

  return {
    title,
    keys,
    secondaryKeys,
    content: wrapLabel(entry.content),
    enabled,
    constant: readBoolean(entry.constant),
    selective: readBoolean(entry.selective),
    caseSensitive: hasOwn(entry, "caseSensitive")
      ? readBoolean(entry.caseSensitive)
      : readBoolean(entry.case_sensitive),
    matchWholeWords: hasOwn(entry, "matchWholeWords")
      ? readBoolean(entry.matchWholeWords)
      : readBoolean(entry.match_whole_words),
    order: order ?? 100,
    position: position ?? "before_char",
    probability: useProbability ? probability ?? 100 : 100,
    extensions: {
      source: formatId,
      sourceId: sourceId.id,
      ...(sourceId.remapped ? { sourceIdRemappedFrom: sourceId.original } : {}),
      sourceFields: collectSourceFields(entry)
    }
  };
}

function collectBookFields(book) {
  const fields = {};

  for (const [key, value] of Object.entries(book)) {
    if (!["name", "title", "description", "entries"].includes(key) && !UNSAFE_KEYS.has(key)) {
      fields[key] = value;
    }
  }

  return fields;
}

export function normalizeLorebook(input, options) {
  const resolved = resolveLorebook(input);

  if (!resolved) {
    return { ok: false, error: "That JSON file doesn't contain a readable lorebook." };
  }

  const { book: source, wrapper } = resolved;
  const warnings = {
    positions: 0,
    skipped: 0,
    sourceIds: 0
  };
  const entries = [];
  const allocateSourceId = createSourceIdAllocator();

  for (const item of getEntryItems(source.entries)) {
    if (!isRecord(item.entry)) {
      warnings.skipped += 1;
      continue;
    }

    entries.push(normalizeEntry(item.entry, item.sourceKey, options.formatId, warnings, allocateSourceId));
  }

  const notes = [];
  const name = readString(source.name)
    || readString(source.title)
    || readString(wrapper?.data?.name)
    || readString(wrapper?.name)
    || unwrapFilename(options.filename)
    || "Imported Lorebook";
  const description = readString(source.description);

  if (!entries.length) {
    notes.push("This lorebook contains no entries.");
  }

  if (warnings.positions) {
    notes.push(`${warnings.positions} ${warnings.positions === 1 ? "entry used" : "entries used"} an unsupported position and ${warnings.positions === 1 ? "was" : "were"} placed before the character.`);
  }

  if (warnings.skipped) {
    notes.push(`${warnings.skipped} malformed ${warnings.skipped === 1 ? "entry was" : "entries were"} skipped.`);
  }

  if (warnings.sourceIds) {
    notes.push(`${warnings.sourceIds} duplicate source ${warnings.sourceIds === 1 ? "UID was" : "UIDs were"} remapped to keep exports unique.`);
  }

  const extensions = {
    source: options.formatId,
    fileName: options.filename || null,
    sourceFields: collectBookFields(source)
  };

  return {
    ok: true,
    project: createProject({
      books: [{
        name,
        description,
        entries,
        extensions
      }]
    }),
    format: options.formatLabel,
    warnings: notes
  };
}
