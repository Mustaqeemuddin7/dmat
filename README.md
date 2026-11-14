# dMAT Core Module Practice Platform (v4 — multi-profile + cloud sync)

A single self-contained HTML file (`dmat-practice.html`) — HTML + CSS + vanilla
JavaScript, no external libraries, no build step needed. Open it in any modern
browser. Works fully offline; OPTIONAL cloud sync through a free Supabase
project adds cross-laptop sync and a live group comparison.

## What's inside

**Three complete Core Module subtests**, 5 difficulty classes × 50 questions
each = **750 validated questions**: Latin Squares (A–E grid), Mathematical
Equations (numeric input 1–20, the official worked-out format), Figure
Sequences (A–E SVG figures).

- **Profiles** — one per person, stored separately in IndexedDB; header chip
  switches people in one click.
- **Class Practice** — 50 s per question (amber < 20 s, red < 10 s), full
  explanations after every question, sequential/shuffled, resume anywhere.
- **Exam Simulation** — Standard (20 q, 6/6/5/3) and Advanced (20 Master) per
  module, one 25-minute timer, navigator + mark-for-review, auto-saved and
  resumable after interruption.
- **Adaptive Practice** — per module across all five classes.
- **Group Dashboard** — compares every profile: attempts, accuracy, avg time,
  per-class correct/attempted, per-module counts, ★ best-in-column, accuracy
  bars. Live from the cloud when connected.
- **Performance Analytics** — by class/type/technique, weakest techniques with
  retry queues, wrong/timed-out/slow lists, improvement trend.
- **Study Notes** — per-module techniques with verified worked examples.
- **Settings** — profile management, cloud sync config, export/import
  (validated before applying), per-module and full reset.

White professional theme. Keyboard: A–E answer, Enter submit/next, M mark (exam).

## Cloud sync with friends (Supabase, free)

1. **One person** creates a free project at supabase.com.
2. Authentication → Providers → Email → turn **OFF** "Confirm email".
3. SQL Editor → paste the SQL from the app's **Settings → Cloud sync → Setup
   guide** (creates dmat_profiles + dmat_results with Row Level Security:
   you can only write your own rows; the group can read) → Run.
4. Project Settings → API → copy the **Project URL** and **anon public key**.
5. Everyone opens the same HTML file → Settings → Cloud sync → paste URL + key
   → **Connect** → create their own account (email + password) → create a
   profile with their name.
6. Practice. Answers push automatically (a ☁ chip shows sync status); the
   **Group** tab shows everyone from every laptop, live.

Cross-device for yourself also works: sign in on another laptop and your
answers merge down (union by unique answer id — nothing is overwritten).
Without a cloud config the file remains a fully offline app; JSON export/import
stays available as a backup path.

**Security notes:** the anon key is public by design; safety comes from Row
Level Security. Anyone who gets the URL + key + an account can read the group's
scores — use a project you own. Data lives in your project on supabase.com.

## Question quality guarantees

Every embedded question passed at build time and is re-verified at page load:
structural validation, unique-answer brute force, solution-trace replay, and
duplicate detection (canonical forms). The original 200 Latin Squares questions
are regression-gated byte-identical (hash embedded in the bank metadata and
re-checked in the browser).

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


## Rebuilding / extending (dev folder)

- core.js / math.js / figures.js — the three module engines
- cloud.js — optional Supabase sync layer (vanilla fetch REST)
- makebank.js — builds + audits all banks → bank.json (regression gate)
- template.html + app.js — UI source; build.js assembles the final file
- mock-supabase.js — test double for the automated e2e sync test:
  node dev/mock-supabase.js 8787, then open
  dmat-practice.html?selftest=1&holdload=1&cloud=http://127.0.0.1:8787&clouduser=you@test.local
  (this verifies the full auth → push → pull → multi-user pipeline headlessly;
  ?cloud=/?clouduser= are test hooks, production config happens in Settings)


A single self-contained HTML file (`dmat-practice.html`) — HTML + CSS + vanilla
JavaScript, no external libraries, no backend. Open it in any modern browser
(double-click, or File → Open). Everything runs locally.

## What's inside (v2)

**Three complete Core Module subtests**, 5 difficulty classes × 50 questions
each = **750 validated questions**:

| Module | Answer format | Classes |
|---|---|---|
| Latin Squares | A–E buttons (5×5 grid) | Easy · Medium · Hard · Extreme · **Master** |
| Mathematical Equations | numeric input 1–20 (official format: "answers are worked out") | Easy · … · Master |
| Figure Sequences | A–E SVG figures | Easy · … · Master |

