import { analyzeEntryQuery } from "../search.js";
import { getActiveBook, getSelectedEntryIds, getState } from "../store.js";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function entryLabel(entry) {
  return entry.title.trim() || "Untitled entry";
}

function keySummary(entry) {
  if (!entry.keys.length) {
    return "No trigger keys";
  }

  const visible = entry.keys.slice(0, 3).join(" · ");
  const remaining = entry.keys.length - 3;
  return remaining > 0 ? `${visible} +${remaining}` : visible;
}

function matchesFilters(entry, filters) {
  if (filters.enabled && !entry.enabled) {
    return false;
  }

  if (filters.disabled && entry.enabled) {
    return false;
  }

  if (filters.alwaysOn && !entry.constant) {
    return false;
  }

  if (filters.missingKeys && (entry.constant || entry.keys.length)) {
    return false;
  }

  return true;
}

function matchesTagFilters(entry, tagFilters) {
  if (!tagFilters.length) {
    return true;
  }

  const tags = new Set(entry.tags ?? []);
  return tagFilters.every((tag) => tags.has(tag));
}

function highlightMatches(text, query) {
  const value = String(text);

  if (!query) {
    return document.createTextNode(value);
  }

  const lower = value.toLowerCase();
  const fragment = document.createDocumentFragment();
  let index = 0;

  while (index < value.length) {
    const found = lower.indexOf(query, index);

    if (found === -1) {
      fragment.append(document.createTextNode(value.slice(index)));
      break;
    }

    if (found > index) {
      fragment.append(document.createTextNode(value.slice(index, found)));
    }

    const mark = document.createElement("mark");
    mark.textContent = value.slice(found, found + query.length);
    fragment.append(mark);
    index = found + query.length;
  }

  return fragment;
}

function renderFilterChips(container, filters) {
  if (!container) {
    return;
  }

  for (const button of container.querySelectorAll("[data-filter]")) {
    const active = filters[button.dataset.filter] === true;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
  }
}

function renderTagFilters(container, tags, activeTags) {
  if (!container) {
    return;
  }

  container.replaceChildren();
  container.hidden = !tags.length;

  for (const tag of tags) {
    const button = document.createElement("button");
    const active = activeTags.includes(tag);

    button.type = "button";
    button.className = "filter-chip tag-filter-chip";
    button.dataset.tag = tag;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
    button.textContent = tag;
    container.append(button);
  }
}

function compactId(entry) {
  const sourceId = entry.extensions?.sourceId;

  if (sourceId !== undefined && sourceId !== null && String(sourceId).trim()) {
    return String(sourceId).trim();
  }

  const digits = String(entry.id).match(/\d+/g)?.join("") ?? "";

  if (digits) {
    return digits.slice(-4);
  }

  let hash = 0;

  for (const character of String(entry.id)) {
    hash = (Math.imul(hash, 31) + character.codePointAt(0)) | 0;
  }

  return String(Math.abs(hash) % 10000).padStart(4, "0");
}

function compareTitle(a, b) {
  return collator.compare(entryLabel(a), entryLabel(b));
}

export function sortEntries(entries, mode) {
  const sorted = [...entries];

  if (mode === "title") {
    sorted.sort(compareTitle);
  } else if (mode === "order") {
    sorted.sort((a, b) => a.order - b.order || compareTitle(a, b));
  } else if (mode === "updated") {
    sorted.sort((a, b) => b.updatedAt - a.updatedAt || compareTitle(a, b));
  } else if (mode === "enabled") {
    sorted.sort((a, b) => Number(b.enabled) - Number(a.enabled) || compareTitle(a, b));
  }

  return sorted;
}

function createEntryCard(entry, options) {
  const { isActive, isSelected, canDrag, query = "", match = null, pinned = false } = options;
  const card = document.createElement("div");
  card.dataset.entryId = entry.id;
  card.className = "entry-card";
  card.tabIndex = 0;
  card.setAttribute("role", "option");
  card.setAttribute("aria-selected", String(isSelected));

  if (isActive) {
    card.classList.add("is-active");
    card.setAttribute("aria-current", "true");
  }

  if (isSelected) {
    card.classList.add("is-selected");
  }

  if (!entry.enabled) {
    card.classList.add("is-disabled");
  }

  if (pinned) {
    card.classList.add("is-pinned");
  }

  if (canDrag) {
    card.draggable = true;
  }

  const top = document.createElement("span");
  top.className = "entry-card-top";

  const id = document.createElement("span");
  id.className = "entry-id";
  id.textContent = `#${compactId(entry)}`;
  id.title = `Entry ID: ${entry.id}`;

  const dot = document.createElement("span");
  dot.className = "status-dot";
  dot.setAttribute("aria-hidden", "true");

  const title = document.createElement("span");
  title.className = "entry-card-title";
  title.append(highlightMatches(entryLabel(entry), query));

  top.append(id, dot, title);

  if (entry.constant) {
    const badge = document.createElement("span");
    badge.className = "entry-badge";
    badge.textContent = "Always";
    top.append(badge);
  }

  if (pinned) {
    const pin = document.createElement("span");
    pin.className = "entry-pin";
    pin.textContent = "Current";
    top.append(pin);
  }

  const meta = document.createElement("span");
  meta.className = "entry-card-meta";
  meta.append(highlightMatches(keySummary(entry), query));

  card.append(top, meta);

  if (entry.tags?.length) {
    const tags = document.createElement("span");
    tags.className = "entry-card-tags";

    for (const tag of entry.tags.slice(0, 3)) {
      const chip = document.createElement("span");
      chip.className = "entry-tag";
      chip.textContent = tag;
      tags.append(chip);
    }

    if (entry.tags.length > 3) {
      const more = document.createElement("span");
      more.className = "entry-tag";
      more.textContent = `+${entry.tags.length - 3}`;
      tags.append(more);
    }

    card.append(tags);
  }

  if (query && match?.fields.length) {
    const why = document.createElement("span");
    why.className = "entry-card-match";
    why.textContent = `Matched: ${match.fields.join(", ")}`;
    card.append(why);
  }

  card.title = `${entry.keys.length ? entry.keys.join(", ") : "No trigger keys"}\nID: ${entry.id}`;

  return card;
}

