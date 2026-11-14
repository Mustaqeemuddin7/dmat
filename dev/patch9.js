/* patch9.js — v7 UI: icon side-nav + dashboard hero redesign. */
'use strict';
const fs = require('fs');
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
function rep(from, to, label) {
  const i = s.indexOf(from);
  if (i < 0) { console.error('ANCHOR NOT FOUND: ' + label); process.exit(1); }
  s = s.slice(0, i) + to + s.slice(i + from.length);
}

// P1: icon set + side-nav builder
rep(`function buildTabs() {
  const nav = $('#tabs');
  VIEWS.forEach(([id, label]) => {
    const b = el('button', '', label); b.dataset.v = id;
    b.onclick = () => { if (S.exam && !S.exam.submitted && id !== 'exam' && !confirm('Leave the running exam? It stays saved and you can resume from the Dashboard.')) return; showView(id); };
    nav.appendChild(b);
  });
}`,
`/* side-nav icons (inline SVG, stroke = currentColor) */
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
}`, 'nav');

// P2: dashboard hero redesign with stat chips
rep(`  const hero = el('div', 'card');
  const cloudHint = (Cloud.cfg && !Cloud.session) ? ' <b style="color:var(--amber)">☁ Cloud sync is connected — create your group account in Settings (Cloud sync section) to join the live comparison.</b>' : '';
  hero.innerHTML = '<h2>Welcome back</h2><p class="muted">All three <b>Core Module</b> subtests are active with five difficulty classes each (Easy → Master). ' +
    'No negative marking — never leave a question blank. ' + cloudHint + (attempted ? 'This device holds <b>' + attempted + '</b> answered questions (' + Math.round(100 * correct / attempted) + '% correct).' : 'No questions answered yet on this device.') + '</p>';
  v.appendChild(hero);`,
`  const hero = el('div', 'card hero');
  const cloudHint = (Cloud.cfg && !Cloud.session) ? '<span style="color:var(--amber);font-weight:700">☁ Cloud sync is connected — create your group account in Settings (Cloud sync section) to join the live comparison.</span>' : '';
  hero.innerHTML = '<div class="greet">' + (S.profile ? 'Welcome back, ' + esc(S.profile) : 'Welcome') + '</div>' +
    '<p class="muted small">All three <b>Core Module</b> subtests · five difficulty classes (Easy → Master) · no negative marking — never leave a blank. ' + cloudHint + '</p>' +
    (attempted ? '<div class="herostats">' +
      '<div class="statchip"><div><div class="v">' + attempted + '</div><div class="l">answered</div></div></div>' +
      '<div class="statchip"><div><div class="v">' + Math.round(100 * correct / attempted) + '%</div><div class="l">accuracy</div></div></div>' +
      '<div class="statchip"><div><div class="v">' + (S.results.length ? Math.round(S.results.reduce((a, r) => a + r.timeSec, 0) / S.results.length) : 0) + 's</div><div class="l">avg time</div></div></div>' +
      '</div>' : '<div class="herostats"><div class="statchip"><div><div class="l">No questions answered yet — pick a module below.</div></div></div></div>');
  v.appendChild(hero);`, 'hero');

// P3: module cards get icon chips
rep(`    c.innerHTML = '<h3>' + esc(m.name) + ' <span class="badge">' + m.bank.length + ' questions</span></h3>' +`,
    `    c.innerHTML = '<div class="modchip ' + mid + '">' + mid[0].toUpperCase() + '</div>' + '<h3>' + esc(m.name) + ' <span class="badge">' + m.bank.length + ' questions</span></h3>' +`, 'modchip');

fs.writeFileSync(__dirname + '/app.js', s);
console.log('patch9 applied: icon nav + hero + module chips');
