/* ============================================================================
   dMAT Core Module Practice — application layer (v2)
   ----------------------------------------------------------------------------
   v2 additions over v1:
   - IndexedDB persistent progress (versioned schema + migration registry),
     autosave with status indicator, resume everywhere, interrupted-exam
     recovery, Settings / data management.
   - White professional theme (single theme; dark mode removed).
   - Fifth difficulty class MASTER (Latin Squares; bank preserved bit-for-bit).
   - Two new fully functional modules: Mathematical Equations (numeric input,
     per the official "worked out" format) and Figure Sequences (SVG).
   - Per-module adaptive practice, analytics, exam modes (standard + advanced).
   Data lives in JavaScript memory and is written through to IndexedDB; nothing
   ever leaves the device.
   ========================================================================== */
'use strict';
const C = DMATCore, M = MathEq, F = FigSeq, Cloud = DMATCloud, DN = DMATDeepNotes;
/* The group's shared Supabase project, baked in so every friend just opens the
   file, creates an account and practises. The key is a PUBLIC publishable key
   (row-level security protects the data). Settings can override or disable. */
const BAKED_CLOUD = { url: 'https://vhtwomzqpamaqhntehha.supabase.co', key: 'sb_publishable_uzHcmjBGUvgXJLkeBxeCXg_QU3VlChz' };
self.DMAT_BAKED_CLOUD = BAKED_CLOUD; // consumed by cloud.js when no local override exists
const $ = s => document.querySelector(s);
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

const CLASSES = ['Easy', 'Medium', 'Hard', 'Extreme', 'Master'];
const TYPE_LABEL = { a: 'Direct cross', b: 'Letter scan', c: 'Trapped candidate', d: 'Busiest line', e: 'Veto trap', f: 'Phantom chain', g: 'Empty cross', h: 'Missing pair', i: 'Decoy-rich', j: 'Pair / wing', chain: 'Substitution chain', mul: 'Multiples', direct: 'Direct value', elim: 'Elimination pair', rotate: 'Rotation', move: 'Movement', shade: 'Shading', color: 'Colour cycle', swap: 'Position swap', 'alt-rotate': 'Alternating rotation', 'alt-shade': 'Alternating shading', multi: 'Multi-rule' };
const TECH_NAME = {
  latin: { 1: 'The Cross', 2: 'Letter Scan', 3: 'Trapped Candidate', 4: 'Busiest Line', 5: 'Column Veto', 6: 'Phantom Cells', 7: 'Empty Cross', 8: 'Missing Pair', 9: 'Choose the Road', 10: 'Skip & Guess', 11: 'Naked Single', 12: 'Hidden Single', 13: 'Naked Pair', 14: 'Hidden Pair', 15: 'X-Wing', 16: 'Mental Shortcut', 17: 'Letter Tally' },
  math: { 1: 'Substitution', 2: 'Elimination', 3: 'Multiples & Factors', 4: 'Differences', 5: 'Check by Substitution', 6: 'Mental Math' },
  figures: { 1: 'Track One Element', 2: 'Combine Two Rules', 3: 'Multi-Rule Tracking', 4: 'Distractor Elimination', 5: 'Period Recognition' }
};
/* ------------------------------ module registry ---------------------------
   Every module implements the same interface:
   { id, name, answerKind, generate, render, checkAnswer, explain, validate,
     classify, saveProgress, loadProgress, getPerformance }                */
const LatinModule = {
  id: 'latin', name: 'Latin Squares', header: 'Core Module – Latin Squares', answerKind: 'letter',
  bank: BANK.latin.questions, examples: BANK.latin.examples,
  generate(opts) { opts = opts || {}; let pool = opts.cls ? bankQ(this.id, opts.cls) : this.bank; if (opts.exclude) pool = pool.filter(q => opts.exclude.indexOf(q.id) < 0); if (!pool.length) pool = this.bank; return pool[Math.floor(Math.random() * pool.length)]; },
  render(c, q, o) { renderQuestionView(c, q, o || {}); },
  checkAnswer(q, a) { return a === q.answer; },
  explain(c, q, r) { renderLatinExplanation(c, q, r); },
  validate(q) {
    const g = Int8Array.from(q.grid.map(v => v === null ? 0 : C.LTR.indexOf(v) + 1));
    const sol = Int8Array.from(q.solution.map(v => C.LTR.indexOf(v) + 1));
    const errs = C.validatePuzzle(g, q.target, sol, C.LTR.indexOf(q.answer) + 1);
    const ua = C.validateUniqueAnswer(g, q.target);
    if (!ua.unique || ua.answer !== C.LTR.indexOf(q.answer) + 1) errs.push('uniqueness');
    return errs;
  },
  classify() { return CLASSES.slice(); },
  saveProgress() { return Save.mark(); },
  loadProgress() { return S.practice[this.id + ':'] || null; },
  getPerformance() { return moduleStats(this.id); }
};
const MathModule = {
  id: 'math', name: 'Mathematical Equations', header: 'Core Module – Mathematical Equations', answerKind: 'number',
  bank: BANK.math.questions, examples: null,
  generate(opts) { opts = opts || {}; let pool = opts.cls ? bankQ(this.id, opts.cls) : this.bank; if (opts.exclude) pool = pool.filter(q => opts.exclude.indexOf(q.id) < 0); if (!pool.length) pool = this.bank; return pool[Math.floor(Math.random() * pool.length)]; },
  render(c, q, o) { renderQuestionView(c, q, o || {}); },
  checkAnswer(q, a) { return parseInt(a, 10) === q.answer; },
  explain(c, q, r) { renderMathExplanation(c, q, r); },
  validate(q) {
    const errs = [];
    const rows = q.eqs.map(e => M.eqRow(e, q.k));
    if (M.rankOf(rows, q.k) !== q.k) errs.push('rank<k');
    const tr = M.buildTrace(q.eqs, q.k, q.values);
    if (!tr.ok) errs.push('trace');
    if (q.values[q.target] !== q.answer) errs.push('answer');
    return errs;
  },
  classify() { return CLASSES.slice(); },
  saveProgress() { return Save.mark(); },
  loadProgress() { return S.practice[this.id + ':'] || null; },
  getPerformance() { return moduleStats(this.id); }
};
const FiguresModule = {
  id: 'figures', name: 'Figure Sequences', header: 'Core Module – Figure Sequences', answerKind: 'letter',
  bank: BANK.figures.questions, examples: null,
  generate(opts) { opts = opts || {}; let pool = opts.cls ? bankQ(this.id, opts.cls) : this.bank; if (opts.exclude) pool = pool.filter(q => opts.exclude.indexOf(q.id) < 0); if (!pool.length) pool = this.bank; return pool[Math.floor(Math.random() * pool.length)]; },
  render(c, q, o) { renderQuestionView(c, q, o || {}); },
  checkAnswer(q, a) { return a === q.answer; },
  explain(c, q, r) { renderFigExplanation(c, q, r); },
  validate(q) { return F.validateQuestion(q); },
  classify() { return CLASSES.slice(); },
  saveProgress() { return Save.mark(); },
  loadProgress() { return S.practice[this.id + ':'] || null; },
  getPerformance() { return moduleStats(this.id); }
};
const MODS = { latin: LatinModule, math: MathModule, figures: FiguresModule };
const MOD_IDS = ['latin', 'math', 'figures'];
const _bankQ = {};
CLASSES.forEach(cls => MOD_IDS.forEach(mid => { (_bankQ[mid] = _bankQ[mid] || {})[cls] = BANK[mid].questions.filter(q => q.cls === cls); }));
function bankQ(mid, cls) { return _bankQ[mid][cls]; }
const Q_BY_ID = {}; MOD_IDS.forEach(mid => BANK[mid].questions.forEach(q => Q_BY_ID[q.id] = q));

/* ============================== STORAGE LAYER ==============================
   IndexedDB, database 'dmat-practice', versioned schema. Migrations run in
   order inside onupgradeneeded; each step is small and additive so future
   updates never destroy existing progress. */
