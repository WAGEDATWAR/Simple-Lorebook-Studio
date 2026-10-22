const dialog = document.querySelector("#diff-dialog");
const eyebrowElement = document.querySelector("#diff-eyebrow");
const titleElement = document.querySelector("#diff-title");
const messageElement = document.querySelector("#diff-message");
const detailsElement = document.querySelector("#diff-details");
const detailList = document.querySelector("#diff-detail-list");
const warningsElement = document.querySelector("#diff-warnings");
const controlsElement = document.querySelector("#diff-controls");
const summaryElement = document.querySelector("#diff-summary");
const bodyElement = document.querySelector("#diff-body");
const cancelButton = document.querySelector("#diff-cancel");
const acceptButton = document.querySelector("#diff-accept");

let settleDiff = null;
let lastDetails = [];
let lastWarnings = [];

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function statusBadge(status) {
  const badge = document.createElement("span");
  badge.className = `diff-status diff-status-${status}`;
  badge.textContent = status === "added"
    ? "Added"
    : status === "removed"
      ? "Removed"
      : status === "changed"
        ? "Changed"
        : "Unchanged";
  return badge;
}

function renderDetails(details, warnings) {
  detailList.replaceChildren();
  warningsElement.replaceChildren();

  for (const detail of details) {
    if (!detail || detail.value === undefined || detail.value === null || detail.value === "") {
      continue;
    }

    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = String(detail.label || "");
    value.textContent = String(detail.value);
    detailList.append(term, value);
  }

  for (const warning of warnings) {
    if (!warning) {
      continue;
    }

    const item = document.createElement("p");
    item.className = "confirm-warning";
    item.textContent = String(warning);
    warningsElement.append(item);
  }

  warningsElement.hidden = !warningsElement.childElementCount;
  detailsElement.hidden = !detailList.childElementCount && warningsElement.hidden;
}

function summaryChip(tone, text) {
  const chip = document.createElement("span");
  chip.className = `diff-summary-chip diff-summary-${tone}`;
  chip.textContent = text;
  return chip;
}

function renderSummary(diff) {
  const { summary } = diff;
  const chips = [];

  if (summary.booksAdded) {
    chips.push(summaryChip("added", `+${plural(summary.booksAdded, "book")}`));
  }

  if (summary.booksRemoved) {
    chips.push(summaryChip("removed", `-${plural(summary.booksRemoved, "book")}`));
  }

  if (summary.booksMetadataChanged) {
    chips.push(summaryChip("changed", `~${plural(summary.booksMetadataChanged, "book")}`));
  }

  if (summary.entriesAdded) {
    chips.push(summaryChip("added", `+${plural(summary.entriesAdded, "entry", "entries")}`));
  }

  if (summary.entriesRemoved) {
    chips.push(summaryChip("removed", `-${plural(summary.entriesRemoved, "entry", "entries")}`));
  }

  if (summary.entriesChanged) {
    chips.push(summaryChip("changed", `~${plural(summary.entriesChanged, "entry", "entries")}`));
  }

  if (!chips.length) {
    chips.push(summaryChip("unchanged", "No changes"));
  }

  summaryElement.replaceChildren(...chips);
}

function applyChange(result) {
  if (!result) {
    return;
  }

  if (result.eyebrow !== undefined) {
    eyebrowElement.textContent = result.eyebrow;
  }

  if (result.title !== undefined) {
    titleElement.textContent = result.title;
  }

  if (result.message !== undefined) {
    messageElement.textContent = result.message;
    messageElement.hidden = !result.message;
  }

  if (result.details !== undefined) {
    lastDetails = result.details;
  }

  if (result.warnings !== undefined) {
    lastWarnings = result.warnings;
  }

  if (result.details !== undefined || result.warnings !== undefined) {
    renderDetails(lastDetails, lastWarnings);
  }

  if (result.diff) {
    renderSummary(result.diff);
    renderDiff(result.diff);
  }

  if (result.confirmLabel !== undefined) {
    acceptButton.textContent = result.confirmLabel;
  }

  if (result.tone) {
    acceptButton.className = result.tone === "danger" ? "btn btn-danger" : "btn btn-primary";
  }
}

