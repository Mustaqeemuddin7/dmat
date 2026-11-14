/* patch3.js — one-shot v3 surgery: profiles + group dashboard.
   Run: node dev/patch3.js   (verifies every anchor; exits 1 if any missing) */
'use strict';
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
function rep(from, to, label) {
  const i = s.indexOf(from);
  if (i < 0) { console.error('ANCHOR NOT FOUND: ' + label); process.exit(1); }
  s = s.slice(0, i) + to + s.slice(i + from.length);
}

// A4: Save.flush -> per-profile keys
rep("      await Store.put('kv', S.stateSnapshot(), 'state');\n      await Store.put('kv', { at: Date.now() }, 'lastSaved');",
    "      await Store.put('kv', S.stateSnapshot(), kState());\n      await Store.put('kv', { at: Date.now() }, 'lastSaved:' + S.profile);", 'A4');

// A5: Profiles manager after setStatus
rep("function setStatus(text, cls) { const n = $('#saveStatus'); if (n) { n.textContent = text; n.className = cls; } }",
`function setStatus(text, cls) { const n = $('#saveStatus'); if (n) { n.textContent = text; n.className = cls; } }

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
const MemStash = { state: {}, results: {} };`, 'A5');

// A6: S.profile field
rep("const S = {\n  results: [],",
    "const S = {\n  profile: null,          // active profile name (v3 multi-user)\n  results: [],", 'A6');

// A7: stateSnapshot includes profile
rep("    schema: Store.VERSION,\n    practice: this.practice,",
    "    schema: Store.VERSION,\n    profile: this.profile,\n    practice: this.practice,", 'A7');

// A8: recordResult stamps profile + touches Profiles
rep("    uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),\n    module: q.module,",
    "    uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),\n    profile: S.profile,\n    module: q.module,", 'A8a');
rep("  if (Store.ok) { const r = S.results[S.results.length - 1]; Store.put('results', r).catch(() => setStatus('Save failed', 'failed')); }\n  Save.mark();",
    "  if (Store.ok) { const r = S.results[S.results.length - 1]; Store.put('results', r).catch(() => setStatus('Save failed', 'failed')); }\n  Profiles.touch();\n  Save.mark();", 'A8b');

// A9: boot profile-aware loading
rep(`  const ok = await Store.open();
  if (ok) {
    const st = await Store.get('kv', 'state');
    const migrated = st && st.schema && st.schema < Store.VERSION;
    if (st) {
      S.practice = st.practice || {};
      S.activeModule = MOD_IDS.indexOf(st.activeModule) >= 0 ? st.activeModule : 'latin';
      S.adaptive = st.adaptive || {};
      S.learning = st.learning || { studied: {} };
      S.prefs = st.prefs || {};
      if (st.exam) S.exam = deserializeExam(st.exam);
    }
    S.results = await Store.all('results');
    const last = await Store.get('kv', 'lastSaved');
    setStatus(last && last.at ? 'Saved ' + new Date(last.at).toLocaleTimeString() : 'Storage ready — nothing saved yet', '');
    if (migrated) toast('Database upgraded to schema v' + Store.VERSION + ' — your progress was preserved. A backup can be downloaded in Settings.');
  } else {
    setStatus('Save failed — storage unavailable', 'failed');
  }`,
`  const ok = await Store.open();
  await Profiles.load();
  if (Profiles.active) {
    S.profile = Profiles.active;
    await loadProfileState();
  } else if (ok) {
    setStatus('Storage ready — create a profile to start', '');
  } else {
    setStatus('Save failed — storage unavailable', 'failed');
  }`, 'A9');

// A9b: render chip in boot
rep("  if (p.get('selftest')) selftest();",
    "  renderProfileChip();\n  if (p.get('selftest')) selftest();", 'A9b');

