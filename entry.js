import {
  STORAGE_KEYS,
  DEFAULT_SUBJECTS,
  loadJson,
  saveJson,
  todayIso,
  formatDate,
} from "./data-service.js";
import { createSubjectBadge } from "./subject-icons.js";

const DRAFT_KEY = "academicLogger.entryDraft";

const state = {
  entries: loadJson(STORAGE_KEYS.entries, []),
  subjects: loadJson(STORAGE_KEYS.subjects, DEFAULT_SUBJECTS),
  links: loadJson(STORAGE_KEYS.links, []),
  editingEntryId: null,
  photoDataUrl: null,
};

let autoDetectTimer = null;

const elements = {
  entryForm: document.querySelector("#entry-form"),
  entryDate: document.querySelector("#entry-date"),
  entrySubject: document.querySelector("#entry-subject"),
  entrySubjectCustom: document.querySelector("#entry-subject-custom"),
  entrySubjectTrigger: document.querySelector("#entry-subject-trigger"),
  entrySubjectMenu: document.querySelector("#entry-subject-menu"),
  newSubject: document.querySelector("#new-subject"),
  addSubjectBtn: document.querySelector("#add-subject-btn"),
  entryDuration: document.querySelector("#entry-duration"),
  entryDurationCustom: document.querySelector("#entry-duration-custom"),
  entryDurationTrigger: document.querySelector("#entry-duration-trigger"),
  entryDurationMenu: document.querySelector("#entry-duration-menu"),
  entryNotes: document.querySelector("#entry-notes"),
  entryPhoto: document.querySelector("#entry-photo"),
  photoPreview: document.querySelector("#photo-preview"),
  resetEntryBtn: document.querySelector("#reset-entry-btn"),
  detectFieldsBtn: document.querySelector("#detect-fields-btn"),
  voiceStatus: document.querySelector("#voice-status"),
  voiceDetectedPreview: document.querySelector("#voice-detected-preview"),
  entriesList: document.querySelector("#entries-list"),
  entryTemplate: document.querySelector("#entry-template"),
  linkForm: document.querySelector("#link-form"),
  linkName: document.querySelector("#link-name"),
  linkUrl: document.querySelector("#link-url"),
  linkNotes: document.querySelector("#link-notes"),
  linksList: document.querySelector("#links-list"),
  linkTemplate: document.querySelector("#link-template"),
  exportDataBtn: document.querySelector("#export-data-btn"),
  importDataFile: document.querySelector("#import-data-file"),
  backupStatus: document.querySelector("#backup-status"),
};

init();

function init() {
  elements.entryDate.value = todayIso();
  bindEvents();
  setupCustomSelectInteractions();
  renderSubjects();
  renderDurationCustomSelect();
  renderPhotoPreview();
  restoreDraft();
  renderEntries();
  renderLinks();
}

function bindEvents() {
  elements.entryForm.addEventListener("submit", handleEntrySubmit);
  elements.entryForm.addEventListener("input", saveDraft);
  elements.addSubjectBtn.addEventListener("click", handleAddSubject);
  elements.entryPhoto.addEventListener("change", handlePhotoInput);
  elements.resetEntryBtn.addEventListener("click", resetEntryForm);
  elements.detectFieldsBtn.addEventListener("click", handleDetectFromNotes);
  elements.entryNotes.addEventListener("input", scheduleAutoDetect);
  elements.entryNotes.addEventListener("paste", handleDeferredNotesDetection);
  elements.linkForm.addEventListener("submit", handleLinkSubmit);
  elements.entriesList.addEventListener("click", handleEntryListClick);
  elements.linksList.addEventListener("click", handleLinksListClick);
  elements.exportDataBtn.addEventListener("click", handleExportData);
  elements.importDataFile.addEventListener("change", handleImportData);
}

function setBackupStatus(message) {
  if (!elements.backupStatus) {
    return;
  }
  elements.backupStatus.textContent = message;
}

