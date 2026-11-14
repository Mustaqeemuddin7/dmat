/* readme-patch.js — update README for the v7 multi-file structure. */
'use strict';
const fs = require('fs');
const r = fs.readFileSync(__dirname + '/../README.md', 'utf8');
const i = r.indexOf('\n## Rebuilding');
if (i < 0) { console.error('marker missing'); process.exit(1); }
const updated = r.slice(0, i) + `
## Project structure & deployment (v7 — multi-file UI)

The app now ships in two forms, built from the same sources:

- **site/** — the multi-file website: index.html, css/styles.css, and js/ (bank,
  core, math, figures, cloud, deepnotes, notes-content, study-notes, app).
  This is what you deploy.
- **dmat-practice.html** — the same app as ONE self-contained file (offline
  sharing; the build inlines everything).

### Deploy to GitHub Pages (multi-file)

1. Repo Mustaqeemuddin7/dmat → **Add file → Upload files**.
2. Drag the **contents of deploy/** (index.html, the css folder, the js folder) —
   GitHub preserves the folder structure.
3. Commit. Settings → Pages → Deploy from branch main / root → Save (one time).
4. Live at https://mustaqeemuddin7.github.io/dmat/ — updates are just
   re-uploading changed files.

UI (v7): sidebar navigation with icons (top bar on mobile), redesigned dashboard
with stat chips and module icon cards, refined cards/tables/pills. Question
screens stay exam-neutral. White theme only; the ? stays red.

` + r.slice(i);
fs.writeFileSync(__dirname + '/../README.md', updated);
console.log('README updated for v7');
