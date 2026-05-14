# Academic Practice Logger

This is a local-first static web app for tracking academic practice, lessons, notes, and reference materials.

## Features
- Add entries with date, subject, duration, notes, and an optional photo
- Use browser voice transcription when supported
- Voice note blocks automatically include subject and duration context
- View rollups by day, week, month, and year
- Save external learning dashboard links and notes
- Uses separate pages for entry and dashboard views
- Works as a responsive browser app with no build step

## Run Locally
Open `index.html` in a browser for the basic experience.

For microphone access, use a local server in the project folder, for example:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000), which redirects to:
- [http://localhost:8000/entry.html](http://localhost:8000/entry.html)
- [http://localhost:8000/dashboard.html](http://localhost:8000/dashboard.html)

## PWA (Install to Home Screen)
This app includes a web app manifest and service worker so it can be installed as a PWA.

### iPhone/iPad (Safari)
1. Open the app over **HTTPS** (recommended) or from a supported environment.
2. Tap **Share**.
3. Tap **Add to Home Screen**.

Note: iOS generally requires **HTTPS** for full PWA behavior (service workers won’t reliably work over plain `http://` on a LAN).

### Hosting for your phone (recommended)
This repository auto-deploys to GitHub Pages on every push to `main` via `.github/workflows/pages.yml`. Once Pages is enabled in repo settings (Settings → Pages → Source: GitHub Actions), the app is live at `https://<owner>.github.io/academic-logger/` and installable on iPhone via Safari → Share → **Add to Home Screen**.

## Notes
- Data is stored in browser local storage for v1.
- Photo attachments are stored as data URLs, so very large photos may use a lot of storage.
- Cross-device sync is not included yet.