async function handleExportData() {
  try {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        entries: loadJson(STORAGE_KEYS.entries, []),
        subjects: loadJson(STORAGE_KEYS.subjects, DEFAULT_SUBJECTS),
        links: loadJson(STORAGE_KEYS.links, []),
      },
    };

    const json = JSON.stringify(payload, null, 2);
    const fileName = `academic-logger-backup-${todayIso()}.json`;

    const blob = new Blob([json], { type: "application/json" });

    if (navigator.canShare && navigator.share) {
      const file = new File([blob], fileName, { type: "application/json" });
      const canShareFile = navigator.canShare({ files: [file] });
      if (canShareFile) {
        await navigator.share({
          title: "Academic Logger Backup",
          text: "Backup file for Academic Practice Logger",
          files: [file],
        });
        setBackupStatus("Backup shared. Save it to Files/iCloud/Drive so you can import on another device.");
        return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBackupStatus("Backup downloaded. Save it somewhere you can access on your other device.");
  } catch (error) {
    setBackupStatus("Export failed. Try again, or check browser permissions.");
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

function isValidBackupPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (payload.schemaVersion !== 1) {
    return false;
  }
  if (!payload.data || typeof payload.data !== "object") {
    return false;
  }
  if (!Array.isArray(payload.data.entries)) {
    return false;
  }
  if (!Array.isArray(payload.data.subjects)) {
    return false;
  }
  if (!Array.isArray(payload.data.links)) {
    return false;
  }
  return true;
}

async function handleImportData(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!isValidBackupPayload(payload)) {
      setBackupStatus("That file doesn’t look like an Academic Logger backup.");
      elements.importDataFile.value = "";
      return;
    }

    const ok = window.confirm(
      "Importing will replace this device’s current Academic Logger data (entries, subjects, and links). Continue?"
    );
    if (!ok) {
      setBackupStatus("Import cancelled.");
      elements.importDataFile.value = "";
      return;
    }

    saveJson(STORAGE_KEYS.entries, payload.data.entries);
    saveJson(STORAGE_KEYS.subjects, payload.data.subjects);
    saveJson(STORAGE_KEYS.links, payload.data.links);

    state.entries = loadJson(STORAGE_KEYS.entries, []);
    state.subjects = loadJson(STORAGE_KEYS.subjects, DEFAULT_SUBJECTS);
    state.links = loadJson(STORAGE_KEYS.links, []);

    resetEntryForm();
    renderEntries();
    renderLinks();

    setBackupStatus("Import complete. Your data has been restored on this device.");
  } catch (error) {
    setBackupStatus("Import failed. Make sure you selected a valid JSON backup file.");
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    elements.importDataFile.value = "";
  }
}

function setupCustomSelectInteractions() {
  elements.entrySubjectTrigger.addEventListener("click", () => {
    toggleCustomMenu(elements.entrySubjectCustom, elements.entrySubjectMenu);
    closeCustomMenu(elements.entryDurationCustom, elements.entryDurationMenu);
  });
  elements.entryDurationTrigger.addEventListener("click", () => {
    toggleCustomMenu(elements.entryDurationCustom, elements.entryDurationMenu);
    closeCustomMenu(elements.entrySubjectCustom, elements.entrySubjectMenu);
  });

  document.addEventListener("click", (event) => {
    if (!elements.entrySubjectCustom.contains(event.target)) {
      closeCustomMenu(elements.entrySubjectCustom, elements.entrySubjectMenu);
    }
    if (!elements.entryDurationCustom.contains(event.target)) {
      closeCustomMenu(elements.entryDurationCustom, elements.entryDurationMenu);
    }
  });
}

function scheduleAutoDetect() {
  if (autoDetectTimer) {
    clearTimeout(autoDetectTimer);
  }
  autoDetectTimer = window.setTimeout(autoDetectFromNotes, 400);
}

function autoDetectFromNotes() {
  const transcript = elements.entryNotes.value.trim();
  if (!transcript) {
    clearDetectedPreview();
    return;
  }
  const extracted = extractEntryFieldsFromTranscript(transcript);
  const applied = applyExtractedFields(extracted);
  if (!applied.subject && !applied.duration) {
    return;
  }
  elements.voiceStatus.textContent = buildVoiceStatusMessage(
    extracted,
    elements.entrySubject.value || "Unspecified subject",
    Number(elements.entryDuration.value) || 0
  );
  renderDetectedPreview(applied);
}

