export const STORAGE_KEYS = {
  entries: "academicLogger.entries",
  subjects: "academicLogger.subjects",
  links: "academicLogger.links",
};

export const DEFAULT_SUBJECTS = ["Math", "Language Arts", "Science", "Art"];

export function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function todayIso() {
  return toIso(new Date());
}

export function toIso(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function getRangeForPeriod(anchorDate, period) {
  const date = new Date(`${anchorDate}T12:00:00`);
  if (period === "day") {
    return { start: anchorDate, end: anchorDate };
  }

  if (period === "week") {
    const day = date.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toIso(start), end: toIso(end) };
  }

  if (period === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: toIso(start), end: toIso(end) };
  }

  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear(), 11, 31);
  return { start: toIso(start), end: toIso(end) };
}