// A10: profile runtime helpers after deserializeExam
rep(`  return { module: o.module, kind: o.kind || 'standard', qs, answers: o.answers, marks: new Set(o.marks || []), idx: o.idx || 0, left: o.left, qTimes: o.qTimes, totalStart: o.totalStart, submitted: !!o.submitted, resumed: true };
}`,
`  return { module: o.module, kind: o.kind || 'standard', qs, answers: o.answers, marks: new Set(o.marks || []), idx: o.idx || 0, left: o.left, qTimes: o.qTimes, totalStart: o.totalStart, submitted: !!o.submitted, resumed: true };
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
  if (st) restoreState(st); else { S.practice = {}; S.exam = null; S.adaptive = {}; S.learning = { studied: {} }; S.prefs = {}; }
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
  S.learning = st.learning || { studied: {} };
  S.prefs = st.prefs || {};
  if (st.exam) S.exam = deserializeExam(st.exam);
}
async function switchProfile(name) {
  if (!Profiles.map[name] || S.profile === name) return;
  if (!Store.ok && S.profile) { MemStash.state[S.profile] = S.stateSnapshot(); MemStash.results[S.profile] = S.results; }
  stopAllTimers();
  S.profile = name;
  S.results = [];
  S.practice = {}; S.exam = null; S.adaptive = {}; S.learning = { studied: {} }; S.prefs = {};
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
  S.practice = {}; S.exam = null; S.adaptive = {}; S.learning = { studied: {} }; S.prefs = {};
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
}`, 'A10');

// A11: VIEWS gains Group
rep("const VIEWS = [['dashboard', 'Dashboard'], ['notes', 'Study Notes'],",
    "const VIEWS = [['dashboard', 'Dashboard'], ['group', 'Group'], ['notes', 'Study Notes'],", 'A11');

// A12: showView map gains group
rep("({ dashboard: renderDashboard, notes: renderNotes, class: renderClassMenu, exam: renderExamIntro, adaptive: renderAdaptiveMenu, analytics: renderAnalytics, settings: renderSettings })[name]();",
    "({ dashboard: renderDashboard, group: renderGroup, notes: renderNotes, class: renderClassMenu, exam: renderExamIntro, adaptive: renderAdaptiveMenu, analytics: renderAnalytics, settings: renderSettings })[name]();", 'A12');

// A13: dashboard onboarding gate
rep("function renderDashboard() {\n  const v = $('#view-dashboard');\n  v.innerHTML = '';\n  const attempted = S.results.length, correct = S.results.filter(r => r.outcome === 'correct').length;\n  // interrupted exam card\n  if (S.exam && !S.exam.submitted) {",
    "function renderDashboard() {\n  const v = $('#view-dashboard');\n  v.innerHTML = '';\n  if (!S.profile) { renderOnboarding(v); return; }\n  const attempted = S.results.length, correct = S.results.filter(r => r.outcome === 'correct').length;\n  // interrupted exam card\n  if (S.exam && !S.exam.submitted) {", 'A13');

// A14: renderGroup before SETTINGS section
rep("/* ================================ SETTINGS ================================= */",
`/* ============================== GROUP DASHBOARD =============================
   Compares every profile stored in this browser. For friends practising on
   other devices, exchange JSON export files and import them as profiles. */
function renderGroup() {
  const v = $('#view-group');
  v.innerHTML = '';
  const intro = el('div', 'card');
  intro.innerHTML = '<h2>Group Dashboard</h2><p class="muted small">Compares every profile saved in THIS browser on THIS device. If your friends practise on other devices: they click <b>Export all progress as JSON</b> (Settings) and send you the file; you import it here and it appears below as a comparable profile. Nothing is uploaded anywhere.</p>';
  v.appendChild(intro);
  const wrap = el('div', 'card');
  wrap.innerHTML = '<p class="muted">Loading group data…</p>';
  v.appendChild(wrap);
  (async () => {
    let allR = [];
    if (Store.ok) allR = await Store.all('results');
    else allR = S.results.slice().concat(Object.keys(MemStash.results).reduce((a, k) => a.concat(MemStash.results[k]), []));
    const names = Array.from(new Set([].concat(Profiles.names(), allR.map(r => r.profile).filter(Boolean))));
    const rows = names.map(nm => {
      const R = allR.filter(r => r.profile === nm);
      const perCls = {}, perMod = {};
      CLASSES.forEach(cl => { const rr = R.filter(r => r.cls === cl); perCls[cl] = { n: rr.length, ok: rr.filter(r => r.outcome === 'correct').length }; });
      MOD_IDS.forEach(md => { perMod[md] = R.filter(r => r.module === md).length; });
      const ok = R.filter(r => r.outcome === 'correct').length;
      return { name: nm, n: R.length, ok, acc: R.length ? ok / R.length : 0,
               avg: R.length ? R.reduce((a, r) => a + r.timeSec, 0) / R.length : 0,
               last: R.length ? Math.max.apply(null, R.map(r => r.at || 0)) : (Profiles.map[nm] && Profiles.map[nm].lastActivity) || 0,
               perCls, perMod, me: nm === S.profile };
    }).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
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
    if (!Store.ok) wrap.appendChild(el('p', 'small muted', 'Storage is unavailable in this session — only this session\\'s profiles can be shown.'));
  })();
}

/* ================================ SETTINGS ================================= */`, 'A14');

