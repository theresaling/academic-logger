// entry-v2.js — Pop direction, Milestone 2 (voice + capture + save).
// Side-by-side preview at /entry-v2.html. The original entry.html is untouched.

import { STORAGE_KEYS, loadJson, saveJson, todayIso } from "./data-service.js";

const root = document.querySelector("#pop-root");
const photoInput = document.querySelector("#pop-photo-input");
const importInput = document.querySelector("#pop-import-input");

// Settings keys that aren't part of data-service's existing schema.
const DEMO_MODE_KEY = "popLogger.demoMode";
const DEFAULT_SUBJECTS = ["Math", "Language Arts", "Science", "Art"];

// ─── Subject palette (matches design tokens in pop.css) ─────────────
const POP_SUBJECTS = ["Math", "Reading", "Writing", "Art", "Science", "Music"];
const SUBJECT_COLORS = {
  Math:    { c: "#F2542D", s: "#FFE2D6" },
  Reading: { c: "#E8973A", s: "#FCEACB" },
  Writing: { c: "#D33359", s: "#FCDCE3" },
  Art:     { c: "#D946A8", s: "#FBDDF0" },
  Science: { c: "#EA7331", s: "#FDE1CE" },
  Music:   { c: "#B14ACF", s: "#F2DDFC" },
};
const SUBJECT_KEYWORDS = {
  Math: ["math", "maths", "arithmetic", "algebra", "times table", "multiplication", "division", "fractions", "addition", "subtraction", "geometry"],
  Reading: ["reading", "read", "book", "chapter", "comprehension"],
  Writing: ["writing", "wrote", "essay", "journal", "spelling", "handwriting"],
  Art: ["art", "drawing", "painting", "sketch", "craft"],
  Science: ["science", "experiment", "biology", "chemistry", "physics"],
  Music: ["music", "piano", "guitar", "violin", "singing", "song", "instrument"],
};

const WORD_NUMBERS = {
  five: 5, ten: 10, fifteen: 15, twenty: 20, "twenty-five": 25, "twenty five": 25,
  thirty: 30, "thirty-five": 35, "thirty five": 35, forty: 40, "forty-five": 45,
  "forty five": 45, fifty: 50, "fifty-five": 55, "fifty five": 55, sixty: 60, hour: 60,
};

// ─── State ──────────────────────────────────────────────────────────
const state = {
  tab: "entry",
  phase: "idle", // idle | listening | processing | captured | saved
  settingsOpen: false,
  entries: loadJson(STORAGE_KEYS.entries, []),
  links: loadJson(STORAGE_KEYS.links, []),
  streak: 0,
  // Capture-in-progress
  transcript: "",
  finalText: "",
  note: "",
  subject: null,
  duration: null,
  photoDataUrl: null,
  editor: null, // 'subject' | 'duration' | null
  justDetected: null,
  listeningTimer: 0,
  toast: null,
  // Settings
  demoMode: loadJson(DEMO_MODE_KEY, false) === true,
  backupStatus: "",
  // New-link form
  newLink: { name: "", url: "", notes: "" },
};

state.streak = computeStreak(state.entries);

let timerInterval = null;
let pulseTimeout = null;
let toastTimeout = null;
let demoCancel = null;
const recognizer = setupRecognizer();

// Demo-mode canned recording — progressively reveals a transcript over ~7s
// without using the real mic. Useful for showcasing the flow.
const DEMO_SCRIPT = [
  { t: 0, text: "okay so " },
  { t: 600, text: "okay so we worked on " },
  { t: 1200, text: "okay so we worked on math today, " },
  { t: 1900, text: "okay so we worked on math today, the times tables " },
  { t: 2700, text: "okay so we worked on math today, the times tables — sixes and sevens. " },
  { t: 3500, text: "okay so we worked on math today, the times tables — sixes and sevens. Got most of them quick " },
  { t: 4400, text: "okay so we worked on math today, the times tables — sixes and sevens. Got most of them quick but still stuck on seven times eight. " },
  { t: 5400, text: "okay so we worked on math today, the times tables — sixes and sevens. Got most of them quick but still stuck on seven times eight. Ended with a flashcard round, " },
  { t: 6500, text: "okay so we worked on math today, the times tables — sixes and sevens. Got most of them quick but still stuck on seven times eight. Ended with a flashcard round, took about thirty minutes." },
];

function runDemo() {
  const timers = [];
  let cancelled = false;
  DEMO_SCRIPT.forEach((step) => {
    timers.push(
      setTimeout(() => {
        if (cancelled || state.phase !== "listening") return;
        state.transcript = step.text;
        updateTranscriptDom();
      }, step.t)
    );
  });
  timers.push(
    setTimeout(() => {
      if (cancelled || state.phase !== "listening") return;
      stopListening();
    }, 7200)
  );
  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}

// ─── SVG glyphs ─────────────────────────────────────────────────────
const svgWrap = (size, body, extra = "") =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

