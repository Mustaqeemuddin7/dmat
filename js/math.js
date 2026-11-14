/* ============================================================================
   dMAT Core Module — Mathematical Equations engine (shared Node + browser)
   ----------------------------------------------------------------------------
   Official format (testas.de / g.a.s.t., digital TestAS Core Module):
   "You solve systems of equations, finding which numbers fit the unknown
   letters to make the equations fit. There is one unique solution per letter.
   Each letter can take a value between 1 and 20." It is the one subtest that
   is NOT single-choice — answers are worked out. This engine therefore asks
   for a NUMBER (1-20), not a letter button.

   Representation
   --------------
   An equation is stored in display form:
     { lhs: [[coef, li], ...], rhs: [[coef, li], ...], rhsConst: n }
   meaning  sum(coef*letter) + ...  =  sum(coef*letter) + ... + n
   e.g. "2A + B = C + 7". For solving it becomes the linear row
     sum((lhsCoef - rhsCoef)*v) = rhsConst.

   Uniqueness is PROVEN, not assumed: full-rank Gaussian elimination over the
   rows shows exactly one real solution exists; the row values are then
   re-checked exactly with integers. For k <= 4 letters a full brute-force
   sweep over 1..20 is run as an additional independent check.

   The human trace uses two mechanisms:
     - substitution: an equation with exactly one unknown letter
     - elimination: two equations whose only unknowns are the same pair
       {x, y} — combined with small multipliers to isolate one letter.
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.MathEq = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LTR = ['A', 'B', 'C', 'D', 'E', 'F'];

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ri(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
  function shuffle(arr, rng) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  /* --------------------------- display helpers --------------------------- */
  function sideText(terms) {
    if (!terms.length) return '0';
    var out = '';
    terms.forEach(function (t, i) {
      var c = t[0], body = (Math.abs(c) === 1 ? '' : Math.abs(c)) + LTR[t[1]];
      if (i === 0) out += (c < 0 ? '-' : '') + body;
      else out += (c < 0 ? ' - ' : ' + ') + body;
    });
    return out;
  }
  function eqText(eq) {
    var rhs = sideText(eq.rhs);
    if (eq.rhsConst) rhs = (rhs === '0' ? '' : rhs + ' + ') + eq.rhsConst;
    return sideText(eq.lhs) + ' = ' + rhs;
  }
  function eqLetters(eq) {
    var s = {};
    eq.lhs.concat(eq.rhs).forEach(function (t) { s[t[1]] = 1; });
    return Object.keys(s).map(Number);
  }
  // solve-form row: [c0..c(k-1)] , d  with sum(c_i v_i) = d
  function eqRow(eq, k) {
    var c = new Array(k).fill(0);
    eq.lhs.forEach(function (t) { c[t[1]] += t[0]; });
    eq.rhs.forEach(function (t) { c[t[1]] -= t[0]; });
    return { c: c, d: eq.rhsConst };
  }

  /* --------------------- independent uniqueness check -------------------- */
  // Full-rank Gaussian elimination: rank k  =>  exactly one real solution.
  function rankOf(rows, k) {
    var m = rows.map(function (r) { return r.c.slice(); });
    var rank = 0;
    for (var col = 0; col < k && rank < m.length; col++) {
      var piv = -1;
      for (var r = rank; r < m.length; r++) if (Math.abs(m[r][col]) > 1e-9) { piv = r; break; }
      if (piv < 0) continue;
      var tmp = m[rank]; m[rank] = m[piv]; m[piv] = tmp;
      var pv = m[rank][col];
      for (var r2 = 0; r2 < m.length; r2++) {
        if (r2 === rank || Math.abs(m[r2][col]) < 1e-12) continue;
        var f = m[r2][col] / pv;
        for (var c2 = col; c2 < k; c2++) m[r2][c2] -= f * m[rank][c2];
      }
      rank++;
    }
    return rank;
  }
  // brute force over 1..20 with early pruning (extra independent check)
  function bruteForceSolutions(rows, k, cap) {
    var found = [], nodes = 0;
    // order letters by fewest appearances for pruning
    function rec(vals) {
      if (found.length >= 2) return;
      var i = vals.length;
      if (i === k) {
        for (var r = 0; r < rows.length; r++) {
          var s = 0; for (var c = 0; c < k; c++) s += rows[r].c[c] * vals[c];
          if (s !== rows[r].d) return;
        }
        found.push(vals.slice()); return;
      }
      for (var v = 1; v <= 20; v++) {
        if (nodes++ > cap) return;
        vals.push(v);
        // prune: check rows fully covered by assigned letters
        var ok = true;
        for (var r2 = 0; r2 < rows.length && ok; r2++) {
          var covered = true, s2 = 0;
          for (var c2 = 0; c2 < k; c2++) {
            if (rows[r2].c[c2] !== 0 && c2 >= i + 1) { covered = false; break; }
            if (c2 < i + 1) s2 += rows[r2].c[c2] * vals[c2];
          }
          if (covered && s2 !== rows[r2].d) ok = false;
        }
        if (ok) rec(vals);
        vals.pop();
        if (found.length >= 2) return;
      }
    }
    rec([]);
    return { solutions: found, capped: nodes > cap };
  }

  /* ------------------------------- trace -------------------------------- */
  // Greedy substitution + (if needed) one elimination block per stuck pair.
  // Returns {ok, steps} where steps: [{kind, letter, value, eqIdx/eqs, reason}]
  function buildTrace(eqs, k, values) {
    var known = {}, steps = [], used = {};
    var guard = 0;
    while (Object.keys(known).length < k && guard++ < 40) {
      var progressed = false;
      for (var e = 0; e < eqs.length && !progressed; e++) {
        if (used[e]) continue;
        var ls = eqLetters(eqs[e]).filter(function (li) { return !(li in known); });
        if (ls.length !== 1) continue;
        var li = ls[0], row = eqRow(eqs[e], k);
        var s = row.d;
        eqLetters(eqs[e]).forEach(function (t) { if (t !== li) s -= row.c[t] * known[t]; });
        if (row.c[li] === 0 || s % row.c[li] !== 0) return { ok: false };
        var v = s / row.c[li];
        if (v < 1 || v > 20) return { ok: false };
        var other = eqLetters(eqs[e]).filter(function (t) { return t !== li; });
        var reason;
        if (!other.length) {
          reason = 'Equation ' + (e + 1) + ' (' + eqText(eqs[e]) + ') contains only ' + LTR[li] + ', so ' + LTR[li] + ' = ' + v + '.';
        } else {
          reason = 'Equation ' + (e + 1) + ' (' + eqText(eqs[e]) + '): every letter except ' + LTR[li] +
            ' is already known (' + other.map(function (t) { return LTR[t] + ' = ' + known[t]; }).join(', ') +
            '), so ' + LTR[li] + ' = ' + v + '.';
        }
        known[li] = v; used[e] = 1;
        steps.push({ kind: 'equation', letter: li, value: v, eqIdx: e, reason: reason });
        progressed = true;
      }
      if (!progressed) {
        // elimination: two unused equations whose unknown letters are the same pair {x,y}
        var done = false;
        for (var a = 0; a < eqs.length && !done; a++) {
          if (used[a]) continue;
          var la = eqLetters(eqs[a]).filter(function (li2) { return !(li2 in known); });
          if (la.length !== 2) continue;
          for (var b = a + 1; b < eqs.length && !done; b++) {
            if (used[b]) continue;
            var lb = eqLetters(eqs[b]).filter(function (li3) { return !(li3 in known); });
            if (lb.length !== 2 || lb[0] !== la[0] || lb[1] !== la[1]) continue;
            var ra = eqRow(eqs[a], k), rb = eqRow(eqs[b], k);
            var x = la[0], y = la[1];
            // try small multipliers m1*rA + m2*rB to cancel y — smallest first,
            // then normalised so the first multiplier is positive
            var combo = null;
            for (var S = 2; S <= 8 && !combo; S++) {
              for (var m1 = 1; m1 < S && !combo; m1++) {
                var m2 = S - m1;
                [1, -1].forEach(function (sign) {
                  if (combo) return;
                  var M1 = m1 * sign, M2 = m2 * sign;
                  if (ra.c[y] * M1 + rb.c[y] * M2 !== 0) return;
                  var cx = ra.c[x] * M1 + rb.c[x] * M2;
                  var dx = ra.d * M1 + rb.d * M2;
                  if (cx === 0 || dx % cx !== 0) return;
                  var vx = dx / cx;
                  if (vx < 1 || vx > 20 || vx !== values[x]) return;
                  combo = { m1: M1, m2: M2, vx: vx };
                });
              }
            }
            if (!combo) continue;
            if (combo.m1 < 0) { combo.m1 = -combo.m1; combo.m2 = -combo.m2; }
            var verb = combo.m2 > 0 ? 'Adding' : 'Subtracting';
            var m1s = combo.m1 === 1 ? '' : combo.m1 + '×';
            var m2s = Math.abs(combo.m2) === 1 ? '' : Math.abs(combo.m2) + '×';
            var vy = (ra.d - ra.c[x] * combo.vx) / ra.c[y];
            if (vy < 1 || vy > 20 || !Number.isInteger(vy)) continue;
            used[a] = 1; used[b] = 1;
            var comboText = combo.m2 > 0
              ? 'Adding ' + m1s + 'Equation ' + (a + 1) + ' and ' + m2s + 'Equation ' + (b + 1)
              : 'Subtracting ' + m2s + 'Equation ' + (b + 1) + ' from ' + m1s + 'Equation ' + (a + 1);
            steps.push({
              kind: 'elimination', letter: x, value: combo.vx, eqIdx: a, eqIdx2: b,
              reason: 'Equations ' + (a + 1) + ' and ' + (b + 1) + ' are the only ones still containing ' +
                LTR[x] + ' and ' + LTR[y] + '. ' + comboText + ' cancels ' + LTR[y] +
                ' and gives ' + LTR[x] + ' = ' + combo.vx + '.'
            });
            steps.push({
              kind: 'equation', letter: y, value: vy, eqIdx: a,
              reason: 'Back into Equation ' + (a + 1) + ' (' + eqText(eqs[a]) + ') with ' + LTR[x] + ' = ' + combo.vx +
                ': ' + LTR[y] + ' = ' + vy + '.'
            });
            known[x] = combo.vx; known[y] = vy;
            done = true;
          }
        }
        if (!done) return { ok: false };
      }
    }
    return { ok: Object.keys(known).length === k, steps: steps, known: known };
  }

  /* ----------------------------- generator ------------------------------- */
  // CLASS PROFILES — thresholds the generated system must actually meet.
  // Every letter is solved exactly once, so the trace length == k; the real
  // difficulty knobs are: letter count (k), how many letters are ONLY jointly
  // determined by an elimination PAIR (elim pairs), operation kinds, value
  // range and the number of extra interlocking equations.
  var PROFILES = {
    Easy:    { k: [2, 2], elim: [0, 0], mul: false, sub: false, vmax: 10, mExtra: [0, 0] },
    Medium:  { k: [2, 3], elim: [0, 0], mul: false, sub: true,  vmax: 12, mExtra: [0, 0] },
    Hard:    { k: [3, 4], elim: [0, 1], mul: true,  sub: true,  vmax: 15, mExtra: [0, 1] },
    Extreme: { k: [4, 5], elim: [1, 2], mul: true,  sub: true,  vmax: 20, mExtra: [0, 1] },
    Master:  { k: [5, 6], elim: [1, 2], mul: true,  sub: true,  vmax: 20, mExtra: [1, 2] }
  };

  function generateQuestion(rng, cls) {
    var P = PROFILES[cls];
    for (var attempt = 0; attempt < 80; attempt++) {
      var k = ri(rng, P.k[0], P.k[1]);
      var elimPairs = ri(rng, P.elim[0], P.elim[1]);
      if (k - 2 * elimPairs < 1) elimPairs = Math.floor((k - 1) / 2); // keep >=1 direct letter
      var pool = []; for (var v = 1; v <= P.vmax; v++) pool.push(v);
      shuffle(pool, rng);
      var values = pool.slice(0, k); // distinct values keep systems readable
      var shuffled = shuffle([...Array(k).keys()], rng);
      // individuals first, elimination pairs at the end (order = solve order)
      var nIndiv = k - 2 * elimPairs;
      var order = shuffled.slice(0, nIndiv);
      for (var pI = 0; pI < elimPairs; pI++) order.push(shuffled[nIndiv + 2 * pI], shuffled[nIndiv + 2 * pI + 1]);
      var eqs = [];

      for (var oi = 0; oi < order.length; oi++) {
        var li = order[oi], v = values[li];
        var knownIdx = order.slice(0, oi);
        // elimination-pair letters (they sit at even offsets from nIndiv)
        if (oi >= nIndiv && (oi - nIndiv) % 2 === 0) {
          var li2 = order[oi + 1], v2 = values[li2];
          var hi = v > v2 ? [li, li2] : [li2, li]; // x - y = positive constant
          eqs.push({ lhs: [[1, hi[0]], [1, hi[1]]], rhs: [], rhsConst: values[hi[0]] + values[hi[1]] });
          eqs.push({ lhs: [[1, hi[0]], [-1, hi[1]]], rhs: [], rhsConst: values[hi[0]] - values[hi[1]] });
          oi++; // the partner letter is handled by this pair
          continue;
        }
        if (oi === 0) {
          if (P.mul && rng() < 0.4) {
            var m = ri(rng, 2, 3);
            eqs.push({ lhs: [[m, li]], rhs: [], rhsConst: m * v });
          } else {
            eqs.push({ lhs: [[1, li]], rhs: [], rhsConst: v });
          }
          continue;
        }
        var style = pickStyle(rng, P);
        var p = knownIdx[ri(rng, 0, knownIdx.length - 1)], vp = values[p];
        if (style === 'add') {
          // x + p = c   (or  x = p + q)
          if (rng() < 0.3 && knownIdx.length >= 2) {
            var q = knownIdx[ri(rng, 0, knownIdx.length - 1)];
            if (q === p) continue;
            eqs.push({ lhs: [[1, li]], rhs: [[1, p], [1, q]], rhsConst: 0 });
          } else eqs.push({ lhs: [[1, li], [1, p]], rhs: [], rhsConst: v + vp });
        } else if (style === 'sub') {
          if (v > vp) eqs.push({ lhs: [[1, li]], rhs: [[1, p]], rhsConst: v - vp });
          else if (vp > v) eqs.push({ lhs: [[1, p]], rhs: [[1, li]], rhsConst: vp - v });
          else continue;
        } else { // mul
          var m2 = ri(rng, 2, 3);
          if (v * m2 <= 20 && rng() < 0.5) eqs.push({ lhs: [[m2, li]], rhs: [], rhsConst: v * m2 });
          else if (v * m2 - vp >= 1) eqs.push({ lhs: [[m2, li]], rhs: [[1, p]], rhsConst: v * m2 - vp });
          else if (vp % m2 === 0 && vp / m2 >= 1) eqs.push({ lhs: [[1, li]], rhs: [[m2, p]], rhsConst: 0 });
          else continue;
        }
      }
      // extra (redundant) true equations for density
      var extra = ri(rng, P.mExtra[0], P.mExtra[1]);
      for (var x2 = 0; x2 < extra; x2++) {
        var ts = [];
        var c = 0;
        for (var li2b = 0; li2b < k; li2b++) {
          if (rng() < 0.4) {
            var cc = ri(rng, 1, 2);
            ts.push([cc, li2b]); c += cc * values[li2b];
          }
        }
        if (ts.length >= 2 && c <= 60) eqs.push({ lhs: ts, rhs: [], rhsConst: c });
      }
      if (eqs.length < k) continue;
      shuffle(eqs, rng);

      // independent verification 1: full rank => unique real solution
      var rows = eqs.map(function (e) { return eqRow(e, k); });
      if (rankOf(rows, k) !== k) continue;
      // verification 2: the known values satisfy every row exactly
      var consistent = rows.every(function (r) {
        var s = 0; for (var i = 0; i < k; i++) s += r.c[i] * values[i];
        return s === r.d;
      });
      if (!consistent) continue;
      // verification 3: independent brute force for small k
      if (k <= 4) {
        var bf = bruteForceSolutions(rows, k, 400000);
        if (!(bf.solutions.length === 1 && !bf.capped && bf.solutions[0].join(',') === values.join(','))) continue;
      }
      // verification 4: human trace exists (substitution + elimination)
      var tr = buildTrace(eqs, k, values);
      if (!tr.ok) continue;
      var steps = tr.steps.length;
      var elims = tr.steps.filter(function (s) { return s.kind === 'elimination'; }).length;
      var hasMul = eqs.some(function (e) { return e.lhs.concat(e.rhs).some(function (t) { return Math.abs(t[0]) > 1; }); });
      var hasSub = eqs.some(function (e) { return e.lhs.concat(e.rhs).some(function (t) { return t[0] < 0; }); });
      // classification must match the requested class
      if (k < P.k[0] || k > P.k[1]) continue;
      if (elims < P.elim[0] || elims > P.elim[1]) continue;
      if (!P.mul && hasMul) continue;
      if (!P.sub && hasSub) continue;
      var target = tr.steps[tr.steps.length - 1].letter;
      return {
        k: k, values: values, eqs: eqs, target: target, answer: values[target],
        trace: tr.steps, steps: steps, elims: elims,
        type: traceType(tr.steps, target),
        text: eqs.map(eqText)
      };
    }
    return null;
  }
  function pickStyle(rng, P) {
    var opts = ['add', 'add'];
    if (P.sub) opts.push('sub', 'sub');
    if (P.mul) opts.push('mul', 'mul');
    return opts[Math.floor(rng() * opts.length)];
  }
  function traceType(steps, target) {
    var last = steps[steps.length - 1];
    if (last.kind === 'elimination') return 'elim';
    var txt = last.reason;
    if (/Equation \d+ \([^)]*\) contains only/.test(txt)) return 'direct';
    if (/[23][A-F]/.test(txt)) return 'mul';
    return 'chain';
  }

  /* -------------------------- duplicate detection ------------------------ */
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function canonicalKey(q) {
    var k = q.k;
    var rows = q.eqs.map(function (e) {
      var r = eqRow(e, k);
      var g = r.d;
      r.c.forEach(function (x) { g = gcd(g, Math.abs(x)); });
      g = g || 1;
      var c = r.c.map(function (x) { return x / g; }), d = r.d / g;
      // sign-normalise on the last nonzero coefficient
      var last = 1;
      for (var i = k - 1; i >= 0; i--) if (c[i]) { last = c[i]; break; }
      if (last < 0) { c = c.map(function (x) { return -x; }); d = -d; }
      return { c: c, d: d };
    });
    var perms = permut(k), best = null;
    for (var pi = 0; pi < perms.length; pi++) {
      var p = perms[pi];
      var lines = rows.map(function (r) {
        var c = r.c.map(function (_, i) { return r.c[p.indexOf(i)] || 0; });
        return c.join(',') + '|' + r.d;
      }).sort();
      // map target through the permutation
      var t = p.indexOf(q.target);
      var key = lines.join(';') + '#' + t;
      if (best === null || key < best) best = key;
    }
    return best;
  }
  var _permCache = {};
  function permut(k) {
    if (_permCache[k]) return _permCache[k];
    var out = [];
    function rec(arr, start) {
      if (start === k) { out.push(arr.slice()); return; }
      for (var i = start; i < k; i++) { var t = arr[start]; arr[start] = arr[i]; arr[i] = t; rec(arr, start + 1); t = arr[start]; arr[start] = arr[i]; arr[i] = t; }
    }
    rec([...Array(k).keys()], 0);
    _permCache[k] = out;
    return out;
  }

  /* ------------------------------ explanation ---------------------------- */
  function whyWrong(q, w) {
    // first equation violated when the target letter takes the wrong value w
    for (var e = 0; e < q.eqs.length; e++) {
      var eq = q.eqs[e], row = eqRow(eq, q.k);
      var s = row.d;
      var hasTarget = false;
      eq.lhs.concat(eq.rhs).forEach(function (t) { if (t[1] === q.target) hasTarget = true; });
      if (!hasTarget) continue;
      var lhsStr = [], val = 0;
      eq.lhs.forEach(function (t) {
        var vv = t[1] === q.target ? w : q.values[t[1]];
        val += t[0] * vv; lhsStr.push((t[0] === 1 ? '' : t[0]) + vv);
      });
      var rval = eq.rhsConst;
      eq.rhs.forEach(function (t) {
        var vv = t[1] === q.target ? w : q.values[t[1]];
        rval += t[0] * vv; // display only
      });
      var s2 = 0; for (var i = 0; i < q.k; i++) s2 += row.c[i] * (i === q.target ? w : q.values[i]);
      if (s2 !== row.d) {
        return w + ' fails Equation ' + (e + 1) + ' (' + eqText(eq) + '): substituting ' + w +
          ' for ? gives ' + val + ' on the left but ' + rval + ' on the right.';
      }
    }
    return w + ' does not satisfy the linked equations (the system has exactly one solution: ' + q.answer + ').';
  }

  /* ---------------------------- bank building ---------------------------- */
  function buildBank(opts) {
    opts = opts || {};
    var seed = opts.seed || 90210;
    var rng = mulberry32(seed);
    var classes = ['Easy', 'Medium', 'Hard', 'Extreme', 'Master'];
    var quotas = opts.quotas || { Easy: 10, Medium: 10, Hard: 10, Extreme: 10, Master: 10 };
    var perClass = opts.perClass || 50;
    var seenKeys = opts.seenKeys || new Set();
    var questions = [], report = { seed: seed, generated: 0, rejected: 0, duplicates: 0, perType: {}, perClass: {}, notes: [] };
    classes.forEach(function (cls) {
      var attempts = 0, sinceHit = 0, need = perClass;
      // types that are actually reachable in this class (direct single-letter
      // finishes cannot be the target for k>=2; elim is profile-gated)
      var typeCycle = cls === 'Easy' || cls === 'Medium' ? ['chain', 'mul'] : ['chain', 'mul', 'elim'];
      var wantType = typeCycle[0], typeIdx = 0;
      while (need > 0 && attempts < 40000) {
        attempts++; sinceHit++;
        if (sinceHit > 400) { typeIdx = (typeIdx + 1) % typeCycle.length; wantType = typeCycle[typeIdx]; }
        if (sinceHit > 2000) wantType = null; // relax so quotas always fill
        var g = generateQuestion(rng, cls);
        if (!g) { report.rejected++; continue; }
        if (wantType && g.type !== wantType) { report.rejected++; continue; }
        var cand = {
          k: g.k, values: g.values, eqs: g.eqs, target: g.target, answer: g.answer,
          trace: g.trace, stepsCount: g.steps, elims: g.elims, type: g.type, cls: cls
        };
        var key = canonicalKey(cand);
        if (seenKeys.has(key)) { report.duplicates++; continue; }
        seenKeys.add(key);
        var num = questions.filter(function (x) { return x.cls === cls; }).length + 1;
        questions.push(makeQuestion(num, cls, cand));
        need--; sinceHit = 0;
        typeIdx = (typeIdx + 1) % typeCycle.length; wantType = typeCycle[typeIdx]; // spread types across the bank
        report.generated++;
        report.perType[g.type] = (report.perType[g.type] || 0) + 1;
      }
      report.perClass[cls] = perClass - need;
      if (need > 0) report.notes.push(cls + ': ' + (perClass - need) + '/' + perClass);
    });
    return { questions: questions, report: report };
  }
  function makeQuestion(num, cls, c) {
    return {
      id: 'MATH-' + cls.toUpperCase() + '-' + pad3(num),
      module: 'math', cls: cls, type: c.type,
      kind: 'math',
      k: c.k, values: c.values,
      eqs: c.eqs.map(function (e) { return { lhs: e.lhs, rhs: e.rhs, rhsConst: e.rhsConst }; }),
      eqText: c.eqs.map(eqText),
      target: c.target, answer: c.answer,
      steps: c.trace.map(function (s) { return { kind: s.kind, letter: s.letter, value: s.value, eqIdx: s.eqIdx, eqIdx2: s.eqIdx2, reason: s.reason }; }),
      stepsCount: c.trace.length, elims: c.elims,
      techs: techsOf(c),
      validated: true
    };
  }
  function techsOf(c) {
    // technique tags for analytics (math-specific numbering, see Study Notes)
    var t = [1]; // 1 = substitution chain
    c.trace.forEach(function (s) { if (s.kind === 'elimination') t.push(2); });
    if (c.eqs.some(function (e) { return e.lhs.concat(e.rhs).some(function (x) { return Math.abs(x[0]) > 1; }); })) t.push(3);
    if (c.eqs.some(function (e) { return e.lhs.concat(e.rhs).some(function (x) { return x[0] < 0; }); })) t.push(4);
    if (c.type === 'elim') t.push(2);
    return t.filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
  }
  function pad3(n) { return (n < 10 ? '00' : n < 100 ? '0' : '') + n; }

  return {
    LTR: LTR, mulberry32: mulberry32, eqText: eqText, eqRow: eqRow, rankOf: rankOf, bruteForceSolutions: bruteForceSolutions,
    buildTrace: buildTrace, generateQuestion: generateQuestion, canonicalKey: canonicalKey,
    whyWrong: whyWrong, buildBank: buildBank, PROFILES: PROFILES
  };
});
