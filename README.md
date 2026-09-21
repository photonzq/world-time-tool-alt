# World Time Tool

An interactive, responsive world clock, timezone converter, and meeting scheduler designed for cross-timezone coordination. Built with zero runtime external dependencies using native browser `Intl` and `Temporal` APIs, fully compatible with curated Windows and IANA timezones.

---

## Features

- **Continuous Diurnal Timeline**:
  - 24-hour horizontal timeline with continuous gradient color shading representing night, sunrise/sunset transitions, and business working hours (9 AM – 5 PM).
  - Live "NOW" indicator needle tracking real-time local minutes and seconds.

- **Interactive Hour Pinning & Meeting Planner**:
  - Click or tap any hour cell to pin a cross-timezone snapshot.
  - Displays business status cards for every tracked city (`WORK`, `SHOULDER`, `NIGHT`, `WEEKEND`) with mutual business hour overlap calculation.

- **AI-Ready Natural Language Summary**:
  - Automatically synthesizes a clean, human-readable sentence description of the pinned time (e.g. *"Friday, Sep 18, 2026 at 4:00 PM EDT (New York) corresponds to 1:00 PM PDT (Los Angeles), 10:00 PM CEST (Berlin), and Sat, Sep 19 at 4:00 AM CST (Beijing)."*).
  - One-click copy for emails, calendar invitations, Slack, or LLM prompting.

- **Three Time Formats**:
  - **`am/pm`**: Standard 12-hour format with meridian indicators.
  - **`24`**: Standard 24-hour military/international clock format.
  - **`MX` (Mixed Native Mode)**: Displays each row according to its own country's regional clock convention via CLDR conventions (e.g., Zurich shows `05:42`, New York shows `11:47p`).

- **Full Mobile & Touch Ergonomics**:
  - Distinguishes horizontal swipe-scrolling from stationary tap-pinning without accidental column selections.
  - Form inputs configured with `font-size: 16px` to eliminate iOS Safari viewport auto-zoom.
  - Instant response with `touch-action: manipulation` (no 300ms tap delay).
  - Edge-to-edge mobile canvas and zero-truncation 2-row sticky sidebar on phone screens.

- **Zero-Dependency Architecture & Golden Test Suite**:
  - Self-contained single-file bundle (`index.html`) requiring no backend or npm installation.
  - Integrated 154-assertion self-test suite covering DST spring-forward gaps, fall-back overlaps, leap years, and International Date Line skips.

---

## Deployment to GitHub Pages

This repository is pre-configured for GitHub Pages:

1. Push this repository to GitHub.
2. Go to your repository on GitHub: **Settings** > **Pages** (under *Code and automation*).
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `main`, folder `/ (root)`.
   - Click **Save**.
4. GitHub Pages will build and deploy the standalone `index.html` at `https://<your-username>.github.io/<repo-name>/`.

---

## Local Development & Building

The standalone single-file `index.html` is generated using `bundle.py`:

```bash
# Build standalone index.html from source modules
python bundle.py
```

Source structure:
- `index.template.html`: Base HTML template.
- `style.css`: Stylesheets and mobile responsive rules.
- `zones.js` & `zones.json`: Curated Windows timezone database and IANA mappings.
- `app.js`: Core application logic, time engine, and UI handlers.
- `selftest.js`: Automated test suite with 154 golden assertions.
- `bundle.py`: Inlines HTML, CSS, and JS into single-file portable `index.html`.

---

## License

Dedicated to the public domain under the Creative Commons [CC0 1.0 Universal](LICENSE) license.
