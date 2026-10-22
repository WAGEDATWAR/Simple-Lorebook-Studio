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

function matchesQuery(entry, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    entry.title,
    entry.content,
    entry.keys.join(" "),
    entry.secondaryKeys.join(" ")
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(query);
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
  const { isActive, isSelected, canDrag } = options;
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
  title.textContent = entryLabel(entry);

  top.append(id, dot, title);

  if (entry.constant) {
    const badge = document.createElement("span");
    badge.className = "entry-badge";
    badge.textContent = "Always";
    top.append(badge);
  }

  const meta = document.createElement("span");
  meta.className = "entry-card-meta";
  meta.textContent = keySummary(entry);

  card.append(top, meta);
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
  const filtered = sortEntries(
    entries.filter((entry) => matchesQuery(entry, query)),
    state.ui.sortMode
  );
  const scrollTop = refs.entryList.scrollTop;
  const selected = new Set(getSelectedEntryIds());
  const canDrag = state.ui.sortMode === "manual" && !query;

  const options = state.books.map((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name.trim() || "Untitled Lorebook";
    return option;
  });

  refs.bookSelect.replaceChildren(...options);
  refs.bookSelect.value = state.activeBookId ?? "";
  refs.entrySort.value = state.ui.sortMode;
  refs.entryCount.textContent = query
    ? `${filtered.length}/${entries.length}`
    : String(entries.length);

  refs.entryList.replaceChildren();
  renderBulkBar(refs);

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "entry-list-empty";
    empty.textContent = entries.length
      ? `No entries match "${state.ui.searchQuery.trim()}".`
      : "No entries yet. Create one to start writing.";
    refs.entryList.append(empty);
    refs.entryList.scrollTop = 0;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const entry of filtered) {
    fragment.append(createEntryCard(entry, {
      isActive: entry.id === state.activeEntryId,
      isSelected: selected.has(entry.id),
      canDrag
    }));
  }

  refs.entryList.append(fragment);
  refs.entryList.scrollTop = scrollTop;
}
