/* patch4.js — v4 surgery: optional Supabase cloud sync (vanilla fetch).
   Run: node dev/patch4.js   (verifies every anchor; exits 1 if any missing) */
'use strict';
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
function rep(from, to, label) {
  const i = s.indexOf(from);
  if (i < 0) { console.error('ANCHOR NOT FOUND: ' + label); process.exit(1); }
  s = s.slice(0, i) + to + s.slice(i + from.length);
}

// P1: Cloud const
rep("const C = DMATCore, M = MathEq, F = FigSeq;",
    "const C = DMATCore, M = MathEq, F = FigSeq, Cloud = DMATCloud;", 'P1');

// P2: boot cloud params (test hooks + quick config)
rep("  if (p.get('mod') && MOD_IDS.indexOf(p.get('mod')) >= 0) S.activeModule = p.get('mod');",
`  if (p.get('mod') && MOD_IDS.indexOf(p.get('mod')) >= 0) S.activeModule = p.get('mod');
  if (p.get('cloud')) { // quick cloud config (also used by the automated tests)
    Cloud.cfg = { url: p.get('cloud').trim(), key: (p.get('cloudkey') || 'mock-anon-key').trim() };
    Cloud.persistCfg();
  }`, 'P2');

// P3: boot — resume cloud session and merge own rows before loading local state
rep(`  if (Profiles.active) {
    S.profile = Profiles.active;
    await loadProfileState();
  } else if (ok) {`,
`  if (Profiles.active) {
    S.profile = Profiles.active;
    if (Cloud.cfg && Cloud.session) {
      try { await Cloud.ensureSession(); await cloudPullMine(); }
      catch (e) { console.warn('cloud resume failed', e); }
    }
    await loadProfileState();
  } else if (ok) {`, 'P3');

// P3b: auto-login for cloud test/demo params (after Profiles.load, before renderProfileChip)
rep("  renderProfileChip();\n  if (p.get('selftest')) selftest();",
`  if (Cloud.cfg && p.get('clouduser')) {
    try { await Cloud.signIn(p.get('clouduser'), p.get('cloudpass') || 'test1234'); }
    catch (e1) { try { await Cloud.signUp(p.get('clouduser'), p.get('cloudpass') || 'test1234'); } catch (e2) { console.warn('cloud test login failed', e2.message); } }
    try { await cloudPullMine(); } catch (e3) { }
  }
  if (!S.profile && p.get('clouduser')) { try { await createAndSwitch(p.get('clouduser').split('@')[0]); } catch (e4) { } }
  renderProfileChip();
  if (p.get('selftest')) selftest();`, 'P3b');

// P4: recordResult queues the cloud push
rep("  Profiles.touch();\n  Save.mark();",
    "  Profiles.touch();\n  Cloud.queueUid(S.results[S.results.length - 1].uid);\n  Save.mark();", 'P4');

// P5: Save.flush also triggers the cloud push
rep("      setStatus('Saved ' + new Date().toLocaleTimeString(), '');",
    "      setStatus('Saved ' + new Date().toLocaleTimeString(), '');\n      if (Cloud.ready()) Cloud.flush(S.profile, uid => S.results.find(x => x.uid === uid), activeCloudStats());", 'P5');

// P6: cloud runtime helpers before the SETTINGS section
rep("/* ================================ SETTINGS ================================= */",
`/* --------------------------------- cloud (v4) ------------------------------
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
  g.innerHTML = '<summary><b>Setup guide (one person does this once, ~5 minutes)</b></summary>' +
    '<ol class="small">' +
    '<li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a> (no credit card needed).</li>' +
    '<li>In the project: <b>Authentication → Providers → Email</b> → turn <b>OFF</b> "Confirm email" (so friends can log in straight away).</li>' +
    '<li><b>SQL Editor → New query</b> — paste the SQL below and press <b>Run</b>.</li>' +
    '<li><b>Project Settings → API</b> — copy the <i>Project URL</i> and the <i>anon public key</i> into the fields above and Connect.</li>' +
    '<li>Share this HTML file with your friends. Each one connects with the SAME URL + key, then creates their own account (email + password) and a profile with their name. The Group tab then shows everybody live.</li>' +
    '</ol>' +
    '<pre style="background:var(--panel2);border:1px solid var(--border2);border-radius:6px;padding:10px;font-size:12px;white-space:pre-wrap">-- Run once in the Supabase SQL editor\n' +
    'create table if not exists public.dmat_profiles (\n' +
    '  id text primary key,\n' +
    '  user_id uuid not null default auth.uid() references auth.users on delete cascade,\n' +
    '  name text not null,\n' +
    '  created_at timestamptz not null default now(),\n' +
    '  last_activity timestamptz not null default now(),\n' +
    '  stats jsonb not null default \'{}\'::jsonb\n' +
    ');\n' +
    'create table if not exists public.dmat_results (\n' +
    '  uid text primary key,\n' +
    '  user_id uuid not null default auth.uid() references auth.users on delete cascade,\n' +
    '  profile text not null,\n' +
    '  module text not null,\n' +
    '  qid text not null,\n' +
    '  cls text,\n' +
    '  type text,\n' +
    '  techs jsonb,\n' +
    '  outcome text not null,\n' +
    '  time_sec int not null default 0,\n' +
    '  answer text,\n' +
    '  at timestamptz not null default now()\n' +
    ');\n' +
    'alter table public.dmat_profiles enable row level security;\n' +
    'alter table public.dmat_results enable row level security;\n' +
    'create policy "profiles own write" on public.dmat_profiles for insert with check (auth.uid() = user_id);\n' +
    'create policy "profiles own update" on public.dmat_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);\n' +
    'create policy "profiles group read" on public.dmat_profiles for select using (auth.role() = \'authenticated\');\n' +
    'create policy "results own write" on public.dmat_results for insert with check (auth.uid() = user_id);\n' +
    'create policy "results own update" on public.dmat_results for update using (auth.uid() = user_id) with check (auth.uid() = user_id);\n' +
    'create policy "results group read" on public.dmat_results for select using (auth.role() = \'authenticated\');</pre>' +
    '<p class="small muted">Security notes: the anon key is public by design — safety comes from Row Level Security (you can only write your own rows; the group can read). Anyone with the URL + key + an account can read group scores, so use a private project. Data lives in YOUR project on supabase.com.</p>';
  cc.appendChild(g);
  c.appendChild(cc);
}

/* ================================ SETTINGS ================================= */`, 'P6');

