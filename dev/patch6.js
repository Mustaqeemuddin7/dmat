/* patch6.js — v5: Deep Dives curriculum in Study Notes.
   Run: node dev/patch6.js   (verifies every anchor) */
'use strict';
const fs = require('fs');

// ---- template.html: marker + CSS ----
let t = fs.readFileSync(__dirname + '/template.html', 'utf8');
function trep(from, to, label) {
  if (t.indexOf(to) >= 0) { console.log('skip (already applied): ' + label); return; }
  const i = t.indexOf(from);
  if (i < 0) { console.error('TEMPLATE ANCHOR NOT FOUND: ' + label); process.exit(1); }
  t = t.slice(0, i) + to + t.slice(i + from.length);
}
trep("/*__CLOUD__*/\n</script>", "/*__CLOUD__*/\n</script>\n<script>\n/*__DEEP__*/\n</script>", 'marker');
trep("#cloudStatus.ok{color:var(--green);} #cloudStatus.failed{color:var(--red);}",
`.fbox{background:var(--panel2);border-left:3px solid var(--accent);font-family:Consolas,'Courier New',monospace;font-size:13px;line-height:1.7;padding:8px 12px;margin:8px 0;border-radius:0 6px 6px 0;overflow-x:auto;}
.oklist{list-style:none;margin:6px 0;padding:0;}
.oklist li{padding:2px 0;color:var(--text);}
.oklist li::before{content:'✓  ';color:var(--green);font-weight:700;}
.warnlist{list-style:none;margin:6px 0;padding:0;}
.warnlist li{padding:2px 0;}
.warnlist li::before{content:'⚠  ';color:var(--amber);font-weight:700;}
.deepsec{border-left:3px solid var(--accent);}`, 'css');
fs.writeFileSync(__dirname + '/template.html', t);

// ---- build.js: inline deepnotes.js ----
let b = fs.readFileSync(__dirname + '/build.js', 'utf8');
function brep(from, to, label) {
  if (b.indexOf(to) >= 0) { console.log('skip (already applied): ' + label); return; }
  const i = b.indexOf(from);
  if (i < 0) { console.error('BUILD ANCHOR NOT FOUND: ' + label); process.exit(1); }
  b = b.slice(0, i) + to + b.slice(i + from.length);
}
brep("const core = read('core.js'), mathjs = read('math.js'), figuresjs = read('figures.js'), cloudjs = read('cloud.js'), app = read('app.js');",
     "const core = read('core.js'), mathjs = read('math.js'), figuresjs = read('figures.js'), cloudjs = read('cloud.js'), deepjs = read('deepnotes.js'), app = read('app.js');", 'read');
brep("[core, mathjs, figuresjs, cloudjs, app, bankJson]", "[core, mathjs, figuresjs, cloudjs, deepjs, app, bankJson]", 'list');
brep("  .replace('/*__CLOUD__*/', () => cloudjs)", "  .replace('/*__CLOUD__*/', () => cloudjs)\n  .replace('/*__DEEP__*/', () => deepjs)", 'replace');
brep("['__CORE__', '__MATH__', '__FIGURES__', '__CLOUD__', '__BANK__', '__APP__']", "['__CORE__', '__MATH__', '__FIGURES__', '__CLOUD__', '__DEEP__', '__BANK__', '__APP__']", 'check');
fs.writeFileSync(__dirname + '/build.js', b);

// ---- app.js ----
let s = fs.readFileSync(__dirname + '/app.js', 'utf8');
function rep(from, to, label) {
  const i = s.indexOf(from);
  if (i < 0) { console.error('APP ANCHOR NOT FOUND: ' + label); process.exit(1); }
  s = s.slice(0, i) + to + s.slice(i + from.length);
}
rep("const C = DMATCore, M = MathEq, F = FigSeq, Cloud = DMATCloud;",
    "const C = DMATCore, M = MathEq, F = FigSeq, Cloud = DMATCloud, DN = DMATDeepNotes;", 'dn-const');

// dispatcher: Notes gains a Techniques/Deep-dives switch
rep(`function renderNotes() {
  const v = $('#view-notes');
  v.innerHTML = '';
  moduleBar(v, S.activeModule);
  const mid = S.activeModule;
  const T = TECH_TEXT[mid];
  const intro = el('div', 'card');`,
`function renderNotes() {
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
  const intro = el('div', 'card');`, 'dispatcher');

// deep-dive renderer + verified walkthrough renderer
rep("/* ============================== CLASS PRACTICE ============================== */",
`/* ================================ DEEP DIVES ================================ */
function renderDeepNotes(v, mid) {
  const cur = DN[mid];
  const intro = el('div', 'card');
  intro.innerHTML = '<h2>Deep dives — ' + esc(MODS[mid].name) + '</h2>' +
    '<p class="muted small">The full method: fundamentals, formulas, mental tricks and verified walkthroughs. Every walkthrough below is a real bank question solved by the platform\\'s verified engine — nothing here is hand-invented. Tick sections off as you study them (saved automatically).</p>';
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

/* ============================== CLASS PRACTICE ============================== */`, 'deep-renderer');

fs.writeFileSync(__dirname + '/app.js', s);
console.log('patch6 applied fully');