const Store = {
  NAME: 'dmat-practice', VERSION: 4, db: null, ok: false, error: null,
  migrations: [
    { v: 1, note: 'initial schema', up(db) { db.createObjectStore('results', { keyPath: 'uid' }); db.createObjectStore('kv'); } },
    { v: 2, note: 'v2: multi-module + Master + learning state (kv shape only, no structural change needed)', up(db) { } },
    { v: 3, note: 'v3: multi-profile support — existing progress becomes the profile "Me"', up(db, tx) {
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles');
        // stamp pre-v3 results with the default profile name
        const cur = tx.objectStore('results').openCursor();
        cur.onsuccess = (ev2) => { const c = ev2.target.result; if (c) { const r = c.value; if (!r.profile) { r.profile = 'Me'; c.update(r); } c.continue(); } };
        // namespace the kv state under the profile name
        const kv = tx.objectStore('kv');
        const g = kv.get('state');
        g.onsuccess = () => { const st = g.result; if (st) { st.profile = 'Me'; kv.put(st, 'state:Me'); kv.delete('state'); } };
        const l = kv.get('lastSaved');
        l.onsuccess = () => { const v2 = l.result; if (v2) { kv.put(v2, 'lastSaved:Me'); kv.delete('lastSaved'); } };
      } },
    { v: 4, note: 'v6: learning centre — topic states / bookmarks / recent / example completion are additive fields inside the per-profile kv state (no structural change)', up(db, tx) { } }
  ],
  open() {
    return new Promise((resolve) => {
      let settled = false;
      const done = val => { if (!settled) { settled = true; resolve(val); } };
      // resilience: if the database never answers (blocked, private mode,
      // automation quirks), continue WITHOUT storage instead of hanging
      const guard = setTimeout(() => { if (!settled) { this.fail(new Error('storage did not respond in time')); done(false); } }, 6000);
      let req;
      try { req = indexedDB.open(this.NAME, this.VERSION); }
      catch (e) { clearTimeout(guard); this.fail(e); return done(false); }
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        this.migrations.forEach(m => { if (m.v <= this.VERSION && m.v > ev.oldVersion) { try { m.up(db, ev.target.transaction, ev.oldVersion); } catch (e) { console.warn('migration step ' + m.v + ' issue', e); } } });
      };
      req.onsuccess = () => { clearTimeout(guard); this.db = req.result; this.ok = true; done(true); };
      req.onerror = () => { clearTimeout(guard); this.fail(req.error); done(false); };
      req.onblocked = () => { clearTimeout(guard); this.fail(new Error('database blocked by another tab')); done(false); };
    });
  },
  fail(e) { this.ok = false; this.error = e; console.warn('IndexedDB unavailable:', e); },
  tx(store, mode) { return this.db.transaction(store, mode).objectStore(store); },
  put(store, val, key) { return new Promise((res, rej) => { const r = key !== undefined ? this.tx(store, 'readwrite').put(val, key) : this.tx(store, 'readwrite').put(val); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); },
  get(store, key) { return new Promise((res) => { const r = this.tx(store, 'readonly').get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); }); },
  all(store) { return new Promise((res) => { const r = this.tx(store, 'readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); }); },
  del(store, key) { return new Promise((res) => { const r = this.tx(store, 'readwrite').delete(key); r.onsuccess = () => res(); r.onerror = () => res(); }); },
  clear(store) { return new Promise((res) => { const r = this.tx(store, 'readwrite').clear(); r.onsuccess = () => res(); r.onerror = () => res(); }); }
};
/* autosave with debounce + status indicator */
const Save = {
  timer: null, pending: false,
  mark() {
    this.pending = true;
    setStatus('Saving…', 'saving');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
  },
  async flush() {
    if (!this.pending) return;
    this.pending = false;
    if (!Store.ok) { setStatus('Save failed — storage unavailable', 'failed'); return; }
    try {
      await Store.put('kv', S.stateSnapshot(), kState());
      await Store.put('kv', { at: Date.now() }, 'lastSaved:' + S.profile);
      setStatus('Saved ' + new Date().toLocaleTimeString(), '');
      if (Cloud.ready()) Cloud.flush(S.profile, uid => S.results.find(x => x.uid === uid), activeCloudStats());
    } catch (e) { console.warn('save failed', e); setStatus('Save failed', 'failed'); }
  }
};
function setStatus(text, cls) { const n = $('#saveStatus'); if (n) { n.textContent = text; n.className = cls; } }

/* ------------------------------ profiles (v3) ------------------------------
   Several people can prepare with the same file: every profile keeps its own
   results, practice positions, exams and learning progress in THIS browser.
   To compare with friends practising on other devices, each exports a JSON
   file (Settings) and imports it here as a comparable profile — nothing is
   uploaded anywhere, and your own progress is never overwritten. */
const Profiles = {
  map: {},          // name -> {createdAt, lastActivity, imported}
  active: null,
  async load() {
    if (Store.ok) {
      this.map = (await Store.get('kv', 'profiles')) || {};
      const saved = await Store.get('kv', 'activeProfile');
      if (saved && this.map[saved]) this.active = saved;
      else {
        const names = this.names();
        if (names.length === 1) this.active = names[0];
        else if (names.length > 1) { this.active = localStorage.getItem('dmat.activeProfile'); if (!this.active || !this.map[this.active]) this.active = null; }
      }
    }
    if (!this.active && !Store.ok) this.active = this.names()[0] || null;
  },
  names() { return Object.keys(this.map).sort((a, b) => (this.map[a].createdAt || 0) - (this.map[b].createdAt || 0)); },
  async create(name) {
    name = String(name || '').trim().slice(0, 24);
    if (!name) throw new Error('Please enter a name.');
    if (this.names().some(n => n.toLowerCase() === name.toLowerCase())) throw new Error('A profile with that name already exists.');
    this.map[name] = { createdAt: Date.now(), lastActivity: Date.now() };
    try { if (Store.ok) await Store.put('kv', this.map, 'profiles'); } catch (e) { }
    return name;
  },
  async setActive(name) {
    if (!this.map[name]) throw new Error('Unknown profile');
    this.active = name;
    try { localStorage.setItem('dmat.activeProfile', name); } catch (e) { }
    try { if (Store.ok) await Store.put('kv', name, 'activeProfile'); } catch (e) { }
  },
  async rename(oldName, newName) {
    newName = String(newName || '').trim().slice(0, 24);
    if (!newName || this.names().some(n => n.toLowerCase() === newName.toLowerCase() && n !== oldName)) throw new Error('Invalid or duplicate name.');
    const meta = this.map[oldName]; delete this.map[oldName]; this.map[newName] = meta;
    if (Store.ok) {
      const st = await Store.get('kv', 'state:' + oldName);
      if (st) { st.profile = newName; await Store.put('kv', st, 'state:' + newName); await Store.del('kv', 'state:' + oldName); }
      const all = await Store.all('results');
      for (const r of all) if (r.profile === oldName) { r.profile = newName; await Store.put('results', r); }
      await Store.put('kv', this.map, 'profiles');
      if (this.active === oldName) {
        this.active = newName;
        try { localStorage.setItem('dmat.activeProfile', newName); } catch (e) { }
        await Store.put('kv', newName, 'activeProfile');
      }
    } else this.active = newName;
  },
  async remove(name) {
    if (!this.map[name]) throw new Error('Unknown profile');
    if (Store.ok) {
      const all = await Store.all('results');
      for (const r of all) if (r.profile === name) await Store.del('results', r.uid);
      await Store.del('kv', 'state:' + name);
      await Store.del('kv', 'lastSaved:' + name);
      delete this.map[name];
      await Store.put('kv', this.map, 'profiles');
      if (this.active === name) {
        this.active = this.names()[0] || null;
        try { if (this.active) localStorage.setItem('dmat.activeProfile', this.active); else localStorage.removeItem('dmat.activeProfile'); } catch (e) { }
        if (this.active) await Store.put('kv', this.active, 'activeProfile'); else await Store.del('kv', 'activeProfile');
      }
    } else { delete this.map[name]; if (this.active === name) this.active = this.names()[0] || null; }
  },
  async touch() {
    if (this.active && this.map[this.active]) {
      this.map[this.active].lastActivity = Date.now();
      try { if (Store.ok) Store.put('kv', this.map, 'profiles'); } catch (e) { }
    }
  }
};
const kState = () => 'state:' + S.profile;
// per-profile stash used ONLY when IndexedDB is unavailable (memory fallback)
const MemStash = { state: {}, results: {} };

/* ================================ app state ================================ */
const S = {
  profile: null,          // active profile name (v3 multi-user)
  results: [],            // {uid, module, qid, cls, type, techs, outcome, timeSec, user, at}
  practice: {},           // 'module:cls' -> {idx, mode, order?}
  activeModule: 'latin',
  exam: null,             // live exam snapshot (also persisted for resume)
  adaptive: {},           // module -> {ladder, lastIds, done}
  learning: { studied: {}, topics: {}, bookmarks: [], recent: [], exDone: {}, weakImproved: {} },  // per technique key -> timestamp
  prefs: {}
};
S.stateSnapshot = function () {
  return {
    schema: Store.VERSION,
    profile: this.profile,
    practice: this.practice, activeModule: this.activeModule,
    adaptive: this.adaptive, learning: this.learning, prefs: this.prefs,
    exam: this.exam && !this.exam.submitted ? serializeExam(this.exam) : null,
    lastActivity: Date.now()
  };
};
function recordResult(q, outcome, timeSec, user) {
  S.results.push({
    uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    profile: S.profile,
    module: q.module, qid: q.id, cls: q.cls, type: q.type, techs: (q.techs || []).slice(),
    outcome, timeSec: Math.round(timeSec), user: user === null || user === undefined ? null : String(user), at: Date.now()
  });
  if (Store.ok) { const r = S.results[S.results.length - 1]; Store.put('results', r).catch(() => setStatus('Save failed', 'failed')); }
  Profiles.touch();
  Cloud.queueUid(S.results[S.results.length - 1].uid);
  Save.mark();
}

/* --------------------------------- boot ----------------------------------- */
async function boot() {
  try {
  buildTabs();
  setStatus('Storage: starting…', 'saving');
  const ok = await Store.open();
  Cloud.load(); // picks up the baked group project or a saved override
  await Profiles.load();
  if (Profiles.active) {
    S.profile = Profiles.active;
    if (Cloud.cfg && Cloud.session) {
      try { await Cloud.ensureSession(); await cloudPullMine(); }
      catch (e) { console.warn('cloud resume failed', e); }
    }
    await loadProfileState();
  } else if (ok) {
    setStatus('Storage ready — create a profile to start', '');
  } else {
    setStatus('Save failed — storage unavailable', 'failed');
  }
  const p = new URLSearchParams(location.search);
  const view = p.get('view'), run = p.get('run');
  if (p.get('mod') && MOD_IDS.indexOf(p.get('mod')) >= 0) S.activeModule = p.get('mod');
  if (p.get('tab')) S.notesTab = p.get('tab') === 'deep' ? 'deep' : 'tech';
  if (p.get('snmod')) { StudyNotes.compile(); S.snState = { page: 'module', module: p.get('snmod'), topic: p.get('sntopic') || null }; }
  if (p.get('revmod')) { StudyNotes.compile(); S.snState = { page: 'rev', module: p.get('revmod'), dur: +(p.get('revdur') || 5) }; }
  if (p.get('cloud')) { // quick cloud config (also used by the automated tests)
    Cloud.cfg = { url: p.get('cloud').trim(), key: (p.get('cloudkey') || 'mock-anon-key').trim() };
    Cloud.persistCfg();
  }
  showView(run === 'practice' ? 'class' : run === 'exam' ? 'exam' : (['dashboard', 'notes', 'class', 'exam', 'adaptive', 'analytics', 'settings'].indexOf(view) >= 0 ? view : 'dashboard'));
  if (run === 'practice') { startPractice(S.activeModule, p.get('cls') || 'Easy', 'seq'); showPracticeQuestion(); }
  if (run === 'exam') { buildExam(p.get('kind') === 'advanced' ? 'advanced' : 'standard'); }
  if (run === 'explain') demoExplain(p.get('mod') || 'latin');
  if (run === 'analytics') { seedDemoResults(); showView('analytics'); }
  if (run === 'group') { // demo: three friend profiles with plausible progress
    ['Maya', 'Omar', 'Sara'].forEach((nm, pi) => {
      Profiles.map[nm] = { createdAt: Date.now() - (pi + 1) * 86400000, lastActivity: Date.now() - pi * 3600000 };
      const R = [];
      ['latin', 'math', 'figures'].forEach((mid, mi) => {
        ['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Extreme'].forEach((cls, i) => {
          const q = bankQ(mid, cls)[(i * 9 + pi * 5) % 50];
          R.push({ uid: 'demo' + pi + mi + i, profile: nm, module: mid, qid: q.id, cls: q.cls, type: q.type, techs: q.techs,
                   outcome: (i + pi) % 4 === 3 ? 'wrong' : 'correct', timeSec: 20 + ((i * 13 + pi * 7) % 35), user: q.answer, at: Date.now() - (pi * 3 + i) * 3600000 });
        });
      });
      MemStash.results[nm] = R;
    });
    S.profile = 'Maya'; Profiles.active = 'Maya'; S.results = MemStash.results['Maya'];
    showView('group');
  }
  if (Cloud.cfg && p.get('clouduser')) {
    try { await Cloud.signIn(p.get('clouduser'), p.get('cloudpass') || 'test1234'); }
    catch (e1) { try { await Cloud.signUp(p.get('clouduser'), p.get('cloudpass') || 'test1234'); } catch (e2) { console.warn('cloud test login failed', e2.message); } }
    try { await cloudPullMine(); } catch (e3) { }
  }
  if (!S.profile && p.get('clouduser')) { try { await createAndSwitch(p.get('clouduser').split('@')[0]); } catch (e4) { } }
  renderProfileChip();
  renderCloudChip();
  if (p.get('selftest')) selftest();
  window.addEventListener('unhandledrejection', ev => { setStatus('Async error: ' + (ev.reason && ev.reason.message || ev.reason), 'failed'); });
window.addEventListener('error', ev => { setStatus('Error: ' + ev.message + ' @ ' + (ev.filename || '').split('/').pop() + ':' + ev.lineno, 'failed'); });
window.addEventListener('visibilitychange', () => { if (document.hidden) Save.flush(); });
  } catch (err) { setStatus('Boot error: ' + (err && err.message || err), 'failed'); console.error('BOOT ERROR', err); }
}
function serializeExam(e) {
  return { module: e.module, kind: e.kind, ids: e.qs.map(q => q.id), answers: e.answers, marks: Array.from(e.marks), idx: e.idx, left: e.left, qTimes: e.qTimes, totalStart: e.totalStart, submitted: !!e.submitted, interruptedAt: Date.now() };
}
function deserializeExam(o) {
  if (!o || !o.ids) return null;
  const qs = o.ids.map(id => Q_BY_ID[id]).filter(Boolean);
  if (qs.length !== o.ids.length) return null;
  return { module: o.module, kind: o.kind || 'standard', qs, answers: o.answers, marks: new Set(o.marks || []), idx: o.idx || 0, left: o.left, qTimes: o.qTimes, totalStart: o.totalStart, submitted: !!o.submitted, resumed: true };
}

/* ------------------------- profile runtime (v3) ---------------------------- */
async function loadProfileState() {
  if (!S.profile) return;
  if (!Store.ok) { // memory fallback
    S.results = MemStash.results[S.profile] || [];
    const st = MemStash.state[S.profile];
    if (st) restoreState(st);
    return;
  }
  const st = await Store.get('kv', kState());
  const migrated = st && st.schema && st.schema < Store.VERSION;
  if (st) restoreState(st); else { S.practice = {}; S.exam = null; S.adaptive = {}; S.learning = { studied: {}, topics: {}, bookmarks: [], recent: [], exDone: {}, weakImproved: {} }; S.prefs = {}; }
  const all = await Store.all('results');
  S.results = all.filter(r => r.profile === S.profile);
  const last = await Store.get('kv', 'lastSaved:' + S.profile);
  setStatus(last && last.at ? 'Saved ' + new Date(last.at).toLocaleTimeString() : 'Storage ready — nothing saved yet', '');
  if (migrated) toast('Profile "' + S.profile + '" restored — database schema v' + Store.VERSION + '.');
  renderProfileChip();
}
function restoreState(st) {
  S.practice = st.practice || {};
  S.activeModule = MOD_IDS.indexOf(st.activeModule) >= 0 ? st.activeModule : 'latin';
  S.adaptive = st.adaptive || {};
  S.learning = Object.assign({ studied: {}, topics: {}, bookmarks: [], recent: [], exDone: {}, weakImproved: {} }, st.learning || {});
  S.prefs = st.prefs || {};
  if (st.exam) S.exam = deserializeExam(st.exam);
}
async function switchProfile(name) {
  if (!Profiles.map[name] || S.profile === name) return;
  if (!Store.ok && S.profile) { MemStash.state[S.profile] = S.stateSnapshot(); MemStash.results[S.profile] = S.results; }
  stopAllTimers();
  S.profile = name;
  S.results = [];
  S.practice = {}; S.exam = null; S.adaptive = {}; S.learning = { studied: {}, topics: {}, bookmarks: [], recent: [], exDone: {}, weakImproved: {} }; S.prefs = {};
  await Profiles.setActive(name);
  await loadProfileState();
  if (!Store.ok && MemStash.results[name]) { /* already restored above */ }
  renderProfileChip();
  toast('Switched to ' + name);
  showView('dashboard');
}
async function createAndSwitch(name) {
  const n = await Profiles.create(name);
  if (!Store.ok && S.profile) { MemStash.state[S.profile] = S.stateSnapshot(); MemStash.results[S.profile] = S.results; }
  S.profile = n;
  S.results = [];
  S.practice = {}; S.exam = null; S.adaptive = {}; S.learning = { studied: {}, topics: {}, bookmarks: [], recent: [], exDone: {}, weakImproved: {} }; S.prefs = {};
  await Profiles.setActive(n);
  try { if (Store.ok) await Store.put('kv', S.stateSnapshot(), kState()); } catch (e) { }
  renderProfileChip();
  toast('Profile "' + n + '" created — progress is saved under this name.');
  return n;
}
function renderProfileChip() {
  const n = $('#profileChip');
  if (!n) return;
  n.style.display = '';
  if (!S.profile) { n.innerHTML = '<span class="muted">no profile</span>'; n.onclick = () => showView('dashboard'); return; }
  n.innerHTML = '👤 <b>' + esc(S.profile) + '</b> <span class="muted">· switch</span>';
  n.onclick = showProfilePicker;
}
function showProfilePicker() {
  const body = el('div');
  body.appendChild(el('div', 'small muted', 'Each profile keeps its own progress in this browser. Add a profile for each friend, then compare everyone on the Group tab.'));
  const list = el('div', 'row'); list.style.marginTop = '10px';
  Profiles.names().forEach(nm => {
    const b = el('button', nm === S.profile ? 'act' : 'ghost', nm);
    b.onclick = () => { const back = document.querySelector('.modalback'); if (back) back.remove(); if (nm !== S.profile) switchProfile(nm); };
    list.appendChild(b);
  });
  body.appendChild(list);
  const row = el('div', 'row'); row.style.marginTop = '12px';
  const inp = el('input', 'numinput'); inp.style.fontSize = '15px'; inp.style.width = '160px'; inp.placeholder = 'New name';
  const add = el('button', 'ghost', 'Add profile');
  add.onclick = async () => {
    try { await createAndSwitch(inp.value); const back = document.querySelector('.modalback'); if (back) back.remove(); showView('dashboard'); }
    catch (e) { toast(e.message); }
  };
  row.append(inp, add);
  body.appendChild(row);
  modal('Who is practising?', body, [['Close', 'ghost', null]]);
}
function renderOnboarding(v) {
  const c = el('div', 'card');
  c.innerHTML = '<h2>Who is practising?</h2><p class="muted small">Each person gets their own profile with separate progress, exams and statistics — all stored in this browser on this device. Create one profile per friend, then compare everyone on the <b>Group</b> tab. Friends on other devices can export their progress file and you can import it here as a comparable profile.</p>';
  const row = el('div', 'row');
  const inp = el('input', 'numinput'); inp.style.fontSize = '15px'; inp.style.width = '180px'; inp.placeholder = 'Your name';
  const go = el('button', 'act', 'Create profile & start');
  go.onclick = async () => { try { await createAndSwitch(inp.value); showView('dashboard'); } catch (e) { toast(e.message); } };
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') go.click(); });
  row.append(inp, go);
  c.appendChild(row);
  const names = Profiles.names();
  if (names.length) {
    c.appendChild(el('h3', '', 'Existing profiles'));
    const l = el('div', 'row');
    names.forEach(nm => {
      const b = el('button', 'ghost', nm);
      b.onclick = async () => { await Profiles.setActive(nm); S.profile = nm; await loadProfileState(); renderProfileChip(); showView('dashboard'); };
      l.appendChild(b);
    });
    c.appendChild(l);
  }
  v.appendChild(c);
}

/* --------------------------------- router --------------------------------- */
const VIEWS = [['dashboard', 'Dashboard'], ['group', 'Group'], ['notes', 'Study Notes'], ['class', 'Class Practice'], ['exam', 'Exam Simulation'], ['adaptive', 'Adaptive Practice'], ['analytics', 'Performance'], ['settings', 'Settings']];
let currentView = 'dashboard';
/* side-nav icons (inline SVG, stroke = currentColor) */
const NAV_ICONS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  group: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9.5" r="2.5"/><path d="M16.5 14.5c2.8.4 4.5 2.6 4.5 5.5"/>',
  notes: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13z"/><path d="M12 3h5.5A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5H12"/>',
  class: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  exam: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2.5"/>',
  adaptive: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  analytics: '<path d="M5 20v-6"/><path d="M12 20V4"/><path d="M19 20v-9"/><path d="M3 20h18"/>',
  settings: '<path d="M4 8h9"/><circle cx="16.5" cy="8" r="2.5"/><path d="M20 16h-9"/><circle cx="7.5" cy="16" r="2.5"/>'
};
function icon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (NAV_ICONS[name] || '') + '</svg>';
}
function buildTabs() {
  const nav = $('#tabs');
  VIEWS.forEach(([id, label]) => {
    const b = el('button', '', icon(id) + '<span>' + label + '</span>');
    b.dataset.v = id;
    b.onclick = () => { if (S.exam && !S.exam.submitted && id !== 'exam' && !confirm('Leave the running exam? It stays saved and you can resume from the Dashboard.')) return; showView(id); };
    nav.appendChild(b);
  });
}
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + name).classList.add('active');
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.v === name));
  stopAllTimers();
  ({ dashboard: renderDashboard, group: renderGroup, notes: renderNotes, class: renderClassMenu, exam: renderExamIntro, adaptive: renderAdaptiveMenu, analytics: renderAnalytics, settings: renderSettings })[name]();
  Save.mark();
}
function moduleBar(container, active) {
  const bar = el('div', 'modulebar');
  MOD_IDS.forEach(mid => {
    const b = el('button', mid === active ? 'active' : '', MODS[mid].name);
    b.onclick = () => { S.activeModule = mid; Save.mark(); refreshCurrentView(); };
    bar.appendChild(b);
  });
  container.appendChild(bar);
}
function refreshCurrentView() { showView(currentView); }

/* --------------------------------- timers --------------------------------- */
function startTimer(seconds, onTick, onEnd) {
  const h = { left: seconds, iv: null, ticks: 0 };
  h.iv = setInterval(() => {
    h.left -= 1; h.ticks++;
    if (h.ticks % 20 === 0) Save.mark(); // periodic exam snapshot
    onTick(h.left);
    if (h.left <= 0) { clearInterval(h.iv); onEnd(); }
  }, 1000);
  onTick(h.left);
  return h;
}
function stopTimer(h) { if (h && h.iv) clearInterval(h.iv); }
function stopAllTimers() { Object.keys(S.timers || {}).forEach(k => { stopTimer(S.timers[k]); delete S.timers[k]; }); }
S.timers = {};
function fmtClock(s) { return Math.floor(Math.max(0, s) / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0'); }

/* --------------------------- question rendering ---------------------------- */
function renderGrid(container, q, opts) {
  opts = opts || {};
  const t = el('table', 'lsq' + (opts.mini ? ' mini' : ''));
  for (let r = 0; r < 5; r++) {
    const tr = el('tr');
    for (let c = 0; c < 5; c++) {
      const i = r * 5 + c;
      const td = el('td');
      if (i === q.target) {
        td.classList.add('target');
        td.textContent = opts.showAnswer ? q.answer : '?';
        if (opts.showAnswer) td.classList.add('answer');
        if (opts.wrongLetter && opts.wrongLetter !== q.answer) { td.textContent = opts.wrongLetter; td.classList.add('wrongshow'); td.title = 'your answer — correct was ' + q.answer; }
      } else if (q.grid[i]) td.textContent = q.grid[i];
      if (opts.hlCells && opts.hlCells.indexOf(i) >= 0) td.classList.add('hl');
      tr.appendChild(td);
    }
    t.appendChild(tr);
  }
  container.appendChild(t);
  return t;
}
function eqHTML(q, reveal) {
  const tl = 'ABCDEF'[q.target];
  return q.eqText.map(t => esc(reveal ? t : t.split(tl).join('¤'))).map(s => s.split('¤').join('<span class="qm">?</span>')).map(esc2).join('<br>');
  function esc2(s) { return s; } // already escaped above
}
function frameSVG(q, frame, size, qmark) { return F.frameToSVG(frame || [], size, qmark); }
function renderQuestionView(container, q, opts) {
  container.innerHTML = '';
  const mod = MODS[q.module];
  const head = el('div', 'qhead');
  const hL = el('div', '', '<b>' + esc(mod.header) + '</b> <span class="pill class-' + q.cls + '">' + q.cls + '</span> <span class="pill">' + (TYPE_LABEL[q.type] || q.type) + '</span>');
  if (opts.counter) hL.appendChild(el('div', 'muted small', esc(opts.counter)));
  const hR = el('div', '');
  if (opts.timer) {
    const tEl = el('div', 'qtimer', '0:50');
    hR.appendChild(tEl);
    S.timers[q.id] = startTimer(50, left => {
      tEl.textContent = '0:' + String(Math.max(0, left)).padStart(2, '0');
      tEl.classList.toggle('warn', left < 20 && left >= 10);
      tEl.classList.toggle('danger', left < 10);
    }, () => { if (opts.onTimeout) opts.onTimeout(); });
  }
  head.append(hL, hR);
  container.appendChild(head);

  const wrap = el('div', 'qgridwrap');
  const gwrap = el('div');
  const side = el('div', 'qside');
  if (q.kind === 'math' || q.module === 'math') {
    gwrap.appendChild(el('div', 'eqcard', '<div class="eqlist">' + eqHTML(q, !!opts.reveal) + '</div>'));
    if (opts.reveal) gwrap.appendChild(el('div', 'small', 'The question mark stands for <b>' + esc('ABCDEF'[q.target]) + ' = ' + q.answer + '</b>.'));
    side.appendChild(el('div', 'qprompt', 'Which number replaces the question mark? (1–20)'));
    const arow = el('div', 'answers');
    if (opts.reveal) {
      arow.appendChild(el('span', 'numinput', String(q.answer)));
    } else {
      const inp = el('input', 'numinput'); inp.type = 'number'; inp.min = 1; inp.max = 20; inp.id = 'ansInput';
      if (opts.answered && opts.userLetter !== null && opts.userLetter !== undefined) inp.value = opts.userLetter;
      inp.disabled = !!opts.answered;
      const go = el('button', 'act', 'Check');
      go.disabled = !!opts.answered;
      go.onclick = () => { if (opts.onAnswer && inp.value !== '') opts.onAnswer(inp.value); };
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.stopPropagation(); go.click(); } });
      arow.append(inp, go);
      setTimeout(() => { try { inp.focus(); } catch (e) { } }, 30);
    }
    side.appendChild(arow);
  } else if (q.module === 'figures') {
    const fr = el('div', 'figrow');
    q.frames.forEach((frme, i) => {
      const box = el('div', 'figframe' + (i === 5 ? ' q' : ''));
      box.innerHTML = frameSVG(q, i === 5 && !opts.reveal ? null : (opts.reveal && i === 5 ? q.frames[5] : frme), 64, i === 5 && !opts.reveal);
      box.appendChild(el('div', 'fn', 'Frame ' + (i + 1)));
      fr.appendChild(box);
      if (i < 5) fr.appendChild(el('span', 'arrowsep', '→'));
    });
    gwrap.appendChild(fr);
    side.appendChild(el('div', 'qprompt', 'Which figure replaces the question mark?'));
    const ans = el('div', 'answers');
    ['A', 'B', 'C', 'D', 'E'].forEach((L, i) => {
      const b = el('button', 'opt');
      b.innerHTML = frameSVG(q, q.options[i], 60) ;
      b.title = L;
      b.onclick = () => { if (opts.onAnswer) opts.onAnswer(L); };
      if (opts.answered || opts.reveal) b.disabled = true;
      if (opts.answered && opts.userLetter === L) b.classList.add('picked');
      if (opts.reveal && L === q.answer) { b.style.borderColor = 'var(--green)'; b.style.borderWidth = '2px'; }
      if (opts.reveal && opts.userLetter === L && opts.userLetter !== q.answer) { b.style.borderColor = 'var(--red)'; }
      ans.appendChild(b);
    });
    side.appendChild(ans);
  } else {
    renderGrid(gwrap, q, { showAnswer: !!opts.reveal, wrongLetter: opts.reveal ? opts.userLetter : undefined });
    side.appendChild(el('div', 'qprompt', 'Which letter replaces the question mark?'));
    const ans = el('div', 'answers');
    ['A', 'B', 'C', 'D', 'E'].forEach(L => {
      const b = el('button', '', L);
      b.onclick = () => { if (opts.onAnswer) opts.onAnswer(L); };
      if (opts.answered || opts.reveal) b.disabled = true;
      if (opts.answered && opts.userLetter === L) b.classList.add('picked');
      ans.appendChild(b);
    });
    side.appendChild(ans);
  }
  if (opts.examCtl) opts.examCtl(side);
  wrap.append(gwrap, side);
  container.appendChild(wrap);
}