// P7: renderGroup — live cloud data when connected
rep(`  (async () => {
    let allR = [];
    if (Store.ok) allR = await Store.all('results');
    else allR = S.results.slice().concat(Object.keys(MemStash.results).reduce((a, k) => a.concat(MemStash.results[k]), []));
    const names = Array.from(new Set([].concat(Profiles.names(), allR.map(r => r.profile).filter(Boolean))));`,
`  (async () => {
    let allR = [], cloudLive = false, profilesMeta = Profiles.map;
    if (Cloud.ready()) {
      try {
        const g = await Cloud.pullGroup();
        allR = g.results; profilesMeta = g.profiles; cloudLive = true;
      } catch (e) { console.warn('group cloud pull failed', e); }
    }
    if (!cloudLive) {
      allR = Store.ok ? await Store.all('results') : S.results.slice().concat(Object.keys(MemStash.results).reduce((a, k) => a.concat(MemStash.results[k]), []));
    }
    const names = Array.from(new Set([].concat(Object.keys(profilesMeta), allR.map(r => r.profile).filter(Boolean))));`, 'P7a');
rep(`               last: R.length ? Math.max.apply(null, R.map(r => r.at || 0)) : (Profiles.map[nm] && Profiles.map[nm].lastActivity) || 0,`,
    `               last: R.length ? Math.max.apply(null, R.map(r => r.at || 0)) : (profilesMeta[nm] && profilesMeta[nm].lastActivity) || 0,`, 'P7b');
rep(`    if (!Store.ok) wrap.appendChild(el('p', 'small muted', 'Storage is unavailable in this session — only this session\\'s profiles can be shown.'));`,
    `    wrap.appendChild(el('p', 'small muted', cloudLive
      ? '☁ Live from the cloud — every profile from every laptop, updated as people practise. Last sync ' + (Cloud.lastSync ? new Date(Cloud.lastSync).toLocaleTimeString() : '') + '.'
      : (Store.ok ? 'Showing profiles stored in this browser. Connect cloud sync (Settings) to see friends on other laptops live.'
                  : 'Storage is unavailable in this session — only this session\\'s profiles can be shown.')));`, 'P7c');
rep(`  const intro = el('div', 'card');
  intro.innerHTML = '<h2>Group Dashboard</h2><p class="muted small">Compares every profile saved in THIS browser on THIS device. If your friends practise on other devices: they click <b>Export all progress as JSON</b> (Settings) and send you the file; you import it here and it appears below as a comparable profile. Nothing is uploaded anywhere.</p>';
  v.appendChild(intro);`,
`  const intro = el('div', 'card');
  intro.innerHTML = '<h2>Group Dashboard</h2><p class="muted small">' + (Cloud.ready()
    ? '☁ Connected — this view is LIVE from your shared database: every friend\\'s attempts, accuracy and speed from every laptop, updated automatically.'
    : 'Compares every profile saved in THIS browser on THIS device. Practising on separate laptops? Connect <b>Cloud sync</b> (Settings → Supabase, free, ~5 min) for a live comparison — or use JSON export/import: friends send you their progress file, you import it here as a comparable profile.') + '</p>';
  v.appendChild(intro);`, 'P7d');

// P8: settings calls the cloud section
rep("  prow.append(rn, bAdd, bRen, bDel);\n  pc.appendChild(prow);\n  c.appendChild(pc);",
    "  prow.append(rn, bAdd, bRen, bDel);\n  pc.appendChild(prow);\n  c.appendChild(pc);\n  renderCloudSection(c);", 'P8');

// P9: selftest — cloud pipeline tests against a mock/real project
rep("  // export payload shape",
`  // cloud sync (runs only when ?cloud= provides a test/mock project)
  try {
    if (Cloud.cfg) {
      if (!S.profile) await createAndSwitch('CloudTester');
      const prevSession = Cloud.session;
      await Cloud.signIn('host@mock.local', 'test1234').catch(() => Cloud.signUp('host@mock.local', 'test1234'));
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
      Cloud.session = prevSession; Cloud.persistSession();
    } else out.push('SKIP cloud sync (no ?cloud= test project in this run)');
  } catch (e) { t('cloud sync', false, e.message); }
  // export payload shape`, 'P9');

fs.writeFileSync(__dirname + '/app.js', s);
console.log('app.js v4 cloud patch applied fully');
