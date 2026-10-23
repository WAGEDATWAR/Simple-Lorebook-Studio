export function filterCommands(items, query) {
  const needle = String(query ?? "").trim().toLowerCase();

  if (!needle) {
    return items.slice();
  }

  return items.filter((command) => {
    const haystack = [
      command.title,
      command.hint ?? "",
      ...(command.keywords ?? [])
    ].join(" ").toLowerCase();

    return haystack.includes(needle);
  });
}