/* ------------------------------- explanations ------------------------------ */
function verdictLine(result, correctText) {
  return result.outcome === 'correct' ? 'Correct — solved in ' + result.timeSec + 's'
    : result.outcome === 'timeout' ? 'Timed out after 50s (counts as wrong). The answer was ' + correctText + '.'
    : 'Wrong — you chose ' + (result.user === null || result.user === undefined || result.user === '' ? '—' : result.user) + '. The correct answer is ' + correctText + '. Solved in ' + result.timeSec + 's.';
}
function renderLatinExplanation(container, q, result) {
  const ex = el('div', 'expl');
  ex.appendChild(el('div', 'verdict ' + (result.outcome === 'correct' ? 'ok' : result.outcome === 'timeout' ? 'time' : 'bad'), verdictLine(result, q.answer)));
  ex.appendChild(el('div', 'muted small', 'Question ' + q.id + ' · ' + q.cls + ' · ' + (TYPE_LABEL[q.type] || q.type) + ' · techniques: ' + q.techs.map(t => 'T' + t).join(', ')));
  const two = el('div', 'qgridwrap'); const gw = el('div'); two.appendChild(gw);
  const side = el('div', 'qside');
  side.appendChild(el('div', 'qprompt', 'Step-by-step solution (hover a step to highlight cells)'));
  const ol = el('ol', 'steps');
  q.steps.forEach((s, idx) => {
    const li = el('li');
    li.innerHTML = '<span class="tname">Step ' + (idx + 1) + ' — ' + (TECH_NAME.latin[s.tech] || 'T' + s.tech) + ' (T' + s.tech + ')</span>' +
      (s.phantom ? '<span class="ph">phantom fill</span>' : '') + '<div>' + esc(s.reason) + '</div>';
    const cells = (s.cells || []).filter(i => i >= 0);
    li.onmouseenter = () => { gw.innerHTML = ''; renderGrid(gw, q, { showAnswer: true, wrongLetter: result.outcome === 'wrong' ? result.user : null, hlCells: cells }); };
    li.onclick = li.onmouseenter;
    ol.appendChild(li);
  });
  side.appendChild(ol);
  two.appendChild(side);
  ex.appendChild(two);
  gw.innerHTML = ''; renderGrid(gw, q, { showAnswer: true, wrongLetter: result.outcome === 'wrong' ? result.user : null });
  // why the other letters fail
  const tR = C.rowOf(q.target), tC = C.colOf(q.target);
  const rowL = new Set(), colL = new Set();
  for (let k = 0; k < 5; k++) { if (q.grid[tR * 5 + k]) rowL.add(q.grid[tR * 5 + k]); if (q.grid[k * 5 + tC]) colL.add(q.grid[k * 5 + tC]); }
  const wl = el('ul', 'veto-list');
  ['A', 'B', 'C', 'D', 'E'].filter(L => L !== q.answer).forEach(L => {
    const li = el('li');
    if (result.outcome === 'wrong' && result.user === L) li.classList.add('v');
    if (colL.has(L) && rowL.has(L)) li.innerHTML = '<b>' + L + '</b> — already in row ' + (tR + 1) + ' AND column ' + (tC + 1) + '.';
    else if (colL.has(L)) li.innerHTML = (result.outcome === 'wrong' && result.user === L ? '<span class="v">Column veto: ' + L + ' is already in column ' + (tC + 1) + '.</span>' : '<b>' + L + '</b> — already in column ' + (tC + 1) + '.');
    else li.innerHTML = '<b>' + L + '</b> — already in row ' + (tR + 1) + '.';
    wl.appendChild(li);
  });
  ex.appendChild(el('h3', '', 'Why the other letters do not fit'));
  ex.appendChild(wl);
  const last = q.steps[q.steps.length - 1];
  const sc = el('div', 'shortcut');
  if (last && last.tech === 1 && last.data && last.data.seen && last.data.seen.length === 4) {
    const seen = last.data.seen, sum = seen.reduce((a, b) => a + b, 0);
    sc.innerHTML = '<b>Mental shortcut (optional):</b> A=1 … E=5 and every full line sums to 15. The four visible letters sum to ' + sum + ', so ? = 15 − ' + sum + ' = <b>' + (15 - sum) + ' → ' + C.LTR[15 - sum - 1] + '</b>.';
  } else sc.innerHTML = '<b>Mental shortcut:</b> no useful sum shortcut on this route.';
  ex.appendChild(sc);
  container.appendChild(ex);
}
function renderMathExplanation(container, q, result) {
  const ex = el('div', 'expl');
  ex.appendChild(el('div', 'verdict ' + (result.outcome === 'correct' ? 'ok' : result.outcome === 'timeout' ? 'time' : 'bad'), verdictLine(result, String(q.answer))));
  ex.appendChild(el('div', 'muted small', 'Question ' + q.id + ' · ' + q.cls + ' · ' + (TYPE_LABEL[q.type] || q.type) + ' · unknowns: ' + q.k + ' letters · equations: ' + q.eqs.length));
  // given info
  ex.appendChild(el('h3', '', 'Given information'));
  ex.appendChild(el('div', 'eqcard', '<div class="eqlist small">' + q.eqText.map(esc).join('<br>') + '</div>'));
  // steps
  ex.appendChild(el('h3', '', 'Step-by-step solution'));
  const ol = el('ol', 'steps');
  q.steps.forEach((s, idx) => {
    const li = el('li');
    const tname = s.kind === 'elimination' ? 'Elimination (T2)' : 'Substitution (T1)';
    li.innerHTML = '<span class="tname">Step ' + (idx + 1) + ' — ' + tname + '</span><div>' + esc(s.reason) + '</div>';
    li.onmouseenter = () => { const eq = document.querySelectorAll('#' + container.id + ' .eqlist .eql'); };
    ol.appendChild(li);
  });
  ex.appendChild(ol);
  // final answer + verification by substitution (computed from the structured
  // equation data — never by evaluating strings)
  const fin = el('div', 'shortcut');
  let v = '<b>Final solution:</b> ' + q.values.map((val, i) => 'ABCDEF'[i] + ' = ' + val).join(', ') + '. The question mark is <b>' + q.answer + '</b>.<br><b>Check by substituting (T5):</b><br>';
  q.eqs.forEach((eq, i) => {
    const lhsVal = eq.lhs.reduce((acc, t) => acc + t[0] * q.values[t[1]], 0);
    const rhsVal = eq.rhsConst + eq.rhs.reduce((acc, t) => acc + t[0] * q.values[t[1]], 0);
    v += 'Equation ' + (i + 1) + ': ' + esc(q.eqText[i]) + ' → ' + lhsVal + ' = ' + rhsVal + (lhsVal === rhsVal ? ' ✓' : ' ✗') + '<br>';
  });
  fin.innerHTML = v;
  ex.appendChild(fin);
  // why the wrong number fails
  if (result.outcome === 'wrong' && result.user !== null && result.user !== '') {
    ex.appendChild(el('h3', '', 'Why your answer does not fit'));
    ex.appendChild(el('div', 'veto-list', '<li><span class="v">' + esc(M.whyWrong(q, parseInt(result.user, 10) || 0)) + '</span></li>'));
  }
  // mental shortcut
  const last = q.steps[q.steps.length - 1];
  const sc = el('div', 'shortcut');
  const lastEq = last && last.eqIdx !== undefined ? q.eqText[last.eqIdx] : '';
  if (/[23][A-F]/.test(lastEq)) sc.innerHTML = '<b>Mental shortcut:</b> the last equation multiples the letter (' + esc(lastEq) + ') — divide first, then substitute.';
  else sc.innerHTML = '<b>Mental shortcut:</b> no special trick needed — solve the equation with the fewest unknowns first and substitute forwards.';
  ex.appendChild(sc);
  container.appendChild(ex);
}
function renderFigExplanation(container, q, result) {
  const ex = el('div', 'expl');
  ex.appendChild(el('div', 'verdict ' + (result.outcome === 'correct' ? 'ok' : result.outcome === 'timeout' ? 'time' : 'bad'), verdictLine(result, q.answer)));
  ex.appendChild(el('div', 'muted small', 'Question ' + q.id + ' · ' + q.cls + ' · ' + (TYPE_LABEL[q.type] || q.type) + ' · rules: ' + q.rules.length));
  const two = el('div', 'qgridwrap');
  const gw = el('div', 'figframe');
  gw.innerHTML = frameSVG(q, q.frames[5], 96) + '<div class="fn">Answer — frame 6</div>';
  two.appendChild(gw);
  const side = el('div', 'qside');
  side.appendChild(el('div', 'qprompt', 'The rules behind the sequence'));
  const ol = el('ol', 'steps');
  q.steps.forEach(s => { ol.appendChild(el('li', '', '<div>' + esc(s.reason) + '</div>')); });
  side.appendChild(ol);
  two.appendChild(side);
  ex.appendChild(two);
  // why each distractor is wrong
  ex.appendChild(el('h3', '', 'Why the other options do not fit'));
  const wl = el('ul', 'veto-list');
  q.options.forEach((o, i) => {
    const L = 'ABCDE'[i];
    if (i === q.answerIdx) return;
    const li = el('li');
    if (result.outcome === 'wrong' && result.user === L) li.classList.add('v');
    li.innerHTML = '<b>' + L + '</b> — ' + esc(q.notes[i] || 'does not match the rules.');
    wl.appendChild(li);
  });
  ex.appendChild(wl);
  ex.appendChild(el('div', 'shortcut', '<b>Verification:</b> the answer frame was recomputed from the rules independently and differs from every shown frame and from all other options.'));
  container.appendChild(ex);
}

/* ================================ DASHBOARD ================================ */
function moduleStats(mid) {
  const R = S.results.filter(r => r.module === mid);
  return {
    n: R.length, ok: R.filter(r => r.outcome === 'correct').length,
    avgTime: R.length ? R.reduce((a, r) => a + r.timeSec, 0) / R.length : 0
  };
}
function renderDashboard() {
  const v = $('#view-dashboard');
  v.innerHTML = '';
  if (!S.profile) { renderOnboarding(v); return; }
  const attempted = S.results.length, correct = S.results.filter(r => r.outcome === 'correct').length;
  // interrupted exam card
  if (S.exam && !S.exam.submitted) {
    const c = el('div', 'card');
    c.style.borderColor = 'var(--amber)';
    const mins = Math.floor(S.exam.left / 60), secs = S.exam.left % 60;
    c.innerHTML = '<h2>Interrupted exam</h2><p>' + esc(MODS[S.exam.module].name) + ' (' + (S.exam.kind === 'advanced' ? 'Advanced' : 'Standard') +
      ' Simulation) was interrupted at question ' + (S.exam.idx + 1) + ' with <b>' + mins + ':' + String(secs).padStart(2, '0') + '</b> remaining. ' +
      'Your answers and marks are saved. Resuming continues the timer from the moment of interruption — it does not restart.</p>';
    const row = el('div', 'row');
    const br = el('button', 'act', 'Resume exam');
    br.onclick = () => { S.exam = deserializeExam(serializeExam(S.exam)); showView('exam'); renderExamRun(); };
    const bd = el('button', 'danger', 'Discard and delete');
    bd.onclick = () => { if (confirm('Delete the saved exam? Answers cannot be recovered.')) { S.exam = null; Store.del('kv', 'state').then(() => Save.mark()); renderDashboard(); } };
    row.append(br, bd);
    c.appendChild(row);
    v.appendChild(c);
  }
  const hero = el('div', 'card hero');
  const cloudHint = (Cloud.cfg && !Cloud.session) ? '<span style="color:var(--amber);font-weight:700">☁ Cloud sync is connected — create your group account in Settings (Cloud sync section) to join the live comparison.</span>' : '';
  hero.innerHTML = '<div class="greet">' + (S.profile ? 'Welcome back, ' + esc(S.profile) : 'Welcome') + '</div>' +
    '<p class="muted small">All three <b>Core Module</b> subtests · five difficulty classes (Easy → Master) · no negative marking — never leave a blank. ' + cloudHint + '</p>' +
    (attempted ? '<div class="herostats">' +
      '<div class="statchip"><div><div class="v">' + attempted + '</div><div class="l">answered</div></div></div>' +
      '<div class="statchip"><div><div class="v">' + Math.round(100 * correct / attempted) + '%</div><div class="l">accuracy</div></div></div>' +
      '<div class="statchip"><div><div class="v">' + (S.results.length ? Math.round(S.results.reduce((a, r) => a + r.timeSec, 0) / S.results.length) : 0) + 's</div><div class="l">avg time</div></div></div>' +
      '</div>' : '<div class="herostats"><div class="statchip"><div><div class="l">No questions answered yet — pick a module below.</div></div></div></div>');
  v.appendChild(hero);
  const cards = el('div', 'grid2');
  MOD_IDS.forEach(mid => {
    const m = MODS[mid], st = moduleStats(mid);
    const c = el('div', 'card');
    c.innerHTML = '<div class="modchip ' + mid + '">' + mid[0].toUpperCase() + '</div>' + '<h3>' + esc(m.name) + ' <span class="badge">' + m.bank.length + ' questions</span></h3>' +
      '<p class="small muted">5 classes × 50 validated questions · unique answers · full explanations.</p>' +
      (st.n ? '<p class="small">Attempted ' + st.n + ' · ' + Math.round(100 * st.ok / st.n) + '% correct · Ø ' + Math.round(st.avgTime) + 's</p>' : '');
    const row = el('div', 'row');
    CLASSES.forEach(cls => {
      const b = el('button', 'ghost', cls);
      b.onclick = () => { S.activeModule = mid; startPractice(mid, cls, 'seq'); showView('class'); showPracticeQuestion(); };
      row.appendChild(b);
    });
    c.appendChild(row);
    const row2 = el('div', 'row'); row2.style.marginTop = '8px';
    const be = el('button', 'act', 'Exam Simulation');
    be.onclick = () => { S.activeModule = mid; showView('exam'); };
    const ba = el('button', 'ghost', 'Adaptive');
    ba.onclick = () => { S.activeModule = mid; showView('adaptive'); };
    row2.append(be, ba);
    c.appendChild(row2);
    cards.appendChild(c);
  });
  v.appendChild(cards);
}

/* ============================== GROUP DASHBOARD =============================
   Compares every profile stored in this browser. For friends practising on
   other devices, exchange JSON export files and import them as profiles. */
