import { isRegexKey, parseRegexKey } from "./keys.js";

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function keyMatches(text, key, entry = {}) {
  const value = String(text ?? "");

  if (isRegexKey(key)) {
    const parsed = parseRegexKey(key);

    if (parsed.ok) {
      return parsed.regex.test(value);
    }

    return value.toLowerCase().includes(String(key).toLowerCase());
  }

  const escaped = escapeRegExp(key);
  const pattern = entry.matchWholeWords
    ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`
    : escaped;
  const flags = `u${entry.caseSensitive ? "" : "i"}`;

  try {
    return new RegExp(pattern, flags).test(value);
  } catch {
    return value.toLowerCase().includes(String(key).toLowerCase());
  }
}

export const SIMULATION_REASONS = {
  disabled: "Disabled",
  noKeys: "No trigger keys",
  noMatch: "No trigger key matched",
  selective: "Secondary key not matched",
  alwaysOn: "Always on",
  key: "Trigger key matched"
};

export function simulateContext(book, contextText) {
  const text = String(contextText ?? "");
  const entries = book?.entries ?? [];
  const activated = [];
  const skipped = [];

  for (const entry of entries) {
    if (!entry.enabled) {
      skipped.push({ entry, reason: "disabled" });
      continue;
    }

    if (entry.constant) {
      activated.push({ entry, matchedKeys: [], matchedSecondary: [], reason: "alwaysOn" });
      continue;
    }

    if (!entry.keys.length) {
      skipped.push({ entry, reason: "noKeys" });
      continue;
    }

    const matchedKeys = entry.keys.filter((key) => keyMatches(text, key, entry));

    if (!matchedKeys.length) {
      skipped.push({ entry, reason: "noMatch" });
      continue;
    }

    let matchedSecondary = [];

    if (entry.selective && entry.secondaryKeys.length) {
      matchedSecondary = entry.secondaryKeys.filter((key) => keyMatches(text, key, entry));

      if (!matchedSecondary.length) {
        skipped.push({ entry, reason: "selective" });
        continue;
      }
    }

    activated.push({ entry, matchedKeys, matchedSecondary, reason: "key" });
  }

  activated.sort((left, right) => left.entry.order - right.entry.order);

  return {
    context: text,
    activated,
    skipped,
    injectedText: activated.map((item) => item.entry.content).filter(Boolean).join("\n\n")
  };
}
