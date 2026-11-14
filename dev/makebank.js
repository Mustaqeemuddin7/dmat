/* ============================================================================
   makebank.js — builds and validates ALL THREE module banks in Node.
   Run:  node dev/makebank.js
   Output: dev/bank.json  (embedded into the final HTML by dev/build.js)

   Modules:
     latin   : Easy..Extreme via core.buildQuestionBank (seed 20261106 — the
               SAME seed and code path as v1, so those 200 questions are
               reproduced byte-identically), then Master via buildMasterBank
               on a separate RNG stream (existing questions untouched).
     math    : MathEq.buildBank (5 classes x 50).
     figures : FigSeq.buildBank (5 classes x 50).

   A regression gate compares the rebuilt Easy..Extreme Latin Squares bank
   against dev/bank-v1-reference.json and FAILS the build on any difference.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./core.js');
const M = require('./math.js');
const F = require('./figures.js');

const SEED = 20261106;
const VERSION = '2.0.0';

function qHash(questions) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(questions.map(q => [q.id, q.grid, q.target, q.answer, q.steps])))
    .digest('hex').slice(0, 16);
}

function main() {
  const t0 = Date.now();
  const classes = ['Easy', 'Medium', 'Hard', 'Extreme', 'Master'];
  console.log('Building question banks (seed ' + SEED + ')...');

  /* ---------------- 1. Latin Squares: Easy..Extreme (v1 code path) ------- */
  const ls = C.buildQuestionBank({ seed: SEED, perClass: 50 });

  /* ---------------- 2. regression gate against the v1 reference ---------- */
  const refPath = path.join(__dirname, 'bank-v1-reference.json');
  if (fs.existsSync(refPath)) {
    const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
    const refQs = ref.questions ? ref.questions : null;
    if (refQs && refQs.length) {
      // serialize the rebuilt core questions EXACTLY like the reference store
      const rebuilt = classes.filter(c => c !== 'Master').flatMap(c => ls.bank[c]).map(q =>
        [q.id, Array.from(q.grid).map(v => v === 0 ? null : C.LTR[v - 1]), q.target, C.LTR[q.answer - 1], q.steps]);
      const a = crypto.createHash('sha256').update(JSON.stringify(rebuilt)).digest('hex').slice(0, 16);
      const b = crypto.createHash('sha256')
        .update(JSON.stringify(refQs.map(q => [q.id, q.grid, q.target, q.answer, q.steps]))).digest('hex').slice(0, 16);
      console.log('Regression gate: rebuilt v1 hash ' + a + ' vs reference ' + b + (a === b ? '  [IDENTICAL]' : '  [MISMATCH]'));
      if (a !== b) {
        console.error('FATAL: existing questions changed — aborting so nothing is silently overwritten.');
        process.exit(3);
      }
    }
  }

  /* ---------------- 3. Latin Squares: Master (new, separate stream) ------ */
  const master = C.buildMasterBank({ seed: SEED + 777, seenKeys: ls.seenKeys, perClass: 50 });
  ls.bank.Master = master.bank;

  /* ---------------- 4. Mathematical Equations ---------------------------- */
  const math = M.buildBank({ seed: 90210, perClass: 50 });

  /* ---------------- 5. Figure Sequences ---------------------------------- */
  const figures = F.buildBank({ seed: 31337, perClass: 50 });

  /* ---------------- 6. independent final audit --------------------------- */
  const audit = { total: 0, failed: [], dupKeys: new Set(), duplicates: 0, perModule: {} };
  function auditFail(id, why) { audit.failed.push(id + ': ' + why); }

  classes.forEach(cls => (ls.bank[cls] || []).forEach(q => {
    audit.total++;
    audit.perModule.latin = (audit.perModule.latin || 0) + 1;
    // core-format question: Int8Array grid, numeric answer
    const e1 = C.validatePuzzle(q.grid, q.target, q.solution, q.answer);
    if (e1.length) auditFail(q.id, 'grid ' + e1.join(';'));
    const ua = C.validateUniqueAnswer(q.grid, q.target);
    if (!ua.unique || ua.answer !== q.answer) auditFail(q.id, 'uniqueness');
    const e3 = C.validateSolutionTrace(q.grid, q.target, q.steps, q.answer);
    if (e3.length) auditFail(q.id, 'trace ' + e3.join(';'));
    const key = C.canonicalKey(q.grid, q.target);
    if (audit.dupKeys.has(key)) { audit.duplicates++; auditFail(q.id, 'duplicate'); }
    audit.dupKeys.add(key);
    if (cls !== 'Master') {
      const cl = C.classifyPuzzle({ solved: true, steps: q.steps.map(uncompact), totalPhantoms: q.phantoms });
      if (cl.cls !== cls) auditFail(q.id, 'class mismatch ' + cl.cls);
    } else {
      const tr = { solved: true, steps: q.steps.map(uncompact), totalPhantoms: q.phantoms };
      if (!C.classifyMaster(tr)) auditFail(q.id, 'not Master-qualified');
    }
  }));
  math.questions.forEach(q => {
    audit.total++;
    audit.perModule.math = (audit.perModule.math || 0) + 1;
    const rows = q.eqs.map(e => M.eqRow(e, q.k));
    if (M.rankOf(rows, q.k) !== q.k) auditFail(q.id, 'rank < k (ambiguous)');
    const tr = M.buildTrace(q.eqs, q.k, q.values);
    if (!tr.ok || tr.steps.length !== q.steps.length) auditFail(q.id, 'trace replay');
    if (q.values[q.target] !== parseInt(q.answer, 10)) auditFail(q.id, 'answer mismatch');
    if (q.values.some(v => v < 1 || v > 20)) auditFail(q.id, 'value out of 1..20');
    if (q.k <= 4) {
      const bf = M.bruteForceSolutions(rows, q.k, 400000);
      if (!bf.capped && bf.solutions.length !== 1) auditFail(q.id, 'brute force non-unique');
    }
    const key = M.canonicalKey(q);
    if (audit.dupKeys.has(key)) { audit.duplicates++; auditFail(q.id, 'duplicate'); }
    audit.dupKeys.add(key);
  });
  figures.questions.forEach(q => {
    audit.total++;
    audit.perModule.figures = (audit.perModule.figures || 0) + 1;
    const errs = F.validateQuestion(q);
    if (errs.length) auditFail(q.id, errs.join(';'));
    const key = JSON.stringify([q.rules, q.elems0.map(e => Array.isArray(e) ? e.slice(0, 6) : e)]);
    if (audit.dupKeys.has(key)) { audit.duplicates++; auditFail(q.id, 'duplicate'); }
    audit.dupKeys.add(key);
  });
  function uncompact(s) {
    return { fill: s.fill >= 0 ? s.fill : undefined, letter: s.letter, tech: s.tech, techs: s.techs,
             reason: s.reason, cells: s.cells, phantom: s.phantom, removed: s.removed, data: s.data };
  }

  /* ---------------- 7. assemble bank.json -------------------------------- */
  const out = {
    meta: {
      version: VERSION, seed: SEED, builtAt: new Date().toISOString(),
      latinV1Hash: (function () {
        const ref = fs.existsSync(refPath) ? JSON.parse(fs.readFileSync(refPath, 'utf8')) : null;
        if (!ref) return null;
        return crypto.createHash('sha256')
          .update(JSON.stringify(ref.questions.map(q => [q.id, q.grid, q.target, q.answer, q.steps]))).digest('hex').slice(0, 16);
      })(),
      counts: {
        latin: Object.fromEntries(classes.map(c => [c, (ls.bank[c] || []).length])),
        math: Object.fromEntries(classes.map(c => [c, math.questions.filter(q => q.cls === c).length])),
        figures: Object.fromEntries(classes.map(c => [c, figures.questions.filter(q => q.cls === c).length]))
      },
      totals: { latin: classes.reduce((s, c) => s + (ls.bank[c] || []).length, 0), math: math.questions.length, figures: figures.questions.length },
      validated: audit.total - audit.failed.length,
      duplicates: audit.duplicates
    },
    latin: {
      report: {
        perClass: Object.fromEntries(classes.map(c => [c, (ls.bank[c] || []).length])),
        perType: countBy(latinQuestions(), q => q.type),
        perTech: countBy(latinQuestions(), q => q.techs, true),
        master: master.report,
        base: ls.report
      },
      examples: buildLatinExamples(ls.bank),
      questions: latinQuestions()
    },
    math: { report: math.report, questions: math.questions },
    figures: { report: figures.report, questions: figures.questions }
  };

  function latinQuestions() {
    return classes.flatMap(c => (ls.bank[c] || []).map(q => ({
      id: q.id, module: 'latin', cls: q.cls, type: q.type,
      grid: Array.from(q.grid).map(v => v === 0 ? null : C.LTR[v - 1]),
      solution: Array.from(q.solution).map(v => C.LTR[v - 1]),
      target: q.target, answer: C.LTR[q.answer - 1],
      givens: q.givens, crossSeen: q.crossSeen,
      steps: q.steps, stepsCount: q.stepsCount,
      phantoms: q.phantoms, maxPhantomRun: q.maxPhantomRun,
      techs: q.techs, validated: true
    })));
  }
  function countBy(arr, fn, flat) {
    const m = {};
    arr.forEach(q => {
      const ks = fn(q);
      (flat ? ks : [ks]).forEach(k => m[k] = (m[k] || 0) + 1);
    });
    return m;
  }
  function buildLatinExamples(bank) {
    const examples = {};
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17].forEach(t => { examples[t] = null; });
    classes.forEach(cls => (bank[cls] || []).forEach(q => {
      q.steps.forEach((s, idx) => s.techs.forEach(t => { if (examples[t] === null) examples[t] = { qref: q.id, stepIdx: idx, cls: cls, type: q.type }; }));
    }));
    if (!examples[7]) { const q = bank.Master.find(q => q.type === 'g') || bank.Extreme.find(q => q.type === 'g'); if (q) examples[7] = { qref: q.id, stepIdx: 0, cls: q.cls, type: q.type }; }
    if (!examples[9]) { const q = bank.Hard.find(q => q.stepsCount >= 4); if (q) examples[9] = { qref: q.id, stepIdx: 0, cls: q.cls, type: q.type }; }
    if (!examples[16]) { const q = bank.Easy[0]; if (q) examples[16] = { qref: q.id, stepIdx: 0, cls: q.cls, type: q.type }; }
    if (!examples[17]) { const q = bank.Medium.find(q => q.type === 'b'); if (q) examples[17] = { qref: q.id, stepIdx: 0, cls: q.cls, type: q.type }; }
    // exotic techniques not needed by any bank question: standalone search
    [13, 14, 15].forEach(t => {
      if (examples[t]) return;
      const rng = C.mulberry32(SEED + t);
      for (let a = 0; a < 150000 && !examples[t]; a++) {
        const sq = C.generateLatinSquare(rng);
        const target = Math.floor(rng() * 25);
        const vis = new Int8Array(25);
        for (let i = 0; i < 25; i++) if (i !== target && rng() < 0.42) vis[i] = sq[i];
        const tr = C.solveWithSteps(vis, target);
        if (!tr.solved) continue;
        const idx = tr.steps.findIndex(s => s.tech === t);
        if (idx >= 0) examples[t] = { grid: Array.from(vis), target, answer: tr.answer,
          steps: tr.steps.slice(0, idx + 1).map(s => ({ fill: s.fill === undefined ? -1 : s.fill, letter: s.letter || 0, tech: s.tech, techs: s.techs, reason: s.reason, cells: s.cells || [], phantom: !!s.phantom, removed: s.removed || [], data: s.data || null })), cls: 'Extreme', type: 'j', standalone: true };
      }
    });
    if (!examples[14]) {
      const rng = C.mulberry32(SEED + 1400);
      outer:
      for (let a = 0; a < 200000 && !examples[14]; a++) {
        const sq = C.generateLatinSquare(rng);
        const r = Math.floor(rng() * 5);
        const vis = Int8Array.from(sq);
        for (let c = 0; c < 5; c++) vis[r * 5 + c] = 0;
        for (let i = 0; i < 25; i++) if (i < r * 5 || i >= r * 5 + 5) { if (rng() < 0.5) vis[i] = 0; }
        const st = C.makeState(vis);
        const cells = [0, 1, 2, 3, 4].map(kk => r * 5 + kk);
        const empty = cells.filter(i => !st.vals[i]);
        if (empty.length < 3) continue;
        const spots = {};
        for (let v = 1; v <= 5; v++) spots[v] = empty.filter(i => st.cand[i] & C.bit(v));
        for (let x = 1; x <= 5; x++) for (let y = x + 1; y <= 5; y++) {
          if (spots[x].length === 2 && spots[y].length === 2 && spots[x][0] === spots[y][0] && spots[x][1] === spots[y][1]) {
            examples[14] = { grid: Array.from(vis), target: -1, answer: 0, patternDemo: true, pairCells: spots[x], pairLetters: [x, y],
              reason: 'Hidden-pair pattern: in row ' + (r + 1) + ', letters ' + C.LTR[x - 1] + ' and ' + C.LTR[y - 1] +
                ' can each go only in ' + spots[x].map(i => 'column ' + ((i % 5) + 1)).join(' and ') +
                '. Those two cells are therefore reserved for {' + C.LTR[x - 1] + ',' + C.LTR[y - 1] + '}.',
              cls: 'Extreme', type: 'j', standalone: true };
            break outer;
          }
        }
      }
    }
    return examples;
  }

  fs.writeFileSync(path.join(__dirname, 'bank.json'), JSON.stringify(out));

  /* ---------------- 8. report -------------------------------------------- */
  console.log('\n================ BANK REPORT ================');
  console.log('Build time: ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log('Latin Squares : ' + JSON.stringify(out.meta.counts.latin) + ' = ' + out.meta.totals.latin);
  console.log('  per type    : ' + JSON.stringify(out.latin.report.perType));
  console.log('  Master build: ' + master.report.generated + ' accepted, ' + master.report.rejected +
              ' rejected (' + master.report.notMaster + ' solvable-but-not-Master), ' + master.report.duplicates + ' duplicates, attempts ' + master.attempts);
  console.log('Math Equations: ' + JSON.stringify(out.meta.counts.math) + ' = ' + out.meta.totals.math);
  console.log('  per type    : ' + JSON.stringify(math.report.perType));
  console.log('  notes       : ' + (math.report.notes.join('; ') || 'none'));
  console.log('Figure Sequences: ' + JSON.stringify(out.meta.counts.figures) + ' = ' + out.meta.totals.figures);
  console.log('  per type    : ' + JSON.stringify(figures.report.perType));
  console.log('  notes       : ' + (figures.report.notes.join('; ') || 'none'));
  console.log('Audited       : ' + audit.total + ' questions, failures: ' + audit.failed.length +
              (audit.failed.length ? ' -> ' + audit.failed.slice(0, 8).join(' | ') : ''));
  console.log('Duplicates    : ' + audit.duplicates);
  const okAll = classes.every(c => (ls.bank[c] || []).length === 50) &&
                classes.every(c => math.questions.filter(q => q.cls === c).length === 50) &&
                classes.every(c => figures.questions.filter(q => q.cls === c).length === 50) &&
                audit.failed.length === 0;
  console.log(okAll ? 'RESULT: OK — 750 validated questions (3 modules x 5 classes x 50).' : 'RESULT: SHORTFALL OR AUDIT FAILURE — see above.');
  console.log('=============================================');
  if (!okAll) process.exitCode = 2;
}
main();