function renderGroup() {
  const v = $('#view-group');
  v.innerHTML = '';
  const intro = el('div', 'card');
  intro.innerHTML = '<h2>Group Dashboard</h2><p class="muted small">' + (Cloud.ready()
    ? '☁ Connected — this view is LIVE from your shared database: every friend\'s attempts, accuracy and speed from every laptop, updated automatically.'
    : 'Compares every profile saved in THIS browser on THIS device. Practising on separate laptops? Connect <b>Cloud sync</b> (Settings → Supabase, free, ~5 min) for a live comparison — or use JSON export/import: friends send you their progress file, you import it here as a comparable profile.') + '</p>';
  v.appendChild(intro);
  const wrap = el('div', 'card');
  wrap.innerHTML = '<p class="muted">Loading group data…</p>';
  v.appendChild(wrap);
  (async () => {
    window.__groupDebug = { started: true };
    let allR = [], cloudLive = false, profilesMeta = Profiles.map;
    if (Cloud.ready()) {
      try {
        const g = await Cloud.pullGroup();
        allR = g.results; profilesMeta = g.profiles; cloudLive = true;
        window.__groupDebug.cloud = { results: allR.length, profiles: Object.keys(profilesMeta) };
      } catch (e) { window.__groupDebug.cloudError = e.message; console.warn('group cloud pull failed', e); }
    }
    if (!cloudLive) {
      window.__groupDebug.fellBack = true;
      allR = Store.ok ? await Store.all('results') : S.results.slice().concat(Object.keys(MemStash.results).reduce((a, k) => a.concat(MemStash.results[k]), []));
    }
    const names = Array.from(new Set([].concat(Object.keys(profilesMeta), allR.map(r => r.profile).filter(Boolean))));
    const rows = names.map(nm => {
      const R = allR.filter(r => r.profile === nm);
      const perCls = {}, perMod = {};
      CLASSES.forEach(cl => { const rr = R.filter(r => r.cls === cl); perCls[cl] = { n: rr.length, ok: rr.filter(r => r.outcome === 'correct').length }; });
      MOD_IDS.forEach(md => { perMod[md] = R.filter(r => r.module === md).length; });
      const ok = R.filter(r => r.outcome === 'correct').length;
      return { name: nm, n: R.length, ok, acc: R.length ? ok / R.length : 0,
               avg: R.length ? R.reduce((a, r) => a + r.timeSec, 0) / R.length : 0,
               last: R.length ? Math.max.apply(null, R.map(r => r.at || 0)) : (profilesMeta[nm] && profilesMeta[nm].lastActivity) || 0,
               perCls, perMod, me: nm === S.profile };
    }).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    window.__groupDebug.rows = rows.length;
    window.__groupDebug.names = names;
    if (!rows.length) { wrap.innerHTML = '<p class="muted">No profiles yet — create one on the Dashboard.</p>'; return; }
    const tot = rows.reduce((s, r) => s + r.n, 0);
    const okAll = rows.reduce((s, r) => s + r.ok, 0);
    const summary = el('div', 'grid2');
    summary.appendChild(el('div', 'techcard', '<b>Profiles:</b> ' + rows.length + '<br><b>Group attempts:</b> ' + tot + '<br><b>Combined accuracy:</b> ' + (tot ? Math.round(100 * okAll / tot) + '%' : '—')));
    summary.appendChild(el('div', 'techcard', '<b>Most active:</b> ' + esc(rows[0].name) + ' (' + rows[0].n + ' questions)<br><b>Last activity:</b> ' + esc(rows.slice().sort((a, b) => b.last - a.last)[0].name)));
    wrap.innerHTML = '<h3>Summary</h3>';
    wrap.appendChild(summary);
    const t = el('table', 'stat');
    let head = '<tr><th>Profile</th><th>Attempts</th><th>Accuracy</th><th>Avg time</th>';
    CLASSES.forEach(cl => head += '<th>' + cl + '</th>');
    MOD_IDS.forEach(md => head += '<th>' + MODS[md].name.split(' ')[0] + '</th>');
    head += '<th>Last activity</th></tr>';
    t.innerHTML = head;
    const maxAcc = Math.max.apply(null, rows.map(r => r.acc));
    const maxN = Math.max.apply(null, rows.map(r => r.n));
    rows.forEach(r => {
      let tr = '<tr' + (r.me ? ' style="background:var(--accent-soft)"' : '') + '><td><b>' + esc(r.name) + '</b>' + (r.me ? ' <span class="badge">you</span>' : '') + '</td>';
      tr += '<td class="num">' + r.n + (r.n === maxN && r.n > 0 ? ' ★' : '') + '</td>';
      tr += '<td class="num">' + (r.n ? Math.round(100 * r.acc) + '%' : '—') + (r.acc === maxAcc && r.n > 0 ? ' ★' : '') + '</td>';
      tr += '<td class="num">' + (r.n ? Math.round(r.avg) + 's' : '—') + '</td>';
      CLASSES.forEach(cl => { const pc = r.perCls[cl]; tr += '<td class="num">' + (pc.n ? pc.ok + '/' + pc.n : '—') + '</td>'; });
      MOD_IDS.forEach(md => { tr += '<td class="num">' + r.perMod[md] + '</td>'; });
      tr += '<td class="num small">' + (r.last ? new Date(r.last).toLocaleDateString() + ' ' + new Date(r.last).toLocaleTimeString().slice(0, 5) : '—') + '</td></tr>';
      t.innerHTML += tr;
    });
    wrap.appendChild(el('h3', '', 'Comparison'));
    wrap.appendChild(t);
    wrap.appendChild(el('p', 'small muted', '★ best in column · per-class columns show correct/attempts · module columns show attempted questions · your row is highlighted.'));
    const bars = el('div');
    rows.forEach(r => {
      bars.appendChild(el('div', '', '<div class="small muted" style="margin-top:8px">' + esc(r.name) + ' — ' + r.n + ' attempted, ' + Math.round(100 * r.acc) + '% correct</div><div class="pbar"><div style="width:' + Math.min(100, Math.round(r.acc * 100)) + '%"></div></div>'));
    });
    wrap.appendChild(el('h3', '', 'Accuracy at a glance'));
    wrap.appendChild(bars);
    wrap.appendChild(el('p', 'small muted', cloudLive
      ? '☁ Live from the cloud — every profile from every laptop, updated as people practise. Last sync ' + (Cloud.lastSync ? new Date(Cloud.lastSync).toLocaleTimeString() : '') + '.'
      : (Store.ok ? 'Showing profiles stored in this browser. Connect cloud sync (Settings) to see friends on other laptops live.'
                  : 'Storage is unavailable in this session — only this session\'s profiles can be shown.')));
  })();
}

/* --------------------------------- cloud (v4) ------------------------------
   Optional Supabase sync: local IndexedDB stays the source of truth; the
   cloud adds cross-laptop sync and the live group comparison. */
function activeCloudStats() {
  const st = computeStats(S.profile);
  const stats = { attempts: st.n, accuracy: st.acc, avgTime: st.avgTime, perClass: st.byClass, perModule: {} };
  MOD_IDS.forEach(md => {
    const rr = S.results.filter(r => r.module === md);
    stats.perModule[md] = { n: rr.length, ok: rr.filter(x => x.outcome === 'correct').length };
  });
  return stats;
}
async function cloudPullMine() {
  if (!Cloud.ready()) return;
  const rows = await Cloud.pullMine();
  if (!rows.length) return;
  const existing = new Set((Store.ok ? await Store.all('results') : S.results).map(r => r.uid));
  let added = 0;
  for (const r of rows) {
    if (existing.has(r.uid)) continue;
    existing.add(r.uid);
    if (Store.ok) await Store.put('results', r);
    if (r.profile === S.profile) S.results.push(r);
    if (!Profiles.map[r.profile]) { Profiles.map[r.profile] = { createdAt: Date.now(), lastActivity: r.at, imported: true }; }
    added++;
  }
  if (added) {
    if (Store.ok) await Store.put('kv', Profiles.map, 'profiles');
    toast('Cloud sync: ' + added + ' answers merged from your other device(s).');
  }
}
function renderCloudChip() {
  const n = $('#cloudStatus');
  if (!n) return;
  if (!Cloud.cfg) { n.style.display = 'none'; return; }
  n.style.display = '';
  n.className = Cloud.ready() ? 'ok' : (Cloud.status === 'error' ? 'failed' : 'saving');
  n.textContent = Cloud.ready() ? '☁ synced' + (Cloud.lastSync ? ' ' + new Date(Cloud.lastSync).toLocaleTimeString().slice(0, 5) : '')
    : Cloud.status === 'error' ? '☁ sync error' : Cloud.session ? '☁ signed in' : '☁ not signed in';
}
function renderCloudSection(c) {
  const cc = el('div', 'techcard');
  cc.innerHTML = '<b>Cloud sync — Supabase (optional)</b><br><span class="small muted">' +
    (Cloud.ready() ? 'Connected and signed in — answers push automatically and the Group tab shows everyone live.' :
      'Practise offline anytime. Connecting a free Supabase project adds cross-laptop sync and a live group comparison. Follow the setup guide below — takes about 5 minutes.') + '</span>';
  if (!Cloud.cfg) {
    const r1 = el('div', 'row'); r1.style.marginTop = '8px';
    const u = el('input', 'numinput'); u.style.fontSize = '14px'; u.style.width = '230px'; u.placeholder = 'https://xxxx.supabase.co';
    const k = el('input', 'numinput'); k.style.fontSize = '14px'; k.style.width = '280px'; k.placeholder = 'anon public key (eyJ…)';
    const bc = el('button', 'act', 'Connect');
    bc.onclick = async () => { try { await Cloud.connect(u.value, k.value); renderSettings(); renderCloudChip(); toast('Cloud connected — now sign in.'); } catch (e) { toast(e.message); } };
    r1.append(u, k, bc);
    cc.appendChild(r1);
  }
  if (Cloud.cfg && !Cloud.session) {
    cc.appendChild(el('div', 'small', '<b>Group account</b> — every friend creates their own (any email + password; no verification needed when "Confirm email" is off):'));
    const r2 = el('div', 'row'); r2.style.marginTop = '6px';
    const em = el('input', 'numinput'); em.style.fontSize = '14px'; em.style.width = '200px'; em.placeholder = 'email';
    const pw = el('input', 'numinput'); pw.style.fontSize = '14px'; pw.style.width = '160px'; pw.type = 'password'; pw.placeholder = 'password';
    const bi = el('button', 'act', 'Sign in');
    bi.onclick = async () => { try { await Cloud.signIn(em.value.trim(), pw.value); await cloudPullMine(); renderSettings(); toast('Signed in — your progress now syncs.'); } catch (e) { toast(e.message); } };
    const bu = el('button', 'ghost', 'Create account');
    bu.onclick = async () => { try { await Cloud.signUp(em.value.trim(), pw.value); await cloudPullMine(); renderSettings(); toast('Account created — your progress now syncs.'); } catch (e) { toast(e.message); } };
    const bd = el('button', 'ghost', 'Disconnect');
    bd.onclick = () => { if (confirm('Remove cloud settings from this device? Local progress is kept.')) { Cloud.disconnect(); renderSettings(); } };
    r2.append(em, pw, bi, bu, bd);
    cc.appendChild(r2);
  }
  if (Cloud.ready()) {
    cc.appendChild(el('div', 'small', 'Signed in as <b>' + esc(Cloud.session.user.email || '') + '</b>' +
      (Cloud.lastSync ? ' · last sync ' + new Date(Cloud.lastSync).toLocaleTimeString() : '') +
      (Cloud.pending.length ? ' · ' + Cloud.pending.length + ' answers waiting' : '')));
    const r3 = el('div', 'row'); r3.style.marginTop = '8px';
    const bs = el('button', 'ghost', 'Sync now');
    bs.onclick = async () => { S.results.forEach(r => Cloud.queueUid(r.uid)); await Cloud.flush(S.profile, uid => S.results.find(x => x.uid === uid), activeCloudStats()); await cloudPullMine(); renderSettings(); toast('Cloud synced.'); };
    const bo = el('button', 'ghost', 'Sign out');
    bo.onclick = () => { Cloud.signOut(); renderSettings(); renderCloudChip(); };
    const bx = el('button', 'danger', 'Disconnect');
    bx.onclick = () => { if (confirm('Remove cloud settings from this device? Local progress is kept.')) { Cloud.disconnect(); renderSettings(); renderCloudChip(); } };
    r3.append(bs, bo, bx);
    cc.appendChild(r3);
  }
  // setup guide
  const g = el('details', 'small'); g.style.marginTop = '10px';
  const SQL = "-- Run once in the Supabase SQL editor\ncreate table if not exists public.dmat_profiles (\n  id text primary key,\n  user_id uuid not null default auth.uid() references auth.users on delete cascade,\n  name text not null,\n  created_at timestamptz not null default now(),\n  last_activity timestamptz not null default now(),\n  stats jsonb not null default '{}'::jsonb\n);\ncreate table if not exists public.dmat_results (\n  uid text primary key,\n  user_id uuid not null default auth.uid() references auth.users on delete cascade,\n  profile text not null,\n  module text not null,\n  qid text not null,\n  cls text,\n  type text,\n  techs jsonb,\n  outcome text not null,\n  time_sec int not null default 0,\n  answer text,\n  at timestamptz not null default now()\n);\nalter table public.dmat_profiles enable row level security;\nalter table public.dmat_results enable row level security;\ncreate policy \"profiles own write\" on public.dmat_profiles for insert with check (auth.uid() = user_id);\ncreate policy \"profiles own update\" on public.dmat_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);\ncreate policy \"profiles group read\" on public.dmat_profiles for select using (auth.role() = 'authenticated');\ncreate policy \"results own write\" on public.dmat_results for insert with check (auth.uid() = user_id);\ncreate policy \"results own update\" on public.dmat_results for update using (auth.uid() = user_id) with check (auth.uid() = user_id);\ncreate policy \"results group read\" on public.dmat_results for select using (auth.role() = 'authenticated');";
  g.innerHTML = '<summary><b>Setup guide (one person does this once, ~5 minutes)</b></summary>' +
    '<ol class="small">' +
    '<li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a> (no credit card needed).</li>' +
    '<li>In the project: <b>Authentication → Providers → Email</b> → turn <b>OFF</b> "Confirm email" (so friends can log in straight away).</li>' +
    '<li><b>SQL Editor → New query</b> — paste the SQL below and press <b>Run</b>.</li>' +
    '<li><b>Project Settings → API</b> — copy the <i>Project URL</i> and the <i>anon public key</i> into the fields above and Connect.</li>' +
    '<li>Share this HTML file with your friends. Each one connects with the SAME URL + key, then creates their own account (email + password) and a profile with their name. The Group tab then shows everybody live.</li>' +
    '</ol>' +
    '<pre style="background:var(--panel2);border:1px solid var(--border2);border-radius:6px;padding:10px;font-size:12px;white-space:pre-wrap">' + esc(SQL) + '</pre>' +
    '<p class="small muted">Security notes: the anon key is public by design — safety comes from Row Level Security (you can only write your own rows; the group can read). Anyone with the URL + key + an account can read group scores, so use a private project. Data lives in YOUR project on supabase.com.</p>';
  cc.appendChild(g);

  c.appendChild(cc);
}

/* ================================ SETTINGS ================================= */
function renderSettings() {
  const v = $('#view-settings');
  v.innerHTML = '';
  const c = el('div', 'card');
  c.innerHTML = '<h2>Settings &amp; Data Management</h2>';
  // ---- profiles ----
  const pc = el('div', 'techcard');
  pc.innerHTML = '<b>Profiles</b><br><span class="small muted">Each profile keeps separate progress in this browser. Add one per friend, switch anytime, and compare on the Group tab. Friends on other devices: export a file there, import it here.</span>';
  const prow = el('div', 'row'); prow.style.marginTop = '8px';
  Profiles.names().forEach(nm => {
    const b = el('button', nm === S.profile ? 'act' : 'ghost', nm);
    b.onclick = () => { if (nm !== S.profile) switchProfile(nm); };
    prow.appendChild(b);
  });
  const rn = el('input', 'numinput'); rn.style.fontSize = '14px'; rn.style.width = '150px'; rn.placeholder = 'New profile name';
  const bAdd = el('button', 'ghost', 'Add');
  bAdd.onclick = async () => { try { await createAndSwitch(rn.value); renderProfileChip(); renderSettings(); } catch (e) { toast(e.message); } };
  const bRen = el('button', 'ghost', 'Rename current');
  bRen.onclick = async () => {
    const nn = prompt('New name for "' + S.profile + '"', S.profile);
    if (nn && nn !== S.profile) {
      try { await Profiles.rename(S.profile, nn); S.profile = nn; await Profiles.setActive(nn); renderProfileChip(); Save.mark(); renderSettings(); toast('Profile renamed to ' + nn); }
      catch (e) { toast(e.message); }
    }
  };
  const bDel = el('button', 'danger', 'Delete current profile');
  bDel.onclick = async () => {
    if (!confirm('Delete profile "' + S.profile + '" and ALL of its progress from this browser? Consider exporting a backup first.')) return;
    await Profiles.remove(S.profile);
    S.profile = Profiles.active;
    S.results = Store.ok ? (await Store.all('results')).filter(r => r.profile === S.profile) : (MemStash.results[S.profile] || []);
    S.practice = {}; S.exam = null; S.adaptive = {}; S.learning = { studied: {}, topics: {}, bookmarks: [], recent: [], exDone: {}, weakImproved: {} };
    renderProfileChip(); showView('dashboard');
  };
  prow.append(rn, bAdd, bRen, bDel);
  pc.appendChild(prow);
  c.appendChild(pc);
  renderCloudSection(c);
  // storage status
  const st = el('div', 'techcard');
  let statusHTML = '<b>Storage status:</b> ' + (Store.ok ? 'IndexedDB ready ("' + Store.NAME + '", schema v' + Store.VERSION + ')' : 'unavailable (' + esc(Store.error && Store.error.message || 'blocked') + ') — progress will NOT be saved') + '<br>';
  statusHTML += '<b>Last saved:</b> ' + ($('#saveStatus').textContent || '—') + '<br>';
  statusHTML += '<span class="muted small">IndexedDB data lives in THIS browser on THIS device. Clearing site data or using another browser/device will not see it. Use Export for backup and transfer.</span>';
  st.innerHTML = statusHTML;
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(est => {
      st.innerHTML += '<br><b>Space used:</b> ' + (est.usage / 1024).toFixed(0) + ' KB of ' + (est.quota / 1048576).toFixed(0) + ' MB available';
    });
  }
  c.appendChild(st);
  // export / import / backup
  const row = el('div', 'row');
  const be = el('button', 'act', 'Export all progress as JSON');
  be.onclick = exportResults;
  const imp = el('input'); imp.type = 'file'; imp.accept = 'application/json'; imp.style.display = 'none';
  imp.onchange = () => importResults(imp.files[0]);
  const bi = el('button', 'ghost', 'Import progress');
  bi.onclick = () => imp.click();
  row.append(be, bi, imp);
  c.appendChild(row);
  c.appendChild(el('p', 'small muted', 'Import validates the file first; invalid files never touch your existing progress. Exported files include results, practice positions, adaptive state, learning progress and any interrupted exam.'));
  // resets
  c.appendChild(el('h3', '', 'Reset'));
  const row2 = el('div', 'row');
  MOD_IDS.forEach(mid => {
    const b = el('button', 'danger', 'Reset ' + MODS[mid].name);
    b.onclick = async () => {
      if (!confirm('Delete ALL progress for ' + MODS[mid].name + ' on this device? This cannot be undone.')) return;
      S.results = S.results.filter(r => r.module !== mid);
      MOD_IDS.forEach(() => { }); // practice keys handled below
      Object.keys(S.practice).forEach(k => { if (k.startsWith(mid + ':')) delete S.practice[k]; });
      delete S.adaptive[mid];
      if (Store.ok) { const old = await Store.all('results'); for (const r of old) if (r.module === mid) await Store.del('results', r.uid); }
      Save.mark(); renderSettings(); toast(MODS[mid].name + ' progress reset.');
    };
    row2.appendChild(b);
  });
  const ball = el('button', 'danger', 'Reset ALL progress');
  ball.onclick = async () => {
    if (!confirm('Delete ALL progress for every module on this device? Consider exporting a backup first. This cannot be undone.')) return;
    S.results = []; S.practice = {}; S.adaptive = {}; S.learning = { studied: {}, topics: {}, bookmarks: [], recent: [], exDone: {}, weakImproved: {} }; S.exam = null;
    if (Store.ok) { await Store.clear('results'); await Store.clear('kv'); }
    Save.mark(); renderSettings(); toast('All progress reset.');
  };
  row2.appendChild(ball);
  c.appendChild(row2);
  // migration note
  c.appendChild(el('h3', '', 'Schema &amp; migration'));
  c.appendChild(el('p', 'small muted', 'Database "' + Store.NAME + '" uses a versioned schema (currently v' + Store.VERSION + '). Upgrades run small ordered migration steps inside the database\'s own version-change transaction, so existing records are never deleted or rewritten. If a future update changes the schema, download a backup here first — Import can restore it.'));
  v.appendChild(c);
}

