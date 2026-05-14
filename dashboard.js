import {
  STORAGE_KEYS,
  DEFAULT_SUBJECTS,
  loadJson,
  todayIso,
  formatDate,
  escapeHtml,
  getRangeForPeriod,
} from "./data-service.js";
import { createSubjectBadge } from "./subject-icons.js";

const state = {
  entries: loadJson(STORAGE_KEYS.entries, []),
  subjects: loadJson(STORAGE_KEYS.subjects, DEFAULT_SUBJECTS),
};

const elements = {
  periodFilter: document.querySelector("#period-filter"),
  anchorDate: document.querySelector("#anchor-date"),
  subjectFilter: document.querySelector("#subject-filter"),
  dashboardSubjectCustom: document.querySelector("#dashboard-subject-custom"),
  dashboardSubjectTrigger: document.querySelector("#dashboard-subject-trigger"),
  dashboardSubjectMenu: document.querySelector("#dashboard-subject-menu"),
  totalMinutes: document.querySelector("#total-minutes"),
  entryCount: document.querySelector("#entry-count"),
  subjectCount: document.querySelector("#subject-count"),
  subjectRollup: document.querySelector("#subject-rollup"),
  notesRollup: document.querySelector("#notes-rollup"),
};

init();

function init() {
  elements.anchorDate.value = todayIso();
  bindEvents();
  setupCustomSubjectFilter();
  renderSubjects();
  renderDashboard();
}

function bindEvents() {
  elements.periodFilter.addEventListener("change", renderDashboard);
  elements.anchorDate.addEventListener("change", renderDashboard);
  elements.subjectFilter.addEventListener("change", renderDashboard);
}

function setupCustomSubjectFilter() {
  elements.dashboardSubjectTrigger.addEventListener("click", () => {
    toggleCustomMenu(elements.dashboardSubjectCustom, elements.dashboardSubjectMenu);
  });
  document.addEventListener("click", (event) => {
    if (!elements.dashboardSubjectCustom.contains(event.target)) {
      closeCustomMenu(elements.dashboardSubjectCustom, elements.dashboardSubjectMenu);
    }
  });
}

function renderSubjects() {
  elements.subjectFilter.innerHTML = "<option value=\"\">All subjects</option>";
  const uniqueSubjects = [...new Set(state.subjects)].sort((a, b) => a.localeCompare(b));
  uniqueSubjects.forEach((subject) => {
    elements.subjectFilter.append(new Option(subject, subject));
  });
  renderSubjectFilterCustom();
}

function renderDashboard() {
  state.entries = loadJson(STORAGE_KEYS.entries, []);
  state.subjects = loadJson(STORAGE_KEYS.subjects, DEFAULT_SUBJECTS);
  renderSubjectFilterCustom();

  const filteredEntries = getFilteredEntries();
  const subjectMap = new Map();
  let totalMinutes = 0;

  filteredEntries.forEach((entry) => {
    totalMinutes += entry.duration;
    subjectMap.set(entry.subject, (subjectMap.get(entry.subject) || 0) + entry.duration);
  });

  elements.totalMinutes.textContent = String(totalMinutes);
  elements.entryCount.textContent = String(filteredEntries.length);
  elements.subjectCount.textContent = String(subjectMap.size);

  elements.subjectRollup.innerHTML = "";
  if (!subjectMap.size) {
    elements.subjectRollup.innerHTML = "<li>No entries in this period.</li>";
  } else {
    [...subjectMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([subject, minutes]) => {
        const item = document.createElement("li");
        item.className = "rollup-item";
        item.append(createSubjectBadge(subject, true));
        const minutesTag = document.createElement("span");
        minutesTag.className = "rollup-minutes";
        minutesTag.textContent = `${minutes} min`;
        item.append(minutesTag);
        elements.subjectRollup.append(item);
      });
  }

  elements.notesRollup.innerHTML = "";
  if (!filteredEntries.length) {
    elements.notesRollup.innerHTML = "<li>No notes for this selection.</li>";
    return;
  }

  filteredEntries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const item = document.createElement("li");
      const header = document.createElement("strong");
      header.className = "note-item-header";
      header.textContent = formatDate(entry.date);

      const meta = document.createElement("div");
      meta.className = "entry-meta";
      meta.append(createSubjectBadge(entry.subject, true));
      const duration = document.createElement("span");
      duration.className = "entry-duration";
      duration.textContent = `${entry.duration} min`;
      meta.append(duration);

      const notes = document.createElement("p");
      notes.className = "entry-notes";
      notes.innerHTML = escapeHtml(entry.notes || "No notes added.");

      item.append(header, meta, notes);
      elements.notesRollup.append(item);
    });
}

function renderSubjectFilterCustom() {
  const options = [...elements.subjectFilter.options].map((option) => ({
    value: option.value,
    label: option.textContent || "All subjects",
  }));

  elements.dashboardSubjectMenu.innerHTML = "";
  options.forEach((option) => {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "custom-select-option";
    if (option.value === elements.subjectFilter.value) {
      optionButton.classList.add("active");
    }

    if (!option.value) {
      optionButton.textContent = "All subjects";
    } else {
      optionButton.append(createSubjectBadge(option.value, true));
    }

    optionButton.addEventListener("click", () => {
      elements.subjectFilter.value = option.value;
      closeCustomMenu(elements.dashboardSubjectCustom, elements.dashboardSubjectMenu);
      renderSubjectFilterCustom();
      renderDashboard();
    });
    elements.dashboardSubjectMenu.append(optionButton);
  });

  const selected = options.find((option) => option.value === elements.subjectFilter.value);
  elements.dashboardSubjectTrigger.innerHTML = "";
  if (!selected || !selected.value) {
    elements.dashboardSubjectTrigger.textContent = "All subjects";
    return;
  }
  elements.dashboardSubjectTrigger.append(createSubjectBadge(selected.value, true));
}

function toggleCustomMenu(container, menu) {
  const isOpen = !menu.classList.contains("hidden");
  if (isOpen) {
    closeCustomMenu(container, menu);
    return;
  }
  menu.classList.remove("hidden");
  container.classList.add("open");
}

function closeCustomMenu(container, menu) {
  menu.classList.add("hidden");
  container.classList.remove("open");
}

function getFilteredEntries() {
  const anchorDate = elements.anchorDate.value || todayIso();
  const period = elements.periodFilter.value;
  const subjectFilter = elements.subjectFilter.value;
  const range = getRangeForPeriod(anchorDate, period);

  return state.entries.filter((entry) => {
    const inPeriod = entry.date >= range.start && entry.date <= range.end;
    const subjectMatch = !subjectFilter || entry.subject === subjectFilter;
    return inPeriod && subjectMatch;
  });
}