- **Class Practice** — 50 s per question (amber < 20 s, red < 10 s, timeout =
  wrong), full step-by-step explanations after every question, sequential or
  shuffled, jump/resume at any question number, five classes.
- **Exam Simulation** — per module: Standard (20 q: 6/6/5/3 Easy→Extreme, no
  Master) and **Advanced** (20 Master questions), one 25-minute timer, navigator
  with answered/marked states, mark-for-review (M), warning before submitting
  blanks, results + full review. Interrupted exams are auto-saved and can be
  resumed from the Dashboard (timer continues from the saved moment).
- **Adaptive Practice** — per module; promotes/demotes across all five classes
  (Master only after Extreme is under control), prioritises unseen/failed
  questions, recommendations from saved performance.
- **Study Notes** — per-module techniques with worked examples from the
  platform's own verified generators, "studied" checkboxes (persisted),
  difficulty-class cards, sources consulted.
- **Performance Analytics** — per-module or combined scope; accuracy by class /
  type / technique, weakest techniques with retry queues, wrong / timed-out /
  slow (>50 s, >75 s) lists, improvement over the session.
- **Settings & Data Management** — storage status, space usage, last save,
  export/import all progress as JSON (validated before applying), per-module
  and full reset with confirmation dialogs.

**White professional theme** (single theme, no dark mode). Latin Squares `?`
stays red. Keyboard: `A`–`E` answer, `Enter` submit/next, `M` mark (exam).

## Multi-profile + Group Dashboard (v3)

Open the file → enter your name → that's your profile. Each of the four of you creates one profile **in the same browser on the same computer** — progress, exams, positions and statistics are stored completely separately (IndexedDB, namespaced per profile). The header chip (👤 name · switch) flips between people in one click, and the new **Group** tab compares everyone: attempts, accuracy, average time, per-class correct/attempted, per-module counts, best-in-column ★ markers and per-person accuracy bars.

If friends practise **on other devices/browsers**, one file cannot magically sync (there is no server, by design). Instead: each person opens their copy → Settings → **Export all progress as JSON** → sends you the file → you open your copy → Settings → **Import progress** → choose *Create profile from file*. Their full history appears as a comparable profile on your Group tab, and your own progress is never touched. To combine someone's progress into yours, choose *Merge* instead (duplicate answers are skipped).

## Permanent progress (IndexedDB)

Progress is saved automatically to IndexedDB (database `dmat-practice`, versioned
schema v2 with an ordered migration registry) after every answered question,
mark, navigation, exam action and settings change — with a Saved / Saving… /
Save failed indicator in the header. **IndexedDB data lives in this browser on
this device only** — it does not sync; use Settings → Export for backup and
transfer between devices. If storage is unavailable (private mode quirks,
blocked database), the app continues in memory with a clear "Save failed"
indicator instead of hanging.

## Question quality guarantees

Every embedded question passed at build time **and** is re-verified at page load:
1. structural validation,
2. unique-answer brute force (Latin: completion enumeration; Math: exact
   full-rank Gaussian elimination + brute force for ≤4 letters + true values;
   Figures: rule recomputation + option-distinctness + single-answer check),
3. solution-trace replay,
4. duplicate detection (Latin: canonical form under row/column permutations,
   transpose and relabelling; Math: normalised equation matrix under letter
   permutations; Figures: rule-set + start-config identity).

The original 200 Latin Squares questions (v1) are preserved **byte-identically**
— enforced by a regression gate in `dev/makebank.js` (hash of the 200 rebuilt
questions must equal the v1 reference hash, embedded in the bank metadata and
re-checked in the browser at load).

## Rebuilding / extending (dev folder)

- `dev/core.js` — Latin Squares engine (RNG, generator, carver, technique
  solver with traces, classifier incl. `classifyMaster`, validators, dedup).
- `dev/math.js` — Mathematical Equations engine (system generator, rank-based
  uniqueness proof, substitution/elimination traces).
- `dev/figures.js` — Figure Sequences engine (rule engine, SVG renderer,
  distractor generator with per-distractor explanations, validators).
- `dev/makebank.js` — builds + audits all three banks → `dev/bank.json`
  (run `node dev/makebank.js`).
- `dev/template.html` + `dev/app.js` — UI source (theme, storage, views).
- `dev/build.js` — assembles `dmat-practice.html` (run `node dev/build.js`).

Note on testing: automated headless runs cannot exercise IndexedDB (Chromium
virtual-time limitation — disk I/O does not participate), so the suite reports
1 SKIP there and the app falls back to memory mode with a visible indicator.
Open the file normally in a browser once and answer a question to confirm the
"Saved" indicator appears; progress then survives refresh and restart.