function handleAddSubject() {
  const name = elements.newSubject.value.trim();
  if (!name) {
    return;
  }

  if (!state.subjects.includes(name)) {
    state.subjects.push(name);
    saveJson(STORAGE_KEYS.subjects, state.subjects);
    renderSubjects();
  }

  elements.entrySubject.value = name;
  elements.newSubject.value = "";
  renderSubjects();
  saveDraft();
}

function handlePhotoInput(event) {
  const [file] = event.target.files;
  if (!file) {
    state.photoDataUrl = null;
    renderPhotoPreview();
    saveDraft();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.photoDataUrl = reader.result;
    renderPhotoPreview();
    saveDraft();
  };
  reader.readAsDataURL(file);
}

function handleEntrySubmit(event) {
  event.preventDefault();

  const entry = {
    id: state.editingEntryId || crypto.randomUUID(),
    date: elements.entryDate.value || todayIso(),
    subject: elements.entrySubject.value,
    duration: Number(elements.entryDuration.value),
    notes: elements.entryNotes.value.trim(),
    photoDataUrl: state.photoDataUrl,
    createdAt: new Date().toISOString(),
  };

  if (state.editingEntryId) {
    state.entries = state.entries.map((item) => (item.id === entry.id ? entry : item));
  } else {
    state.entries.unshift(entry);
  }

  saveJson(STORAGE_KEYS.entries, state.entries);
  resetEntryForm();
  renderEntries();
}

function handleDeferredNotesDetection() {
  window.setTimeout(() => {
    handleDetectFromNotes();
  }, 0);
}

function handleDetectFromNotes() {
  const transcript = elements.entryNotes.value.trim();
  if (!transcript) {
    clearDetectedPreview();
    return;
  }

  const extracted = extractEntryFieldsFromTranscript(transcript);
  const applied = applyExtractedFields(extracted);
  if (applied.subject || applied.duration) {
    const conciseNotes = buildConciseVoiceNotes(extracted.scrubbedText);
    if (conciseNotes) {
      elements.entryNotes.value = conciseNotes;
    }
  }
  if (!applied.subject && !applied.duration) {
    elements.voiceStatus.textContent =
      "Could not detect subject/duration from notes text. Try 'Subject is Math for 45 minutes'.";
    renderDetectedPreview(applied);
    return;
  }

  elements.voiceStatus.textContent = buildVoiceStatusMessage(
    extracted,
    elements.entrySubject.value || "Unspecified subject",
    Number(elements.entryDuration.value) || 0
  );
  renderDetectedPreview(applied);
}

function handleLinkSubmit(event) {
  event.preventDefault();

  const link = {
    id: crypto.randomUUID(),
    name: elements.linkName.value.trim(),
    url: elements.linkUrl.value.trim(),
    notes: elements.linkNotes.value.trim(),
    createdAt: new Date().toISOString(),
  };

  state.links.unshift(link);
  saveJson(STORAGE_KEYS.links, state.links);
  elements.linkForm.reset();
  renderLinks();
}

function handleEntryListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const card = event.target.closest("[data-entry-id]");
  if (!card) {
    return;
  }

  const entry = state.entries.find((item) => item.id === card.dataset.entryId);
  if (!entry) {
    return;
  }

  if (button.dataset.action === "delete") {
    const ok = window.confirm(
      `Delete the ${entry.subject} entry from ${formatDate(entry.date)}? This can't be undone.`
    );
    if (!ok) {
      return;
    }
    state.entries = state.entries.filter((item) => item.id !== entry.id);
    saveJson(STORAGE_KEYS.entries, state.entries);
    renderEntries();
    if (state.editingEntryId === entry.id) {
      resetEntryForm();
    }
    return;
  }

  state.editingEntryId = entry.id;
  elements.entryDate.value = entry.date;
  elements.entrySubject.value = entry.subject;
  elements.entryDuration.value = entry.duration;
  elements.entryNotes.value = entry.notes;
  state.photoDataUrl = entry.photoDataUrl || null;
  renderPhotoPreview();
  renderSubjectCustomSelect();
  renderDurationCustomSelect();
  saveDraft();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleLinksListClick(event) {
  const button = event.target.closest("button[data-action='delete-link']");
  if (!button) {
    return;
  }

  const card = event.target.closest("[data-link-id]");
  if (!card) {
    return;
  }

  state.links = state.links.filter((item) => item.id !== card.dataset.linkId);
  saveJson(STORAGE_KEYS.links, state.links);
  renderLinks();
}

