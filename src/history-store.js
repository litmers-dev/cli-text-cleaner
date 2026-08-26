export const HISTORY_KEY = "cli-text-cleaner.history.v1";
export const HISTORY_LIMIT = 10;

export function readHistory(storage) {
  const raw = storage.getItem(HISTORY_KEY);
  if (raw === null) return [];

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
    throw new TypeError("Stored history must be an array of strings.");
  }

  return parsed.slice(0, HISTORY_LIMIT);
}

export function saveHistoryEntry(storage, value) {
  if (!value) return readHistory(storage);

  const entries = [
    value,
    ...readHistory(storage).filter((entry) => entry !== value),
  ].slice(0, HISTORY_LIMIT);
  storage.setItem(HISTORY_KEY, JSON.stringify(entries));
  return entries;
}

export function clearHistory(storage) {
  storage.removeItem(HISTORY_KEY);
}