/* ================================ EXPORT/IMPORT ============================ */
function exportResults() {
  const payload = {
    app: 'dmat-core-practice', version: Store.VERSION, bankVersion: BANK.meta.version,
    exportedAt: new Date().toISOString(),
    profile: S.profile,
    results: S.results, state: S.stateSnapshot(), prefs: S.prefs
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'dmat-progress.json';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Progress exported.');
}
function importResults(file) {
  const fr = new FileReader();
  fr.onload = async () => {
    try {
      const data = JSON.parse(fr.result);
      if (!data || !Array.isArray(data.results)) throw new Error('missing results array');
      if (data.app && data.app !== 'dmat-core-practice') throw new Error('not a dmat practice export');
      // validate BEFORE touching anything
      const clean = [];
      data.results.forEach(r => {
        if (r && Q_BY_ID[r.qid] && ['correct', 'wrong', 'timeout'].indexOf(r.outcome) >= 0 &&
            typeof r.timeSec === 'number' && r.timeSec >= 0 && r.timeSec < 10000 &&
            CLASSES.indexOf(r.cls) >= 0 && MOD_IDS.indexOf(r.module) >= 0) {
          clean.push({ uid: r.uid || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)), module: r.module, qid: r.qid, cls: r.cls, type: r.type, techs: Array.isArray(r.techs) ? r.techs : Q_BY_ID[r.qid].techs, outcome: r.outcome, timeSec: Math.round(r.timeSec), user: r.user === undefined ? null : String(r.user), at: r.at || Date.now() });
        }
      });
      const fileProfile = String(data.profile || (data.state && data.state.profile) || 'Imported').trim().slice(0, 24) || 'Imported';
      const applyImport = async (targetProfile, stateOpt) => {
        // global uid uniqueness across all profiles
        const existing = new Set((Store.ok ? await Store.all('results') : S.results).map(r => r.uid));
        let added = 0;
        for (const r of clean) {
          if (existing.has(r.uid)) continue;
          existing.add(r.uid);
          const rec = Object.assign({}, r, { profile: targetProfile });
          if (Store.ok) await Store.put('results', rec);
          if (targetProfile === S.profile) S.results.push(rec);
          added++;
        }
        if (stateOpt && targetProfile !== S.profile) {
          // store their practice/adaptive/learning state under their profile
          const snap = { schema: Store.VERSION, profile: targetProfile, practice: stateOpt.practice || {}, activeModule: stateOpt.activeModule || 'latin', adaptive: stateOpt.adaptive || {}, learning: stateOpt.learning || { studied: {} }, prefs: stateOpt.prefs || {}, exam: stateOpt.exam || null, lastActivity: Date.now() };
          try { if (Store.ok) await Store.put('kv', snap, 'state:' + targetProfile); } catch (e) { }
          if (!Profiles.map[targetProfile]) { Profiles.map[targetProfile] = { createdAt: Date.now(), lastActivity: Date.now(), imported: true }; try { if (Store.ok) await Store.put('kv', Profiles.map, 'profiles'); } catch (e) { } }
        }
        Save.mark();
        toast('Imported ' + added + ' results into "' + targetProfile + '" (' + (clean.length - added) + ' duplicates/invalid skipped).');
        renderProfileChip();
        renderSettings();
      };
      if (fileProfile && fileProfile !== S.profile) {
        modal('Import progress from "' + esc(fileProfile) + '"',
          '<p class="small">The file contains ' + clean.length + ' valid results from profile <b>' + esc(fileProfile) + '</b>. Where should they go?</p>',
          [['Merge into "' + S.profile + '"', 'act', () => applyImport(S.profile, null)],
           ['Create profile "' + esc(fileProfile) + '"', 'ghost', () => applyImport(fileProfile, data.state)],
           ['Cancel', 'ghost', null]]);
      } else {
        await applyImport(S.profile, data.state);
      }
    } catch (e) { toast('Import failed: ' + e.message + ' — your existing progress is untouched.'); }
  };
  fr.readAsText(file);
}

/* ============================== STUDY NOTES ================================ */
const TECH_TEXT = {
  latin: {
    title: 'Latin Squares techniques (T1–T17)',
    items: {
      1: ['Always your first move.', 'Read the row and the column through the ? as ONE merged list of letters. Four different letters visible → the fifth is the answer.', 'Reading the row and column separately; forgetting a repeated letter still only counts once.'],
      2: ['When the cross alone does not finish it.', 'Count where each letter is placed. A letter seen 4 times is missing from exactly one row and one column — its fifth cell is forced.', 'Scanning cells instead of letters when cells are jammed.'],
      3: ['The ? has two candidates left.', 'Look at the OTHER empty cell in ?\'s row or column. If one of the two candidates cannot go there, it is trapped in ?, so the other candidate goes into ?.', 'Checking cells outside the cross line.'],
      4: ['The cross is quiet.', 'A line with four letters fills itself in one move — start there, never in an empty region.', 'Filling random easy cells far from the ?.'],
      5: ['On every single placement.', 'The row proposes, the column vetoes: a candidate must clear BOTH its row and its column.', 'Trusting a row-only match (classic veto trap).'],
      6: ['The cross needs information you cannot see yet.', 'Derive a cell mentally, use it, drop it — never write anything. Hold at most two phantom letters at once.', 'Holding 3+ phantom letters and losing track.'],
      7: ['The cross shows almost nothing.', 'Chase letters, not cells: pick a letter and count every cell where it can still legally go. Where the count is 1, it is forced.', 'Staring at the empty cross.'],
      8: ['A line is missing exactly two letters in two empty cells.', 'Resolve the pair together: whatever forces one cell forces the other.', 'Trying to decide one cell of the pair in isolation.'],
      9: ['Before every fill.', 'Only fill cells that walk toward the ?. Spend about 10 seconds choosing the road — it saves 30.', 'Completing the grid like a Sudoku.'],
      10: ['Jammed or out of time.', 'Mark it, skip it, come back. If you must guess, eliminate what the cross rules out first.', 'Burning minutes on one question; leaving blanks.'],
      11: ['Any empty cell.', 'Candidates = letters missing from BOTH the row and the column. One candidate left → fill it. The Cross is this applied to the ? itself.', 'Missing column information.'],
      12: ['Cell perspective is jammed.', 'Pick a line. If a letter can go in only ONE cell of that line, it must go there.', 'Checking the letter against the row but not its column conflicts.'],
      13: ['Rarely needed (advanced).', 'Two cells in the same line with the same two candidates reserve those letters — remove them from every other cell in that line.', 'Applying it when the two cells are not in the same line.'],
      14: ['Rarely needed (advanced).', 'Two letters that can only go in the same two cells of a line take those cells over — remove all other candidates from them.', 'Confusing it with the naked pair.'],
      15: ['Rarely needed (advanced).', 'A letter with exactly two possible cells in each of two rows, sharing the same two columns, is locked to those columns — remove it elsewhere in them.', 'Forcing it where a phantom chain is faster.'],
      16: ['Optional speed aid.', 'A=1 … E=5, every full line sums to 15. Four seen letters → missing = 15 − sum. Two missing → their sum narrows the pair.', 'Using it as a proof instead of a check.'],
      17: ['Before starting a hard grid.', 'Count how often each letter is placed. A letter placed 4 times is the cheapest to finish (T2), one placed 3 times is next.', 'Tallying mid-solve instead of once at the start.']
    }
  },
  math: {
    title: 'Mathematical Equations techniques (T1–T6)',
    items: {
      1: ['Almost every question.', 'Substitution: solve the equation with the fewest unknowns first, then feed its value into the next one. Work forwards from what is given toward the ?.', 'Starting from an equation with two unknowns.'],
      2: ['Two letters only ever appear together.', 'If two equations contain the same two unknown letters, add or subtract them to cancel one letter, then substitute back.', 'Trying to solve one of the pair alone.'],
      3: ['Equations like 3A = 45.', 'Divide first: A = 15. Coefficients 2 and 3 are exact divisions — never estimate.', 'Long-dividing when a small multiple is enough.'],
      4: ['Equations like A − B = 4.', 'A difference pins the gap between two letters; combine it with a sum to get both (half the sum plus/minus half the difference).', 'Sign errors when moving letters across the equals sign.'],
      5: ['Before moving on.', 'Substitute your answer into EVERY equation — the first one that fails shows the error. In practice mode the platform does this for you.', 'Checking only the equation used last.'],
      6: ['Always.', 'Values are 1–20, whole numbers. Use number sense: multiples, parity and size limits prune wrong candidates fast.', 'Treating it like algebra on paper — it is mental math.']
    }
  },
  figures: {
    title: 'Figure Sequences techniques (T1–T5)',
    items: {
      1: ['Every sequence.', 'Pick ONE element and follow it across all frames: does it rotate, move, change shading? Lock its rule before looking at anything else.', 'Trying to see the whole pattern change at once.'],
      2: ['Two rules are active.', 'Attribute every visible change to exactly one rule; the rules should explain ALL differences between consecutive frames with nothing left over.', 'Two rules explaining the same change (double counting).'],
      3: ['Hard and Master sequences.', 'Track each element separately, write its rule, then combine: the answer frame applies every rule exactly one more time.', 'Forgetting the least visible rule (shading, colour).'],
      4: ['When choosing between options.', 'Most distractors break exactly ONE rule. Check each option against each rule; the wrong ones fail exactly one.', 'Picking an option that "looks right" without checking all rules.'],
      5: ['Easy sequences with few frames.', 'Some easy sequences cycle: the pattern repeats every 2–4 frames. Detect the period and the answer is the frame that continues the cycle.', 'Assuming every sequence is strictly new each frame.']
    }
  }
};
function renderNotes() {
  StudyNotes.render(document.getElementById('view-notes'));
}
function renderNotesLegacy() {
  const v = $('#view-notes');
  v.innerHTML = '';
  moduleBar(v, S.activeModule);
  const seg = el('div', 'modulebar');
  [['tech', 'Techniques & examples'], ['deep', 'Deep dives & formulas']].forEach(pair => {
    const bt = el('button', (S.notesTab || 'tech') === pair[0] ? 'active' : '', pair[1]);
    bt.onclick = () => { S.notesTab = pair[0]; Save.mark(); refreshCurrentView(); };
    seg.appendChild(bt);
  });
  v.appendChild(seg);
  if ((S.notesTab || 'tech') === 'deep') { renderDeepNotes(v, S.activeModule); return; }
  renderNotesTech(v, S.activeModule);
}
function renderNotesTech(v, mid) {
  const T = TECH_TEXT[mid];
  const intro = el('div', 'card');
  intro.innerHTML = '<h2>Study Notes</h2><p class="muted small">All wording is original to this platform; worked examples come from the platform\'s own verified generator — nothing is copied from official or commercial materials. Marking a technique as studied is saved on this device.</p>';
  v.appendChild(intro);
  const tcard = el('div', 'card');
  tcard.innerHTML = '<h2>' + esc(T.title) + '</h2>';
  Object.keys(T.items).forEach(n => {
    const [when, how, mistake] = T.items[n];
    const d = el('div', 'techcard'); d.id = 'tech-' + mid + '-' + n;
    let html = '<span class="tnum">T' + n + '</span><b>' + (TECH_NAME[mid][n] || '') + '</b>' +
      (mid === 'latin' && +n >= 13 && +n <= 15 ? '<span class="pill adv">Advanced — rarely needed</span>' : '') +
      '<div class="small"><b>When:</b> ' + esc(when) + '</div><div class="small"><b>How:</b> ' + esc(how) + '</div>' +
      '<div class="small muted"><b>Common mistake:</b> ' + esc(mistake) + '</div>';
    const key = mid + ':' + n;
    html += '<div class="small" style="margin-top:6px"><label><input type="checkbox" ' + (S.learning.studied[key] ? 'checked' : '') + ' data-study="' + key + '"> studied</label></div>';
    d.innerHTML = html;
    d.querySelector('[data-study]').onchange = ev => { if (ev.target.checked) S.learning.studied[key] = Date.now(); else delete S.learning.studied[key]; Save.mark(); };
    // worked example
    if (mid === 'latin' && BANK.latin.examples[n]) {
      const ex = BANK.latin.examples[n];
      const w = el('div', 'row'); w.style.marginTop = '8px';
      if (ex.patternDemo) {
        const g = el('div');
        renderGrid(g, { grid: ex.grid.map(x => x === 0 ? null : C.LTR[x - 1]), target: -1, answer: '' }, { mini: true, hlCells: ex.pairCells });
        w.appendChild(g);
        w.appendChild(el('div', 'small', '<b>Pattern demo (verified):</b> ' + esc(ex.reason)));
      } else {
        const q = Q_BY_ID[ex.qref];
        if (q) {
          const s = q.steps[ex.stepIdx];
          const g = el('div');
          renderGrid(g, q, { mini: true, showAnswer: true, hlCells: (s.cells || []).filter(i => i >= 0) });
          w.appendChild(g);
          w.appendChild(el('div', 'small', '<b>Worked example — ' + esc(q.id) + ' (' + q.cls + '):</b> ' + esc(s.reason) + ' <span class="muted">Answer: ' + q.answer + '.</span>'));
        }
      }
      tcard.appendChild(d); tcard.appendChild(w);
      return;
    }
    if (mid === 'math' && !BANK._mathEx) {
      BANK._mathEx = bankQ('math', 'Hard')[0];
    }
    if (mid === 'math' && +n === 1 && BANK._mathEx) {
      const q = BANK._mathEx;
      const w = el('div', 'row'); w.style.marginTop = '8px';
      w.appendChild(el('div', 'small', '<b>Worked example — ' + esc(q.id) + ' (' + q.cls + '):</b> ' + esc(q.eqText.join('  ·  ')) + '. Steps: ' + esc(q.steps.map(s => 'ABCDEF'[s.letter] + '=' + s.value).join(', ')) + '. <span class="muted">Answer: ' + q.answer + '.</span>'));
      tcard.appendChild(d); tcard.appendChild(w);
      return;
    }
    if (mid === 'figures' && !BANK._figEx) BANK._figEx = bankQ('figures', 'Hard')[0];
    if (mid === 'figures' && +n === 1 && BANK._figEx) {
      const q = BANK._figEx;
      const w = el('div', 'row'); w.style.marginTop = '8px';
      const g = el('div', 'figrow');
      g.innerHTML = q.frames.map((fr, i) => '<div class="figframe">' + frameSVG(q, i === 5 ? q.frames[5] : fr, 44, i === 5) + '</div>').join('<span class="arrowsep">→</span>');
      w.appendChild(g);
      w.appendChild(el('div', 'small', '<b>Worked example — ' + esc(q.id) + ' (' + q.cls + '):</b> ' + esc(q.steps.map(s => s.reason).join(' ')) + ' <span class="muted">Answer: ' + q.answer + '.</span>'));
      tcard.appendChild(d); tcard.appendChild(w);
      return;
    }
    tcard.appendChild(d);
  });
  v.appendChild(tcard);
  // class cards linking techniques
  const clsMap = {
    latin: [['Easy', 'Cross only, 1 step.', [1, 11, 16, 17]], ['Medium', 'Letter scan / trapped candidate / hidden single, 2–3 steps.', [2, 3, 12]], ['Hard', 'Busiest line, veto, phantoms, missing pair — 4–5 steps.', [4, 5, 6, 8, 9]], ['Extreme', 'Empty cross, long chains, pair/wing — 6+ steps.', [7, 13, 14, 15]], ['Master', 'Very hard: 9+ steps or 4+ phantom fills or advanced eliminations on near-empty grids. Calibrated above Extreme; harder than anything published officially.', [6, 7, 13, 14, 15]]],
    math: [['Easy', 'Direct values and one substitution.', [1, 5]], ['Medium', 'Two-step chains with addition/subtraction.', [1, 4]], ['Hard', '3–4 letters, multiples, first eliminations.', [1, 2, 3]], ['Extreme', '4–5 letters, elimination pairs, values to 20.', [2, 3, 6]], ['Master', '5–6 letters, several interacting elimination pairs and redundant constraints.', [2, 3, 6]]],
    figures: [['Easy', 'One rule (movement / rotation / shading), possibly cycling.', [1, 5]], ['Medium', 'Two rules or an alternating rule.', [1, 2]], ['Hard', 'Three simultaneous rules.', [2, 3]], ['Extreme', 'Three rules incl. swaps, colours or late additions.', [3, 4]], ['Master', 'Four or more interacting rules incl. alternation.', [3, 4]]]
  }[mid];
  const clsCard = el('div', 'card');
  clsCard.innerHTML = '<h2>Difficulty classes</h2>';
  clsMap.forEach(([cls, desc, techs]) => {
    const d = el('div', 'techcard');
    d.innerHTML = '<span class="pill class-' + cls + '">' + cls + '</span> <span class="muted small">' + esc(desc) + '</span><br>' +
      '<span class="small">Techniques: ' + techs.map(t => '<a href="#" data-tech="' + t + '">T' + t + ' ' + (TECH_NAME[mid][t] || '') + '</a>').join(' · ') + '</span>';
    d.querySelectorAll('a[data-tech]').forEach(a => a.onclick = e => { e.preventDefault(); const n = document.getElementById('tech-' + mid + '-' + a.dataset.tech); if (n) n.scrollIntoView(); });
    clsCard.appendChild(d);
  });
  v.appendChild(clsCard);
  // sources
  const src = el('div', 'card');
  src.innerHTML = '<h2>Sources consulted</h2><ul class="small">' +
    '<li><b>Official — testas.de (g.a.s.t.):</b> <a href="https://www.testas.de/en/teilnehmende/the-digital-testas/structure-of-the-digital-testas" target="_blank" rel="noopener">Structure of the digital TestAS</a> — Core Module = Figure Sequences, Mathematical Equations, Latin Squares, 20 items / 25 min each; Latin Squares 5×5 A–E; Mathematical Equations: unique solution per letter, values 1–20, answers worked out (the one non-single-choice subtest); Figure Sequences: figures change position, colour and/or alignment in rule-governed ways; no negative marking.</li>' +
    '<li><b>Official — testas.de:</b> preparation PDF + tutorial videos exist behind registration (<a href="https://www.testas.de/en/teilnehmende/the-digital-testas/preparing-for-the-digital-testas" target="_blank" rel="noopener">preparing page</a>) — <b>not directly accessed; official sample difficulty is unverified</b> and class calibration is the platform\'s own.</li>' +
    '<li><b>Supplementary:</b> prep-provider guides (CareerWise, LeapScholar, DMAT Club) for solving order; standard Sudoku-family logic for pairs/X-wing; all techniques re-derived and machine-verified here. No grids, figures or wording copied.</li>' +
    '<li><b>Unverified:</b> exact dMAT item counts (third parties disagree); per-question time (25 min ÷ 20 = 75 s derived); the Master class is a practice construct above anything officially published.</li></ul>';
  v.appendChild(src);
}

