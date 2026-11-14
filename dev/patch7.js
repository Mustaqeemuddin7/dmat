/* patch7.js — v6: wire the Study Notes Learning Centre into the app.
   Run: node dev/patch7.js   (verifies every anchor) */
'use strict';
const fs = require('fs');

// ---- template.html ----
let t = fs.readFileSync(__dirname + '/template.html', 'utf8');
function trep(from, to, label) {
  const i = t.indexOf(from);
  if (i < 0) { console.error('TEMPLATE ANCHOR NOT FOUND: ' + label); process.exit(1); }
  t = t.slice(0, i) + to + t.slice(i + from.length);
}
trep("/*__DEEP__*/\n</script>", "/*__DEEP__*/\n</script>\n<script>\n/*__NOTES__*/\n</script>\n<script>\n/*__SN__*/\n</script>", 'markers');
trep("#saveStatus.saving{color:var(--amber);} #saveStatus.failed{color:var(--red);}",
`#saveStatus.saving{color:var(--amber);} #saveStatus.failed{color:var(--red);}
#cloudStatus.ok{color:var(--green);} #cloudStatus.failed{color:var(--red);}
.snl{display:grid;grid-template-columns:290px 1fr;gap:14px;align-items:start;}
.snav{max-height:72vh;overflow:auto;}
.trow{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;}
.trow:hover{background:var(--panel2);}
.trow.cur{background:var(--accent-soft);}
.sdot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none;}
.sdot.l{background:var(--green);} .sdot.p{background:var(--amber);} .sdot.n{background:var(--border);}
.eqline{padding:0 6px;border-radius:4px;}
@media(max-width:860px){.snl{grid-template-columns:1fr;}.snav{max-height:none;}}`, 'css');
fs.writeFileSync(__dirname + '/template.html', t);

// ---- build.js ----
let b = fs.readFileSync(__dirname + '/build.js', 'utf8');
function brep(from, to, label) {
  if (b.indexOf(to) >= 0) { console.log('skip (already applied): ' + label); return; }
  const i = b.indexOf(from);
  if (i < 0) { console.error('BUILD ANCHOR NOT FOUND: ' + label); process.exit(1); }
  b = b.slice(0, i) + to + b.slice(i + from.length);
}
brep("cloudjs = read('cloud.js'), deepjs = read('deepnotes.js'), app = read('app.js');",
     "cloudjs = read('cloud.js'), deepjs = read('deepnotes.js'), notesjs = read('notes-content.js'), snjs = read('study-notes.js'), app = read('app.js');", 'read');
brep("[core, mathjs, figuresjs, cloudjs, deepjs, app, bankJson]", "[core, mathjs, figuresjs, cloudjs, deepjs, notesjs, snjs, app, bankJson]", 'list');
brep("  .replace('/*__DEEP__*/', () => deepjs)", "  .replace('/*__DEEP__*/', () => deepjs)\n  .replace('/*__NOTES__*/', () => notesjs)\n  .replace('/*__SN__*/', () => snjs)", 'replace');
brep("['__CORE__', '__MATH__', '__FIGURES__', '__CLOUD__', '__DEEP__', '__BANK__', '__APP__']", "['__CORE__', '__MATH__', '__FIGURES__', '__CLOUD__', '__DEEP__', '__NOTES__', '__SN__', '__BANK__', '__APP__']", 'check');
fs.writeFileSync(__dirname + '/build.js', b);

// ---- app.js ----
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
function rep(from, to, label) {
  const i = s.indexOf(from);
  if (i < 0) { console.error('APP ANCHOR NOT FOUND: ' + label); process.exit(1); }
  s = s.slice(0, i) + to + s.slice(i + from.length);
}
// schema v4 (additive: learning-centre fields live inside the per-profile kv state)
rep("  NAME: 'dmat-practice', VERSION: 3, db: null, ok: false, error: null,", "  NAME: 'dmat-practice', VERSION: 4, db: null, ok: false, error: null,", 'ver');
rep("      } }\n  ],\n  open() {",
`      } },
    { v: 4, note: 'v6: learning centre — topic states / bookmarks / recent / example completion are additive fields inside the per-profile kv state (no structural change)', up(db, tx) { } }
  ],
  open() {`, 'v4-mig');
// renderNotes delegates to the Learning Centre
rep(`function renderNotes() {
  const v = $('#view-notes');
  v.innerHTML = '';
  moduleBar(v, S.activeModule);
  const seg = el('div', 'modulebar');`,
`function renderNotes() {
  StudyNotes.render(document.getElementById('view-notes'));
}
function renderNotesLegacy() {
  const v = $('#view-notes');
  v.innerHTML = '';
  moduleBar(v, S.activeModule);
  const seg = el('div', 'modulebar');`, 'rendernotes');
// learning defaults on profile restore (single restore site: restoreState)
rep('  S.learning = st.learning || { studied: {} };',
    '  S.learning = Object.assign({ studied: {}, topics: {}, bookmarks: [], recent: [], exDone: {}, weakImproved: {} }, st.learning || {});', 'learn1');
// selftest additions
rep("  // export payload shape",
`  // study notes / learning centre (v6)
  try {
    StudyNotes.compile();
    const snCounts = MOD_ORDER.map(m => StudyNotes.topicCount(m));
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
  // export payload shape`, 'selftest');

fs.writeFileSync(__dirname + '/app.js', s);
console.log('patch7 applied fully');
