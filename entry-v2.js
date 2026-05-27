// entry-v2.js — Pop direction, Milestone 1 (visual scaffold).
// Side-by-side preview at /entry-v2.html. The original entry.html is untouched.
// Behavior is intentionally minimal here — voice/save logic lands in M2.

const root = document.querySelector("#pop-root");

const state = {
  tab: "entry",
  phase: "idle",
  settingsOpen: false,
  // M1 stub — real streak comes in M2 once we read entries.
  streak: 0,
};

// ─── SVG glyphs (vanilla strings; will be lifted into a shared module later) ─
const svgWrap = (size, body) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const Glyphs = {
  Math: (size) =>
    svgWrap(
      size,
      `<rect x="5" y="6" width="22" height="20" rx="3"/>
       <line x1="5" y1="14" x2="27" y2="14"/>
       <line x1="5" y1="20" x2="27" y2="20"/>
       <circle cx="11" cy="14" r="2.4" fill="currentColor" stroke="none"/>
       <circle cx="20" cy="20" r="2.4" fill="currentColor" stroke="none"/>`
    ),
  Reading: (size) =>
    svgWrap(
      size,
      `<path d="M16 9 C 12 7, 8 7, 5 8 L 5 25 C 8 24, 12 24, 16 26 C 20 24, 24 24, 27 25 L 27 8 C 24 7, 20 7, 16 9 Z"/>
       <line x1="16" y1="9" x2="16" y2="26"/>`
    ),
  Writing: (size) =>
    svgWrap(
      size,
      `<path d="M22 5 L 27 10 L 11 26 L 5 27 L 6 21 Z"/>
       <line x1="19" y1="8" x2="24" y2="13"/>
       <line x1="6" y1="21" x2="11" y2="26"/>`
    ),
  Art: (size) =>
    svgWrap(
      size,
      `<path d="M16 5 C 9 5, 4 10, 4 16 C 4 22, 9 27, 15 27 C 17 27, 17 24, 18 23 C 19 22, 22 22, 24 22 C 27 22, 28 19, 28 16 C 28 10, 23 5, 16 5 Z"/>
       <circle cx="11" cy="12" r="1.6" fill="currentColor" stroke="none"/>
       <circle cx="17" cy="10" r="1.6" fill="currentColor" stroke="none"/>
       <circle cx="22" cy="13" r="1.6" fill="currentColor" stroke="none"/>
       <circle cx="10" cy="18" r="1.6" fill="currentColor" stroke="none"/>`
    ),
  Science: (size) =>
    svgWrap(
      size,
      `<path d="M12 5 L 20 5 M 13 5 L 13 13 L 6 25 C 5 27, 6 28, 8 28 L 24 28 C 26 28, 27 27, 26 25 L 19 13 L 19 5"/>
       <line x1="9" y1="22" x2="23" y2="22"/>`
    ),
  Music: (size) =>
    svgWrap(
      size,
      `<path d="M12 22 a 4 3 0 1 0 4 -3 L 16 7 L 24 9 L 24 12 L 16 10"/>`
    ),
};

const MicFilled = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
     <rect x="11" y="3" width="10" height="18" rx="5"/>
     <path d="M6 14 v 1 a 10 10 0 0 0 20 0 v -1 h -2 v 1 a 8 8 0 0 1 -16 0 v -1 z"/>
     <rect x="15" y="23" width="2" height="6" rx="1"/>
     <rect x="10" y="27" width="12" height="2" rx="1"/>
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

// ─── Render functions ───────────────────────────────────────────────
function renderTopNav() {
  return `
    <div class="pop-topnav">
      <div class="pop-tabs" role="tablist">
        <button class="pop-tab" role="tab" aria-selected="${state.tab === "entry"}" data-action="tab" data-value="entry">Entry</button>
        <button class="pop-tab" role="tab" aria-selected="${state.tab === "history"}" data-action="tab" data-value="history">History</button>
      </div>
      <button class="pop-gear" data-action="open-settings" aria-label="Settings">
        ${GearIcon(18)}
      </button>
    </div>
  `;
}

function renderDateRow() {
  // M1: cosmetic only — Today is hardcoded active.
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
  return `
    ${renderDateRow()}
    <div class="pop-idle">
      <h1 class="pop-idle-headline">How'd practice go?</h1>
      <p class="pop-idle-subhead">Tap the mic and tell me. I'll fill in the subject and time for you.</p>
      <button class="pop-mic-big" data-action="start-mic" aria-label="Start recording">
        ${MicFilled(60)}
      </button>
      ${
        state.streak > 0
          ? `<div class="pop-streak"><span class="pop-streak-dot"></span>${state.streak}-day streak · keep it going</div>`
          : ""
      }
    </div>
  `;
}

function renderEntryTab() {
  // M1: only idle is rendered. Other phases are M2+.
  if (state.phase === "idle") return renderIdle();
  return `<div class="pop-stub"><strong>${state.phase}</strong>coming in Milestone 2</div>`;
}

function renderHistoryTab() {
  return `<div class="pop-stub"><strong>History</strong>coming in Milestone 3</div>`;
}

function renderSettingsSheet() {
  if (!state.settingsOpen) return "";
  return `
    <div class="pop-sheet-overlay" data-action="close-settings"></div>
    <div class="pop-sheet" role="dialog" aria-label="Settings">
      <div class="pop-sheet-handle"></div>
      <div class="pop-sheet-titlebar">
        <h2 class="pop-sheet-title">Settings</h2>
        <button class="pop-sheet-close" data-action="close-settings" aria-label="Close">×</button>
      </div>
      <div class="pop-sheet-stub">Demo mode, backup &amp; restore, links — coming in Milestone 4.</div>
    </div>
  `;
}

function render() {
  const body =
    state.tab === "entry" ? renderEntryTab() : renderHistoryTab();
  root.innerHTML = `
    <div class="pop-preview-banner">Preview · Pop redesign · Milestone 1</div>
    ${renderTopNav()}
    <div class="pop-screen">${body}</div>
    ${renderSettingsSheet()}
  `;
}

// ─── Event delegation (single listener; rebinds survive re-render) ──
root.addEventListener("click", (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === "tab") {
    state.tab = actionEl.dataset.value;
    if (state.tab === "entry") state.phase = "idle";
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
    // M1: stub. M2 will start the recognizer.
    state.phase = "listening";
    render();
    return;
  }
});

render();