/* ================================ DEEP DIVES ================================ */
function renderDeepNotes(v, mid) {
  const cur = DN[mid];
  const intro = el('div', 'card');
  intro.innerHTML = '<h2>Deep dives — ' + esc(MODS[mid].name) + '</h2>' +
    '<p class="muted small">The full method: fundamentals, formulas, mental tricks and verified walkthroughs. Every walkthrough below is a real bank question solved by the platform\'s verified engine — nothing here is hand-invented. Tick sections off as you study them (saved automatically).</p>';
  v.appendChild(intro);
  if (DN.shared) {
    const sc = el('div', 'card deepsec');
    sc.innerHTML = '<h3>' + esc(DN.shared.title) + '</h3>';
    renderDeepBlocks(sc, DN.shared.blocks, mid, 'shared');
    v.appendChild(sc);
  }
  const toc = el('div', 'card');
  toc.innerHTML = '<h3>Contents</h3><div class="row small">' +
    cur.map(sec => '<a href="#" data-deep="' + sec.id + '">' + esc(sec.title) + '</a>').join(' · ') + '</div>';
  toc.querySelectorAll('a[data-deep]').forEach(a => a.onclick = e => { e.preventDefault(); const n = document.getElementById('deep-' + mid + '-' + a.dataset.deep); if (n) n.scrollIntoView(); });
  v.appendChild(toc);
  cur.forEach(sec => {
    const card = el('div', 'card deepsec'); card.id = 'deep-' + mid + '-' + sec.id;
    card.innerHTML = '<h2 style="font-size:16px">' + esc(sec.title) + '</h2>';
    renderDeepBlocks(card, sec.blocks, mid, sec.id);
    const key = 'deep:' + mid + ':' + sec.id;
    const lbl = el('label', 'small', '<input type="checkbox" ' + (S.learning.studied[key] ? 'checked' : '') + ' data-study="' + key + '"> studied this section');
    lbl.style.marginTop = '8px';
    lbl.querySelector('input').onchange = ev => { if (ev.target.checked) S.learning.studied[key] = Date.now(); else delete S.learning.studied[key]; Save.mark(); };
    card.appendChild(lbl);
    v.appendChild(card);
  });
  v.appendChild(el('div', 'card', '<p class="small muted">Next: practise the methods above in Class Practice (start one class up from your comfort zone), then check the Group tab to see how your pace compares. All wording on this platform is original; formulas are elementary and machine-verified by the solver.</p>'));
}
function renderDeepBlocks(card, blocks, mid, secId) {
  let walkN = 0;
  blocks.forEach(bl => {
    if (bl.p !== undefined) card.appendChild(el('div', 'small', esc(bl.p)));
    else if (bl.f !== undefined) card.appendChild(el('div', 'fbox', bl.f.map(esc).join('<br>')));
    else if (bl.b !== undefined) { const u = el('ul', 'small'); u.style.margin = '6px 0 6px 18px'; bl.b.forEach(x => u.appendChild(el('li', '', esc(x)))); card.appendChild(u); }
    else if (bl.t !== undefined) { const u = el('ul', 'small oklist'); u.style.margin = '6px 0'; bl.t.forEach(x => u.appendChild(el('li', '', esc(x)))); card.appendChild(u); }
    else if (bl.w !== undefined) { const u = el('ul', 'small warnlist'); u.style.margin = '6px 0'; bl.w.forEach(x => u.appendChild(el('li', '', esc(x)))); card.appendChild(u); }
    else if (bl.walk !== undefined) {
      walkN++;
      const qs = bankQ(mid, bl.walk.cls);
      let q = null;
      if (bl.walk.pickTech !== undefined) q = qs.find(x => (x.techs || []).indexOf(bl.walk.pickTech) >= 0) || null;
      else if (bl.walk.pickElim) q = qs.find(x => x.elims >= 1) || null;
      if (!q) q = qs[(walkN * 3) % qs.length];
      const holder = el('div', '', '<div class="small" style="font-weight:700;margin:10px 0 6px">Verified walkthrough</div>');
      card.appendChild(holder);
      const inner = el('div');
      holder.appendChild(inner);
      renderWalk(inner, q);
    }
  });
}
function renderWalk(container, q) {
  const wrap = el('div', 'qgridwrap');
  const gw = el('div');
  const side = el('div', 'qside');
  if (q.module === 'math') {
    gw.appendChild(el('div', 'eqcard', '<div class="eqlist small">' + q.eqText.map(esc).join('<br>') + '</div>'));
    side.appendChild(el('div', 'qprompt', 'Answer: ' + q.answer));
  } else if (q.module === 'figures') {
    const fr = el('div', 'figrow');
    q.frames.forEach((f, i) => {
      const box = el('div', 'figframe' + (i === 5 ? ' q' : ''));
      box.innerHTML = frameSVG(q, i === 5 ? q.frames[5] : f, 44, i === 5);
      fr.appendChild(box);
      if (i < 5) fr.appendChild(el('span', 'arrowsep', '→'));
    });
    gw.appendChild(fr);
    side.appendChild(el('div', 'qprompt', 'Answer: ' + q.answer));
  } else {
    renderGrid(gw, q, { showAnswer: true });
    side.appendChild(el('div', 'qprompt', 'Answer: ' + q.answer));
  }
  const ol = el('ol', 'steps');
  q.steps.forEach((st, i) => ol.appendChild(el('li', '', '<span class="tname">Step ' + (i + 1) + '</span><div>' + esc(st.reason) + '</div>')));
  side.appendChild(ol);
  wrap.append(gw, side);
  container.appendChild(wrap);
}

/* ============================== CLASS PRACTICE ============================== */
function startPractice(mid, cls, mode) {
  const key = mid + ':' + cls;
  mode = mode || (S.practice[key] && S.practice[key].mode) || 'seq';
  if (!S.practice[key] || S.practice[key].mode !== mode || !S.practice[key].order) {
    let order = bankQ(mid, cls).map((_, i) => i);
    if (mode === 'shuf') order = C.shuffle(order, Math.random);
    S.practice[key] = { idx: 0, mode, order };
  }
  S.practice._active = key;
  Save.mark();
}
function classStats(mid, cls) {
  const R = S.results.filter(r => r.module === mid && r.cls === cls);
  return { n: R.length, ok: R.filter(r => r.outcome === 'correct').length, avg: R.length ? R.reduce((a, r) => a + r.timeSec, 0) / R.length : 0 };
}
function renderClassMenu(msg) {
  const v = $('#view-class');
  v.innerHTML = '';
  if (S.retryQueue) { renderPracticeRun(); return; }
  const mid = S.activeModule;
  const menu = el('div', 'card');
  menu.innerHTML = '<h2>Class Practice — ' + esc(MODS[mid].name) + '</h2><p class="muted small">50 seconds per question (all classes, including Master), countdown turns amber under 20s and red under 10s. After every question you get the full step-by-step explanation. Positions are saved automatically — leave and resume any time.</p>';
  if (msg) menu.appendChild(el('p', '', '<b>' + esc(msg) + '</b>'));
  moduleBar(menu, mid);
  const grid = el('div', 'grid2');
  CLASSES.forEach(cls => {
    const qs = bankQ(mid, cls);
    const key = mid + ':' + cls;
    const st = S.practice[key];
    const done = st ? Math.min(st.idx, qs.length) : 0;
    const cs = classStats(mid, cls);
    const c = el('div', 'card');
    c.innerHTML = '<h3><span class="pill class-' + cls + '">' + cls + '</span> <span class="muted small">' + qs.length + ' questions</span></h3>' +
      '<div class="pbar" style="margin:6px 0"><div style="width:' + (100 * done / qs.length) + '%"></div></div>' +
      '<div class="small muted">Completed: ' + done + ' (' + Math.round(100 * done / qs.length) + '%) · this device: ' + cs.n + ' tried, ' + (cs.n ? Math.round(100 * cs.ok / cs.n) + '% correct' : '—') + ' · Ø ' + Math.round(cs.avg) + 's</div>';
    const row = el('div', 'row'); row.style.marginTop = '8px';
    const b1 = el('button', 'act', done ? 'Resume at #' + (done + 1) : 'Start');
    b1.onclick = () => { startPractice(mid, cls, 'seq'); showPracticeQuestion(); };
    const b2 = el('button', 'ghost', 'Shuffled');
    b2.onclick = () => { startPractice(mid, cls, 'shuf'); showPracticeQuestion(); };
    const jump = el('input', 'ghost'); jump.type = 'number'; jump.min = 1; jump.max = qs.length; jump.value = done + 1; jump.style.width = '70px'; jump.title = 'Jump to question number';
    const b3 = el('button', 'ghost', 'Go');
    b3.onclick = () => { startPractice(mid, cls, 'seq'); const n = Math.max(1, Math.min(qs.length, +jump.value || 1)); S.practice[key].idx = n - 1; showPracticeQuestion(); };
    row.append(b1, b2, jump, b3);
    c.appendChild(row);
    grid.appendChild(c);
  });
  menu.appendChild(grid);
  v.appendChild(menu);
}
function showPracticeQuestion() {
  const v = $('#view-class');
  v.innerHTML = '';
  let q, posLabel, pos;
  if (S.retryQueue) {
    const rq = S.retryQueue;
    if (!rq.list.length) { S.retryQueue = null; renderClassMenu('Retry queue finished.'); return; }
    q = rq.list[0]; pos = rq.pos; posLabel = 'Retry ' + (pos + 1) + ' of ' + rq.total;
  } else {
    const key = S.practice._active;
    const [mid, cls] = key.split(':');
    const st = S.practice[key];
    if (st.idx >= st.order.length) { renderClassMenu('Class ' + cls + ' (' + MODS[mid].name + ') completed — ' + bankQ(mid, cls).length + ' questions done.'); return; }
    q = bankQ(mid, cls)[st.order[st.idx]];
    posLabel = 'Question ' + (st.idx + 1) + ' of ' + st.order.length;
  }
  const wrap = el('div', 'card');
  const bar = el('div', 'row'); bar.style.justifyContent = 'space-between';
  const bquit = el('button', 'ghost', 'Quit to menu');
  bquit.onclick = () => { stopAllTimers(); S.retryQueue = null; renderClassMenu(); };
  bar.appendChild(bquit);
  wrap.appendChild(bar);
  const qv = el('div');
  wrap.appendChild(qv);
  v.appendChild(wrap);
  const t0 = Date.now();
  let finished = false;
  MODS[q.module].render(qv, q, {
    counter: posLabel + ' · ' + q.id, timer: true,
    onAnswer: a => {
      if (finished) return; finished = true;
      stopAllTimers();
      const timeSec = Math.min(50, Math.round((Date.now() - t0) / 1000));
      const ok = MODS[q.module].checkAnswer(q, a);
      recordResult(q, ok ? 'correct' : 'wrong', timeSec, a);
      advance(q, { outcome: ok ? 'correct' : 'wrong', timeSec, user: a });
    },
    onTimeout: () => {
      if (finished) return; finished = true;
      recordResult(q, 'timeout', 50, null);
      advance(q, { outcome: 'timeout', timeSec: 50, user: null });
    }
  });
  function advance(qq, result) {
    if (S.retryQueue) { S.retryQueue.list.shift(); S.retryQueue.pos++; }
    else S.practice[S.practice._active].idx++;
    const ex = el('div');
    MODS[qq.module].explain(ex, qq, result);
    wrap.appendChild(ex);
    const row = el('div', 'row'); row.style.marginTop = '12px';
    const bn = el('button', 'act', 'Next question (Enter)');
    bn.onclick = () => { stopAllTimers(); showPracticeQuestion(); };
    row.appendChild(bn);
    wrap.appendChild(row);
    wrap._nextBtn = bn;
  }
}

/* ============================== EXAM SIMULATION ============================= */
function renderExamIntro() {
  const v = $('#view-exam');
  v.innerHTML = '';
  if (S.exam && !S.exam.submitted) { renderExamRun(); return; }
  if (S.exam && S.exam.submitted) { renderExamResults(); return; }
  const mid = S.activeModule;
  const c = el('div', 'card');
  c.innerHTML = '<h2>Exam Simulation — ' + esc(MODS[mid].name) + '</h2>' +
    '<ul class="small">' +
    '<li><b>Standard:</b> 20 questions — 6 Easy, 6 Medium, 5 Hard, 3 Extreme · one 25-minute timer · Master questions are NOT included.</li>' +
    '<li><b>Advanced:</b> 20 Master questions · same 25-minute format · for after Extreme feels comfortable.</li>' +
    '<li>Navigate freely, mark for review (<span class="kbd">M</span>), skip and return. No explanations during the test; full review afterwards.</li>' +
    '<li>No negative marking — you are warned before submitting blanks. The exam is auto-saved: if the browser closes, you can resume from the Dashboard.</li>' +
    '</ul>';
  moduleBar(c, mid);
  const row = el('div', 'row');
  const b1 = el('button', 'act', 'Start standard exam');
  b1.onclick = () => buildExam('standard');
  const b2 = el('button', 'ghost', 'Start advanced exam (Master)');
  b2.onclick = () => buildExam('advanced');
  row.append(b1, b2);
  c.appendChild(row);
  v.appendChild(c);
}
function buildExam(kind) {
  const mid = S.activeModule;
  const qs = [];
  if (kind === 'advanced') {
    qs.push(...C.shuffle(bankQ(mid, 'Master').slice(), Math.random).slice(0, 20));
  } else {
    const mix = { Easy: 6, Medium: 6, Hard: 5, Extreme: 3 };
    CLASSES.filter(c => c !== 'Master').forEach(cls => {
      qs.push(...C.shuffle(bankQ(mid, cls).slice(), Math.random).slice(0, mix[cls]));
    });
  }
  S.exam = { module: mid, kind, qs, answers: Array(20).fill(null), marks: new Set(), idx: 0, left: 25 * 60, qTimes: Array(20).fill(0), totalStart: Date.now(), submitted: false };
  Save.mark();
  renderExamRun();
}
function renderExamRun() {
  const v = $('#view-exam');
  const e = S.exam;
  v.innerHTML = '';
  const top = el('div', 'card');
  const trow = el('div', 'row'); trow.style.justifyContent = 'space-between';
  const tl = el('div', 'qtimer', fmtClock(e.left));
  S.timers.exam = startTimer(e.left, left => {
    e.left = left; tl.textContent = fmtClock(left);
    tl.classList.toggle('danger', left <= 60);
  }, () => finishExam(true));
  const bsub = el('button', 'act', 'Submit');
  bsub.onclick = () => {
    const blank = e.answers.filter(a => a === null).length;
    if (blank && !confirm(blank + ' question(s) are unanswered. There is no negative marking — a guess is free. Submit anyway?')) return;
    finishExam(false);
  };
  trow.append(el('div', '', '<b>' + (e.kind === 'advanced' ? 'Advanced' : 'Standard') + ' Exam</b> <span class="muted small">' + MODS[e.module].name + ' · 25 min · 20 questions' + (e.resumed ? ' · <b style="color:var(--amber)">resumed after interruption</b>' : '') + '</span>'), tl, bsub);
  top.appendChild(trow);
  v.appendChild(top);
  const mid = el('div', 'card');
  const nav = el('div', 'navgrid');
  e.qs.forEach((q, i) => { const b = el('button', '', i + 1); b.onclick = () => examGoto(i); nav.appendChild(b); });
  mid.appendChild(nav);
  mid.appendChild(el('div', 'legend', '<span class="l-done">answered</span><span class="l-mark">marked</span><span>current is outlined</span>'));
  const brow = el('div', 'row'); brow.style.marginTop = '10px';
  const bmark = el('button', 'ghost', 'Mark for review (M)');
  bmark.onclick = examMark;
  const bprev = el('button', 'ghost', 'Previous');
  bprev.onclick = () => examGoto(Math.max(0, e.idx - 1));
  const bnext = el('button', 'ghost', 'Next / skip');
  bnext.onclick = () => examGoto(Math.min(19, e.idx + 1));
  brow.append(bprev, bmark, bnext);
  mid.appendChild(brow);
  v.appendChild(mid);
  const qv = el('div', 'card');
  v.appendChild(qv);
  e._nav = nav; e._qv = qv;
  examGoto(e.idx, true);
}
function examGoto(i, force) {
  const e = S.exam; if (!e || e.submitted) return;
  if (!force) e.qTimes[e.idx] += (Date.now() - (e._qStart || Date.now())) / 1000;
  e.idx = i; e._qStart = Date.now();
  e._nav.querySelectorAll('button').forEach((b, j) => {
    b.className = '';
    if (e.answers[j] !== null) b.classList.add('done');
    if (e.marks.has(j)) b.classList.add('marked');
    if (j === e.idx) b.classList.add('cur');
  });
  renderExamQuestion(e._qv);
  Save.mark();
}
function examMark() {
  const e = S.exam;
  e.marks.has(e.idx) ? e.marks.delete(e.idx) : e.marks.add(e.idx);
  Save.mark();
  examGoto(e.idx, true);
}
function renderExamQuestion(qv) {
  const e = S.exam, q = e.qs[e.idx];
  MODS[q.module].render(qv, q, {
    counter: 'Question ' + (e.idx + 1) + ' of 20', timer: false,
    answered: e.answers[e.idx] !== null, userLetter: e.answers[e.idx],
    onAnswer: a => { e.answers[e.idx] = a; Save.mark(); examGoto(e.idx, true); },
    examCtl: side => {
      const r = el('div', 'row'); r.style.marginTop = '10px';
      const bm = el('button', 'ghost', e.marks.has(e.idx) ? 'Unmark' : 'Mark');
      bm.onclick = examMark;
      r.appendChild(bm); side.appendChild(r);
    }
  });
}
function finishExam(auto) {
  const e = S.exam; if (!e || e.submitted) return;
  stopAllTimers();
  e.qTimes[e.idx] += (Date.now() - (e._qStart || Date.now())) / 1000;
  e.submitted = true; e.auto = !!auto;
  e.qs.forEach((q, i) => {
    if (e.answers[i] === null) return;
    recordResult(q, e.answers[i] === MODS[q.module].answerValue(q) ? 'correct' : 'wrong', Math.min(600, Math.round(e.qTimes[i])), e.answers[i]);
  });
  Save.mark();
  renderExamResults();
}
function calculateScore(e) { return e.qs.reduce((n, q, i) => n + (e.answers[i] !== null && MODS[q.module].checkAnswer(q, e.answers[i]) ? 1 : 0), 0); }
function renderExamResults() {
  const v = $('#view-exam'); const e = S.exam;
  v.innerHTML = '';
  const c = el('div', 'card');
  const score = calculateScore(e);
  const attempted = e.answers.filter(a => a !== null).length;
  const used = 25 * 60 - e.left;
  c.innerHTML = '<h2>Results — ' + esc(MODS[e.module].name) + ' (' + (e.kind === 'advanced' ? 'Advanced' : 'Standard') + ')</h2>' +
    '<p style="font-size:34px;font-weight:800;margin:4px 0">' + score + ' / 20 <span class="muted" style="font-size:16px">(' + Math.round(score * 5) + '%)</span></p>' +
    '<p class="muted small">' + (e.auto ? 'Time expired — submitted automatically. ' : '') + 'Answered: ' + attempted + '/20 · time used: ' + fmtClock(used) + '.</p>';
  const t = el('table', 'stat');
  t.innerHTML = '<tr><th>Class</th><th>Questions</th><th>Correct</th><th>Accuracy</th></tr>';
  const groups = e.kind === 'advanced' ? ['Master'] : ['Easy', 'Medium', 'Hard', 'Extreme'];
  groups.forEach(cls => {
    const idxs = e.qs.map((q, i) => [q, i]).filter(([q]) => q.cls === cls);
    const ok = idxs.filter(([q, i]) => e.answers[i] !== null && MODS[q.module].checkAnswer(q, e.answers[i])).length;
    t.innerHTML += '<tr><td>' + cls + '</td><td class="num">' + idxs.length + '</td><td class="num">' + ok + '</td><td class="num">' + (idxs.length ? Math.round(100 * ok / idxs.length) + '%' : '—') + '</td></tr>';
  });
  c.appendChild(t);
  const row = el('div', 'row'); row.style.marginTop = '12px';
  const br = el('button', 'act', 'Review every question');
  br.onclick = () => { S.examReview = { idx: 0 }; renderExamReview(); };
  const bn = el('button', 'ghost', 'New exam');
  bn.onclick = () => { S.exam = null; Save.mark(); renderExamIntro(); };
  row.append(br, bn);
  c.appendChild(row);
  v.appendChild(c);
}
function renderExamReview() {
  const v = $('#view-exam'); const e = S.exam; const rv = S.examReview;
  v.innerHTML = '';
  const c = el('div', 'card');
  const q = e.qs[rv.idx];
  const yourAnswer = e.answers[rv.idx];
  const res = { outcome: yourAnswer === null ? 'wrong' : (MODS[q.module].checkAnswer(q, yourAnswer) ? 'correct' : 'wrong'), timeSec: Math.round(e.qTimes[rv.idx]), user: yourAnswer };
  c.appendChild(el('div', 'qhead', '<b>Review — Question ' + (rv.idx + 1) + ' of 20</b> <span class="muted small">' + q.id + '</span>'));
  const qv = el('div');
  MODS[q.module].render(qv, q, { counter: 'Your answer: ' + (yourAnswer === null ? '— (blank)' : yourAnswer), reveal: true, userLetter: yourAnswer });
  c.appendChild(qv);
  const ex = el('div');
  MODS[q.module].explain(ex, q, res);
  c.appendChild(ex);
  const row = el('div', 'row');
  const bp = el('button', 'ghost', 'Previous');
  bp.disabled = rv.idx === 0;
  bp.onclick = () => { rv.idx--; renderExamReview(); };
  const bn = el('button', 'act', rv.idx === 19 ? 'Finish review' : 'Next');
  bn.onclick = () => { if (rv.idx === 19) showView('analytics'); else { rv.idx++; renderExamReview(); } };
  row.append(bp, bn);
  c.appendChild(row);
  v.appendChild(c);
}