const Glyphs = {
  Math: (size) => svgWrap(size, `
    <rect x="5" y="6" width="22" height="20" rx="3"/>
    <line x1="5" y1="14" x2="27" y2="14"/>
    <line x1="5" y1="20" x2="27" y2="20"/>
    <circle cx="11" cy="14" r="2.4" fill="currentColor" stroke="none"/>
    <circle cx="20" cy="20" r="2.4" fill="currentColor" stroke="none"/>`),
  Reading: (size) => svgWrap(size, `
    <path d="M16 9 C 12 7, 8 7, 5 8 L 5 25 C 8 24, 12 24, 16 26 C 20 24, 24 24, 27 25 L 27 8 C 24 7, 20 7, 16 9 Z"/>
    <line x1="16" y1="9" x2="16" y2="26"/>`),
  Writing: (size) => svgWrap(size, `
    <path d="M22 5 L 27 10 L 11 26 L 5 27 L 6 21 Z"/>
    <line x1="19" y1="8" x2="24" y2="13"/>
    <line x1="6" y1="21" x2="11" y2="26"/>`),
  Art: (size) => svgWrap(size, `
    <path d="M16 5 C 9 5, 4 10, 4 16 C 4 22, 9 27, 15 27 C 17 27, 17 24, 18 23 C 19 22, 22 22, 24 22 C 27 22, 28 19, 28 16 C 28 10, 23 5, 16 5 Z"/>
    <circle cx="11" cy="12" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="10" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="22" cy="13" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="18" r="1.6" fill="currentColor" stroke="none"/>`),
  Science: (size) => svgWrap(size, `
    <path d="M12 5 L 20 5 M 13 5 L 13 13 L 6 25 C 5 27, 6 28, 8 28 L 24 28 C 26 28, 27 27, 26 25 L 19 13 L 19 5"/>
    <line x1="9" y1="22" x2="23" y2="22"/>`),
  Music: (size) => svgWrap(size, `
    <path d="M12 22 a 4 3 0 1 0 4 -3 L 16 7 L 24 9 L 24 12 L 16 10"/>`),
};

const MicFilled = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
     <rect x="11" y="3" width="10" height="18" rx="5"/>
     <path d="M6 14 v 1 a 10 10 0 0 0 20 0 v -1 h -2 v 1 a 8 8 0 0 1 -16 0 v -1 z"/>
     <rect x="15" y="23" width="2" height="6" rx="1"/>
     <rect x="10" y="27" width="12" height="2" rx="1"/>
   </svg>`;

const MicLine = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
     <rect x="12" y="4" width="8" height="16" rx="4"/>
     <path d="M7 15 a 9 9 0 0 0 18 0"/>
     <line x1="16" y1="24" x2="16" y2="28"/>
     <line x1="11" y1="28" x2="21" y2="28"/>
   </svg>`;

const GearIcon = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
     <circle cx="12" cy="12" r="3"/>
     <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
   </svg>`;

const CalendarIcon = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
     <rect x="3" y="4" width="18" height="18" rx="4"/>
     <line x1="16" y1="2" x2="16" y2="6"/>
     <line x1="8" y1="2" x2="8" y2="6"/>
     <line x1="3" y1="10" x2="21" y2="10"/>
   </svg>`;

const CheckIcon = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
     <polyline points="20 6 9 17 4 12"/>
   </svg>`;

const ClockIcon = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
     <circle cx="12" cy="12" r="9"/>
     <polyline points="12 7 12 12 15 14"/>
   </svg>`;

// ─── Voice recognition ──────────────────────────────────────────────
function setupRecognizer() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        state.finalText += result[0].transcript + " ";
      } else {
        interim += result[0].transcript;
      }
    }
    state.transcript = (state.finalText + interim).trim();
    updateTranscriptDom();
  };

  rec.onerror = (event) => {
    // Best-effort: if the user denied mic permission or it fails, transition
    // to captured with whatever text we already have (likely empty) so they
    // can still type / save manually later.
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      showToast("Mic blocked. Enable microphone access in Safari settings to record.");
    } else if (event.error !== "no-speech" && event.error !== "aborted") {
      showToast(`Voice error: ${event.error}`);
    }
  };

  rec.onend = () => {
    // If we were still in listening, finalize. Otherwise the user already
    // moved to processing/captured manually.
    if (state.phase === "listening") {
      processTranscript();
    }
  };

  return rec;
}

function startListening() {
  state.phase = "listening";
  state.transcript = "";
  state.finalText = "";
  state.note = "";
  state.subject = null;
  state.duration = null;
  state.photoDataUrl = null;
  state.editor = null;
  state.justDetected = null;
  state.listeningTimer = 0;

  if (state.demoMode) {
    if (demoCancel) demoCancel();
    demoCancel = runDemo();
  } else if (recognizer) {
    try {
      recognizer.start();
    } catch {
      // Recognizer can throw if already started — safe to ignore.
    }
  } else {
    showToast("Voice input isn't supported in this browser. Flip on Demo mode in Settings to try the flow.");
  }

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    state.listeningTimer++;
    updateTimerDom();
  }, 1000);

  render();
}

function stopListening() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (state.demoMode) {
    if (demoCancel) {
      demoCancel();
      demoCancel = null;
    }
    processTranscript();
    return;
  }
  if (recognizer) {
    try {
      recognizer.stop();
    } catch {
      // ignore
    }
    // onend will call processTranscript()
  } else {
    processTranscript();
  }
}

function processTranscript() {
  state.phase = "processing";
  render();
  // Small delay so the user sees the "Cleaning up…" state, then resolve.
  setTimeout(() => {
    const transcript = state.transcript.trim();
    const extracted = extractFields(transcript);
    state.note = extracted.note;
    state.subject = extracted.subject;
    state.duration = extracted.duration;
    state.justDetected = extracted.subject;
    state.phase = "captured";
    render();
    if (pulseTimeout) clearTimeout(pulseTimeout);
    pulseTimeout = setTimeout(() => {
      state.justDetected = null;
      render();
    }, 3000);
  }, 350);
}

