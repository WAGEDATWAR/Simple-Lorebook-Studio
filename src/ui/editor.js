import { getActiveBook, getActiveEntry } from "../store.js";

const numberFormatter = new Intl.NumberFormat("en-US");

export function syncEntryStats(refs, content) {
  const chars = content.length;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tokens = Math.ceil(chars / 4);

  refs.entryStatChars.textContent = numberFormatter.format(chars);
  refs.entryStatWords.textContent = numberFormatter.format(words);
  refs.entryStatTokens.textContent = `~${numberFormatter.format(tokens)}`;
}

export function renderEditor(refs) {
  const book = getActiveBook();
  const entry = getActiveEntry();
  const hasEntry = Boolean(entry);

  refs.editorEmpty.hidden = hasEntry;
  refs.editorPane.hidden = !hasEntry;

  if (!hasEntry) {
    const hasEntries = Boolean(book?.entries.length);
    refs.emptyTitle.textContent = hasEntries ? "Select an entry" : "Start your lorebook";
    refs.emptyText.textContent = hasEntries
      ? "Choose an entry from the sidebar or create a new one."
      : "This lorebook is empty. Create your first entry to begin building the world.";
    return;
  }

  refs.entryTitle.value = entry.title;
  refs.entryEnabled.checked = entry.enabled;
  refs.entryKeys.value = entry.keys.join(", ");
  refs.entrySecondaryKeys.value = entry.secondaryKeys.join(", ");
  refs.entryContent.value = entry.content;
  refs.entryOrder.value = String(entry.order);
  refs.entryPosition.value = entry.position;
  refs.entryProbability.value = String(entry.probability);
  refs.entryProbabilityOutput.textContent = `${entry.probability}%`;
  refs.entryConstant.checked = entry.constant;
  refs.entrySelective.checked = entry.selective;
  refs.entryCaseSensitive.checked = entry.caseSensitive;
  refs.entryWholeWords.checked = entry.matchWholeWords;

  syncEntryStats(refs, entry.content);
}