function resetEntryForm() {
  state.editingEntryId = null;
  elements.entryForm.reset();
  elements.entryDate.value = todayIso();
  state.photoDataUrl = null;
  renderPhotoPreview();
  renderSubjects();
  elements.entryDuration.value = "30";
  elements.voiceStatus.textContent = "Ready.";
  clearDetectedPreview();
  renderDurationCustomSelect();
  clearDraft();
}

function saveDraft() {
  const draft = {
    editingEntryId: state.editingEntryId,
    date: elements.entryDate.value,
    subject: elements.entrySubject.value,
    duration: elements.entryDuration.value,
    notes: elements.entryNotes.value,
    photoDataUrl: state.photoDataUrl,
  };
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // sessionStorage quota exceeded (most likely a large photo); the entry can still be saved manually.
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function restoreDraft() {
  let raw;
  try {
    raw = sessionStorage.getItem(DRAFT_KEY);
  } catch {
    return;
  }
  if (!raw) {
    return;
  }
  let draft;
  try {
    draft = JSON.parse(raw);
  } catch {
    return;
  }
  if (!draft || typeof draft !== "object") {
    return;
  }

  if (draft.editingEntryId) {
    const stillExists = state.entries.some((item) => item.id === draft.editingEntryId);
    state.editingEntryId = stillExists ? draft.editingEntryId : null;
  }
  if (draft.date) {
    elements.entryDate.value = draft.date;
  }
  if (draft.subject) {
    elements.entrySubject.value = draft.subject;
  }
  if (draft.duration) {
    elements.entryDuration.value = draft.duration;
  }
  if (typeof draft.notes === "string") {
    elements.entryNotes.value = draft.notes;
  }
  if (draft.photoDataUrl) {
    state.photoDataUrl = draft.photoDataUrl;
  }

  renderSubjectCustomSelect();
  renderDurationCustomSelect();
  renderPhotoPreview();
}

function renderSubjects() {
  const uniqueSubjects = [...new Set(state.subjects)].sort((a, b) => a.localeCompare(b));
  state.subjects = uniqueSubjects;
  saveJson(STORAGE_KEYS.subjects, state.subjects);

  elements.entrySubject.innerHTML = "";
  uniqueSubjects.forEach((subject) => {
    elements.entrySubject.append(new Option(subject, subject));
  });
  if (!elements.entrySubject.value && uniqueSubjects.length) {
    elements.entrySubject.value = uniqueSubjects[0];
  }
  renderSubjectCustomSelect();
}

function renderPhotoPreview() {
  elements.photoPreview.innerHTML = "";
  if (!state.photoDataUrl) {
    elements.photoPreview.classList.add("empty");
    elements.photoPreview.textContent = "No photo selected.";
    return;
  }

  elements.photoPreview.classList.remove("empty");
  const image = document.createElement("img");
  image.src = state.photoDataUrl;
  image.alt = "Selected photo preview";
  elements.photoPreview.append(image);
}

function renderEntries() {
  elements.entriesList.innerHTML = "";

  if (!state.entries.length) {
    elements.entriesList.innerHTML = "<p class=\"entry-card\">No entries yet. Add your first learning log above.</p>";
    return;
  }

  state.entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const fragment = elements.entryTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".entry-card");
      card.dataset.entryId = entry.id;
      fragment.querySelector(".entry-title").textContent = formatDate(entry.date);
      const meta = fragment.querySelector(".entry-meta");
      meta.innerHTML = "";
      meta.append(createSubjectBadge(entry.subject, true));
      const duration = document.createElement("span");
      duration.className = "entry-duration";
      duration.textContent = `${entry.duration} min`;
      meta.append(duration);
      fragment.querySelector(".entry-notes").textContent = entry.notes || "No notes added.";

      const image = fragment.querySelector(".entry-photo");
      if (entry.photoDataUrl) {
        image.src = entry.photoDataUrl;
        image.classList.remove("hidden");
      }

      elements.entriesList.append(fragment);
    });
}