function renderControls(controls, onChange) {
  if (!controlsElement) {
    return;
  }

  controlsElement.replaceChildren();
  controlsElement.hidden = !controls.length;

  for (const control of controls) {
    const wrapper = document.createElement("label");
    const label = document.createElement("span");
    const select = document.createElement("select");

    wrapper.className = "diff-control";
    label.className = "diff-control-label";
    select.className = "diff-control-select";
    label.textContent = control.label || "";
    select.name = control.id || "";

    for (const option of control.options ?? []) {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      select.append(item);
    }

    select.value = control.value ?? control.options?.[0]?.value ?? "";

    select.addEventListener("change", async () => {
      if (!onChange) {
        return;
      }

      select.disabled = true;

      try {
        applyChange(await onChange(select.value, control.id));
      } finally {
        select.disabled = false;
      }
    });

    wrapper.append(label, select);
    controlsElement.append(wrapper);
  }
}

function renderTextLines(lines) {
  const container = document.createElement("div");
  container.className = "diff-lines";

  for (const line of lines) {
    const row = document.createElement("div");
    const before = document.createElement("span");
    const after = document.createElement("span");
    const marker = document.createElement("span");
    const text = document.createElement("span");

    row.className = `diff-line diff-line-${line.type}`;
    before.className = "diff-line-number";
    after.className = "diff-line-number";
    marker.className = "diff-line-marker";
    text.className = "diff-line-text";
    before.textContent = line.beforeLine ?? "";
    after.textContent = line.afterLine ?? "";
    marker.textContent = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
    text.textContent = line.text || " ";
    row.append(before, after, marker, text);
    container.append(row);
  }

  return container;
}

function renderField(field) {
  const wrapper = document.createElement("div");
  const heading = document.createElement("div");
  const label = document.createElement("span");

  wrapper.className = "diff-field";
  heading.className = "diff-field-head";
  label.className = "diff-field-label";
  label.textContent = field.label;
  heading.append(label);
  wrapper.append(heading);

  if (field.lines) {
    wrapper.append(renderTextLines(field.lines));
    return wrapper;
  }

  const values = document.createElement("div");
  const before = document.createElement("span");
  const arrow = document.createElement("span");
  const after = document.createElement("span");

  values.className = "diff-field-values";
  before.className = "diff-value diff-value-before";
  arrow.className = "diff-value-arrow";
  after.className = "diff-value diff-value-after";
  before.textContent = field.beforeLabel || "(empty)";
  arrow.textContent = "\u2192";
  after.textContent = field.afterLabel || "(empty)";
  values.append(before, arrow, after);
  wrapper.append(values);
  return wrapper;
}

function renderEntryMeta(entry) {
  const wrapper = document.createElement("div");
  const items = [
    { label: "Trigger keys", value: entry.keys?.length ? entry.keys.join(", ") : "None" },
    {
      label: "Secondary keys",
      value: entry.secondaryKeys?.length ? entry.secondaryKeys.join(", ") : "None"
    },
    { label: "Insertion order", value: String(entry.order ?? 100) },
    { label: "Enabled", value: entry.enabled ? "On" : "Off" }
  ];

  wrapper.className = "diff-entry-meta";

  for (const item of items) {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("span");
    label.className = "diff-entry-meta-label";
    value.className = "diff-entry-meta-value";
    label.textContent = item.label;
    value.textContent = item.value;
    row.append(label, value);
    wrapper.append(row);
  }

  return wrapper;
}

function renderEntrySnapshot(entry, status) {
  const fragment = document.createDocumentFragment();
  fragment.append(renderEntryMeta(entry));

  if (entry.content) {
    fragment.append(renderField({
      label: "Content",
      kind: "long",
      lines: (status === "added" ? entry.content.split("\n").map((text, index) => ({
        type: "add",
        text,
        beforeLine: null,
        afterLine: index + 1
      })) : entry.content.split("\n").map((text, index) => ({
        type: "remove",
        text,
        beforeLine: index + 1,
        afterLine: null
      })))
    }));
  }

  if (entry.notes) {
    fragment.append(renderField({
      label: "Author notes",
      kind: "long",
      lines: (status === "added" ? entry.notes.split("\n").map((text, index) => ({
        type: "add",
        text,
        beforeLine: null,
        afterLine: index + 1
      })) : entry.notes.split("\n").map((text, index) => ({
        type: "remove",
        text,
        beforeLine: index + 1,
        afterLine: null
      })))
    }));
  }

  return fragment;
}

