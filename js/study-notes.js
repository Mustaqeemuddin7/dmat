/* ============================================================================
   dMAT Core Module Practice — Study Notes / Learning Centre engine (v6)
   ----------------------------------------------------------------------------
   Compiles a topic tree per module from DMATNotesContent (categories,
   technique lessons, difficulty levels, question types, revision) plus the
   platform's verified bank (walkthroughs), and renders:

     dashboard   → search, module cards, weak topics, recent, bookmarks
     module page → collapsible sidebar + topic content + worked examples
     topic       → status (Not started / In progress / Learned), bookmark,
                   verified walkthroughs, prev/next navigation
     quick rev   → 5-minute and 15-minute condensed revision

   Learning state lives in S.learning (persisted through the existing
   per-profile IndexedDB kv state — additive fields, schema v4).
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.StudyNotes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MOD_ORDER = ['latin', 'math', 'figures'];
  function modName(mid) { return (typeof MODS !== 'undefined' && MODS[mid]) ? MODS[mid].name : 'Exam Strategy'; }
  const WEAK_REF = {
    'latin:1': 'latin:tech:1', 'latin:2': 'latin:tech:2', 'latin:3': 'latin:tech:3', 'latin:4': 'latin:tech:4',
    'latin:5': 'latin:tech:5', 'latin:6': 'latin:tech:6', 'latin:7': 'latin:tech:7', 'latin:8': 'latin:tech:8',
    'latin:9': 'latin:tech:9', 'latin:10': 'latin:tech:10', 'latin:11': 'latin:tech:11', 'latin:12': 'latin:tech:12',
    'latin:13': 'latin:tech:13', 'latin:14': 'latin:tech:14', 'latin:15': 'latin:tech:15', 'latin:16': 'latin:tech:16',
    'latin:17': 'latin:tech:17',
    'latin:type:a': 'latin:types:a', 'latin:type:b': 'latin:types:b', 'latin:type:c': 'latin:types:c',
    'latin:type:d': 'latin:types:d', 'latin:type:e': 'latin:types:e', 'latin:type:f': 'latin:types:f',
    'latin:type:g': 'latin:types:g', 'latin:type:h': 'latin:types:h', 'latin:type:i': 'latin:types:i',
    'latin:type:j': 'latin:types:j',
    'math:1': 'math:tech:2', 'math:2': 'math:tech:3', 'math:3': 'math:tech:6', 'math:4': 'math:tech:4',
    'math:type:chain': 'math:tech:2', 'math:type:mul': 'math:con:mul', 'math:type:direct': 'math:fund:eq',
    'math:type:elim': 'math:tech:3',
    'figures:1': 'figures:tech:2', 'figures:2': 'figures:tech:7', 'figures:3': 'figures:tech:7',
    'figures:type:rotate': 'figures:pat:rotation', 'figures:type:move': 'figures:pat:movement',
    'figures:type:shade': 'figures:pat:shade', 'figures:type:multi': 'figures:pat:comb',
    'figures:type:color': 'figures:pat:shade', 'figures:type:swap': 'figures:pat:comb',
    'figures:type:alt-rotate': 'figures:pat:alt', 'figures:type:alt-shade': 'figures:pat:alt'
  };

  const SN = {
    topics: {}, order: {}, compiled: false,

    /* ------------------------------ compile ------------------------------ */
    compile() {
      if (this.compiled) return;
      // defensive defaults for learning-centre state (memory mode, old profiles)
      S.learning.topics = S.learning.topics || {};
      S.learning.bookmarks = S.learning.bookmarks || [];
      S.learning.recent = S.learning.recent || [];
      S.learning.exDone = S.learning.exDone || {};
      S.learning.weakImproved = S.learning.weakImproved || {};
      const NC = (typeof DMATNotesContent !== 'undefined') ? DMATNotesContent : null;
      if (!NC) return;
      this.topics = {}; this.order = {};
      const mods = MOD_ORDER.concat(['study']);
      mods.forEach(mod => {
        const cc = NC.CONTENT[mod];
        if (!cc) return;
        this.order[mod] = [];
        cc.cats.forEach(cat => {
          let list = cat.topics;
          if (list === 'TECH') {
            list = Object.keys(NC.TECH_LESSONS[mod]).map(n => ({
              id: String(n),
              title: ((typeof TECH_NAME !== 'undefined' && TECH_NAME[mod] && TECH_NAME[mod][+n]) ? TECH_NAME[mod][+n] : 'Technique T' + n) + ' (T' + n + ')',
              lesson: NC.TECH_LESSONS[mod][n], tech: +n
            }));
          }
          list.forEach(t => {
            const id = mod + ':' + cat.id + ':' + t.id;
            let blocks = (t.blocks || []).map(x => Object.assign({}, x));
            if (t.lesson) {
              const meta = (typeof TECH_TEXT !== 'undefined' && TECH_TEXT[mod] && TECH_TEXT[mod][t.tech]) || null;
              blocks = [{ p: t.lesson.def }];
              if (meta) blocks.push({ p: 'When to use it: ' + meta.when });
              blocks.push({ h: 'Step-by-step' });
              blocks.push({ ol: t.lesson.steps });
              blocks.push({ p: 'Why it works: ' + t.lesson.why });
              if (t.walk) blocks.push({ walk: t.walk });
              if (meta) blocks.push({ w: meta.mistakes });
              blocks.push({ sum: 'Quick revision: ' + t.lesson.summary });
            }
            const topic = {
              id, module: mod, catId: cat.id, cat: cat.title, title: t.title,
              blocks, tech: t.tech || null, qex: t.qex || null, walk: t.walk || null, repQ: null
            };
            if (t.qex) {
              const order = ['Hard', 'Medium', 'Extreme', 'Master', 'Easy'];
              for (let i = 0; i < order.length && !topic.repQ; i++) {
                topic.repQ = bankQ(mod, order[i]).find(q => q.type === t.qex.type) || null;
              }
            }
            this.topics[id] = topic;
            this.order[mod].push(id);
          });
        });
        // deep-dive sections as a category (formula/trick content)
        if (typeof DN !== 'undefined' && DN[mod]) {
          this.order[mod].push('__deep__');
          DN[mod].forEach(sec => {
            const id = mod + ':deep:' + sec.id;
            this.topics[id] = {
              id, module: mod, catId: 'deep', cat: 'Formulas & deep dives', title: sec.title,
              blocks: sec.blocks.map(x => Object.assign({}, x)), tech: null, qex: null, walk: null, repQ: null
            };
            this.order[mod].push(id);
          });
        }
      });
      // search strings
      Object.keys(this.topics).forEach(id => {
        const t = this.topics[id];
        t.search = (t.title + ' ' + t.cat + ' ' + t.module + ' ' + this.textOf(t.blocks) + (t.repQ ? ' ' + t.repQ.id : '')).toLowerCase();
      });
      this.compiled = true;
    },
    textOf(blocks) {
      const out = [];
      (blocks || []).forEach(b => {
        if (b.p) out.push(b.p);
        else if (b.f) out.push(b.f.join(' '));
        else if (b.b) out.push(b.b.join(' '));
        else if (b.t) out.push(b.t.join(' '));
        else if (b.w) out.push(b.w.join(' '));
        else if (b.sum) out.push(b.sum);
        else if (b.table) out.push(b.table.head.join(' ') + ' ' + b.table.rows.map(r => r.join(' ')).join(' '));
        else if (b.walk) out.push('worked example ' + b.walk.cls);
        else if (b.note) out.push(b.note);
      });
      return out.join(' ');
    },
    topicsOf(mod) { return (this.order[mod] || []).filter(id => id !== '__deep__').map(id => this.topics[id]); },
    topicCount(mod) { return this.topicsOf(mod).length; },
    exCount(mod) {
      const set = new Set();
      this.topicsOf(mod).forEach(t => { this.examplesFor(t).forEach(q => set.add(q.id)); });
      return set.size;
    },
    progress(mod) {
      const ids = (this.order[mod] || []).filter(id => id !== '__deep__');
      let learned = 0, prog = 0;
      ids.forEach(id => {
        const s = S.learning.topics[id] && S.learning.topics[id].status;
        if (s === 'learned') learned++; else if (s === 'progress') prog++;
      });
      return { total: ids.length, learned, prog, pct: ids.length ? Math.round(100 * learned / ids.length) : 0 };
    },

    /* -------------------------- walkthrough utils ------------------------- */
    findWalkQ(module, walk) {
      const qs = bankQ(module, walk.cls);
      if (walk.pickTech !== undefined) return qs.find(q => (q.techs || []).indexOf(walk.pickTech) >= 0) || qs[0] || null;
      if (walk.pickElim) return qs.find(q => q.elims >= 1) || qs[0] || null;
      return qs[0] || null;
    },
    examplesFor(topic) {
      const out = [];
      const seen = new Set();
      const push = q => { if (q && !seen.has(q.id)) { seen.add(q.id); out.push(q); } };
      if (topic.walk) push(this.findWalkQ(topic.module, topic.walk));
      if (topic.repQ) push(topic.repQ);
      if (topic.tech !== null && topic.tech !== undefined) {
        ['Medium', 'Hard', 'Extreme', 'Master', 'Easy'].forEach(cls => {
          bankQ(topic.module, cls).forEach(q => { if ((q.techs || []).indexOf(topic.tech) >= 0 && out.length < 6) push(q); });
        });
      } else if (topic.type) {
        ['Medium', 'Hard', 'Extreme', 'Master', 'Easy'].forEach(cls => {
          bankQ(topic.module, cls).forEach(q => { if (q.type === topic.type && out.length < 6) push(q); });
        });
      } else if (topic.walk && out.length < 5) {
        const cls = topic.walk.cls;
        bankQ(topic.module, cls).forEach(q => { if (out.length < 5 && q.id !== (out[0] && out[0].id)) push(q); });
      }
      return out;
    },

    /* ------------------------------ progress ------------------------------ */
    statusOf(id) { return (S.learning.topics[id] && S.learning.topics[id].status) || 'not-started'; },
    updateProgress(id, status) {
      S.learning.topics[id] = { status: status, at: Date.now() };
      Save.mark();
    },
    dot(status) { return '<span class="sdot ' + (status === 'learned' ? 'l' : status === 'progress' ? 'p' : 'n') + '"></span>'; },

    /* ------------------------------ bookmarks ----------------------------- */
    bookmarkTopic(id) {
      const i = S.learning.bookmarks.indexOf(id);
      if (i >= 0) S.learning.bookmarks.splice(i, 1); else S.learning.bookmarks.push(id);
      Save.mark();
      return S.learning.bookmarks.indexOf(id) >= 0;
    },
    touchRecent(id) {
      const r = S.learning.recent;
      const i = r.indexOf(id);
      if (i >= 0) r.splice(i, 1);
      r.unshift(id);
      if (r.length > 10) r.length = 10;
      Save.mark();
    },

    /* -------------------------------- weak -------------------------------- */
    getWeakTopics() {
      const agg = {};
      S.results.forEach(r => {
        const add = tid => {
          if (!tid || !this.topics[tid]) return;
          const e = agg[tid] = agg[tid] || { topicId: tid, n: 0, wrong: 0, last: 0 };
          e.n++; if (r.outcome !== 'correct') e.wrong++;
          e.last = Math.max(e.last, r.at || 0);
        };
        (r.techs || []).forEach(tn => add(WEAK_REF[r.module + ':' + tn]));
        add(WEAK_REF[r.module + ':type:' + r.type]);
      });
      const imp = S.learning.weakImproved || {};
      const weak = [], done = [];
      Object.keys(agg).forEach(tid => {
        const e = agg[tid];
        if (e.n < 3) return;                       // insufficient evidence
        const entry = { topicId: tid, n: e.n, wrong: e.wrong, last: e.last,
                        acc: Math.round(100 * (e.n - e.wrong) / e.n), improved: !!imp[tid],
                        topic: this.topics[tid] };
        (entry.improved ? done : weak).push(entry);
      });
      weak.sort((a, b) => (a.wrong / a.n) - (b.wrong / b.n) || b.n - a.n);
      return { weak: weak, done: done };
    },

    /* ------------------------------- search ------------------------------- */
    searchNotes(query, module, catId) {
      const q = String(query || '').trim().toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      const out = [];
      Object.keys(this.topics).forEach(id => {
        const t = this.topics[id];
        if (module && module !== 'all' && t.module !== module) return;
        if (catId && catId !== 'all' && t.catId !== catId) return;
        if (!tokens.length || tokens.every(tok => t.search.indexOf(tok) >= 0)) out.push(t);
      });
      return out;
    },

    /* ------------------------------- render ------------------------------- */
    render(v) {
      this.compile();
      v.innerHTML = '';
      const st = S.snState || { page: 'dashboard' };
      if (st.page === 'module') return this.renderModuleNotes(v, st.module, st.topic);
      if (st.page === 'rev') return this.renderQuickRevision(v, st.module, st.dur);
      this.renderDashboard(v);
    },
    go(state) { S.snState = state; showView('notes'); },
    openTopic(id) {
      const t = this.topics[id];
      if (!t) return;
      this.touchRecent(id);
      this.go({ page: 'module', module: t.module, topic: id });
    },

    /* ---------------------------- SN dashboard ---------------------------- */
    renderDashboard(v) {
      const head = el('div', 'card');
      head.innerHTML = '<h2>Study Notes &amp; Learning Centre</h2><p class="muted small">Learn a concept, study its technique, walk through verified examples, then practise — and the centre links your mistakes back to the notes. Everything is stored in your profile.</p>';
      // search
      const srow = el('div', 'row');
      const inp = el('input', 'numinput'); inp.style.fontSize = '14px'; inp.style.width = '230px'; inp.placeholder = 'Search topics, techniques, examples…';
      const msel = el('select', 'ghost'); msel.style.padding = '8px';
      msel.innerHTML = '<option value="all">All modules</option>' + MOD_ORDER.map(m => '<option value="' + m + '">' + MODS[m].name + '</option>').join('') + '<option value="study">Exam strategy</option>';
      const csel = el('select', 'ghost'); csel.style.padding = '8px'; csel.innerHTML = '<option value="all">All categories</option>';
      const res = el('div');
      const doSearch = () => {
        const list = this.searchNotes(inp.value, msel.value, csel.value).slice(0, 12);
        res.innerHTML = '';
        if (!inp.value.trim()) { res.appendChild(el('p', 'small muted', 'Type to search across ' + Object.keys(this.topics).length + ' topics.')); return; }
        list.forEach(t => {
          const row = el('div', 'trow');
          row.innerHTML = this.dot(this.statusOf(t.id)) + '<span class="small"><b>' + esc(t.title) + '</b> <span class="muted">· ' + esc(MODS[t.module] ? modName(t.module) : 'Exam strategy') + ' · ' + esc(t.cat) + '</span></span>';
          row.onclick = () => this.openTopic(t.id);
          res.appendChild(row);
        });
        if (!list.length) res.appendChild(el('p', 'small muted', 'No matching topics.'));
      };
      inp.oninput = doSearch; msel.onchange = doSearch;
      msel.onchange = () => {
        csel.innerHTML = '<option value="all">All categories</option>';
        const mod = msel.value;
        if (mod !== 'all' && this.order[mod]) {
          const seen = {};
          this.order[mod].forEach(id => { const t2 = this.topics[id]; if (!seen[t2.catId]) { seen[t2.catId] = 1; csel.innerHTML += '<option value="' + t2.catId + '">' + esc(t2.cat) + '</option>'; } });
        }
        doSearch();
      };
      csel.onchange = doSearch;
      inp.oninput = doSearch;
      srow.append(inp, msel, csel);
      head.appendChild(srow);
      head.appendChild(res);
      v.appendChild(head);

      // module cards
      const grid = el('div', 'grid2');
      MOD_ORDER.forEach(mid => {
        const m = MODS[mid];
        const pr = this.progress(mid);
        const nEx = this.exCount(mid);
        const c = el('div', 'card');
        c.innerHTML = '<h3>' + esc(m.name) + '</h3><p class="small muted">' + esc((typeof DMATNotesContent !== 'undefined' && DMATNotesContent.CONTENT[mid].desc) || '') + '</p>' +
          '<p class="small">📚 ' + pr.total + ' topics · 🧪 ' + nEx + ' worked examples</p>' +
          '<div class="pbar" style="margin:6px 0"><div style="width:' + pr.pct + '%"></div></div>' +
          '<p class="small muted">Learning progress: ' + pr.pct + '% (' + pr.learned + ' learned, ' + (pr.total - pr.learned) + ' remaining)</p>';
        const row = el('div', 'row');
        const b1 = el('button', 'act', pr.learned ? 'Continue Learning' : 'Start Learning');
        b1.onclick = () => {
          const first = this.order[mid].find(id => this.statusOf(id) !== 'learned') || this.order[mid][0];
          this.openTopic(first);
        };
        const b2 = el('button', 'ghost', 'Browse notes');
        b2.onclick = () => this.go({ page: 'module', module: mid });
        row.append(b1, b2);
        c.appendChild(row);
        grid.appendChild(c);
      });
      // study-skills card
      const spr = this.progress('study');
      const sc = el('div', 'card');
      sc.innerHTML = '<h3>Exam Strategy &amp; Quick Revision <span class="badge">all modules</span></h3><p class="small muted">' + esc(DMATNotesContent.CONTENT.study.desc) + '</p>' +
        '<p class="small">📚 ' + spr.total + ' topics · pacing, the five-step routine, the universal mistake list, and how to run the timed simulation.</p>' +
        '<div class="pbar" style="margin:6px 0"><div style="width:' + spr.pct + '%"></div></div>';
      const srow2 = el('div', 'row');
      const sb1 = el('button', 'ghost', 'Open strategy notes');
      sb1.onclick = () => this.go({ page: 'module', module: 'study' });
      const sb2 = el('button', 'act', 'Quick Revision');
      sb2.onclick = () => this.go({ page: 'rev', module: 'all', dur: 5 });
      srow2.append(sb1, sb2);
      sc.appendChild(srow2);
      grid.appendChild(sc);
      v.appendChild(grid);

      // weak topics
      const wk = this.getWeakTopics();
      if (wk.weak.length || wk.done.length) {
        const wc = el('div', 'card');
        wc.innerHTML = '<h3>My mistakes &amp; recommended revision</h3><p class="small muted">Topics with ≥3 attempts and below 60% accuracy, linked to their notes. "Mark as improved" clears them from this list (your statistics stay untouched).</p>';
        wk.weak.slice(0, 6).forEach(e => {
          const r = el('div', 'trow');
          r.innerHTML = this.dot('p') + '<span class="small"><b>' + esc(e.topic.title) + '</b> <span class="muted">· ' + esc(modName(e.topic.module)) + ' · ' + e.wrong + ' wrong of ' + e.n + ' (' + e.acc + '%) · last ' + new Date(e.last).toLocaleDateString() + '</span></span>';
          const rr = el('div', 'row');
          const b1 = el('button', 'ghost', 'Revise');
          b1.onclick = () => this.openTopic(e.topicId);
          const b2 = el('button', 'ghost', 'Mark as improved');
          b2.onclick = () => { S.learning.weakImproved[e.topicId] = Date.now(); Save.mark(); this.render(v); };
          rr.style.margin = '4px 0';
          r.appendChild(rr); rr.append(b1, b2);
          wc.appendChild(r);
        });
        if (wk.done.length) wc.appendChild(el('p', 'small muted', '✔ ' + wk.done.length + ' topic(s) marked as improved.'));
        v.appendChild(wc);
      }

      // recent + bookmarks
      const rb = el('div', 'grid2');
      if (S.learning.recent.length) {
        const rc = el('div', 'card');
        rc.innerHTML = '<h3>Recently viewed</h3>';
        S.learning.recent.forEach(id => {
          const t = this.topics[id]; if (!t) return;
          const r = el('div', 'trow');
          r.innerHTML = this.dot(this.statusOf(id)) + '<span class="small">' + esc(t.title) + ' <span class="muted">· ' + esc(modName(t.module)) + '</span></span>';
          r.onclick = () => this.openTopic(id);
          rc.appendChild(r);
        });
        rb.appendChild(rc);
      }
      if (S.learning.bookmarks.length) {
        const bc = el('div', 'card');
        bc.innerHTML = '<h3>⭐ Bookmarked topics</h3>';
        S.learning.bookmarks.forEach(id => {
          const t = this.topics[id]; if (!t) return;
          const r = el('div', 'trow');
          r.innerHTML = this.dot(this.statusOf(id)) + '<span class="small">' + esc(t.title) + ' <span class="muted">· ' + esc(modName(t.module)) + '</span></span>';
          r.onclick = () => this.openTopic(id);
          bc.appendChild(r);
        });
        rb.appendChild(bc);
      }
      if (rb.children.length) v.appendChild(rb);

      // quick revision entry
      const qr = el('div', 'card');
      qr.innerHTML = '<h3>⚡ Quick Revision mode</h3><p class="small muted">Condensed rules, one-line technique summaries, key formulas and the top mistakes — pick a module or revise all three.</p>';
      const qrow = el('div', 'row');
      const qm = el('select', 'ghost'); qm.style.padding = '8px';
      qm.innerHTML = '<option value="all">All modules</option>' + MOD_ORDER.map(m => '<option value="' + m + '">' + MODS[m].name + '</option>').join('');
      const qd = el('select', 'ghost'); qd.style.padding = '8px';
      qd.innerHTML = '<option value="5">5-Minute Revision</option><option value="15">15-Minute Revision</option>';
      const qb = el('button', 'act', 'Start revision');
      qb.onclick = () => this.go({ page: 'rev', module: qm.value, dur: +qd.value });
      qrow.append(qm, qd, qb);
      qr.appendChild(qrow);
      v.appendChild(qr);
    },

    /* --------------------------- module notes page ------------------------- */
    renderModuleNotes(v, mid, topicId) {
      const isStudy = mid === 'study';
      const m = isStudy ? null : MODS[mid];
      const pr = this.progress(mid);
      const head = el('div', 'card');
      const back = el('button', 'ghost', '← Study Notes');
      back.onclick = () => this.go({ page: 'dashboard' });
      head.appendChild(back);
      head.appendChild(el('div', '', '<h2 style="display:inline">' + esc(isStudy ? 'Exam Strategy & Quick Revision' : m.name + ' — Notes') + '</h2> <span class="pill">' + pr.total + ' topics</span>'));
      head.appendChild(el('div', 'pbar', '<div style="width:' + pr.pct + '%"></div>'));
      head.appendChild(el('div', 'small muted', 'Learning progress: ' + pr.pct + '% · ' + pr.learned + ' learned · ' + pr.prog + ' in progress'));
      v.appendChild(head);

      const layout = el('div', 'snl');
      // sidebar
      const nav = el('div', 'card snav');
      const search = el('input', 'numinput'); search.style.fontSize = '13px'; search.style.width = '100%'; search.placeholder = 'Filter topics…';
      nav.appendChild(search);
      const navList = el('div');
      const renderNav = filter => {
        navList.innerHTML = '';
        const groups = {}; // cat title -> details element (raw titles; selectors break on '&')
        (this.order[mid] || []).filter(id => id !== '__deep__').forEach(id => {
          const t = this.topics[id];
          if (filter && t.search.indexOf(filter.toLowerCase()) < 0) return;
          let d = groups[t.cat];
          if (!d) {
            d = el('details', '', '<summary class="small" style="font-weight:700">' + esc(t.cat) + '</summary>');
            d.dataset.cat = t.cat; d.open = true;
            groups[t.cat] = d;
            navList.appendChild(d);
          }
          const row = el('div', 'trow' + (topicId === id ? ' cur' : ''));
          row.innerHTML = this.dot(this.statusOf(id)) + '<span class="small" style="flex:1">' + esc(t.title) + '</span>' +
            (S.learning.bookmarks.indexOf(id) >= 0 ? '<span class="wstar">⭐</span>' : '');
          row.onclick = () => this.openTopic(id);
          d.appendChild(row);
        });
      };
      renderNav('');
      search.oninput = () => renderNav(search.value.trim());
      nav.appendChild(navList);
      // content
      const content = el('div');
      layout.append(nav, content);
      v.appendChild(layout);
      const tid = topicId && this.topics[topicId] ? topicId : (this.order[mid] || [])[0];
      this.renderTopic(content, tid, mid, () => this.renderModuleNotes(v, mid, tid));
    },

    /* ------------------------------ topic page ----------------------------- */
    renderTopic(container, id, mid, rerender) {
      const t = this.topics[id];
      if (!t) return;
      this.touchRecent(id);
      container.innerHTML = '';
      const card = el('div', 'card');
      const status = this.statusOf(id);
      const marked = S.learning.bookmarks.indexOf(id) >= 0;
      card.appendChild(el('div', 'qhead', '<div><span class="pill class-' + (MODS[t.module] ? t.module : 'study') + '" style="visibility:hidden">.</span><span class="muted small">' + esc(t.cat) + '</span><h2 style="margin:4px 0">' + esc(t.title) + '</h2></div>'));
      const ctrl = el('div', 'row'); ctrl.style.marginBottom = '10px';
      [['not-started', 'Not started'], ['progress', 'In progress'], ['learned', 'Learned']].forEach(pair => {
        const b = el('button', status === pair[0] ? 'act' : 'ghost', pair[1]);
        b.onclick = () => { this.updateProgress(id, pair[0]); rerender ? rerender() : this.render(document.getElementById('view-notes')); };
        ctrl.appendChild(b);
      });
      const star = el('button', 'ghost', marked ? '⭐ Bookmarked' : '☆ Bookmark');
      star.onclick = () => { this.bookmarkTopic(id); this.renderTopic(container, id, mid, rerender); };
      ctrl.appendChild(star);
      card.appendChild(ctrl);
      // blocks
      t.blocks.forEach(bl => this.renderBlock(card, bl, t));
      // worked examples
      const exs = this.examplesFor(t);
      if (exs.length) {
        card.appendChild(el('h3', '', 'Worked examples (' + exs.length + ') — interactive'));
        const holder = el('div');
        card.appendChild(holder);
        this.renderWorkedExamples(holder, t, exs);
      }
      // prev / next
      const order = (this.order[mid] || []).filter(x => x !== '__deep__');
      const idx = order.indexOf(id);
      const nav = el('div', 'row'); nav.style.marginTop = '14px';
      const bp = el('button', 'ghost', '← Previous topic');
      bp.disabled = idx <= 0;
      bp.onclick = () => { const c2 = container; this.renderTopic(c2, order[idx - 1], mid, rerender); };
      const bn = el('button', 'act', idx >= order.length - 1 ? 'Back to dashboard' : 'Next topic →');
      bn.onclick = () => { if (idx >= order.length - 1) this.go({ page: 'dashboard' }); else this.renderTopic(container, order[idx + 1], mid, rerender); };
      nav.append(bp, bn);
      card.appendChild(nav);
      container.appendChild(card);
    },

    renderBlock(card, bl, t) {
      if (bl.p !== undefined) card.appendChild(el('div', 'small', esc(bl.p)));
      else if (bl.f !== undefined) card.appendChild(el('div', 'fbox', bl.f.map(esc).join('<br>')));
      else if (bl.b !== undefined) { const u = el('ul', 'small'); u.style.margin = '6px 0 6px 18px'; bl.b.forEach(x => u.appendChild(el('li', '', esc(x)))); card.appendChild(u); }
      else if (bl.ol !== undefined) { const o = el('ol', 'small'); o.style.margin = '4px 0 4px 22px'; bl.ol.forEach(x => o.appendChild(el('li', '', esc(x)))); card.appendChild(o); }
      else if (bl.h !== undefined) card.appendChild(el('div', 'small', '<b>' + esc(bl.h) + '</b>'));
      else if (bl.t !== undefined) { const u = el('ul', 'small oklist'); u.style.margin = '6px 0'; bl.t.forEach(x => u.appendChild(el('li', '', esc(x)))); card.appendChild(u); }
      else if (bl.w !== undefined) { const u = el('ul', 'small warnlist'); u.style.margin = '6px 0'; bl.w.forEach(x => u.appendChild(el('li', '', esc(x)))); card.appendChild(u); }
      else if (bl.sum !== undefined) card.appendChild(el('div', 'shortcut', esc(bl.sum)));
      else if (bl.svg !== undefined) { const w = el('div', '', bl.svg); if (bl.note) w.appendChild(el('div', 'small muted', esc(bl.note))); card.appendChild(w); }
      else if (bl.table !== undefined) {
        const tb = el('table', 'stat');
        tb.innerHTML = '<tr>' + bl.table.head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>';
        bl.table.rows.forEach(r => { tb.innerHTML += '<tr>' + r.map(cell => '<td>' + esc(cell) + '</td>').join('') + '</tr>'; });
        card.appendChild(tb);
      }
      else if (bl.walk !== undefined) {
        const q = this.findWalkQ(t.module, bl.walk);
        if (q) { const h = el('div'); this.renderWalkEx(h, q); card.appendChild(h); }
      }
      else if (bl.qex !== undefined && t.repQ) {
        card.appendChild(el('div', 'small', '<b>Representative example (verified question ' + esc(t.repQ.id) + ', ' + t.repQ.cls + '):</b>'));
        const h = el('div'); this.renderWalkEx(h, t.repQ); card.appendChild(h);
      }
    },

    /* --------------------- interactive worked examples --------------------- */
    renderWorkedExamples(holder, topic, list) {
      const state = { idx: 0, revealed: false };
      const paint = () => {
        const q = list[state.idx];
        holder.innerHTML = '';
        const bar = el('div', 'row');
        bar.appendChild(el('span', 'small', '<b>Example ' + (state.idx + 1) + ' of ' + list.length + '</b> · ' + esc(q.id) + ' (' + q.cls + ')'));
        const bT = el('button', 'ghost', state.revealed ? 'Hide explanation' : 'Show explanation');
        bT.onclick = () => { state.revealed = !state.revealed; paint(); };
        const bR = el('button', 'ghost', 'Retry');
        bR.onclick = () => { state.revealed = false; paint(); };
        const bU = el('button', state.revealed && S.learning.exDone[q.id] ? 'act' : 'ghost', S.learning.exDone[q.id] ? '✓ Understood' : 'Mark as Understood');
        bU.disabled = !state.revealed;
        bU.onclick = () => { S.learning.exDone[q.id] = Date.now(); Save.mark(); paint(); toast('Marked as understood.'); };
        const bP = el('button', 'ghost', '← Prev');
        bP.disabled = state.idx === 0;
        bP.onclick = () => { state.idx--; state.revealed = false; paint(); };
        const bN = el('button', 'ghost', 'Next →');
        bN.disabled = state.idx === list.length - 1;
        bN.onclick = () => { state.idx++; state.revealed = false; paint(); };
        bar.append(bP, bN, bT, bR, bU);
        holder.appendChild(bar);
        // question (no answer revealed until asked)
        const qw = el('div', 'qgridwrap'); qw.style.marginTop = '10px';
        const gw = el('div');
        const side = el('div', 'qside');
        if (q.module === 'math') {
          const lines = q.eqText.map((x, i) => '<div class="eqline" data-i="' + i + '">' + esc(x.split('ABCDEF'[q.target]).join('¤')) + '</div>').join('');
          gw.appendChild(el('div', 'eqcard', '<div class="eqlist small">' + lines.split('¤').join('<span class="qm">?</span>') + '</div>'));
          side.appendChild(el('div', 'qprompt', 'Which number replaces the question mark? (1–20)'));
        } else if (q.module === 'figures') {
          const fr = el('div', 'figrow');
          q.frames.forEach((f, i) => {
            const box = el('div', 'figframe' + (i === 5 ? ' q' : ''));
            box.innerHTML = frameSVG(q, i === 5 ? null : f, 48, i === 5);
            fr.appendChild(box);
            if (i < 5) fr.appendChild(el('span', 'arrowsep', '→'));
          });
          gw.appendChild(fr);
          side.appendChild(el('div', 'qprompt', 'Which figure replaces the question mark?'));
        } else {
          renderGrid(gw, q, {});
          side.appendChild(el('div', 'qprompt', 'Which letter replaces the question mark?'));
        }
        side.appendChild(el('div', 'small muted', 'Try it first — the worked solution is hidden.'));
        qw.append(gw, side);
        holder.appendChild(qw);
        if (state.revealed) {
          ansChip.innerHTML = '<b style="color:var(--green)">Final answer: ' + esc(q.answer) + '</b>';
          const ex = el('div', 'expl');
          const ol = el('ol', 'steps');
          q.steps.forEach((st, i) => {
            const li = el('li', '', '<span class="tname">Step ' + (i + 1) + '</span><div>' + esc(st.reason) + '</div>');
            if (q.module === 'latin') {
              const cells = (st.cells || []).filter(x => x >= 0);
              li.onmouseenter = () => { gw.innerHTML = ''; renderGrid(gw, q, { showAnswer: true, hlCells: cells }); };
              li.onclick = li.onmouseenter;
            }
            if (q.module === 'math' && st.eqIdx !== undefined) {
              li.onmouseenter = () => { const lines = qw.querySelectorAll('.eqlist .eqline'); lines.forEach((n, k) => n.style.background = k === st.eqIdx ? 'var(--hl2)' : ''); };
            }
            ol.appendChild(li);
          });
          ex.appendChild(ol);
          holder.appendChild(ex);
        }
      };
      paint();
    },

    /* ---------------------------- quick revision --------------------------- */
    renderQuickRevision(v, mid, dur) {
      v.innerHTML = '';
      const mods = mid === 'all' ? MOD_ORDER : [mid];
      const card = el('div', 'card');
      const back = el('button', 'ghost', '← Study Notes');
      back.onclick = () => this.go({ page: 'dashboard' });
      card.appendChild(back);
      card.appendChild(el('h2', '', '⚡ ' + (dur === 5 ? '5-Minute' : '15-Minute') + ' Revision — ' + (mid === 'all' ? 'all modules' : MODS[mid].name)));
      const chip = el('div', 'qtimer', (dur === 5 ? '5:00' : '15:00'));
      card.appendChild(chip);
      stopAllTimers();
      S.timers.qrev = startTimer(dur * 60, left => { chip.textContent = fmtClock(left); chip.classList.toggle('danger', left < 60); }, () => { chip.textContent = "Time's up — keep the page open and finish reading."; });
      const rev = (this.topics[mid + ':rev:rules'] || null);
      mods.forEach(mod => {
        const sec = el('div', 'techcard');
        sec.appendChild(el('h3', '', MODS[mod].name));
        const rules = this.topics[mod + ':rev:rules'];
        if (rules) rules.blocks.forEach(b => { if (b.b) { const u = el('ul', 'small'); u.style.margin = '4px 0 4px 18px'; b.b.forEach(x => u.appendChild(el('li', '', esc(x)))); sec.appendChild(u); } });
        const summaries = this.topicsOf(mod).filter(t => t.tech !== null && t.tech !== undefined);
        if (summaries.length) {
          sec.appendChild(el('div', 'small', '<b>Techniques in one line:</b>'));
          const u = el('ul', 'small'); u.style.margin = '4px 0 4px 18px';
          summaries.forEach(t => {
            const sum = ((t.blocks.filter(b => b.sum)[0] || {}).sum || '').replace(/^Quick revision: /, '');
            u.appendChild(el('li', '', '<b>' + esc(t.title.replace(/ \(T\d+\)$/, '')) + '</b> — ' + esc(sum)));
          });
          sec.appendChild(u);
        }
        const mistakes = this.topics[mod + ':rev:mistakes'];
        if (mistakes && dur === 15) {
          mistakes.blocks.forEach(b => { if (b.w) { const u = el('ul', 'small warnlist'); u.style.margin = '4px 0'; b.w.forEach(x => u.appendChild(el('li', '', esc(x)))); sec.appendChild(u); } });
        }
        if (dur === 15) {
          const steps = this.topicsOf(mod).filter(t => t.tech !== null && t.tech !== undefined).slice(0, 8);
          sec.appendChild(el('div', 'small', '<b>Key steps (first two of each technique):</b>'));
          const u = el('ul', 'small'); u.style.margin = '4px 0 4px 18px';
          steps.forEach(t => {
            const stp = t.blocks.filter(b => b.ol).map(b => b.ol[0]);
            u.appendChild(el('li', '', '<b>' + esc(t.title.replace(/ \(T\d+\)$/, '')) + '</b>: ' + esc(stp.join(' → '))));
          });
          sec.appendChild(u);
        }
        if (dur === 15) {
          const walkTopic = this.topicsOf(mod).find(t => t.walk || t.repQ);
          if (walkTopic) {
            const exs = this.examplesFor(walkTopic);
            if (exs.length) {
              sec.appendChild(el('div', 'small', '<b>One worked example to re-read (' + esc(exs[0].id) + '):</b>'));
              const h = el('div'); this.renderWalkEx(h, exs[0]); sec.appendChild(h);
            }
          }
        }
        card.appendChild(sec);
      });
      const row = el('div', 'row');
      const b5 = el('button', dur === 5 ? 'act' : 'ghost', 'Switch to 5-minute');
      b5.onclick = () => this.go({ page: 'rev', module: mid, dur: 5 });
      const b15 = el('button', dur === 15 ? 'act' : 'ghost', 'Switch to 15-minute');
      b15.onclick = () => this.go({ page: 'rev', module: mid, dur: 15 });
      const bb = el('button', 'ghost', '← Study Notes');
      bb.onclick = () => this.go({ page: 'dashboard' });
      row.append(b5, b15, bb);
      card.appendChild(row);
      v.appendChild(card);
    },

    /* ------------------------- verified walkthrough ------------------------ */
    renderWalkEx(container, q) {
      const wrap = el('div', 'qgridwrap');
      const gw = el('div');
      const side = el('div', 'qside');
      if (q.module === 'math') {
        const lines = q.eqText.map((x, i) => '<div class="eqline" data-i="' + i + '">' + esc(x) + '</div>').join('');
        gw.appendChild(el('div', 'eqcard', '<div class="eqlist small">' + lines + '</div>'));
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
      q.steps.forEach((st, i) => {
        const li = el('li', '', '<span class="tname">Step ' + (i + 1) + '</span><div>' + esc(st.reason) + '</div>');
        if (q.module === 'latin') {
          const cells = (st.cells || []).filter(x => x >= 0);
          li.onmouseenter = () => { gw.innerHTML = ''; renderGrid(gw, q, { showAnswer: true, hlCells: cells }); };
          li.onclick = li.onmouseenter;
        }
        if (q.module === 'math' && st.eqIdx !== undefined) {
          li.onmouseenter = () => { const L = gw.querySelectorAll('.eqline'); for (let k = 0; k < L.length; k++) L[k].style.background = k === st.eqIdx ? 'var(--hl2)' : ''; };
        }
        ol.appendChild(li);
      });
      side.appendChild(ol);
      wrap.append(gw, side);
      container.appendChild(wrap);
    }
  };
  return SN;
});