/* ============================= ADAPTIVE PRACTICE ============================ */
function updatePerformance() { /* stats are computed on the fly; kept for interface parity */ }
function computeStats(mid) {
  const R = mid ? S.results.filter(r => r.module === mid) : S.results;
  const by = key => {
    const m = {};
    R.forEach(r => {
      const ks = key(r);
      (Array.isArray(ks) ? ks : [ks]).forEach(k => { m[k] = m[k] || { n: 0, ok: 0, time: 0 }; m[k].n++; if (r.outcome === 'correct') m[k].ok++; m[k].time += r.timeSec; });
    });
    return m;
  };
  return {
    n: R.length, ok: R.filter(r => r.outcome === 'correct').length,
    avgTime: R.length ? R.reduce((a, r) => a + r.timeSec, 0) / R.length : 0,
    byClass: by(r => r.cls), byType: by(r => r.type),
    byTech: by(r => r.techs.map(t => r.module + ':' + t)),
    wrong: R.filter(r => r.outcome === 'wrong'), timeouts: R.filter(r => r.outcome === 'timeout'),
    slow: R.filter(r => r.timeSec > 50), verySlow: R.filter(r => r.timeSec > 75),
    acc: R.length ? R.filter(r => r.outcome === 'correct').length / R.length : 0
  };
}
function selectAdaptiveQuestion(mid) {
  const A = S.adaptive[mid] = S.adaptive[mid] || { ladder: 'Easy', lastIds: [], done: 0 };
  const recent = S.results.filter(r => r.module === mid).slice(-6);
  let reason = '';
  if (recent.length >= 4) {
    const acc = recent.filter(r => r.outcome === 'correct').length / recent.length;
    const avgT = recent.reduce((a, r) => a + r.timeSec, 0) / recent.length;
    if (acc >= 0.8 && avgT <= 35 && A.ladder !== 'Master') {
      A.ladder = CLASSES[CLASSES.indexOf(A.ladder) + 1];
      reason = 'Promoted to ' + A.ladder + ' after ' + recent.filter(r => r.outcome === 'correct').length + '/' + recent.length + ' correct at good speed.';
    } else if (acc < 0.4 && A.ladder !== 'Easy') {
      A.ladder = CLASSES[CLASSES.indexOf(A.ladder) - 1];
      reason = 'Stepped down to ' + A.ladder + ' to rebuild accuracy.';
    }
  }
  const pool = bankQ(mid, A.ladder).filter(q => A.lastIds.indexOf(q.id) < 0);
  const fresh = pool.filter(q => !S.results.some(r => r.qid === q.id && r.outcome === 'correct'));
  const pick = C.shuffle((fresh.length ? fresh : pool).slice(), Math.random);
  const q = pick[0] || MODS[mid].generate({ cls: A.ladder, exclude: A.lastIds });
  A.lastIds.push(q.id); A.lastIds = A.lastIds.slice(-2);
  A.done++;
  Save.mark();
  return { q, reason, ladder: A.ladder };
}
function generateRecommendations(mid) {
  const st = computeStats(mid), out = [];
  const names = TECH_NAME[mid || 'latin'];
  if (st.n < 4) return ['Answer a few more questions and the recommendations will use your saved performance.'];
  const techs = Object.entries(st.byTech).filter(([, m]) => m.n >= 4).map(([t, m]) => ({ t, acc: m.ok / m.n, n: m.n }));
  techs.sort((a, b) => a.acc - b.acc);
  if (techs.length && techs[0].acc < 0.7) {
    const [mod, tn] = techs[0].t.split(':');
    out.push('Improve your ' + (TECH_NAME[mod] || {})[tn] + ' technique (' + mod + ' T' + tn + ') — accuracy ' + Math.round(techs[0].acc * 100) + '% over ' + techs[0].n + ' attempts. See Study Notes.');
  }
  const easy = st.byClass.Easy;
  if (easy && easy.n >= 4 && easy.ok / easy.n >= 0.9 && easy.time / easy.n < 25) out.push('You are solving Easy questions quickly. Try Medium.');
  const recent = (mid ? S.results.filter(r => r.module === mid) : S.results).slice(-6);
  if (recent.length === 6 && recent.filter(r => r.outcome === 'correct').length <= 3) out.push('Your recent accuracy dropped — slow down on route choice or practise a lower class for a few questions.');
  if (st.timeouts.length / st.n > 0.2) out.push('More than 1 in 5 questions timed out — practise picking the fastest route first and skip jammed questions.');
  const hard = st.byClass.Hard;
  if (hard && hard.n >= 6) {
    const half = S.results.filter(r => (!mid || r.module === mid) && r.cls === 'Hard');
    const a1 = half.slice(0, Math.floor(half.length / 2)), a2 = half.slice(Math.floor(half.length / 2));
    if (a1.length && a2.length && (a2.filter(r => r.outcome === 'correct').length / a2.length) - (a1.filter(r => r.outcome === 'correct').length / a1.length) >= 0.15)
      out.push('Your accuracy in Hard questions has improved — keep going.');
  }
  const extreme = st.byClass.Extreme;
  if (extreme && extreme.n >= 6 && extreme.ok / extreme.n >= 0.75) out.push('Your Extreme performance is strong — Master questions (or the Advanced exam) are now appropriate.');
  const types = Object.entries(st.byType).filter(([, m]) => m.n >= 4).map(([t, m]) => ({ t, acc: m.ok / m.n }));
  types.sort((a, b) => a.acc - b.acc);
  if (types.length && types[0].acc < 0.6) out.push('Weakest question type: ' + (TYPE_LABEL[types[0].t] || types[0].t) + ' (' + Math.round(types[0].acc * 100) + '%). Use the retry lists in Performance.');
  if (!out.length) out.push('Performance looks balanced — keep practising harder classes to find your ceiling.');
  return out;
}
function renderAdaptiveMenu() {
  const v = $('#view-adaptive');
  v.innerHTML = '';
  const mid = S.activeModule;
  const c = el('div', 'card');
  c.innerHTML = '<h2>Adaptive Practice — ' + esc(MODS[mid].name) + '</h2><p class="muted small">The engine watches your saved accuracy and speed, promotes you through the five classes (Master only after Extreme is under control), avoids repeating mastered questions, and prioritises previously wrong or unseen items. 50-second timer, explanations after every question.</p>';
  moduleBar(c, mid);
  const rec = el('div');
  rec.innerHTML = '<h3>Recommendations</h3>';
  generateRecommendations(mid).forEach(r => rec.appendChild(el('div', 'techcard', '• ' + esc(r))));
  c.appendChild(rec);
  const A = S.adaptive[mid] || { ladder: 'Easy', done: 0 };
  const row = el('div', 'row');
  const b = el('button', 'act', (A.done ? 'Continue' : 'Start') + ' (current level: ' + A.ladder + ')');
  b.onclick = showAdaptiveQuestion;
  row.appendChild(b);
  c.appendChild(row);
  v.appendChild(c);
}
function showAdaptiveQuestion() {
  const v = $('#view-adaptive');
  v.innerHTML = '';
  const mid = S.activeModule;
  const sel = selectAdaptiveQuestion(mid);
  const q = sel.q;
  const c = el('div', 'card');
  c.appendChild(el('div', '', '<b>Adaptive</b> <span class="pill class-' + q.cls + '">' + q.cls + '</span> <span class="pill">' + (TYPE_LABEL[q.type] || q.type) + '</span> <span class="muted small">' + esc(sel.reason) + '</span>'));
  const qv = el('div'); c.appendChild(qv);
  v.appendChild(c);
  const t0 = Date.now();
  let fin = false;
  MODS[q.module].render(qv, q, {
    counter: q.id, timer: true,
    onAnswer: a => {
      if (fin) return; fin = true; stopAllTimers();
      const ok = MODS[q.module].checkAnswer(q, a);
      const timeSec = Math.min(50, Math.round((Date.now() - t0) / 1000));
      recordResult(q, ok ? 'correct' : 'wrong', timeSec, a);
      adaptiveAfter(q, { outcome: ok ? 'correct' : 'wrong', timeSec, user: a });
    },
    onTimeout: () => {
      if (fin) return; fin = true;
      recordResult(q, 'timeout', 50, null);
      adaptiveAfter(q, { outcome: 'timeout', timeSec: 50, user: null });
    }
  });
}
function adaptiveAfter(q, result) {
  const c = $('#view-adaptive .card');
  const ex = el('div');
  MODS[q.module].explain(ex, q, result);
  c.appendChild(ex);
  const row = el('div', 'row'); row.style.marginTop = '12px';
  const bn = el('button', 'act', 'Next adaptive question (Enter)');
  bn.onclick = showAdaptiveQuestion;
  const bm = el('button', 'ghost', 'Back to menu');
  bm.onclick = renderAdaptiveMenu;
  row.append(bn, bm);
  c.appendChild(row);
  c._nextBtn = bn;
}

/* ============================== PERFORMANCE ================================ */
function renderAnalytics() {
  const v = $('#view-analytics');
  v.innerHTML = '';
  const scope = S._analyticsScope || 'all';
  const bar = el('div', 'modulebar');
  const mkBtn = (id, label) => {
    const b = el('button', scope === id ? 'active' : '', label);
    b.onclick = () => { S._analyticsScope = id; renderAnalytics(); };
    bar.appendChild(b);
  };
  mkBtn('all', 'All modules');
  MOD_IDS.forEach(mid => mkBtn(mid, MODS[mid].name));
  v.appendChild(bar);
  const st = computeStats(scope === 'all' ? null : scope);
  const c = el('div', 'card');
  c.innerHTML = '<h2>Performance Analytics</h2>';
  if (!st.n) { c.appendChild(el('p', 'muted', 'No results in this scope yet — answer questions first.')); v.appendChild(c); return; }
  c.appendChild(el('p', '', 'Attempted <b>' + st.n + '</b> · correct <b>' + st.ok + '</b> · accuracy <b>' + Math.round(st.acc * 100) + '%</b> · average time <b>' + Math.round(st.avgTime) + 's</b>'));
  const mkTable = (title, entries, labelFn) => {
    if (!entries.length) return;
    const h = el('h3', '', title);
    const t = el('table', 'stat');
    t.innerHTML = '<tr><th>Group</th><th>Attempted</th><th>Correct</th><th>Accuracy</th><th>Avg time</th></tr>';
    entries.forEach(([k, m]) => {
      t.innerHTML += '<tr><td>' + labelFn(k) + '</td><td class="num">' + m.n + '</td><td class="num">' + m.ok + '</td><td class="num">' + Math.round(100 * m.ok / m.n) + '%</td><td class="num">' + Math.round(m.time / m.n) + 's</td></tr>';
    });
    c.append(h, t);
  };
  mkTable('By class', Object.entries(st.byClass).sort((a, b) => CLASSES.indexOf(a[0]) - CLASSES.indexOf(b[0])), k => k);
  mkTable('By question type', Object.entries(st.byType), k => TYPE_LABEL[k] || k);
  mkTable('By technique', Object.entries(st.byTech), k => { const [mod, tn] = k.split(':'); return MODS[mod].name + ' — ' + ((TECH_NAME[mod] || {})[tn] || 'T' + tn); });
  const techs = Object.entries(st.byTech).filter(([, m]) => m.n >= 3).sort((a, b) => (a[1].ok / a[1].n) - (b[1].ok / b[1].n)).slice(0, 3);
  if (techs.length) {
    c.appendChild(el('p', '', '<b>Weakest techniques:</b> ' + techs.map(([t, m]) => { const [mod, tn] = t.split(':'); return ((TECH_NAME[mod] || {})[tn] || 'T' + tn) + ' (' + Math.round(100 * m.ok / m.n) + '%)'; }).join(', ')));
    const bwt = el('button', 'ghost', 'Retry weakest technique');
    bwt.onclick = () => retryTechnique(techs[0][0]);
    c.appendChild(bwt);
  }
  const lists = [['Incorrect (' + st.wrong.length + ')', st.wrong], ['Timed out (' + st.timeouts.length + ')', st.timeouts], ['Over 50s (' + st.slow.length + ')', st.slow], ['Over 75s (' + st.verySlow.length + ')', st.verySlow]];
  lists.forEach(([title, list]) => {
    if (!list.length) return;
    c.appendChild(el('h3', '', title));
    const b = el('button', 'ghost', 'Retry these');
    b.onclick = () => {
      const qs = list.map(r => Q_BY_ID[r.qid]).filter(Boolean).reverse();
      S.retryQueue = { list: qs, total: qs.length, pos: 0 };
      S.activeModule = qs[0].module;
      showView('class'); showPracticeQuestion();
    };
    c.appendChild(b);
    const t = el('table', 'stat');
    t.innerHTML = '<tr><th>Question</th><th>Module</th><th>Class</th><th>Type</th><th>Outcome</th><th>Time</th></tr>';
    list.slice(-10).reverse().forEach(r => {
      t.innerHTML += '<tr><td>' + esc(r.qid) + '</td><td>' + MODS[r.module].name + '</td><td>' + r.cls + '</td><td>' + (TYPE_LABEL[r.type] || r.type) + '</td><td>' + r.outcome + '</td><td class="num">' + r.timeSec + 's</td></tr>';
    });
    c.appendChild(t);
  });
  if (st.n >= 8) {
    const half = Math.floor(st.n / 2);
    const a1 = (scope === 'all' ? S.results : S.results.filter(r => r.module === scope)).slice(0, half);
    const a2 = (scope === 'all' ? S.results : S.results.filter(r => r.module === scope)).slice(half);
    const p1 = a1.filter(r => r.outcome === 'correct').length / a1.length;
    const p2 = a2.filter(r => r.outcome === 'correct').length / a2.length;
    c.appendChild(el('p', '', '<b>Improvement across the session:</b> ' + Math.round(100 * p1) + '% (first half) → ' + Math.round(100 * p2) + '% (second half)'));
  }
  v.appendChild(c);
}
function retryTechnique(key) {
  const [mod, tn] = key.split(':');
  const list = C.shuffle(BANK[mod].questions.filter(q => (q.techs || []).indexOf(+tn) >= 0), Math.random).slice(0, 10);
  if (!list.length) { toast('No questions use that technique.'); return; }
  S.retryQueue = { list, total: list.length, pos: 0 };
  S.activeModule = mod;
  showView('class'); showPracticeQuestion();
}