function renderLinks() {
  elements.linksList.innerHTML = "";

  if (!state.links.length) {
    elements.linksList.innerHTML =
      "<p class=\"entry-card\">No external references yet. Add dashboards or curriculum links here.</p>";
    return;
  }

  state.links.forEach((link) => {
    const fragment = elements.linkTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".entry-card");
    card.dataset.linkId = link.id;
    const title = fragment.querySelector(".entry-title");
    title.textContent = link.name;

    const meta = fragment.querySelector(".entry-meta");
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.url;
    meta.replaceWith(anchor);

    fragment.querySelector(".entry-notes").textContent = link.notes || "No notes added.";
    elements.linksList.append(fragment);
  });
}

function extractEntryFieldsFromTranscript(transcript) {
  let scrubbedText = transcript;
  const lower = transcript.toLowerCase();
  const result = {
    subject: null,
    duration: null,
    scrubbedText,
  };

  const durationPatterns = [
    /(\d+)\s*(minutes|minute|mins|min)\b/,
    /\bfor\s+(\d+)\b/,
    /\bduration\s*(?:is|was|:)?\s*(\d+)\b/,
    /\b(\d+)\s*(hours|hour|hrs|hr)\b/,
  ];

  for (const pattern of durationPatterns) {
    const match = lower.match(pattern);
    if (!match) {
      continue;
    }

    const value = Number(match[1]);
    const unit = match[2] || "minutes";
    if (Number.isFinite(value) && value > 0) {
      result.duration = unit.startsWith("hour") || unit.startsWith("hr") ? value * 60 : value;
      result.scrubbedText = scrubDurationPhrases(result.scrubbedText);
      break;
    }
  }

  const knownSubject = findBestSubjectMatch(state.subjects, lower);
  if (knownSubject) {
    result.subject = knownSubject;
    result.scrubbedText = scrubSubjectPhrases(result.scrubbedText, knownSubject);
    return result;
  }

  const namedSubjectMatch =
    transcript.match(/subject\s*(?:is|was|:)\s*([a-zA-Z][a-zA-Z0-9 &-]{1,40})/i) ||
    transcript.match(/for\s+([a-zA-Z][a-zA-Z0-9 &-]{1,40})\s+(?:practice|lesson|work)/i);
  if (namedSubjectMatch) {
    result.subject = sanitizeSubject(namedSubjectMatch[1]);
    result.scrubbedText = scrubSubjectPhrases(result.scrubbedText, result.subject);
  }

  return result;
}

function sanitizeSubject(value) {
  return value
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ");
}

function applyExtractedFields(extracted) {
  const applied = { subject: null, duration: null };
  if (extracted.subject) {
    const subjectExists = state.subjects.some(
      (item) => item.toLowerCase() === extracted.subject.toLowerCase()
    );
    if (!subjectExists) {
      state.subjects.push(extracted.subject);
      saveJson(STORAGE_KEYS.subjects, state.subjects);
      renderSubjects();
    }

    const selected = state.subjects.find(
      (item) => item.toLowerCase() === extracted.subject.toLowerCase()
    );
    if (selected) {
      elements.entrySubject.value = selected;
      applied.subject = selected;
      renderSubjectCustomSelect();
    }
  }

  if (extracted.duration) {
    const normalized = normalizeDurationToOption(extracted.duration);
    elements.entryDuration.value = String(normalized);
    applied.duration = normalized;
    renderDurationCustomSelect();
  }

  if (applied.subject || applied.duration) {
    saveDraft();
  }

  return applied;
}

function buildVoiceStatusMessage(extracted, subject, duration) {
  const parts = [];
  if (extracted.subject) {
    parts.push(`subject set to "${subject}"`);
  }
  if (extracted.duration) {
    parts.push(`duration set to ${duration} min`);
  }
  if (!parts.length) {
    return "Voice note added. Subject/duration were not detected; please fill them manually.";
  }
  return `Voice note processed: ${parts.join(", ")}.`;
}

function renderDetectedPreview(applied) {
  const parts = [];
  if (applied.subject) {
    parts.push(`Subject: ${applied.subject}`);
  }
  if (applied.duration) {
    parts.push(`Duration: ${applied.duration} min`);
  }

  if (!parts.length) {
    elements.voiceDetectedPreview.classList.add("hidden");
    elements.voiceDetectedPreview.textContent = "";
    return;
  }

  elements.voiceDetectedPreview.classList.remove("hidden");
  elements.voiceDetectedPreview.textContent = `Detected from voice/notes -> ${parts.join(" | ")}`;
}

