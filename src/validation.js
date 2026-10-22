export const VALIDATION_LABELS = {
  emptyContent: "Empty content",
  duplicateKeys: "Duplicate keys",
  missingKeys: "Missing keys",
  orderCollision: "Order collision"
};

function entryLabel(entry) {
  return entry.title.trim() || "Untitled entry";
}

function normalizeKey(key) {
  return key.trim().toLocaleLowerCase();
}

export function validateBook(book) {
  if (!book?.entries?.length) {
    return [];
  }

  const keyOwners = new Map();
  const orderOwners = new Map();

  for (const entry of book.entries) {
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

    if (!orderOwners.has(entry.order)) {
      orderOwners.set(entry.order, []);
    }

    orderOwners.get(entry.order).push(entry);
  }

  const issues = [];

  for (const entry of book.entries) {
    const title = entryLabel(entry);

    if (!entry.content.trim()) {
      issues.push({
        code: "emptyContent",
        label: VALIDATION_LABELS.emptyContent,
        entryId: entry.id,
        entryTitle: title,
        message: "Add content before exporting this entry."
      });
    }

    if (!entry.constant && !entry.keys.length) {
      issues.push({
        code: "missingKeys",
        label: VALIDATION_LABELS.missingKeys,
        entryId: entry.id,
        entryTitle: title,
        message: "Add trigger keys or make the entry always on."
      });
    }

    const localKeys = new Map();
    const repeatedKeys = new Map();

    for (const key of entry.keys) {
      const normalized = normalizeKey(key);

      if (!normalized) {
        continue;
      }

      if (localKeys.has(normalized)) {
        if (!repeatedKeys.has(normalized)) {
          repeatedKeys.set(normalized, localKeys.get(normalized));
        }
      } else {
        localKeys.set(normalized, key.trim());
      }

      if ((keyOwners.get(normalized)?.size ?? 0) > 1 && !repeatedKeys.has(normalized)) {
        repeatedKeys.set(normalized, key.trim());
      }
    }

    if (repeatedKeys.size) {
      const keys = [...repeatedKeys.values()].join(", ");
      const shared = [...repeatedKeys.keys()].some((key) => (
        (keyOwners.get(key)?.size ?? 0) > 1
      ));

      issues.push({
        code: "duplicateKeys",
        label: VALIDATION_LABELS.duplicateKeys,
        entryId: entry.id,
        entryTitle: title,
        message: shared
          ? `Also used by another entry: ${keys}.`
          : `Repeated in this entry: ${keys}.`
      });
    }

    const orderGroup = orderOwners.get(entry.order) ?? [];

    if (orderGroup.length > 1) {
      issues.push({
        code: "orderCollision",
        label: VALIDATION_LABELS.orderCollision,
        entryId: entry.id,
        entryTitle: title,
        message: `Insertion order ${entry.order} is shared by ${orderGroup.length} entries.`
      });
    }
  }

  return issues;
}