function renderEntry(entry, bookStatus) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const title = document.createElement("span");
  const meta = document.createElement("span");
  const body = document.createElement("div");
  const changes = entry.changes;
  const entryStatus = bookStatus === "added" ? "added" : bookStatus === "removed" ? "removed" : entry.status;

  details.className = `diff-entry diff-entry-${entryStatus}`;
  summary.className = "diff-entry-summary";
  title.className = "diff-entry-title";
  meta.className = "diff-entry-summary-meta";
  body.className = "diff-entry-body";
  title.textContent = entry.title;

  if (entryStatus === "changed") {
    meta.textContent = changes.map((change) => change.label).join(", ");
    summary.append(statusBadge("changed"), title, meta);

    for (const change of changes) {
      body.append(renderField(change));
    }
  } else {
    const sourceEntry = entryStatus === "added" ? entry.after : entry.before;
    meta.textContent = entryStatus === "added" ? "New entry" : "Removed entry";
    summary.append(statusBadge(entryStatus), title, meta);
    body.append(renderEntrySnapshot(sourceEntry, entryStatus));
  }

  details.append(summary, body);
  return details;
}

function renderBook(book) {
  const article = document.createElement("article");
  const header = document.createElement("header");
  const title = document.createElement("h3");
  const meta = document.createElement("span");
  const body = document.createElement("div");
  const changedEntries = book.entries.filter((entry) => entry.status !== "unchanged");

  article.className = `diff-book diff-book-${book.status}`;
  header.className = "diff-book-head";
  title.className = "diff-book-title";
  meta.className = "diff-book-meta";
  body.className = "diff-book-body";
  title.textContent = book.name;
  meta.textContent = changedEntries.length
    ? plural(changedEntries.length, "entry", "entries")
    : plural(book.changes.length, "field");
  header.append(statusBadge(book.status), title, meta);
  article.append(header);

  if (book.changes.length) {
    const bookFields = document.createElement("div");
    bookFields.className = "diff-fields";
    bookFields.append(...book.changes.map(renderField));
    body.append(bookFields);
  }

  if (changedEntries.length) {
    const entries = document.createElement("div");
    entries.className = "diff-entries";
    entries.append(...changedEntries.map((entry) => renderEntry(entry, book.status)));
    body.append(entries);
  }

  article.append(body);
  return article;
}

function renderDiff(diff) {
  const changedBooks = diff.books.filter((book) => book.status !== "unchanged");

  if (!changedBooks.length) {
    const empty = document.createElement("p");
    empty.className = "diff-empty";
    empty.textContent = "No differences found between these states.";
    bodyElement.replaceChildren(empty);
    return;
  }

  bodyElement.replaceChildren(...changedBooks.map(renderBook));

  const firstChangedEntry = bodyElement.querySelector(".diff-entry-changed");

  if (firstChangedEntry) {
    firstChangedEntry.open = true;
  }
}

function closeWith(value) {
  if (!dialog.open) {
    return;
  }

  dialog.close(value ? "confirm" : "cancel");
}

async function showDiffDialog({
  eyebrow = "Changes",
  title = "Review changes",
  message = "",
  details = [],
  warnings = [],
  diff,
  controls = [],
  onChange = null,
  confirmLabel = "Close",
  cancelLabel = null,
  tone = "primary"
} = {}) {
  if (!dialog) {
    return false;
  }

  if (settleDiff) {
    const settle = settleDiff;
    settleDiff = null;
    settle(false);
  }

  eyebrowElement.textContent = eyebrow;
  titleElement.textContent = title;
  messageElement.textContent = message;
  messageElement.hidden = !message;
  lastDetails = details;
  lastWarnings = warnings;
  renderDetails(details, warnings);
  renderControls(controls, onChange);
  renderSummary(diff);
  renderDiff(diff);
  acceptButton.textContent = confirmLabel;
  acceptButton.className = tone === "danger" ? "btn btn-danger" : "btn btn-primary";
  cancelButton.hidden = !cancelLabel;
  cancelButton.textContent = cancelLabel || "Cancel";
  dialog.returnValue = "cancel";

  return new Promise((resolve) => {
    settleDiff = resolve;
    dialog.showModal();
    acceptButton.focus();
  });
}

if (dialog) {
  dialog.addEventListener("close", () => {
    if (!settleDiff) {
      return;
    }

    const accepted = dialog.returnValue === "confirm";
    const settle = settleDiff;
    settleDiff = null;
    settle(accepted);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeWith(false);
    }
  });

  cancelButton.addEventListener("click", () => closeWith(false));
  acceptButton.addEventListener("click", () => closeWith(true));
}

export { showDiffDialog };