// ─── Extraction (regex-based, no LLM) ───────────────────────────────
function extractFields(transcript) {
  const lower = transcript.toLowerCase();

  // Subject — keyword match, longest first to avoid e.g. "art" inside "artist".
  let subject = null;
  for (const s of POP_SUBJECTS) {
    const hit = SUBJECT_KEYWORDS[s].some((k) => {
      const re = new RegExp(`\\b${k.replace(/\s+/g, "\\s+")}\\b`, "i");
      return re.test(lower);
    });
    if (hit) {
      subject = s;
      break;
    }
  }

  // Duration — explicit minutes, then hours, then number words.
  let duration = null;
  const minMatch = lower.match(/(\d+)\s*(min|minute|mins|minutes)\b/);
  if (minMatch) {
    duration = clampDuration(Number(minMatch[1]));
  }
  if (duration == null) {
    const hrMatch = lower.match(/(\d+)\s*(hour|hours|hr|hrs)\b/);
    if (hrMatch) duration = clampDuration(Number(hrMatch[1]) * 60);
  }
  if (duration == null) {
    for (const word in WORD_NUMBERS) {
      const re = new RegExp(`\\b(for|about|around|roughly|like)\\s+${word}\\b|\\b${word}\\s+min`, "i");
      if (re.test(lower)) {
        duration = clampDuration(WORD_NUMBERS[word]);
        break;
      }
    }
  }
  if (duration == null && /\bhalf\s*(an?\s*)?hour\b/.test(lower)) duration = 30;

  const note = cleanNote(transcript);

  return { note, subject, duration };
}

function clampDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const stepped = Math.round(minutes / 5) * 5;
  return Math.min(60, Math.max(5, stepped));
}

function cleanNote(transcript) {
  if (!transcript) return "";
  let t = transcript.trim();
  // Strip leading filler ("okay so", "um", "well", "alright").
  t = t.replace(/^(okay so|ok so|so |um |uh |well |alright |all right )+/gi, "");
  // Strip filler words mid-sentence.
  t = t.replace(/\b(uh|um|like,?)\s+/gi, "");
  // Strip subject/duration mentions so they don't double up with the chips.
  t = t.replace(/\b(\d+)\s*(min|minute|mins|minutes)\b/gi, "");
  t = t.replace(/\bfor\s+(five|ten|fifteen|twenty|thirty|forty|fifty|sixty|an? hour|half an? hour)\b/gi, "");
  t = t.replace(/\bhalf\s*an?\s*hour\b/gi, "");
  // Collapse whitespace and stray punctuation left over from substitutions.
  t = t.replace(/\s+([,.:;!?])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/[,;:\s]+$/g, "");
  if (!t) return "";

  // Bullet-ize long transcripts by splitting on conjunctions.
  const SHORT_THRESHOLD = 25; // words
  const wordCount = t.split(/\s+/).length;
  if (wordCount > SHORT_THRESHOLD) {
    const segments = splitOnConjunctions(t);
    if (segments.length >= 2) {
      return segments
        .map((seg) => `- ${sentenceCase(seg)}`)
        .join("\n");
    }
  }

  return sentenceCase(t);
}

// Split a flat dictated sentence into chunks on common conjunctions.
// Tries to be conservative — only splits if the resulting chunks are
// each at least 4 words, so we don't shred a short sentence.
function splitOnConjunctions(text) {
  const re = /\s+(?:and then|then|so|next|after that|but)\s+/gi;
  const parts = text
    .split(re)
    .map((s) => s.trim().replace(/[,.;:]+$/g, "").trim())
    .filter(Boolean);
  if (parts.length < 2) return [text];
  if (parts.some((p) => p.split(/\s+/).length < 4)) return [text];
  return parts;
}

function sentenceCase(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ─── Save / streak ──────────────────────────────────────────────────
function computeStreak(entries) {
  const days = new Set(entries.map((e) => (e.date || "").slice(0, 10)));
  let s = 0;
  let d = new Date();
  d.setHours(0, 0, 0, 0);
  while (days.has(toIsoLocal(d))) {
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

function toIsoLocal(date) {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function saveCurrentEntry() {
  if (!state.subject || !state.duration) return;
  const entry = {
    id: crypto.randomUUID(),
    date: todayIso(),
    subject: state.subject,
    duration: state.duration,
    notes: state.note || "",
    photoDataUrl: state.photoDataUrl,
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...state.entries];
  try {
    saveJson(STORAGE_KEYS.entries, next);
  } catch (err) {
    if (err && (err.name === "QuotaExceededError" || err.code === 22)) {
      showToast("Storage full — try removing the photo and saving again.");
    } else {
      showToast("Couldn't save entry. Try again.");
    }
    return;
  }
  state.entries = next;
  state.streak = computeStreak(next);
  state.phase = "saved";
  // Keep subject + duration around for the saved screen display.
  render();
}

function resetEntry() {
  state.transcript = "";
  state.finalText = "";
  state.note = "";
  state.subject = null;
  state.duration = null;
  state.photoDataUrl = null;
  state.editor = null;
  state.justDetected = null;
  state.listeningTimer = 0;
  state.phase = "idle";
}

// ─── Photo (reuses M1 compression approach from entry.js) ───────────
function compressImageDataUrl(dataUrl, maxDim = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const longest = Math.max(width, height);
      if (longest > maxDim) {
        const scale = maxDim / longest;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = dataUrl;
  });
}

// ─── Backup / restore / clear ───────────────────────────────────────
function setBackupStatus(message) {
  state.backupStatus = message;
  render();
}

async function exportData() {
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
      if (navigator.canShare({ files: [file] })) {
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
  } catch (err) {
    setBackupStatus("Export failed. Try again, or check browser permissions.");
  }
}

function isValidBackupPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (payload.schemaVersion !== 1) return false;
  if (!payload.data || typeof payload.data !== "object") return false;
  if (!Array.isArray(payload.data.entries)) return false;
  if (!Array.isArray(payload.data.subjects)) return false;
  if (!Array.isArray(payload.data.links)) return false;
  return true;
}

async function importDataFile(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!isValidBackupPayload(payload)) {
      setBackupStatus("That file doesn't look like an Academic Logger backup.");
      return;
    }
    const ok = window.confirm(
      "Importing will replace this device's current entries, subjects, and links. Continue?"
    );
    if (!ok) {
      setBackupStatus("Import cancelled.");
      return;
    }
    saveJson(STORAGE_KEYS.entries, payload.data.entries);
    saveJson(STORAGE_KEYS.subjects, payload.data.subjects);
    saveJson(STORAGE_KEYS.links, payload.data.links);
    state.entries = loadJson(STORAGE_KEYS.entries, []);
    state.links = loadJson(STORAGE_KEYS.links, []);
    state.streak = computeStreak(state.entries);
    setBackupStatus("Import complete. Your data has been restored on this device.");
  } catch (err) {
    setBackupStatus("Import failed. Make sure you selected a valid JSON backup file.");
  }
}

importInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (file) importDataFile(file);
  event.target.value = "";
});

// ─── Links ──────────────────────────────────────────────────────────
function handleNewLink() {
  const { name, url, notes } = state.newLink;
  if (!name.trim() || !url.trim()) return;
  const link = {
    id: crypto.randomUUID(),
    name: name.trim(),
    url: url.trim(),
    notes: notes.trim(),
    createdAt: new Date().toISOString(),
  };
  state.links = [link, ...state.links];
  saveJson(STORAGE_KEYS.links, state.links);
  state.newLink = { name: "", url: "", notes: "" };
  render();
}

// Track link form input changes without re-rendering (would lose focus).
root.addEventListener("input", (event) => {
  const field = event.target.dataset && event.target.dataset.linkField;
  if (!field) return;
  state.newLink[field] = event.target.value;
});

root.addEventListener("submit", (event) => {
  const form = event.target.closest && event.target.closest("[data-form='new-link']");
  if (!form) return;
  event.preventDefault();
  handleNewLink();
});

photoInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      state.photoDataUrl = await compressImageDataUrl(reader.result);
    } catch {
      state.photoDataUrl = reader.result;
    }
    render();
  };
  reader.readAsDataURL(file);
  // Reset value so picking the same file twice in a row still fires change.
  event.target.value = "";
});

// ─── Toast ──────────────────────────────────────────────────────────
function showToast(message) {
  state.toast = message;
  render();
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    state.toast = null;
    render();
  }, 3500);
}

// ─── Targeted DOM updates (avoid full re-render during listening) ──
function updateTranscriptDom() {
  const el = root.querySelector(".pop-transcript-body");
  if (!el) return;
  if (!state.transcript) {
    el.innerHTML = `<span class="pop-transcript-empty">start talking — words appear here…</span><span class="pop-caret"></span>`;
  } else {
    el.textContent = state.transcript;
    el.insertAdjacentHTML("beforeend", `<span class="pop-caret"></span>`);
  }
}

function updateTimerDom() {
  const el = root.querySelector("[data-timer]");
  if (el) el.textContent = formatTimer(state.listeningTimer);
}