/* ------------------------------ modal + toast ------------------------------ */
function modal(title, body, buttons) {
  const back = el('div', 'modalback');
  const m = el('div', 'modal');
  m.appendChild(el('h3', '', esc(title)));
  if (typeof body === 'string') m.appendChild(el('div', '', body)); else m.appendChild(body);
  const row = el('div', 'mrow');
  buttons.forEach(([label, cls, fn]) => { const b = el('button', cls, label); b.onclick = () => { back.remove(); fn && fn(); }; row.appendChild(b); });
  m.appendChild(row); back.appendChild(m); $('#modal-root').appendChild(back);
}
function toast(msg) { const t = el('div', 'toast', esc(msg)); document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

/* ------------------------------ keyboard ----------------------------------- */
document.addEventListener('keydown', ev => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const tag = (ev.target && ev.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const k = ev.key.toUpperCase();
  const letterBtns = document.querySelectorAll('.answers button:not(.opt)');
  const optBtns = document.querySelectorAll('.answers button.opt');
  const answeredHere = document.querySelector('.answers button.picked');
  if (['A', 'B', 'C', 'D', 'E'].indexOf(k) >= 0) {
    const idx = 'ABCDE'.indexOf(k);
    const set = optBtns.length ? optBtns : letterBtns;
    const btn = set[idx];
    if (btn && !btn.disabled && !answeredHere) { btn.click(); ev.preventDefault(); }
  } else if (ev.key === 'Enter') {
    const btns = Array.from(document.querySelectorAll('button.act')).filter(b => /Next|Review every/.test(b.textContent));
    if (btns.length) { btns[btns.length - 1].click(); ev.preventDefault(); }
  } else if (k === 'M' && S.exam && !S.exam.submitted && currentView === 'exam') {
    examMark(); ev.preventDefault();
  }
});

/* ------------------------------ demo helpers -------------------------------- */
function seedDemoResults() {
  ['latin', 'math', 'figures'].forEach(mid => {
    ['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Extreme'].forEach((cls, i) => {
      const q = bankQ(mid, cls)[(i * 7) % 50];
      recordResult(q, i % 4 === 3 ? 'wrong' : 'correct', 18 + (i * 11) % 40, MODS[mid].answerValue ? MODS[mid].answerValue(q) : q.answer);
    });
  });
}
function demoExplain(mid) {
  S.activeModule = mid;
  const cls = mid === 'latin' ? 'Hard' : 'Hard';
  const qq = bankQ(mid, cls)[0];
  const wrongL = qq.answer === 'A' ? 'B' : qq.answer === 5 ? 4 : 'B';
  recordResult(qq, 'wrong', 31, wrongL);
  showView('class');
  const wrap = el('div', 'card');
  $('#view-class').innerHTML = '';
  $('#view-class').appendChild(wrap);
  MODS[mid].render(wrap, qq, { reveal: true, userLetter: wrongL, counter: qq.id });
  const ex = el('div');
  MODS[mid].explain(ex, qq, { outcome: 'wrong', timeSec: 31, user: wrongL });
  wrap.appendChild(ex);
}

/* --------------------------- bank report on load --------------------------- */
(function bankReport() {
  const m = BANK.meta;
  console.log('%c=== dMAT Core Module — bank report (v' + m.version + ') ===', 'font-weight:bold');
  console.log('Seed ' + m.seed + ' · built ' + m.builtAt);
  console.log('Counts:', JSON.stringify(m.counts), 'totals:', JSON.stringify(m.totals));
  console.log('All questions re-validated at build time and re-checked at load (see below).');
  setTimeout(() => {
    let bad = [];
    MOD_IDS.forEach(mid => BANK[mid].questions.forEach(q => { const e = MODS[mid].validate(q); if (e.length) bad.push(q.id + ': ' + e.join(';')); }));
    console.log(bad.length === 0 ? 'Load-time re-validation: all ' + (MOD_IDS.reduce((s, m2) => s + BANK[m2].questions.length, 0)) + ' questions re-verified.' : 'RE-VALIDATION FAILED: ' + bad.slice(0, 5).join(' | '));
    // regression check against the embedded v1 hash (Latin Squares Easy..Extreme)
    if (m.latinV1Hash && crypto && crypto.subtle) {
      const payload = JSON.stringify(bankQ('latin', 'Easy').concat(bankQ('latin', 'Medium'), bankQ('latin', 'Hard'), bankQ('latin', 'Extreme')).map(q => [q.id, q.grid, q.target, q.answer, q.steps]));
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)).then(buf => {
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
        console.log(hex === m.latinV1Hash ? 'Regression check: the original 200 Latin Squares questions are byte-identical to v1 (' + hex + ').' : 'REGRESSION ALERT: original questions changed (' + hex + ' vs ' + m.latinV1Hash + ')!');
      });
    }
  }, 60);
})();

/* ------------------------------ selftest hook -------------------------------
   Open with ?selftest=1 — automated checks, results written into the DOM.     */
async function selftest() {
  const out = [];
  try {
  const t = (name, ok, info) => out.push((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : ''));
  // banks
  const counts = {};
  MOD_IDS.forEach(mid => CLASSES.forEach(cls => counts[mid + ':' + cls] = bankQ(mid, cls).length));
  t('bank 5x50 per module', MOD_IDS.every(mid => CLASSES.every(cls => bankQ(mid, cls).length === 50)), JSON.stringify(counts).slice(0, 80));
  // v1 regression (crypto.subtle)
  try {
    if (BANK.meta.latinV1Hash) {
      const payload = JSON.stringify(bankQ('latin', 'Easy').concat(bankQ('latin', 'Medium'), bankQ('latin', 'Hard'), bankQ('latin', 'Extreme')).map(q => [q.id, q.grid, q.target, q.answer, q.steps]));
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
      t('original 200 questions unchanged (hash)', hex === BANK.meta.latinV1Hash, hex + ' vs ' + BANK.meta.latinV1Hash);
    }
  } catch (e) { t('v1 regression hash', false, e.message); }
  // storage roundtrip (SKIP when the environment cannot open IndexedDB)
  try {
    if (Store.ok) {
      await Store.put('kv', { ping: Date.now() }, '_selftest');
      const back = await Store.get('kv', '_selftest');
      t('IndexedDB roundtrip', back && !!back.ping);
      await Store.del('kv', '_selftest');
    } else out.push('SKIP IndexedDB roundtrip (storage unavailable in this environment)');
  } catch (e) { t('IndexedDB roundtrip', false, e.message); }
  // white theme
  t('white theme (no dark override)', getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)' && !window.matchMedia('(prefers-color-scheme: dark)').matches ? true : getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)', getComputedStyle(document.body).backgroundColor);
  // per-module validation
  let lsBad = 0; bankQ('latin', 'Master').concat(bankQ('latin', 'Extreme')).forEach(q => { if (MODS.latin.validate(q).length) lsBad++; });
  t('latin Extreme+Master validate', lsBad === 0, lsBad + ' bad');
  let mathBad = 0; BANK.math.questions.forEach(q => { if (MODS.math.validate(q).length) mathBad++; });
  t('math all validate (rank+trace+answer)', mathBad === 0, mathBad + ' bad');
  let figBad = 0; BANK.figures.questions.forEach(q => { if (F.validateQuestion(q).length) figBad++; });
  t('figures all validate', figBad === 0, figBad + ' bad');
  // Master harder than Extreme (Latin)
  const avgS = cls => bankQ('latin', cls).reduce((a, q) => a + q.stepsCount, 0) / 50;
  const avgP = cls => bankQ('latin', cls).reduce((a, q) => a + q.phantoms, 0) / 50;
  t('Master harder than Extreme (steps+phantoms)', avgS('Master') > avgS('Extreme') || avgP('Master') > avgP('Extreme'), 'steps ' + avgS('Extreme').toFixed(1) + '→' + avgS('Master').toFixed(1) + ', phantoms ' + avgP('Extreme').toFixed(1) + '→' + avgP('Master').toFixed(1));
  // answer checking per module
  const lq = bankQ('latin', 'Easy')[0];
  t('latin checkAnswer', MODS.latin.checkAnswer(lq, lq.answer) && !MODS.latin.checkAnswer(lq, lq.answer === 'A' ? 'B' : 'A'));
  const mq = bankQ('math', 'Easy')[0];
  t('math checkAnswer', MODS.math.checkAnswer(mq, String(mq.answer)) && !MODS.math.checkAnswer(mq, mq.answer === 7 ? 8 : 7));
  const fq = bankQ('figures', 'Easy')[0];
  t('figures checkAnswer', MODS.figures.checkAnswer(fq, fq.answer) && !MODS.figures.checkAnswer(fq, fq.answer === 'A' ? 'B' : 'A'));
  // UI flows
  try {
    startPractice('latin', 'Easy', 'seq');
    showPracticeQuestion();
    const q1 = bankQ('latin', 'Easy')[S.practice['latin:Easy'].order[0]];
    document.querySelectorAll('#view-class .answers button')['ABCDE'.indexOf(q1.answer)].click();
    t('latin practice UI flow', !!document.querySelector('#view-class .expl'));
    stopAllTimers();
  } catch (e) { t('latin practice UI flow', false, e.message); }
  try {
    startPractice('math', 'Easy', 'seq');
    showPracticeQuestion();
    const q2 = bankQ('math', 'Easy')[S.practice['math:Easy'].order[0]];
    const inp = $('#ansInput');
    inp.value = q2.answer;
    document.querySelector('#view-class .answers .act').click();
    t('math practice UI flow (numeric input)', !!document.querySelector('#view-class .expl'));
    stopAllTimers();
  } catch (e) { t('math practice UI flow', false, e.message); }
  try {
    startPractice('figures', 'Easy', 'seq');
    showPracticeQuestion();
    const q3 = bankQ('figures', 'Easy')[S.practice['figures:Easy'].order[0]];
    document.querySelectorAll('#view-class .answers button.opt')['ABCDE'.indexOf(q3.answer)].click();
    t('figures practice UI flow (SVG options)', !!document.querySelector('#view-class .expl'));
    stopAllTimers();
  } catch (e) { t('figures practice UI flow', false, e.message); }
  // exams
  S.activeModule = 'latin';
  buildExam('standard');
  let e1 = S.exam;
  t('standard exam mix 6/6/5/3', e1.qs.length === 20 && ['Easy', 'Medium', 'Hard', 'Extreme'].every(c => e1.qs.filter(q => q.cls === c).length === { Easy: 6, Medium: 6, Hard: 5, Extreme: 3 }[c]));
  e1.qs.forEach((q, i) => e1.answers[i] = i < 14 ? MODS[q.module].answerValue(q) : null);
  e1.left = 0; finishExam(false);
  t('standard exam scoring', calculateScore(S.exam) === 14, String(calculateScore(S.exam)));
  S.exam = null;
  buildExam('advanced');
  t('advanced exam = 20 Master', S.exam.qs.length === 20 && S.exam.qs.every(q => q.cls === 'Master'));
  S.exam = null;
  // adaptive per module
  const sel = selectAdaptiveQuestion('math');
  t('adaptive selection (math)', sel && sel.q && sel.q.module === 'math', sel.ladder);
  t('recommendations', generateRecommendations('latin').length > 0);
  // profiles (v3)
  try {
    const prevProfile = S.profile;
    await createAndSwitch('TestAlfa');
    recordResult(bankQ('latin', 'Easy')[3], 'correct', 10, 'A');
    const alfaCount = S.results.length;
    const alfaStamp = S.results[S.results.length - 1].profile;
    await createAndSwitch('TestBeta');
    recordResult(bankQ('math', 'Easy')[3], 'wrong', 22, '3');
    t('profiles isolate per-person results', S.results.every(r => r.profile === 'TestBeta') && alfaStamp === 'TestAlfa', 'alfa=' + alfaCount + ' stamped ' + alfaStamp);
    await switchProfile('TestAlfa');
    t('profile switch restores results', S.profile === 'TestAlfa' && S.results.length === alfaCount, String(S.results.length));
    showView('group');
    await new Promise(res => setTimeout(res, 300));
    const gtxt = document.getElementById('view-group').textContent;
    t('group dashboard renders', gtxt.indexOf('Group Dashboard') >= 0);
    await Profiles.remove('TestAlfa');
    await Profiles.remove('TestBeta');
    if (prevProfile) { S.profile = Profiles.active = prevProfile; await loadProfileState(); } else { S.profile = null; }
    renderProfileChip();
  } catch (e) { t('profiles', false, e.message); }
  // cloud sync (runs only when ?cloud= provides a test/mock project)
  try {
    if (Cloud.cfg && new URLSearchParams(location.search).get('cloudtest') === '1') {
      if (!S.profile) await createAndSwitch('CloudTester');
      const prevSession = Cloud.session;
      await Cloud.signIn('host@mock.local', 'test1234').catch(() => Cloud.signUp('host@mock.local', 'test1234'));
      const profUsed = S.profile || 'CloudTester';
      if (!S.profile) await createAndSwitch('CloudTester');
      recordResult(bankQ('latin', 'Easy')[5], 'correct', 9, 'A');
      await Cloud.flush(S.profile, uid => S.results.find(x => x.uid === uid), activeCloudStats());
      const mine = await Cloud.pullMine();
      t('cloud push+pull own results', mine.length >= 1, String(mine.length));
      const g1 = await Cloud.pullGroup();
      t('cloud group pull', g1.results.length >= 1 && Object.keys(g1.profiles).length >= 1);
      // friend simulation: a second account pushes its own rows
      await Cloud.signUp('friend@mock.local', 'test1234').catch(() => Cloud.signIn('friend@mock.local', 'test1234'));
      recordResult(bankQ('figures', 'Easy')[5], 'correct', 11, 'C');
      await Cloud.flush(S.profile, uid => S.results.find(x => x.uid === uid), activeCloudStats());
      const g2 = await Cloud.pullGroup();
      t('cloud multi-user rows visible to the group', g2.results.length > g1.results.length, g1.results.length + '->' + g2.results.length);
      // group view now shows the pushed rows live from the cloud
      showView('group');
      await new Promise(res => setTimeout(res, 600));
      const gprof = S.profile || 'host';
      await new Promise(res => setTimeout(res, 400));
      const gtxt2 = document.getElementById('view-group').textContent;
      t('group dashboard live from cloud', gtxt2.indexOf(gprof) >= 0, 'profile=' + gprof + ' rows=' + (window.__groupDebug && window.__groupDebug.rows));
      Cloud.session = prevSession; Cloud.persistSession();
    } else out.push('SKIP cloud sync (no ?cloud= test project in this run)');
  } catch (e) { t('cloud sync', false, e.message); }
  // study notes / learning centre (v6)
  try {
    StudyNotes.compile();
    const snCounts = MOD_IDS.map(m => StudyNotes.topicCount(m));
    t('study topics compiled (>=20 per module)', snCounts.every(c => c >= 20), snCounts.join(','));
    StudyNotes.updateProgress('latin:tech:1', 'learned');
    t('topic progress update', StudyNotes.statusOf('latin:tech:1') === 'learned');
    StudyNotes.updateProgress('latin:tech:1', 'not-started');
    const sr = StudyNotes.searchNotes('x-wing');
    t('search finds the X-wing topic', sr.some(x => x.id === 'latin:tech:15'), String(sr.length));
    const bm = StudyNotes.bookmarkTopic('latin:fund:what');
    t('bookmark toggle', bm === true && S.learning.bookmarks.indexOf('latin:fund:what') >= 0);
    StudyNotes.bookmarkTopic('latin:fund:what');
    for (let i = 0; i < 3; i++) S.results.push({ uid: 'wk' + i, profile: S.profile, module: 'latin', qid: 'EASY-001', cls: 'Easy', type: 'a', techs: [1], outcome: 'wrong', timeSec: 10, user: 'Z', at: Date.now() });
    const w = StudyNotes.getWeakTopics();
    t('weak topics detected with sufficient evidence', w.weak.some(e => e.topicId === 'latin:tech:1'), JSON.stringify(w.weak.slice(0, 2)));
    StudyNotes.go({ page: 'rev', module: 'latin', dur: 5 });
    t('quick revision renders', document.getElementById('view-notes').textContent.indexOf('Revision') >= 0);
    stopAllTimers();
    StudyNotes.go({ page: 'dashboard' });
  } catch (e) { t('study notes', false, e.message); }
  // export payload shape
  t('export payload shape', (() => { return Array.isArray(S.results) && S.results.length > 0 && !!S.stateSnapshot(); })());
  } catch (err) {
    out.push('FAIL selftest crashed — ' + (err && err.message || err));
    console.warn(err && err.stack || err);
  }
  const mh = document.querySelector('main'); if (mh) mh.prepend(el('div', 'card', '<h2>SELFTEST ' + (out.every(x => x.startsWith('PASS') || x.startsWith('SKIP')) ? 'PASSED' : 'FAILED') + ' (' + out.filter(x => x.startsWith('PASS')).length + '/' + out.length + ')</h2><pre style="white-space:pre-wrap">' + esc(out.join('\n')) + '</pre>'));
  console.log(out.join('\n'));
}
/* answerValue helper used by exam scoring: normalises a question to its stored answer */
MOD_IDS.forEach(mid => { MODS[mid].answerValue = q => q.answer; });

(function () {
  // automated-test helper: hold the page's load event open with a slow
  // subresource so the async selftest finishes before a headless --dump-dom
  const p = new URLSearchParams(location.search);
  if (p.get('selftest') && p.get('holdload') && p.get('cloud')) {
    const img = document.createElement('img');
    img.style.display = 'none';
    img.src = p.get('cloud') + '/slow.png';
    document.body.appendChild(img);
  }
})();
boot();
