function iconSvg(pathD) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="subject-icon-svg">
    <path d="${pathD}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;
}

export function getSubjectIconSvg(subject) {
  const key = normalizeSubject(subject);
  if (key.includes("math")) {
    return iconSvg("M6 6l12 12M18 6L6 18M4 12h16M12 4v16");
  }
  if (key.includes("science")) {
    return iconSvg("M9 3v5l-4 7a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 15l-4-7V3M8 12h8");
  }
  if (key.includes("language") || key.includes("writing") || key.includes("reading")) {
    return iconSvg("M5 5h9a4 4 0 0 1 4 4v10H9a4 4 0 0 0-4 4V5zM9 9h6M9 13h6");
  }
  if (key.includes("art")) {
    return iconSvg("M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.9-.6-1.6-1.5-1.8-.9-.2-1.5-.9-1.5-1.8 0-1.1.9-2 2-2h1a4 4 0 0 0 0-8h-2zM7 11h.01M9.5 8.5h.01M13 8h.01");
  }
  return iconSvg("M12 4v16M4 12h16");
}

export function createSubjectBadge(subject, showText = true) {
  const badge = document.createElement("span");
  badge.className = "subject-badge";
  badge.innerHTML = `${getSubjectIconSvg(subject)}${showText ? `<span class="subject-label">${subject}</span>` : ""}`;
  return badge;
}

function normalizeSubject(value) {
  return (value || "").toLowerCase().trim();
}