function clearDetectedPreview() {
  elements.voiceDetectedPreview.classList.add("hidden");
  elements.voiceDetectedPreview.textContent = "";
}

function scrubDurationPhrases(text) {
  return text
    .replace(/\b(duration\s*(?:is|was|:)?\s*)?\d+\s*(minutes|minute|mins|min)\b[,.:-]?\s*/gi, "")
    .replace(/\bfor\s+\d+\b[,.:-]?\s*/gi, "")
    .replace(/\b\d+\s*(hours|hour|hrs|hr)\b[,.:-]?\s*/gi, "");
}

function scrubSubjectPhrases(text, subject) {
  const escapedSubject = escapeRegex(subject);
  return text
    .replace(new RegExp(`\\bsubject\\s*(?:is|was|:)\\s*${escapedSubject}\\b[,.:-]?\\s*`, "gi"), "")
    .replace(new RegExp(`\\b${escapedSubject}\\s+(?:practice|lesson|work)\\b[,.:-]?\\s*`, "gi"), "")
    .replace(new RegExp(`\\b${escapedSubject}\\b[,.:-]?\\s*`, "gi"), "");
}

function buildConciseVoiceNotes(text) {
  if (/^\s*[•-]\s+/m.test(text)) {
    return text.trim();
  }

  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s*([,.!?;:])\s*/g, "$1 ")
    .trim();
  if (!cleaned) {
    return "";
  }

  const segments = cleaned
    .split(/[\n]+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const bullets = segments
    .slice(0, 6)
    .map((segment) => `• ${sentenceCase(segment)}`);

  return bullets.join("\n");
}

function sentenceCase(value) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findBestSubjectMatch(subjects, lowerTranscript) {
  const sorted = [...subjects].sort((a, b) => b.length - a.length);
  return sorted.find((subject) => {
    const escaped = escapeRegex(subject.toLowerCase());
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");
    return pattern.test(lowerTranscript);
  });
}

function normalizeDurationToOption(minutes) {
  const clamped = Math.max(10, Math.min(60, minutes));
  return Math.round(clamped / 10) * 10;
}

function renderSubjectCustomSelect() {
  const options = [...elements.entrySubject.options].map((option) => option.value);
  elements.entrySubjectMenu.innerHTML = "";
  options.forEach((subject) => {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "custom-select-option";
    if (subject === elements.entrySubject.value) {
      optionButton.classList.add("active");
    }
    optionButton.append(createSubjectBadge(subject, true));
    optionButton.addEventListener("click", () => {
      elements.entrySubject.value = subject;
      closeCustomMenu(elements.entrySubjectCustom, elements.entrySubjectMenu);
      renderSubjectCustomSelect();
      saveDraft();
    });
    elements.entrySubjectMenu.append(optionButton);
  });

  const selectedSubject = elements.entrySubject.value || options[0] || "Select subject";
  elements.entrySubjectTrigger.innerHTML = "";
  if (selectedSubject && selectedSubject !== "Select subject") {
    elements.entrySubjectTrigger.append(createSubjectBadge(selectedSubject, true));
  } else {
    elements.entrySubjectTrigger.textContent = "Select subject";
  }
}

function renderDurationCustomSelect() {
  const options = [...elements.entryDuration.options].map((option) => ({
    value: option.value,
    label: option.textContent,
  }));
  elements.entryDurationMenu.innerHTML = "";
  options.forEach((option) => {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "custom-select-option";
    if (option.value === elements.entryDuration.value) {
      optionButton.classList.add("active");
    }
    optionButton.textContent = option.label;
    optionButton.addEventListener("click", () => {
      elements.entryDuration.value = option.value;
      closeCustomMenu(elements.entryDurationCustom, elements.entryDurationMenu);
      renderDurationCustomSelect();
      saveDraft();
    });
    elements.entryDurationMenu.append(optionButton);
  });

  const selected = options.find((option) => option.value === elements.entryDuration.value);
  elements.entryDurationTrigger.textContent = selected ? selected.label : "Select duration";
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
