import { getTextStats } from "./utils.js";

function summarize(entries) {
  return entries.reduce((totals, entry) => {
    const stats = getTextStats(entry.content);

    return {
      chars: totals.chars + stats.chars,
      words: totals.words + stats.words,
      tokens: totals.tokens + stats.tokens
    };
  }, { chars: 0, words: 0, tokens: 0 });
}

function normalizeKey(key) {
  return key.trim().toLocaleLowerCase();
}

export function buildBookOverview(book) {
  const entries = book?.entries ?? [];
  const enabledEntries = entries.filter((entry) => entry.enabled);
  const keyOwners = new Map();
  let covered = 0;
  let missingKeys = 0;
  let alwaysOn = 0;
  let longestEntry = null;

  for (const entry of entries) {
    const localKeys = new Set();

    for (const key of entry.keys) {
      const normalized = normalizeKey(key);

      if (!normalized || localKeys.has(normalized)) {
        continue;
      }

      localKeys.add(normalized);

      if (!keyOwners.has(normalized)) {
        keyOwners.set(normalized, new Set());
      }

      keyOwners.get(normalized).add(entry.id);
    }

    if (entry.keys.length) {
      covered += 1;
    }

    if (!entry.constant && !entry.keys.length) {
      missingKeys += 1;
    }

    if (entry.constant) {
      alwaysOn += 1;
    }

    if (!longestEntry || entry.content.length > longestEntry.chars) {
      longestEntry = {
        id: entry.id,
        title: entry.title.trim() || "Untitled entry",
        chars: entry.content.length
      };
    }
  }

  const totals = summarize(entries);
  const enabledTotals = summarize(enabledEntries);
  const uniqueKeys = keyOwners.size;
  const sharedKeys = [...keyOwners.values()].filter((owners) => owners.size > 1).length;

  return {
    entries: entries.length,
    enabled: enabledEntries.length,
    disabled: entries.length - enabledEntries.length,
    alwaysOn,
    covered,
    missingKeys,
    coverage: entries.length ? covered / entries.length : 0,
    uniqueKeys,
    sharedKeys,
    totals,
    enabledTotals,
    averageTokens: entries.length ? Math.round(totals.tokens / entries.length) : 0,
    longestEntry: longestEntry && longestEntry.chars ? {
      ...longestEntry,
      tokens: Math.ceil(longestEntry.chars / 4)
    } : null
  };
}
