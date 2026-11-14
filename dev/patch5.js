/* patch5.js — bake the group's Supabase project as the default cloud config.
   The publishable key is public by design; RLS protects the data.
   Settings can still override or disable (a 'dmat.cloudOff' flag). */
'use strict';
const fs = require('fs');

// ---- app.js ----
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
function rep(from, to, label) {
  const i = s.indexOf(from);
  if (i < 0) { console.error('ANCHOR NOT FOUND: ' + label); process.exit(1); }
  s = s.slice(0, i) + to + s.slice(i + from.length);
}
rep("const C = DMATCore, M = MathEq, F = FigSeq, Cloud = DMATCloud;",
`const C = DMATCore, M = MathEq, F = FigSeq, Cloud = DMATCloud;
/* The group's shared Supabase project, baked in so every friend just opens the
   file, creates an account and practises. The key is a PUBLIC publishable key
   (row-level security protects the data). Settings can override or disable. */
const BAKED_CLOUD = { url: 'https://vhtwomzqpamaqhntehha.supabase.co', key: 'sb_publishable_uzHcmjBGUvgXJLkeBxeCXg_QU3VlChz' };`, 'app-baked');

// cloud selftest must only run against an explicit test project
rep("  try {\n    if (Cloud.cfg) {\n      if (!S.profile) await createAndSwitch('CloudTester');",
"  try {\n    if (Cloud.cfg && new URLSearchParams(location.search).get('cloudtest') === '1') {\n      if (!S.profile) await createAndSwitch('CloudTester');", 'selftest-gate');

// dashboard hint: cloud ready but no account yet
rep("  const hero = el('div', 'card');\n  hero.innerHTML = '<h2>Welcome back</h2>",
`  const hero = el('div', 'card');
  const cloudHint = (Cloud.cfg && !Cloud.session) ? ' <b style="color:var(--amber)">☁ Cloud sync is connected — create your group account in Settings (Cloud sync section) to join the live comparison.</b>' : '';
  hero.innerHTML = '<h2>Welcome back</h2>`, 'dash-hint-1');
rep(`    'No negative marking — never leave a question blank. ' +`,
    `    'No negative marking — never leave a question blank. ' + cloudHint +`, 'dash-hint-2');
fs.writeFileSync(__dirname + '/app.js', s);

// ---- cloud.js ----
let c = fs.readFileSync(__dirname + '/cloud.js', 'utf8');
function crep(from, to, label) {
  const i = c.indexOf(from);
  if (i < 0) { console.error('CLOUD ANCHOR NOT FOUND: ' + label); process.exit(1); }
  c = c.slice(0, i) + to + c.slice(i + from.length);
}
crep("    load() {\n      try { this.cfg = JSON.parse(localStorage.getItem('dmat.cloud') || 'null'); } catch (e) { this.cfg = null; }",
`    load() {
      try { this.cfg = JSON.parse(localStorage.getItem('dmat.cloud') || 'null'); } catch (e) { this.cfg = null; }
      // fall back to the baked-in group project unless the user disconnected
      if (!this.cfg && typeof root.DMAT_BAKED_CLOUD !== 'undefined' && root.DMAT_BAKED_CLOUD && localStorage.getItem('dmat.cloudOff') !== '1') {
        this.cfg = root.DMAT_BAKED_CLOUD;
      }`, 'load-fallback');
crep("    disconnect() { this.cfg = null; this.session = null; this.pending = []; this.status = 'off'; this.persistCfg(); this.persistSession(); this.setUI(); },",
"    disconnect() { this.cfg = null; this.session = null; this.pending = []; this.status = 'off'; this.persistCfg(); this.persistSession(); try { localStorage.setItem('dmat.cloudOff', '1'); } catch (e) { } this.setUI(); },", 'disconnect-off');
crep("      this.cfg = { url, key };\n      this.persistCfg();",
"      this.cfg = { url, key };\n      try { localStorage.removeItem('dmat.cloudOff'); } catch (e) { }\n      this.persistCfg();", 'connect-clears-off');
fs.writeFileSync(__dirname + '/cloud.js', c);
console.log('patch5 applied: baked config + fallback + gates');