function formatTimer(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Render ─────────────────────────────────────────────────────────
function renderTopNav() {
  return `
    <div class="pop-topnav">
      <div class="pop-tabs" role="tablist">
        <button class="pop-tab" role="tab" aria-selected="${state.tab === "entry"}" data-action="tab" data-value="entry">Entry</button>
        <button class="pop-tab" role="tab" aria-selected="${state.tab === "history"}" data-action="tab" data-value="history">History</button>
      </div>
      <button class="pop-gear" data-action="open-settings" aria-label="Settings">${GearIcon(18)}</button>
    </div>
  `;
}

function renderDateRow() {
  return `
    <div class="pop-daterow">
      <button class="pop-datepill" aria-pressed="true">Today</button>
      <button class="pop-datepill" aria-pressed="false">Yest</button>
      <button class="pop-datepill" aria-pressed="false">2d</button>
      <button class="pop-calbtn" aria-label="Pick a date">${CalendarIcon(16)}</button>
    </div>
  `;
}

function renderIdle() {
  const streakPill = state.streak > 0
    ? `<div class="pop-streak"><span class="pop-streak-dot"></span>${state.streak}-day streak · keep it going</div>`
    : "";
  return `
    ${renderDateRow()}
    <div class="pop-idle">
      <h1 class="pop-idle-headline">How'd practice go?</h1>
      <p class="pop-idle-subhead">Tap the mic and tell me. I'll fill in the subject and time for you.</p>
      <button class="pop-mic-big" data-action="start-mic" aria-label="Start recording">${MicFilled(60)}</button>
      ${streakPill}
    </div>
  `;
}

function renderListening() {
  const bars = [10, 16, 8, 20, 12, 18, 6, 14]
    .map((h, i) => `<span style="height:${h}px;animation-delay:${(i * 0.08).toFixed(2)}s"></span>`)
    .join("");
  return `
    ${renderDateRow()}
    <div class="pop-listen">
      <button class="pop-listen-bar" data-action="stop-mic" aria-label="Stop recording">
        <span class="pop-listen-bar-mic">${MicFilled(18)}</span>
        <span class="pop-listen-bar-text">
          <span class="pop-listen-bar-title"><span class="pop-live-dot"></span>Listening…</span>
          <span class="pop-listen-bar-sub">tap to stop · <span data-timer>${formatTimer(state.listeningTimer)}</span></span>
        </span>
        <span class="pop-wave">${bars}</span>
      </button>
      <div class="pop-transcript">
        <div class="pop-transcript-eyebrow">Transcript</div>
        <div class="pop-transcript-body">
          ${
            state.transcript
              ? `${escapeHtml(state.transcript)}<span class="pop-caret"></span>`
              : `<span class="pop-transcript-empty">start talking — words appear here…</span><span class="pop-caret"></span>`
          }
        </div>
      </div>
    </div>
    <div class="pop-listen-hint">Tap the mic when you're done</div>
  `;
}

function renderGotIt(cleaning) {
  return `
    <div class="pop-gotit">
      <div class="pop-gotit-icon">${cleaning ? `<span class="pop-spinner"></span>` : CheckIcon(18)}</div>
      <div class="pop-gotit-text">
        <div class="pop-gotit-title">${cleaning ? "Cleaning up…" : "Got it"}</div>
        <div class="pop-gotit-sub">${cleaning ? "tidying notes + detecting subject/time" : "tap mic to re-record"}</div>
      </div>
      <button class="pop-rerec" data-action="restart-mic" aria-label="Re-record">${MicLine(18)}</button>
    </div>
  `;
}

function renderNoteCard(cleaning) {
  if (cleaning && !state.note) {
    return `<div class="pop-note-card"><p class="pop-note-empty">cleaning up your note…</p></div>`;
  }
  const note = state.note || "";
  const hasBullets = note.includes("\n- ") || note.startsWith("- ");
  if (hasBullets) {
    const items = note
      .split("\n")
      .filter(Boolean)
      .map((l) => `<li>${escapeHtml(l.replace(/^\s*-\s*/, ""))}</li>`)
      .join("");
    return `<div class="pop-note-card"><ul>${items}</ul></div>`;
  }
  return `
    <div class="pop-note-card">
      ${note ? `<p>${escapeHtml(note)}</p>` : `<p class="pop-note-empty">your note will appear here…</p>`}
    </div>
  `;
}

function renderSubjectChip() {
  if (!state.subject) {
    return `<button class="pop-chip pop-chip-empty" data-action="toggle-editor" data-value="subject">＋ subject</button>`;
  }
  const c = SUBJECT_COLORS[state.subject];
  const active = state.editor === "subject";
  const pulse = state.justDetected === state.subject && !active;
  const bg = active ? c.c : c.s;
  const color = active ? "#fff" : c.c;
  const cls = `pop-chip ${pulse ? "pop-pulse" : ""}`;
  const styleVars = pulse ? `--pop-pulse:${c.c}73;` : "";
  return `
    <button class="${cls}" data-action="toggle-editor" data-value="subject"
      style="background:${bg};color:${color};${styleVars}">
      ${Glyphs[state.subject](18)}
      <span>${state.subject}</span>
      <span class="pop-chip-edit">${active ? "×" : "✎"}</span>
    </button>
  `;
}

function renderDurationChip() {
  if (state.duration == null) {
    return `<button class="pop-chip pop-chip-empty" data-action="toggle-editor" data-value="duration">＋ duration</button>`;
  }
  const active = state.editor === "duration";
  const bg = active ? "var(--ink)" : "var(--surface)";
  const color = active ? "#fff" : "var(--ink)";
  return `
    <button class="pop-chip" data-action="toggle-editor" data-value="duration"
      style="background:${bg};color:${color};">
      ${ClockIcon(14)}
      <span>${state.duration} min</span>
      <span class="pop-chip-edit">${active ? "×" : "✎"}</span>
    </button>
  `;
}

function renderPhotoChip() {
  if (!state.photoDataUrl) {
    return `<button class="pop-chip pop-chip-empty" data-action="pick-photo">＋ photo</button>`;
  }
  return `
    <button class="pop-chip" data-action="pick-photo" style="background:var(--surface);color:var(--ink);padding:6px 14px 6px 6px;">
      <img class="pop-chip-thumb" src="${state.photoDataUrl}" alt=""/>
      <span>photo</span>
    </button>
  `;
}

function renderSubjectEditor() {
  if (state.editor !== "subject") return "";
  const tiles = POP_SUBJECTS.map((s) => {
    const c = SUBJECT_COLORS[s];
    const active = state.subject === s;
    const pulse = state.justDetected === s;
    const border = active ? c.c : "var(--border)";
    const bg = active ? c.s : "#fff";
    const labelColor = active ? c.c : "var(--ink)";
    const pulseStyle = pulse ? `--pop-pulse:${c.c}73;` : "";
    return `
      <button class="pop-subj-tile ${pulse ? "pop-pulse" : ""}" data-action="set-subject" data-value="${s}"
        style="border-color:${border};background:${bg};color:${c.c};${pulseStyle}">
        ${Glyphs[s](26)}
        <span class="pop-subj-tile-label" style="color:${labelColor}">${s}</span>
      </button>
    `;
  }).join("");
  return `
    <div class="pop-editor">
      <div class="pop-editor-head">
        <span class="pop-editor-label">Subject</span>
        <button class="pop-editor-done" data-action="close-editor">done</button>
      </div>
      <div class="pop-subj-scroll">${tiles}</div>
    </div>
  `;
}

function renderDurationEditor() {
  if (state.editor !== "duration") return "";
  const v = state.duration ?? 30;
  return `
    <div class="pop-editor">
      <div class="pop-editor-head">
        <span class="pop-editor-label">Duration</span>
        <button class="pop-editor-done" data-action="close-editor">done</button>
      </div>
      <div class="pop-stepper">
        <button class="pop-step-btn" data-action="duration-step" data-value="-5" ${v <= 5 ? "disabled" : ""}>−</button>
        <span class="pop-step-value">
          <span class="pop-step-num">${v}</span>
          <span class="pop-step-unit">min</span>
        </span>
        <button class="pop-step-btn" data-action="duration-step" data-value="5" ${v >= 60 ? "disabled" : ""}>＋</button>
      </div>
      <div class="pop-step-hint">5-minute steps · capped at 60</div>
    </div>
  `;
}

function renderCaptured() {
  const cleaning = state.phase === "processing";
  const canSave = !!state.subject && !!state.duration;
  return `
    ${renderDateRow()}
    <div class="pop-cap">
      ${renderGotIt(cleaning)}
      ${renderNoteCard(cleaning)}
      <div class="pop-chips">
        ${renderSubjectChip()}
        ${renderDurationChip()}
        ${renderPhotoChip()}
      </div>
      ${renderSubjectEditor()}
      ${renderDurationEditor()}
      <div style="flex:1;min-height:8px"></div>
    </div>
    <div class="pop-save-wrap">
      <button class="pop-save-btn" data-action="save" ${canSave ? "" : "disabled"}>
        ${canSave ? "Save entry →" : "Need subject + duration"}
      </button>
    </div>
  `;
}

function renderSaved() {
  const meta = subjectMeta(state.subject);
  const streak = state.streak;
  const segments = Array.from({ length: 7 }, (_, i) =>
    `<div class="pop-streak-seg ${i < streak ? "pop-streak-seg-filled" : ""}"></div>`
  ).join("");
  const remaining = Math.max(0, 7 - streak);
  const streakSubLine =
    streak >= 7 ? "a full week 🎉" : `${remaining} more for a week`;
  const subLine =
    streak === 0
      ? ""
      : streak === 1
      ? `<div class="pop-saved-sub">Nice. That's a fresh streak.</div>`
      : `<div class="pop-saved-sub">Nice. That's ${streak} days in a row.</div>`;

  // 5 confetti dots positioned around the 116px check
  const confetti = [
    { x: -22, y: -8, c: "var(--pop-yellow)", s: 8, delay: 0.15 },
    { x: 130, y: 18, c: SUBJECT_COLORS.Reading.c, s: 6, delay: 0.21 },
    { x: -18, y: 90, c: SUBJECT_COLORS.Art.c, s: 7, delay: 0.27 },
    { x: 128, y: 100, c: SUBJECT_COLORS.Music.c, s: 5, delay: 0.33 },
    { x: 56, y: -30, c: SUBJECT_COLORS.Science.c, s: 6, delay: 0.39 },
  ]
    .map(
      (d, i) => `
      <div class="pop-confetti" style="
        left:${d.x}px;top:${d.y}px;width:${d.s}px;height:${d.s}px;
        background:${d.c};transform:rotate(${i * 25}deg);
        animation-delay:${d.delay}s;"></div>`
    )
    .join("");

  return `
    <div class="pop-saved">
      <div class="pop-saved-body">
        <div class="pop-check-wrap">
          <div class="pop-saved-check">${CheckIcon(56)}</div>
          ${confetti}
        </div>
        <div class="pop-saved-headline">
          <h2 class="pop-saved-title">Logged · <span style="color:${meta.c}">${escapeHtml(meta.name)}</span> · ${state.duration}m</h2>
          ${subLine}
        </div>
        <div class="pop-streak-card">
          <div class="pop-streak-card-head">
            <div class="pop-streak-card-title">
              <span class="pop-streak-card-title-dot">●</span>
              Streak — ${streak} ${streak === 1 ? "day" : "days"}
            </div>
            <div class="pop-streak-card-sub">${streakSubLine}</div>
          </div>
          <div class="pop-streak-segments">${segments}</div>
        </div>
      </div>
      <div class="pop-saved-buttons">
        <button class="pop-btn-soft" data-action="see-history">See history</button>
        <button class="pop-btn-ink" data-action="log-another">Log another</button>
      </div>
    </div>
  `;
}

function renderEntryTab() {
  switch (state.phase) {
    case "idle":
      return renderIdle();
    case "listening":
      return renderListening();
    case "processing":
    case "captured":
      return renderCaptured();
    case "saved":
      return renderSaved();
    default:
      return renderIdle();
  }
}

function renderHistoryTab() {
  const grouped = groupEntriesByDay(state.entries);
  const weekMins = sumWeekMinutes(state.entries);

  const stats = `
    <div class="pop-stats">
      <div class="pop-stat-card pop-stat-soft">
        <div class="pop-stat-eyebrow">This week</div>
        <div class="pop-stat-value">${formatMinutes(weekMins) || "0m"}</div>
      </div>
      <div class="pop-stat-card pop-stat-ink">
        <div class="pop-stat-eyebrow">Streak</div>
        <div class="pop-stat-value">${state.streak}<span class="pop-stat-value-unit">${state.streak === 1 ? "day" : "days"}</span></div>
      </div>
    </div>
  `;

  if (grouped.length === 0) {
    return `
      <div class="pop-history">
        ${stats}
        <div class="pop-history-empty">
          <div class="pop-history-empty-title">No entries yet</div>
          <div class="pop-history-empty-sub">Tap the mic on the Entry tab to log one.</div>
        </div>
      </div>
      <button class="pop-fab" data-action="fab-mic" aria-label="Record new entry">${MicFilled(26)}</button>
    `;
  }

  const groups = grouped
    .map(
      (g) => `
      <div class="pop-day-group">
        <div class="pop-day-eyebrow">${dayLabel(g.date)}</div>
        ${g.items.map(renderEntryCard).join("")}
      </div>`
    )
    .join("");

  return `
    <div class="pop-history">
      ${stats}
      ${groups}
      <div style="height:80px;flex-shrink:0"></div>
    </div>
    <button class="pop-fab" data-action="fab-mic" aria-label="Record new entry">${MicFilled(26)}</button>
  `;
}

function renderEntryCard(entry) {
  const meta = subjectMeta(entry.subject);
  const ts = entryTimestamp(entry);
  const time = ts ? formatTime12(ts) : "";
  const note = entry.notes || "";
  const photo = entry.photoDataUrl
    ? `<img class="pop-entry-photo" src="${entry.photoDataUrl}" alt=""/>`
    : "";
  const glyph = meta.glyph
    ? meta.glyph(24)
    : `<span style="font-size:18px;color:${meta.c};font-weight:800">●</span>`;
  return `
    <div class="pop-entry-card">
      <div class="pop-entry-badge" style="background:${meta.s};color:${meta.c}">${glyph}</div>
      <div class="pop-entry-main">
        <div class="pop-entry-meta">
          <span class="pop-entry-subject" style="color:${meta.c}">${escapeHtml(meta.name)}</span>
          <span class="pop-entry-duration">· ${entry.duration}m</span>
          ${time ? `<span class="pop-entry-time">${time}</span>` : ""}
        </div>
        <div class="pop-entry-note">${escapeHtml(note) || "<span style=\"color:var(--mute);font-style:italic\">No note added.</span>"}</div>
      </div>
      ${photo}
    </div>
  `;
}

// ─── Subject display mapping ────────────────────────────────────────
// Map legacy "Language Arts" entries to display as "Reading" with the
// Reading color palette. Other custom subjects render with a neutral
// muted palette and a dot instead of a glyph.
function subjectMeta(name) {
  const displayName = name === "Language Arts" ? "Reading" : name;
  if (SUBJECT_COLORS[displayName]) {
    return {
      name: displayName,
      c: SUBJECT_COLORS[displayName].c,
      s: SUBJECT_COLORS[displayName].s,
      glyph: Glyphs[displayName],
    };
  }
  return {
    name: name || "Subject",
    c: "var(--ink-soft)",
    s: "var(--surface)",
    glyph: null,
  };
}

// ─── History helpers ────────────────────────────────────────────────
function entryTimestamp(entry) {
  if (entry.createdAt) return new Date(entry.createdAt);
  if (entry.date) return new Date(`${entry.date}T12:00:00`);
  return null;
}

function entryDayKey(entry) {
  const ts = entryTimestamp(entry);
  if (!ts) return "";
  return toIsoLocal(ts);
}

function groupEntriesByDay(entries) {
  const byKey = new Map();
  [...entries]
    .sort((a, b) => {
      const ta = entryTimestamp(a)?.getTime() ?? 0;
      const tb = entryTimestamp(b)?.getTime() ?? 0;
      return tb - ta;
    })
    .forEach((e) => {
      const k = entryDayKey(e);
      if (!byKey.has(k)) byKey.set(k, { date: entryTimestamp(e), key: k, items: [] });
      byKey.get(k).items.push(e);
    });
  return [...byKey.values()];
}

function sumWeekMinutes(entries) {
  // Calendar week starting Monday. Resets at midnight Sunday→Monday.
  const monday = startOfCurrentWeekMonday();
  return entries
    .filter((e) => {
      const ts = entryTimestamp(e);
      return ts && ts.getTime() >= monday.getTime();
    })
    .reduce((s, e) => s + (Number(e.duration) || 0), 0);
}

function startOfCurrentWeekMonday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // getDay: 0=Sun, 1=Mon, ... 6=Sat. We want Monday.
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7; // Mon=0, Sun=6
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

function formatMinutes(m) {
  if (!m) return "";
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function dayLabel(date) {
  if (!date) return "";
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dx = new Date(d);
  dx.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dx.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime12(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderSettingsSheet() {
  if (!state.settingsOpen) return "";
  const entryCount = state.entries.length;
  const linkCount = state.links.length;
  const micSupported = recognizer !== null;

  const demoSub = state.demoMode
    ? "Mic plays a canned recording — great for showing it off."
    : micSupported
    ? "Uses your real mic. Tap mic to record (browser will ask for permission)."
    : "Your browser doesn't support voice — flip this on to try the flow.";

  return `
    <div class="pop-sheet-overlay" data-action="close-settings"></div>
    <div class="pop-sheet" role="dialog" aria-label="Settings">
      <div class="pop-sheet-handle"></div>
      <div class="pop-sheet-titlebar">
        <h2 class="pop-sheet-title">Settings</h2>
        <button class="pop-sheet-close" data-action="close-settings" aria-label="Close">×</button>
      </div>

      <div class="pop-sheet-section">
        <div class="pop-sheet-card">
          <div class="pop-sheet-card-row">
            <div class="pop-setting-text">
              <div class="pop-setting-title">Demo mode</div>
              <div class="pop-setting-sub">${escapeHtml(demoSub)}</div>
            </div>
            <button class="pop-toggle" data-action="toggle-demo"
              aria-checked="${state.demoMode}" aria-label="Toggle demo mode"></button>
          </div>
        </div>
      </div>

      <div class="pop-sheet-section">
        <div class="pop-section-eyebrow">Backup &amp; restore</div>
        <button class="pop-sheet-btn" data-action="export-data">
          <div class="pop-setting-text">
            <div class="pop-setting-title">Export backup</div>
            <div class="pop-setting-sub">Download a JSON file of your ${entryCount} ${entryCount === 1 ? "entry" : "entries"}, subjects, and links.</div>
          </div>
          <span class="pop-sheet-btn-chev">⇣</span>
        </button>
        <button class="pop-sheet-btn" data-action="import-data">
          <div class="pop-setting-text">
            <div class="pop-setting-title">Import backup</div>
            <div class="pop-setting-sub">Replace this device's data from a JSON backup file.</div>
          </div>
          <span class="pop-sheet-btn-chev">⇡</span>
        </button>
        <div class="pop-backup-status">${escapeHtml(state.backupStatus)}</div>
      </div>

      <div class="pop-sheet-section">
        <div class="pop-section-eyebrow">Links</div>
        ${renderLinkList()}
        ${renderLinkForm()}
      </div>

      <div class="pop-sheet-section">
        <button class="pop-sheet-btn pop-sheet-btn-danger" data-action="clear-entries">
          <div class="pop-setting-text">
            <div class="pop-setting-title">Clear all entries</div>
            <div class="pop-setting-sub pop-setting-sub-warn">${entryCount} saved · this can't be undone.</div>
          </div>
          <span class="pop-sheet-btn-chev">→</span>
        </button>
      </div>
    </div>
  `;
}

function renderLinkList() {
  if (!state.links.length) {
    return `<div class="pop-link-empty">No links saved. Add dashboards, curriculum pages, anything you want quick access to.</div>`;
  }
  const items = state.links
    .map(
      (l) => `
      <div class="pop-link-row">
        <div class="pop-link-row-main">
          <span class="pop-link-name">${escapeHtml(l.name)}</span>
          <a class="pop-link-url" href="${escapeHtml(l.url)}" target="_blank" rel="noreferrer">${escapeHtml(l.url)}</a>
          ${l.notes ? `<div class="pop-link-notes">${escapeHtml(l.notes)}</div>` : ""}
        </div>
        <button class="pop-link-del" data-action="delete-link" data-value="${escapeHtml(l.id)}" aria-label="Delete link">×</button>
      </div>`
    )
    .join("");
  return `<div class="pop-link-list">${items}</div>`;
}

function renderLinkForm() {
  return `
    <form class="pop-link-form" data-form="new-link" autocomplete="off">
      <input type="text" placeholder="Name (e.g. Times tables drill)" data-link-field="name" value="${escapeHtml(state.newLink.name)}" required />
      <input type="url" placeholder="https://…" data-link-field="url" value="${escapeHtml(state.newLink.url)}" required />
      <textarea placeholder="Notes (optional)" rows="2" data-link-field="notes">${escapeHtml(state.newLink.notes)}</textarea>
      <button class="pop-link-form-btn" type="submit">Add link</button>
    </form>
  `;
}

function renderToast() {
  if (!state.toast) return "";
  return `<div class="pop-toast">${escapeHtml(state.toast)}</div>`;
}

function render() {
  const body = state.tab === "entry" ? renderEntryTab() : renderHistoryTab();
  root.innerHTML = `
    <div class="pop-preview-banner">Preview · Pop redesign · Milestone 4</div>
    ${renderTopNav()}
    <div class="pop-screen">${body}</div>
    ${renderSettingsSheet()}
    ${renderToast()}
  `;
}

// ─── Helpers ────────────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ─── Event delegation ───────────────────────────────────────────────
root.addEventListener("click", (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const value = actionEl.dataset.value;

  if (action === "tab") {
    state.tab = value;
    if (state.tab === "entry" && state.phase === "saved") {
      resetEntry();
    }
    render();
    return;
  }
  if (action === "open-settings") {
    state.settingsOpen = true;
    render();
    return;
  }
  if (action === "close-settings") {
    state.settingsOpen = false;
    render();
    return;
  }
  if (action === "start-mic") {
    startListening();
    return;
  }
  if (action === "stop-mic") {
    stopListening();
    return;
  }
  if (action === "restart-mic") {
    if (pulseTimeout) clearTimeout(pulseTimeout);
    startListening();
    return;
  }
  if (action === "toggle-editor") {
    state.editor = state.editor === value ? null : value;
    render();
    return;
  }
  if (action === "close-editor") {
    state.editor = null;
    render();
    return;
  }
  if (action === "set-subject") {
    state.subject = value;
    state.justDetected = null;
    render();
    return;
  }
  if (action === "duration-step") {
    const delta = Number(value);
    const next = (state.duration ?? 30) + delta;
    state.duration = Math.min(60, Math.max(5, next));
    render();
    return;
  }
  if (action === "pick-photo") {
    photoInput.click();
    return;
  }
  if (action === "save") {
    saveCurrentEntry();
    return;
  }
  if (action === "log-another") {
    resetEntry();
    render();
    return;
  }
  if (action === "see-history") {
    state.tab = "history";
    resetEntry();
    render();
    return;
  }
  if (action === "fab-mic") {
    state.tab = "entry";
    resetEntry();
    startListening();
    return;
  }
  if (action === "toggle-demo") {
    state.demoMode = !state.demoMode;
    saveJson(DEMO_MODE_KEY, state.demoMode);
    render();
    return;
  }
  if (action === "export-data") {
    exportData();
    return;
  }
  if (action === "import-data") {
    importInput.click();
    return;
  }
  if (action === "clear-entries") {
    if (state.entries.length === 0) {
      setBackupStatus("Nothing to clear.");
      return;
    }
    const ok = window.confirm(
      `Clear all ${state.entries.length} entries? This can't be undone.`
    );
    if (!ok) return;
    state.entries = [];
    saveJson(STORAGE_KEYS.entries, []);
    state.streak = 0;
    setBackupStatus("All entries cleared.");
    return;
  }
  if (action === "delete-link") {
    state.links = state.links.filter((l) => l.id !== value);
    saveJson(STORAGE_KEYS.links, state.links);
    render();
    return;
  }
});

render();