function renderBulkBar(refs) {
  const count = getSelectedEntryIds().length;
  refs.bulkBar.hidden = count === 0;
  refs.bulkCount.textContent = `${count} selected`;
}

export function renderSidebar(refs) {
  const state = getState();
  const book = getActiveBook();
  const query = state.ui.searchQuery.trim().toLowerCase();
  const entries = book?.entries ?? [];
  const filters = state.ui.filters ?? {};
  const tagFilters = Array.isArray(state.ui.tagFilters) ? state.ui.tagFilters : [];
  const hasFilters = Object.values(filters).some(Boolean);
  const hasTagFilters = tagFilters.length > 0;
  const narrowing = Boolean(query) || hasFilters || hasTagFilters;
  const matches = new Map();
  const filtered = sortEntries(
    entries.filter((entry) => {
      const match = analyzeEntryQuery(entry, query);
      matches.set(entry.id, match);
      return match.matched && matchesFilters(entry, filters) && matchesTagFilters(entry, tagFilters);
    }),
    state.ui.sortMode
  );
  const availableTags = [...new Set(entries.flatMap((entry) => entry.tags ?? []))].sort(collator.compare);
  const activeEntry = entries.find((entry) => entry.id === state.activeEntryId) ?? null;
  const activeVisible = filtered.some((entry) => entry.id === state.activeEntryId);
  const pinnedEntry = activeEntry && !activeVisible && narrowing ? activeEntry : null;
  const scrollTop = refs.entryList.scrollTop;
  const activeElement = document.activeElement;
  const focusedEntryId = activeElement instanceof Element
    ? activeElement.closest("[data-entry-id]")?.dataset.entryId ?? null
    : null;
  const selected = new Set(getSelectedEntryIds());
  const canDrag = state.ui.sortMode === "manual" && !narrowing;

  const options = state.books.map((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name.trim() || "Untitled Lorebook";
    return option;
  });

  refs.bookSelect.replaceChildren(...options);
  refs.bookSelect.value = state.activeBookId ?? "";
  refs.entrySort.value = state.ui.sortMode;
  renderFilterChips(refs.entryFilters, filters);
  renderTagFilters(refs.tagFilters, availableTags, tagFilters);
  refs.entryCount.textContent = narrowing
    ? `${filtered.length}/${entries.length}`
    : String(entries.length);

  refs.entryList.replaceChildren();
  renderBulkBar(refs);

  if (!filtered.length && !pinnedEntry) {
    const empty = document.createElement("div");
    empty.className = "entry-list-empty";
    empty.textContent = query
      ? `No entries match "${state.ui.searchQuery.trim()}".`
      : narrowing
        ? "No entries match the current filters."
        : "No entries yet. Create one to start writing.";
    refs.entryList.append(empty);
    refs.entryList.scrollTop = 0;
    return;
  }

  const fragment = document.createDocumentFragment();

  if (pinnedEntry) {
    fragment.append(createEntryCard(pinnedEntry, {
      isActive: true,
      isSelected: selected.has(pinnedEntry.id),
      canDrag: false,
      query,
      match: matches.get(pinnedEntry.id) ?? null,
      pinned: true
    }));
  }

  for (const entry of filtered) {
    fragment.append(createEntryCard(entry, {
      isActive: entry.id === state.activeEntryId,
      isSelected: selected.has(entry.id),
      canDrag,
      query,
      match: matches.get(entry.id) ?? null
    }));
  }

  refs.entryList.append(fragment);
  refs.entryList.scrollTop = scrollTop;

  if (focusedEntryId) {
    const card = Array.from(refs.entryList.querySelectorAll("[data-entry-id]"))
      .find((element) => element.dataset.entryId === focusedEntryId);
    card?.focus({ preventScroll: true });
  }
}