// A15: Settings profile management section
rep("  c.innerHTML = '<h2>Settings &amp; Data Management</h2>';",
`  c.innerHTML = '<h2>Settings &amp; Data Management</h2>';
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
    S.practice = {}; S.exam = null; S.adaptive = {}; S.learning = { studied: {} };
    renderProfileChip(); showView('dashboard');
  };
  prow.append(rn, bAdd, bRen, bDel);
  pc.appendChild(prow);
  c.appendChild(pc);`, 'A15');

// A16: export includes profile
rep("    exportedAt: new Date().toISOString(),\n    results: S.results, state: S.stateSnapshot(), prefs: S.prefs",
    "    exportedAt: new Date().toISOString(),\n    profile: S.profile,\n    results: S.results, state: S.stateSnapshot(), prefs: S.prefs", 'A16');

// A17: importResults — profile-aware (merge or create profile from file)
rep(`      if (data.state) {
        if (data.state.practice && typeof data.state.practice === 'object') S.practice = Object.assign({}, S.practice, data.state.practice);
        if (data.state.adaptive && typeof data.state.adaptive === 'object') S.adaptive = Object.assign({}, S.adaptive, data.state.adaptive);
        if (data.state.learning && typeof data.state.learning === 'object') S.learning = data.state.learning;
        if (data.state.activeModule && MOD_IDS.indexOf(data.state.activeModule) >= 0) S.activeModule = data.state.activeModule;
        if (data.state.exam && !S.exam) S.exam = deserializeExam(data.state.exam);
      }
      const existing = new Set(S.results.map(r => r.uid));
      let added = 0;
      for (const r of clean) { if (existing.has(r.uid)) continue; existing.add(r.uid); S.results.push(r); if (Store.ok) await Store.put('results', r); added++; }
      Save.mark();
      toast('Imported ' + added + ' results (' + (clean.length - added) + ' duplicates/invalid skipped).');
      renderSettings();`,
`      const fileProfile = String(data.profile || (data.state && data.state.profile) || 'Imported').trim().slice(0, 24) || 'Imported';
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
      }`, 'A17');

// A18: modal accepts a DOM node body
rep("  m.appendChild(el('h3', '', esc(title)));\n  m.appendChild(el('div', '', body));",
    "  m.appendChild(el('h3', '', esc(title)));\n  if (typeof body === 'string') m.appendChild(el('div', '', body)); else m.appendChild(body);", 'A18');

// A19: selftest — profile lifecycle + group render
rep("  // export shape",
`  // profiles (v3)
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
    await new Promise(res => setTimeout(res, 60));
    t('group dashboard renders profiles', document.getElementById('view-group').textContent.indexOf('TestAlfa') >= 0);
    await Profiles.remove('TestAlfa');
    await Profiles.remove('TestBeta');
    if (prevProfile) { S.profile = Profiles.active = prevProfile; await loadProfileState(); } else { S.profile = null; }
    renderProfileChip();
  } catch (e) { t('profiles', false, e.message); }
  // export payload shape`, 'A19');

fs.writeFileSync(__dirname + '/app.js', s);
console.log('app.js v3 patch applied fully');
