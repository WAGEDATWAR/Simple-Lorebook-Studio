const FLAGS_PATTERN = /^[dgimsuvy]*$/;

export function isRegexKey(key) {
  const value = String(key ?? "").trim();

  if (value.length < 2 || !value.startsWith("/")) {
    return false;
  }

  const lastSlash = value.lastIndexOf("/");

  if (lastSlash <= 0) {
    return false;
  }

  return FLAGS_PATTERN.test(value.slice(lastSlash + 1));
}

export function parseRegexKey(key) {
  const value = String(key ?? "").trim();

  if (!isRegexKey(value)) {
    return { ok: true, regex: null, pattern: value, flags: "" };
  }

  const lastSlash = value.lastIndexOf("/");
  const pattern = value.slice(1, lastSlash);
  const flags = value.slice(lastSlash + 1);

  try {
    return { ok: true, regex: new RegExp(pattern, flags), pattern, flags };
  } catch (error) {
    return { ok: false, error: error.message, pattern, flags };
  }
}
