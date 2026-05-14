# Academic Practice Logger Spec

## 1) Objective
Create a simple academic logging app for tracking a child's lessons, practice sessions, and supporting materials across subjects.

- Problem to solve: Practice and lesson activity is currently scattered across notes, memory, and external platforms.
- Intended user/value: A parent can quickly log activities by text or voice, attach photos, and review progress over time from desktop or mobile.
- Why this matters now: A lightweight, reusable logging workflow creates a strong foundation before adding mastery goals, curriculum mapping, and integrations.

## 2) User Story
> As a parent tracking a child's learning, I want to log academic practice and lessons in one place, so that I can review time spent, subjects covered, notes, and supporting materials over time.

## 3) Scope

### In Scope
- Create, edit, and delete log entries with date, subject, duration, and notes.
- Add notes by typing or browser microphone transcription.
- Attach a photo to an entry for artwork, handwritten work, or reference materials.
- View totals and notes by day, week, month, and year.
- Store links and short notes for external learning dashboards such as Beast Academy, Synthesis, and IXL.
- Use a responsive layout that works on desktop and iPhone Safari.

### Out of Scope
- Accounts, sign-in, or multi-user collaboration.
- Live syncing with third-party services.
- Full mastery goals and curriculum mapping logic.

## 4) Acceptance Criteria
- [ ] A user can create an entry with a date, subject, duration, notes, and an optional photo.
- [ ] A user can use the microphone button to append transcribed speech to the notes field when browser support is available.
- [ ] The dashboard shows accurate total minutes and entry counts for day, week, month, and year views.
- [ ] The dashboard shows per-subject minute totals and notes for the selected period.
- [ ] The app stores and reloads data locally between sessions.
- [ ] The UI remains usable on iPhone 14 sized screens.
- [ ] A user can save named external links with notes for later reference.

## 5) Technical Constraints
- Language/framework: HTML, CSS, and vanilla JavaScript.
- Runtime/platform: Static browser app with no build step.
- Dependencies allowed: None for v1.
- Dependencies not allowed: Server-only frameworks and remote databases in v1.
- File/folder constraints: Keep the app self-contained inside `projects/academic-logger/`.
- Performance/accessibility/security constraints: Use semantic form controls, readable contrast, touch-friendly sizes, and local-only persistence.

## 6) UX/UI Constraints
- Layout expectations: Single-page app with clear sections for adding entries, dashboard summaries, entries list, and external links.
- Visual style/tone: Calm, clean, parent-friendly dashboard with minimal clutter.
- Responsive behavior: Stack cards vertically on mobile and use larger tap targets.
- Accessibility requirements: Labels for all form fields, keyboard-usable controls, and meaningful empty states.
- Interaction details: Voice input should have a visible status, filters should update dashboard results immediately, and photo previews should be shown before save.

## 7) Verification Steps

### Automated Checks
- Open the app in a browser without console errors.

### Manual Checks
- Create entries in two or more subjects on different dates and confirm rollups change correctly.
- Use subject and period filters to verify totals and notes change correctly.
- Attach a photo and confirm it persists after refresh.
- Save an external link and confirm it appears in the references section.
- Test the responsive layout around iPhone 14 viewport width.

## 8) Iteration Notes
- Version: v1
- What was changed: Initial MVP scope defined for local-first responsive web app.
- Why: Fastest path to a useful working prototype.
- Result: Ready for implementation.

## 9) Definition of Done
- [ ] Acceptance criteria all pass.
- [ ] Verification steps executed and documented.
- [ ] App works as a standalone local-first static project.
- [ ] Future placeholders for goals/curriculum/integrations do not block current use.

## 10) Artifact Log
- Spec file: `projects/academic-logger/spec.md`
- Prompt log: `projects/academic-logger/prompts.md`
- Retrospective: `projects/academic-logger/retrospective.md`
