/* ============================================================================
   dMAT Core Module — shared engine (Latin Squares)
   ----------------------------------------------------------------------------
   This file runs BOTH in Node (bank building / validation) and in the browser
   (runtime re-validation, technique examples). It contains:

     - mulberry32 / shuffle / perm      : seeded randomness (stable bank)
     - generateLatinSquare(rng)         : random valid 5x5 Latin square
     - createPuzzle(...)                : carves cells until a class/type fits
     - solveWithSteps(grid, target)     : technique-based solver, records a
                                          human-readable step trace
     - classifyPuzzle(trace)            : Easy / Medium / Hard / Extreme
     - assignType(...)                  : question type tag (a..j)
     - validatePuzzle / validateUniqueAnswer / validateSolutionTrace
     - detectDuplicatePuzzle            : canonical key up to row/col/transpose/
                                          relabel isomorphism (incl. ? cell)
     - buildQuestionBank(...)           : assembles the full validated bank

   Representation
   --------------
   A grid is an Int8Array(25). 0 = empty, 1..5 = letters "A".."E".
   Letters: LTR = ["A","B","C","D","E"]. A cell index i: row = i/5|0, col = i%5.
   Bitmask convention: letter v (1..5) is bit (1 << (v-1)); mask 31 = all five.

   Techniques (numbers match the study notes):
     1  The Cross            2  Letter Scan          3  Trapped Candidate
     4  Busiest Line         5  Column Veto (extra tag on steps)
     6  Phantom Cells        7  Empty Cross (type tag)
     8  Missing Pair         9  Choose the Road (ordering policy)
    10  Skip & Guess (strategy note only — never a solver step)
    11  Naked Single        12  Hidden Single
    13  Naked Pair          14  Hidden Pair           15  X-Wing
    16  Mental Shortcut (sum trick — shown in explanations)
    17  Letter Tally (ordering policy inside the hidden-single scan)
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DMATCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var N = 5;
  var LTR = ['A', 'B', 'C', 'D', 'E'];
  var ALL = 31; // 0b11111 — all five letters

  function rowOf(i) { return (i / N) | 0; }
  function colOf(i) { return i % N; }
  function bit(v) { return 1 << (v - 1); }        // v = 1..5
  function maskLetter(m) { return 32 - Math.clz32(m); } // single-bit mask -> letter value 1..5
  function popcount(m) { m = m - ((m >> 1) & 0x5555); m = (m & 0x3333) + ((m >> 2) & 0x3333); return (m + (m >> 4)) & 0x0f; }
  function maskToList(m) { var out = []; for (var v = 1; v <= 5; v++) if (m & bit(v)) out.push(v); return out; }
  function listToMask(list) { var m = 0; for (var k = 0; k < list.length; k++) m |= bit(list[k]); return m; }

  /* ------------------------------------------------------------------ *
   *  Seeded RNG (mulberry32) — same seed => same bank on every load.    *
   * ------------------------------------------------------------------ */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngInt(rng, n) { return Math.floor(rng() * n); }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = rngInt(rng, i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function perm5(rng) {
    var p = [0, 1, 2, 3, 4];
    return shuffle(p, rng);
  }

  /* ------------------------------------------------------------------ *
   *  generateLatinSquare(rng)                                           *
   *  Randomised backtracking: fill cells in a randomised order with a   *
   *  randomised candidate order, restart on a dead end. Unlike the      *
   *  classic "shuffle rows/cols/symbols of a cyclic square" this can    *
   *  reach ALL 161280 Latin squares of order 5, giving bank variety.    *
   * ------------------------------------------------------------------ */
  function generateLatinSquare(rng) {
    for (var attempt = 0; attempt < 200; attempt++) {
      var g = new Int8Array(25);
      var rows = new Int8Array(5), cols = new Int8Array(5); // bitmasks of used letters
      var order = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].slice(), rng);
      if (backtrack(g, rows, cols, order, 0, rng)) return g;
    }
    throw new Error('generateLatinSquare failed'); // practically unreachable
  }
  function backtrack(g, rows, cols, order, k, rng) {
    if (k === 25) return true;
    var i = order[k], r = rowOf(i), c = colOf(i);
    var cand = ALL & ~(rows[r] | cols[c]);
    if (cand === 0) return false;
    // randomised candidate order
    var list = maskToList(cand); shuffle(list, rng);
    for (var x = 0; x < list.length; x++) {
      var v = list[x], b = bit(v);
      g[i] = v; rows[r] |= b; cols[c] |= b;
      if (backtrack(g, rows, cols, order, k + 1, rng)) return true;
      g[i] = 0; rows[r] &= ~b; cols[c] &= ~b;
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   *  Solver state (bitmasks + per-cell candidate masks)                 *
   * ------------------------------------------------------------------ */
  function makeState(grid) {
    var vals = Int8Array.from(grid);
    var rows = new Int8Array(5), cols = new Int8Array(5);
    var cand = new Int8Array(25);
    var count = new Int8Array(6); // count[v] = placements of letter v
    var i, r, c;
    for (i = 0; i < 25; i++) if (vals[i]) { count[vals[i]]++; }
    for (r = 0; r < 5; r++) for (c = 0; c < 5; c++) { if (vals[r * 5 + c]) rows[r] |= bit(vals[r * 5 + c]); if (vals[c * 5 + r]) cols[r] |= bit(vals[c * 5 + r]); }
    for (i = 0; i < 25; i++) cand[i] = vals[i] ? 0 : (ALL & ~(rows[rowOf(i)] | cols[colOf(i)]));
    return { vals: vals, rows: rows, cols: cols, cand: cand, count: count };
  }
  function stateFill(st, i, v) {
    var r = rowOf(i), c = colOf(i), b = bit(v), k;
    st.vals[i] = v; st.rows[r] |= b; st.cols[c] |= b; st.count[v]++;
    st.cand[i] = 0;
    for (k = 0; k < 5; k++) { st.cand[r * 5 + k] &= ~b; st.cand[k * 5 + c] &= ~b; }
  }
  function rowEmpties(st, r) { var n = 0; for (var c = 0; c < 5; c++) if (!st.vals[r * 5 + c]) n++; return n; }
  function colEmpties(st, c) { var n = 0; for (var r = 0; r < 5; r++) if (!st.vals[r * 5 + c]) n++; return n; }
  function lineCellsRow(r) { return [r * 5, r * 5 + 1, r * 5 + 2, r * 5 + 3, r * 5 + 4]; }
  function lineCellsCol(c) { return [c, c + 5, c + 10, c + 15, c + 20]; }

  /* ------------------------------------------------------------------ *
   *  solveWithSteps(grid, target)                                       *
   *  Applies techniques in exam-priority order, ONE step at a time,     *
   *  and records a fully human-readable trace.                          *
   *                                                                     *
   *  Priority per iteration (mirrors "work backwards from ?"):          *
   *    1. The Cross / naked single on ?                                  *
   *    2. Trapped Candidate (the only other empty cell in ?'s line)      *
   *    3. Naked singles in ?'s row/column        ("choose the road")     *
   *    4. Hidden singles in ?'s row/column       (letter tally order)    *
   *    5. Naked singles anywhere else            ("phantom fills")       *
   *    6. Hidden singles anywhere else           ("phantom fills")       *
   *    7. Naked pair eliminations (13)                                   *
   *    8. Hidden pair eliminations (14)                                  *
   *    9. X-Wing eliminations (15)                                       *
   *  Off-road fills (5/6) are counted as PHANTOM fills: cells outside    *
   *  ?'s row/column that you derive mentally, use, and drop.             *
   * ------------------------------------------------------------------ */
  function solveWithSteps(grid, target) {
    var st = makeState(grid);
    var steps = [];
    var solved = false, answer = 0;
    var phantomRun = 0, maxPhantomRun = 0, totalPhantoms = 0;
    var tR = rowOf(target), tC = colOf(target);
    var guard = 0;

    function isOnRoad(i) { return i === target || rowOf(i) === tR || colOf(i) === tC; }
    function record(step) {
      if (step.phantom && step.fill !== undefined && step.techs.indexOf(6) < 0) step.techs.push(6); // T6 phantom cells
      steps.push(step);
      if (step.fill !== undefined) {
        stateFill(st, step.fill, step.letter);
        if (isOnRoad(step.fill)) phantomRun = 0;
        else { phantomRun++; totalPhantoms++; if (phantomRun > maxPhantomRun) maxPhantomRun = phantomRun; }
      }
    }
    function names(mask) { return maskToList(mask).map(function (v) { return LTR[v - 1]; }).join(', '); }

    while (guard++ < 80) {
      if (st.vals[target]) { solved = true; answer = st.vals[target]; break; }

      /* ---- 1. The Cross (T1): ? has exactly one candidate ---- */
      if (popcount(st.cand[target]) === 1) {
        var v = maskLetter(st.cand[target]);
        var seenMask = (st.rows[tR] | st.cols[tC]) & ALL;
        var missingMask = ALL & ~st.rows[tR] & ~st.cols[tC];
        record({
          fill: target, letter: v, tech: 1, techs: [1],
          reason: "Read ?'s row " + (tR + 1) + ' and column ' + (tC + 1) +
            ' together as one list. The letters already visible there are ' + names(seenMask) +
            ' — that leaves exactly one letter for ?: ' + LTR[v - 1] + '.',
          cells: [target], data: { seen: maskToList(seenMask), missing: maskToList(missingMask) }
        });
        continue;
      }

      /* ---- 2. Trapped Candidate (T3) ---- */
      var t3 = tryTrapped();
      if (t3) { record(t3); continue; }

      /* ---- 3. Naked singles on the road (T11/T4/T8, extra T5) ---- */
      var ns = tryNaked(true);
      if (ns) { record(ns); continue; }

      /* ---- 4. Hidden singles on the road (T12/T2, extra T8) ---- */
      var hs = tryHidden(true);
      if (hs) { record(hs); continue; }

      /* ---- 5/6. Phantom fills: naked/hidden singles off the road ---- */
      var pns = tryNaked(false);
      if (pns) { pns.phantom = true; record(pns); continue; }
      var phs = tryHidden(false);
      if (phs) { phs.phantom = true; record(phs); continue; }

      /* ---- 7. Naked pair (T13) ---- */
      var np = tryNakedPair();
      if (np) { record(np); continue; }

      /* ---- 8. Hidden pair (T14) ---- */
      var hp = tryHiddenPair();
      if (hp) { record(hp); continue; }

      /* ---- 9. X-Wing (T15) ---- */
      var xw = tryXWing();
      if (xw) { record(xw); continue; }

      break; // stuck: no technique applies -> not solvable by pure logic
    }

    function tryTrapped() {
      // ?'s row (or column) has exactly two empty cells: ? and e.
      // If e cannot take one of ?'s two candidates, that candidate is
      // trapped in ?, so the other one belongs in e and ? is forced.
      var lines = [
        { cells: lineCellsRow(tR), kind: 'row', n: tR + 1 },
        { cells: lineCellsCol(tC), kind: 'column', n: tC + 1 }
      ];
      for (var li = 0; li < 2; li++) {
        var line = lines[li], empties = [];
        for (var k = 0; k < 5; k++) { var i = line.cells[k]; if (!st.vals[i] && i !== target) empties.push(i); }
        if (empties.length !== 1) continue;
        var e = empties[0];
        if (popcount(st.cand[target]) !== 2 || popcount(st.cand[e]) !== 1) continue;
        var y = maskLetter(st.cand[e]);
        var tMask = st.cand[target];
        if (!(tMask & bit(y))) continue;
        var xMask = tMask & ~bit(y);
        if (popcount(xMask) !== 1) continue;
        var x = maskLetter(xMask);
        // find the blocker: a placed cell holding x in one of e's two lines
        var blocker = findBlocker(e, x);
        var cellList = [e, target];
        if (blockerIndex >= 0 && blockerIndex !== e && blockerIndex !== target) cellList.push(blockerIndex);
        return {
          fill: e, letter: y, tech: 3, techs: [3],
          reason: LTR[x - 1] + ' and ' + LTR[y - 1] + ' are both still possible for ?. ' +
            'The only other empty cell in ?\'s ' + line.kind + ' ' + line.n + ' is ' + cellName(e) +
            ', and it cannot take ' + LTR[x - 1] + ' (' + blocker + '). So that cell must be ' + LTR[y - 1] +
            ', which leaves ' + LTR[x - 1] + ' for ?.',
          cells: cellList,
          data: { trapped: x, partner: y }
        };
      }
      return null;
    }
    var blockerIndex = -1;
    function findBlocker(e, x) {
      blockerIndex = -1;
      var r = rowOf(e), c = colOf(e);
      for (var k = 0; k < 5; k++) {
        var i1 = r * 5 + k, i2 = k * 5 + c;
        if (st.vals[i1] === x) { blockerIndex = i1; return LTR[x - 1] + ' is already in row ' + (r + 1) + ' at ' + cellName(i1); }
        if (st.vals[i2] === x) { blockerIndex = i2; return LTR[x - 1] + ' is already in column ' + (c + 1) + ' at ' + cellName(i2); }
      }
      return LTR[x - 1] + ' is blocked there';
    }

    function tryNaked(road) {
      // Choose-the-road (T9): road cells first; among them the busiest line first.
      var best = null;
      for (var i = 0; i < 25; i++) {
        if (st.vals[i] || popcount(st.cand[i]) !== 1) continue;
        if (road !== isOnRoad(i)) continue;
        var r = rowOf(i), c = colOf(i);
        var re = rowEmpties(st, r), ce = colEmpties(st, c);
        var score = (re + ce) * 10 + i;      // fewer empties in the two lines = busier = better
        if (!best || score < best.score) best = { i: i, score: score, re: re, ce: ce };
      }
      if (!best) return null;
      var i = best.i, r = rowOf(i), c = colOf(i), v = maskLetter(st.cand[i]);
      var rowMask = ALL & ~st.rows[r], colMask = ALL & ~st.cols[c];
      var techs = [], tech, reason;
      var lineFull = (best.re === 1 || best.ce === 1);
      var pairLine = (best.re === 2 || best.ce === 2);
      var bothNeeded = (popcount(rowMask) >= 2 && popcount(colMask) >= 2);
      if (lineFull) tech = 4; else if (pairLine) tech = 8; else tech = 11;
      techs.push(tech);
      if (bothNeeded) techs.push(5);
      var phrase;
      if (tech === 4) {
        var ln = best.re === 1 ? 'row ' + (r + 1) : 'column ' + (c + 1);
        phrase = ln + ' already holds four letters — the busiest line on the board. Only ' + LTR[v - 1] + ' is missing';
        if (best.re === 1 && best.ce === 1) phrase += ' in both its row and column';
        phrase += ', and column ' + (c + 1) + ' does not contain it.';
        if (techs.indexOf(5) >= 0) phrase += ' (Row proposes, column confirms — T5.)';
      } else if (tech === 8) {
        var ln2 = best.re === 2 ? 'row ' + (r + 1) : 'column ' + (c + 1);
        var other = best.re === 2 ? colEmpties(st, c) : rowEmpties(st, r);
        phrase = ln2 + ' has exactly two empty cells, so it is missing exactly two letters. ' +
          LTR[v - 1] + ' is the only one of them that fits here';
        if (other === 1) phrase += ' — its line is also complete except for this letter';
        phrase += '; the partner cell takes the last remaining letter. Placing one forces the other.';
      } else {
        phrase = 'Row ' + (r + 1) + ' is missing {' + names(rowMask) + '} and column ' + (c + 1) +
          ' is missing {' + names(colMask) + '}.';
        if (bothNeeded) phrase += ' Neither line alone decides it — the only letter missing from BOTH is ' + LTR[v - 1] + ' (row proposes, column vetoes the rest, T5).';
        else phrase += ' The only letter missing from both is ' + LTR[v - 1] + '.';
      }
      return { fill: i, letter: v, tech: tech, techs: techs, reason: phrase, cells: [i] };
    }

    function tryHidden(road) {
      // Letter tally (T17): scan letters with the most placements first,
      // so a letter seen 4 times (a T2 "letter scan") is found immediately.
      var order = [1, 2, 3, 4, 5].sort(function (a, b) { return st.count[b] - st.count[a] || a - b; });
      var lines = [];
      // road = ?'s row and column; off-road = all other lines
      var roadLines = [{ kind: 'row', n: tR, cells: lineCellsRow(tR) }, { kind: 'column', n: tC, cells: lineCellsCol(tC) }];
      if (road) lines = roadLines;
      else {
        for (var r = 0; r < 5; r++) if (r !== tR) lines.push({ kind: 'row', n: r, cells: lineCellsRow(r) });
        for (var c = 0; c < 5; c++) if (c !== tC) lines.push({ kind: 'column', n: c, cells: lineCellsCol(c) });
      }
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        var lineMask = 0, emptyCells = [];
        for (var k = 0; k < 5; k++) { var i = line.cells[k]; if (st.vals[i]) lineMask |= bit(st.vals[i]); else emptyCells.push(i); }
        var missing = ALL & ~lineMask;
        for (var mi = 0; mi < maskToList(missing).length; mi++) {
          var v = maskToList(missing)[mi];
          var spots = [];
          for (var e = 0; e < emptyCells.length; e++) if (st.cand[emptyCells[e]] & bit(v)) spots.push(emptyCells[e]);
          if (spots.length !== 1) continue;
          var cell = spots[0];
          var tech = st.count[v] === 4 ? 2 : 12;
          var techs = [tech];
          var reason;
          if (tech === 2) {
            reason = 'Letter ' + LTR[v - 1] + ' is already placed 4 times. It is missing only from ' +
              line.kind + ' ' + (line.n + 1) + ', and inside that line the only cell that can still take it is ' +
              cellName(cell) + '. Its fifth and last position is forced.';
          } else {
            reason = 'Hidden single: in ' + line.kind + ' ' + (line.n + 1) + ', letter ' + LTR[v - 1] +
              ' can only go in ' + cellName(cell) + ' — every other empty cell of that line has ' +
              LTR[v - 1] + ' in its crossing line.';
          }
          if (emptyCells.length === 2) {
            techs.push(8);
            reason += ' (This line has only two empty cells — a missing pair; the partner cell must take the other missing letter.)';
          }
          return { fill: cell, letter: v, tech: tech, techs: techs, reason: reason, cells: [cell] };
        }
      }
      return null;
    }

    function tryNakedPair() {
      for (var r = 0; r < 5; r++) {
        var res = pairInLine(lineCellsRow(r), 'row', r + 1); if (res) return res;
      }
      for (var c = 0; c < 5; c++) {
        var res2 = pairInLine(lineCellsCol(c), 'column', c + 1); if (res2) return res2;
      }
      return null;
      function pairInLine(cells, kind, n) {
        var twos = [];
        for (var k = 0; k < 5; k++) { var i = cells[k]; if (!st.vals[i] && popcount(st.cand[i]) === 2) twos.push(i); }
        for (var a = 0; a < twos.length; a++) for (var b = a + 1; b < twos.length; b++) {
          if (st.cand[twos[a]] !== st.cand[twos[b]]) continue;
          var m = st.cand[twos[a]];
          var hit = [];
          for (var k2 = 0; k2 < 5; k2++) {
            var j = cells[k2];
            if (!st.vals[j] && j !== twos[a] && j !== twos[b] && (st.cand[j] & m)) hit.push(j);
          }
          if (!hit.length) continue;
          var removed = [];
          for (var h = 0; h < hit.length; h++) {
            maskToList(m).forEach(function (v) { removed.push({ cell: hit[h], letter: v }); });
            st.cand[hit[h]] &= ~m;
          }
          return {
            tech: 13, techs: [13],
            reason: 'Naked pair: in ' + kind + ' ' + n + ', the two cells ' + cellName(twos[a]) + ' and ' +
              cellName(twos[b]) + ' can only be {' + names(m) + '}. Those two letters are reserved for those two cells, so they are removed from ' +
              hit.map(cellName).join(', ') + '.',
            cells: [twos[a], twos[b]].concat(hit), removed: removed
          };
        }
        return null;
      }
    }

    function tryHiddenPair() {
      var lines = [];
      for (var r = 0; r < 5; r++) lines.push({ kind: 'row', n: r + 1, cells: lineCellsRow(r) });
      for (var c = 0; c < 5; c++) lines.push({ kind: 'column', n: c + 1, cells: lineCellsCol(c) });
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li], emptyCells = [], spots = {};
        for (var k = 0; k < 5; k++) { var i = line.cells[k]; if (!st.vals[i]) emptyCells.push(i); }
        if (emptyCells.length < 3) continue; // pairs in 2-empty lines are trivial
        for (var v = 1; v <= 5; v++) {
          spots[v] = [];
          for (var e = 0; e < emptyCells.length; e++) if (st.cand[emptyCells[e]] & bit(v)) spots[v].push(emptyCells[e]);
        }
        for (var a = 1; a <= 5; a++) for (var b = a + 1; b <= 5; b++) {
          if (spots[a].length !== 2 || spots[b].length !== 2) continue;
          if (spots[a][0] !== spots[b][0] || spots[a][1] !== spots[b][1]) continue;
          var keep = bit(a) | bit(b), hit = [], removed = [];
          for (var e2 = 0; e2 < 2; e2++) {
            var j = spots[a][e2];
            if (st.cand[j] & ~keep) {
              maskToList(st.cand[j] & ~keep).forEach(function (v) { removed.push({ cell: j, letter: v }); });
              st.cand[j] &= keep; hit.push(j);
            }
          }
          if (!hit.length) continue;
          return {
            tech: 14, techs: [14],
            reason: 'Hidden pair: in ' + line.kind + ' ' + line.n + ', letters ' + LTR[a - 1] + ' and ' + LTR[b - 1] +
              ' can each go only in ' + cellName(spots[a][0]) + ' and ' + cellName(spots[a][1]) +
              '. Those two cells therefore hold {' + LTR[a - 1] + ',' + LTR[b - 1] + '} — all other candidates are removed from them.',
            cells: [spots[a][0], spots[a][1]], removed: removed
          };
        }
      }
      return null;
    }

    function tryXWing() {
      for (var v = 1; v <= 5; v++) {
        var b = bit(v);
        // rows
        var rowspots = [];
        for (var r = 0; r < 5; r++) {
          var cs = []; for (var c = 0; c < 5; c++) if (st.cand[r * 5 + c] & b) cs.push(c);
          rowspots.push(cs);
        }
        for (var r1 = 0; r1 < 5; r1++) {
          if (rowspots[r1].length !== 2) continue;
          for (var r2 = r1 + 1; r2 < 5; r2++) {
            if (rowspots[r2].length !== 2) continue;
            if (rowspots[r1][0] !== rowspots[r2][0] || rowspots[r1][1] !== rowspots[r2][1]) continue;
            var c1 = rowspots[r1][0], c2 = rowspots[r1][1], hit = [], removed = [];
            for (var rr = 0; rr < 5; rr++) {
              if (rr === r1 || rr === r2) continue;
              var i1 = rr * 5 + c1, i2 = rr * 5 + c2;
              if (st.cand[i1] & b) { st.cand[i1] &= ~b; hit.push(i1); removed.push({ cell: i1, letter: v }); }
              if (st.cand[i2] & b) { st.cand[i2] &= ~b; hit.push(i2); removed.push({ cell: i2, letter: v }); }
            }
            if (hit.length) return {
              tech: 15, techs: [15],
              reason: 'X-Wing: letter ' + LTR[v - 1] + ' can go in row ' + (r1 + 1) + ' only at columns ' + (c1 + 1) + ',' + (c2 + 1) +
                ' and in row ' + (r2 + 1) + ' only at the same two columns. Whichever way round it is, those two columns are used up in those rows, so ' +
                LTR[v - 1] + ' is impossible in ' + hit.map(cellName).join(', ') + '.',
              cells: [r1 * 5 + c1, r1 * 5 + c2, r2 * 5 + c1, r2 * 5 + c2].concat(hit), removed: removed
            };
          }
        }
        // columns (mirror logic)
        var colspots = [];
        for (var c3 = 0; c3 < 5; c3++) {
          var rs = []; for (var r4 = 0; r4 < 5; r4++) if (st.cand[r4 * 5 + c3] & b) rs.push(r4);
          colspots.push(rs);
        }
        for (var cc1 = 0; cc1 < 5; cc1++) {
          if (colspots[cc1].length !== 2) continue;
          for (var cc2 = cc1 + 1; cc2 < 5; cc2++) {
            if (colspots[cc2].length !== 2) continue;
            if (colspots[cc1][0] !== colspots[cc2][0] || colspots[cc1][1] !== colspots[cc2][1]) continue;
            var rr1 = colspots[cc1][0], rr2 = colspots[cc1][1], hit2 = [], removed2 = [];
            for (var c4 = 0; c4 < 5; c4++) {
              if (c4 === cc1 || c4 === cc2) continue;
              var j1 = rr1 * 5 + c4, j2 = rr2 * 5 + c4;
              if (st.cand[j1] & b) { st.cand[j1] &= ~b; hit2.push(j1); removed2.push({ cell: j1, letter: v }); }
              if (st.cand[j2] & b) { st.cand[j2] &= ~b; hit2.push(j2); removed2.push({ cell: j2, letter: v }); }
            }
            if (hit2.length) return {
              tech: 15, techs: [15],
              reason: 'X-Wing: letter ' + LTR[v - 1] + ' can go in column ' + (cc1 + 1) + ' only at rows ' + (rr1 + 1) + ',' + (rr2 + 1) +
                ' and in column ' + (cc2 + 1) + ' only at the same two rows. So ' + LTR[v - 1] + ' is impossible in ' + hit2.map(cellName).join(', ') + '.',
              cells: [rr1 * 5 + cc1, rr1 * 5 + cc2, rr2 * 5 + cc1, rr2 * 5 + cc2].concat(hit2), removed: removed2
            };
          }
        }
      }
      return null;
    }

    return {
      solved: solved, answer: answer || 0, steps: steps,
      totalPhantoms: totalPhantoms, maxPhantomRun: maxPhantomRun,
      vals: st.vals
    };
  }

  // expose the Master classifier + deep carver
  // (added in v2; classifyPuzzle itself is untouched for backward compatibility)

  function cellName(i) { return '(row ' + (rowOf(i) + 1) + ', column ' + (colOf(i) + 1) + ')'; }

  /* ------------------------------------------------------------------ *
   *  classifyPuzzle(trace) — difficulty from the ACTUAL logic needed.   *
   *  Easy    : 1 step, cross / naked single only.                       *
   *  Medium  : 2-3 steps, only simple techniques, <=1 phantom fill.     *
   *  Hard    : 4-5 steps (or 2-3 steps whose crux is T4/T6/T8),          *
   *            <=2 phantom fills, no advanced pair/wing techniques.     *
   *  Extreme : >=6 steps, or a pair/wing technique, or >=3 phantoms.     *
   * ------------------------------------------------------------------ */
  function classifyPuzzle(trace) {
    if (!trace || !trace.solved || !trace.steps.length) return { cls: 'invalid' };
    var steps = trace.steps.length;
    var primaries = [];
    var all = {};
    trace.steps.forEach(function (s) { primaries.push(s.tech); s.techs.forEach(function (t) { all[t] = 1; }); });
    var exotic = all[13] || all[14] || all[15];
    var hardCrux = all[4] || all[6] || all[8]; // T5 is an extra tag only, see notes
    var ph = trace.totalPhantoms;
    if (steps === 1) {
      if (primaries[0] === 1 || primaries[0] === 11) return { cls: 'Easy' };
      return { cls: 'invalid' }; // e.g. 1-step hidden single on ? — kept out of the bank
    }
    if (steps >= 6 || exotic || ph >= 3) return { cls: 'Extreme' };
    if (steps <= 3 && ph <= 1 && !hardCrux) {
      var simpleOnly = primaries.every(function (t) { return t === 1 || t === 2 || t === 3 || t === 11 || t === 12; });
      if (simpleOnly) return { cls: 'Medium' };
    }
    if (steps >= 4 && steps <= 5 && !exotic && ph <= 2) return { cls: 'Hard' };
    return { cls: 'invalid' }; // e.g. 3-step puzzle with a hard crux — kept out of the bank
  }

  /* ------------------------------------------------------------------ *
   *  classifyMaster(trace) — the fifth class, ABOVE Extreme.            *
   *  Deliberately defined as a SEPARATE function on top of (never       *
   *  inside) classifyPuzzle, so the classification of every existing    *
   *  Easy..Extreme question is bit-for-bit unchanged. A question is     *
   *  Master iff the base classifier says Extreme AND the reasoning is   *
   *  substantially deeper than the ordinary Extreme profile:            *
   *    - >= 9 deduction steps, or                                       *
   *    - >= 4 phantom fills, or                                         *
   *    - an advanced pair/wing technique needed with >= 7 steps, or     *
   *    - >= 7 steps AND >= 3 phantom fills (long interacting chains).   *
   * ------------------------------------------------------------------ */
  function classifyMaster(trace) {
    if (!trace || !trace.solved) return false;
    if (classifyPuzzle(trace).cls !== 'Extreme') return false;
    var steps = trace.steps.length, ph = trace.totalPhantoms, exotic = false;
    trace.steps.forEach(function (s) { if (s.tech === 13 || s.tech === 14 || s.tech === 15) exotic = true; });
    return steps >= 9 || ph >= 4 || (exotic && steps >= 7) || (steps >= 7 && ph >= 3);
  }

  /* ------------------------------------------------------------------ *
   *  carveDeep — like createPuzzle's greedy carve but with NO early     *
   *  stop: removals are kept while the puzzle stays solvable by pure    *
   *  logic at Extreme depth or below. This walks to the frontier        *
   *  between "hard" and "unsolvable", where Master questions live.      *
   * ------------------------------------------------------------------ */
  function carveDeep(square, target, rng) {
    var puzzle = Int8Array.from(square);
    puzzle[target] = 0;
    var order = shuffle(range24(target), rng);
    for (var k = 0; k < order.length; k++) {
      var i = order[k], saved = puzzle[i];
      puzzle[i] = 0;
      var tr = solveWithSteps(puzzle, target), cl = classifyPuzzle(tr);
      if (!(tr.solved && CLASS_RANK[cl.cls] <= 4)) puzzle[i] = saved;
    }
    for (var round = 0; round < 3; round++) {
      var progress = false;
      var order2 = shuffle(range24(target), rng);
      for (var k2 = 0; k2 < order2.length; k2++) {
        var j = order2[k2];
        if (!puzzle[j]) continue;
        var sv = puzzle[j]; puzzle[j] = 0;
        var tr2 = solveWithSteps(puzzle, target), cl2 = classifyPuzzle(tr2);
        if (tr2.solved && CLASS_RANK[cl2.cls] <= 4) progress = true;
        else puzzle[j] = sv;
      }
      if (!progress) break;
    }
    return puzzle;
  }

  /* ------------------------------------------------------------------ *
   *  buildMasterBank — 50 validated Master questions. Separate RNG      *
   *  stream and a shared duplicate-key set (the existing 200 must       *
   *  never be duplicated or modified).                                  *
   * ------------------------------------------------------------------ */
  function buildMasterBank(opts) {
    opts = opts || {};
    var seed = opts.seed || 20261106 + 777;
    var rng = mulberry32(seed);
    var perClass = opts.perClass || 50;
    var seenKeys = opts.seenKeys || new Set();
    var budget = opts.attemptBudget || 60000;
    var report = { seed: seed, generated: 0, rejected: 0, duplicates: 0, notMaster: 0, notes: [] };
    var out = [];
    var attempts = 0;
    while (out.length < perClass && attempts < budget) {
      attempts++;
      var square = generateLatinSquare(rng);
      var target = rngInt(rng, 25);
      var puzzle = carveDeep(square, target, rng);
      var trace = solveWithSteps(puzzle, target);
      if (!trace.solved || !classifyMaster(trace)) {
        if (trace.solved) report.notMaster++;
        report.rejected++;
        continue;
      }
      var errs = validatePuzzle(puzzle, target, square, trace.answer);
      if (errs.length) { report.rejected++; continue; }
      var ua = validateUniqueAnswer(puzzle, target);
      if (!ua.unique || ua.answer !== trace.answer) { report.rejected++; continue; }
      var terrs = validateSolutionTrace(puzzle, target, trace.steps, trace.answer);
      if (terrs.length) { report.rejected++; continue; }
      var dup = detectDuplicatePuzzle(puzzle, target, seenKeys);
      if (dup.duplicate) { report.duplicates++; continue; }
      seenKeys.add(dup.key);
      var cand = { grid: puzzle, target: target, trace: trace, solution: Int8Array.from(square) };
      cand.type = assignType(puzzle, target, trace);
      out.push(makeQuestion(out.length + 1, 'Master', cand));
      report.generated++;
    }
    report.perClass = out.length;
    if (out.length < perClass) report.notes.push('Master: ' + out.length + '/' + perClass + ' after ' + attempts + ' attempts');
    return { bank: out, report: report, attempts: attempts };
  }

  /* ------------------------------------------------------------------ *
   *  assignType — question type tag (a..j), evaluated on the FINAL      *
   *  puzzle and its trace. First match wins.                            *
   *    a direct cross   b letter scan   c trapped candidate             *
   *    d busiest line   e veto trap     f phantom chain                 *
   *    g empty cross    h missing pair  i decoy-rich    j pair/wing     *
   * ------------------------------------------------------------------ */
  function assignType(grid, target, trace) {
    var st = makeState(grid);
    var tR = rowOf(target), tC = colOf(target);
    var seenMask = st.rows[tR] | st.cols[tC];
    var crossSeen = popcount(seenMask);
    var techs = {}, decisive = {};
    // "decisive window": the last 3 fills before the ? fill
    var fills = trace.steps.filter(function (s) { return s.fill !== undefined; });
    var tIdx = fills.findIndex(function (s) { return s.fill === target; });
    var winStart = Math.max(0, (tIdx >= 0 ? tIdx : fills.length) - 3);
    trace.steps.forEach(function (s, idx) {
      s.techs.forEach(function (t) { techs[t] = 1; });
      if (idx >= winStart) s.techs.forEach(function (t) { decisive[t] = 1; });
    });
    var initialNaked = 0;
    for (var i = 0; i < 25; i++) if (!st.vals[i] && i !== target && popcount(st.cand[i]) === 1) initialNaked++;
    var phantoms = trace.totalPhantoms;

    // Veto trap: a letter that fits ?'s row everywhere (so a row-only
    // reader would accept it for ?) but is already in ?'s column.
    var rowMissing = ALL & ~st.rows[tR];
    var vetoLetters = [];
    maskToList(rowMissing).forEach(function (v) {
      if (st.cols[tC] & bit(v)) {
        var fitsAll = true;
        for (var c = 0; c < 5; c++) {
          var j = tR * 5 + c;
          if (!st.vals[j] && j !== target && (st.cols[colOf(j)] & bit(v))) fitsAll = false;
        }
        if (fitsAll) vetoLetters.push(v);
      }
    });

    var exotic = techs[13] || techs[14] || techs[15];
    if (crossSeen === 4) return 'a';
    if (exotic) return 'j';
    if (crossSeen <= 1) return 'g';
    if (decisive[3]) return 'c';
    if (decisive[2] || decisive[12]) return 'b'; // letter-perspective decisive (T2 scan / T12 hidden single)
    if (phantoms >= 2) return 'f';
    // decoy-rich: many cells are instantly solvable at the start (decoys)
    if (initialNaked >= 5 && trace.steps.length >= 3 && phantoms <= 1) return 'i';
    if (vetoLetters.length) return 'e';
    if (decisive[8]) return 'h';
    if (techs[4]) return 'd';
    if (phantoms >= 1) return 'f';
    return 'i';
  }

  /* ------------------------------------------------------------------ *
   *  createPuzzle — carve cells out of a full square until the puzzle   *
   *  sits in the requested difficulty class (and, ideally, type).       *
   *                                                                     *
   *  Greedy randomised carving: try removing cells in random order;     *
   *  keep a removal only while the puzzle stays solvable by pure logic  *
   *  AND its difficulty rank does not exceed the target class.          *
   *  Removing cells usually makes a puzzle harder, so the carve walks   *
   *  the ladder Easy -> Medium -> Hard -> Extreme and stops at the      *
   *  boundary. Early stopping (random) gives variety inside a class.    *
   * ------------------------------------------------------------------ */
  var CLASS_RANK = { Easy: 1, Medium: 2, Hard: 3, Extreme: 4, invalid: 9 };
  var CLASS_MIN_STEPS = { Easy: 1, Medium: 2, Hard: 4, Extreme: 6 };

  function createPuzzle(square, target, cls, rng, opts) {
    opts = opts || {};
    var attempts = opts.attempts || 40;
    var fallback = null;
    for (var a = 0; a < attempts; a++) {
      var puzzle = Int8Array.from(square);
      puzzle[target] = 0; // the question mark cell is always empty
      var wantRank = CLASS_RANK[cls];
      var order = shuffle(range24(target), rng);
      var earlyStop = opts.earlyStop === undefined ? 0.3 : opts.earlyStop;
      var done = false;
      // pass 1: greedy carve
      for (var k = 0; k < order.length && !done; k++) {
        var i = order[k];
        var saved = puzzle[i]; puzzle[i] = 0;
        var tr = solveWithSteps(puzzle, target);
        var cl = classifyPuzzle(tr);
        if (tr.solved && CLASS_RANK[cl.cls] <= wantRank) {
          // keep it; maybe stop early once the class is reached with enough steps
          if (cl.cls === cls && tr.steps.length >= CLASS_MIN_STEPS[cls] && rng() < earlyStop) done = true;
          // type 'i' hint: stop as soon as many decoy cells are instantly solvable
          if (!done && opts.type === 'i' && cl.cls === cls && tr.steps.length >= 3 &&
              countInitialNaked(puzzle, target) >= 5) done = true;
        } else {
          puzzle[i] = saved; // undo
        }
      }
      // pass 2: if still below the class, keep trying remaining cells
      for (var round = 0; round < 3; round++) {
        var tr2 = solveWithSteps(puzzle, target);
        var cl2 = classifyPuzzle(tr2);
        if (cl2.cls === cls) break;
        var progress = false;
        var order2 = shuffle(range24(target), rng);
        for (var k2 = 0; k2 < order2.length; k2++) {
          var j = order2[k2];
          if (!puzzle[j]) continue;
          var sv = puzzle[j]; puzzle[j] = 0;
          var tr3 = solveWithSteps(puzzle, target);
          var cl3 = classifyPuzzle(tr3);
          if (tr3.solved && CLASS_RANK[cl3.cls] <= wantRank) { progress = true; }
          else puzzle[j] = sv;
        }
        if (!progress) break;
      }
      var trace = solveWithSteps(puzzle, target);
      var clsFinal = classifyPuzzle(trace);
      if (!trace.solved || clsFinal.cls !== cls) continue;
      var type = assignType(puzzle, target, trace);
      var cand = {
        grid: Int8Array.from(puzzle), target: target, trace: trace,
        solution: Int8Array.from(square), // full underlying square (the trace is a partial solve)
        cls: cls, type: type, givens: countGivens(puzzle)
      };
      if (!fallback) fallback = cand;
      if (!opts.type || type === opts.type) return cand;
    }
    return fallback; // may be null; caller decides
  }
  function range24(target) {
    var a = []; for (var i = 0; i < 25; i++) if (i !== target) a.push(i); return a;
  }
  // number of non-target empty cells that currently have exactly one candidate
  function countInitialNaked(grid, target) {
    var st = makeState(grid), n = 0;
    for (var i = 0; i < 25; i++) if (!st.vals[i] && i !== target && popcount(st.cand[i]) === 1) n++;
    return n;
  }
  function countGivens(g) { var n = 0; for (var i = 0; i < 25; i++) if (g[i]) n++; return n; }

  /* ------------------------------------------------------------------ *
   *  Validation                                                         *
   * ------------------------------------------------------------------ */

  // 1. Structural: 5x5, letters A-E, valid full square, givens consistent,
  //    exactly one target, stored answer matches the solution square.
  function validatePuzzle(grid, target, solution, answer) {
    var errs = [];
    if (!solution || solution.length !== 25) return ['solution missing'];
    var rows = new Int8Array(5), cols = new Int8Array(5);
    for (var i = 0; i < 25; i++) {
      var v = solution[i];
      if (v < 1 || v > 5) { errs.push('bad letter at ' + i); continue; }
      rows[rowOf(i)] |= bit(v); cols[colOf(i)] |= bit(v);
    }
    for (var r = 0; r < 5; r++) if (rows[r] !== ALL) errs.push('row ' + (r + 1) + ' invalid');
    for (var c = 0; c < 5; c++) if (cols[c] !== ALL) errs.push('column ' + (c + 1) + ' invalid');
    if (grid[target] !== 0) errs.push('target not empty');
    if (answer !== solution[target]) errs.push('answer mismatch');
    for (var j = 0; j < 25; j++) if (grid[j] && grid[j] !== solution[j]) errs.push('given conflicts with solution at ' + j);
    return errs;
  }

  // 2. Unique answer: independent brute force. For every letter L, search
  //    for ANY completion of the visible grid with ? = L (pure backtracking
  //    over rows/columns — deliberately independent of the technique solver).
  //    Exactly one letter must admit a completion, and it must equal the
  //    stored answer. Returns {unique, letters:[...], answer, nodes, capped}.
  function validateUniqueAnswer(grid, target, capNodes) {
    capNodes = capNodes || 120000;
    var found = [], nodes = 0, capped = false;
    // row/column masks of the visible grid
    var rows = new Int8Array(5), cols = new Int8Array(5);
    for (var i = 0; i < 25; i++) if (grid[i]) { rows[rowOf(i)] |= bit(grid[i]); cols[colOf(i)] |= bit(grid[i]); }
    for (var v = 1; v <= 5 && !capped; v++) {
      // a letter that already appears in ?'s row or column admits no completion
      if ((rows[rowOf(target)] & bit(v)) || (cols[colOf(target)] & bit(v))) continue;
      var g = Int8Array.from(grid); g[target] = v;
      if (existsCompletion(g, capNodes)) found.push(v);
      if (nodes > capNodes) capped = true;
    }
    function existsCompletion(g, cap) {
      // MRV backtracking with propagation-free candidate check
      var best = -1, bestCand = 0, bestN = 6;
      for (var i = 0; i < 25; i++) {
        if (g[i]) continue;
        var m = ALL;
        var r = rowOf(i), c = colOf(i);
        for (var k = 0; k < 5; k++) { m &= ~bit(g[r * 5 + k]); m &= ~bit(g[k * 5 + c]); }
        var n = popcount(m);
        if (n === 0) return false;
        if (n < bestN) { bestN = n; best = i; bestCand = m; if (n === 1) break; }
      }
      if (best === -1) return true; // full grid
      if (nodes++ > cap) { capped = true; return false; }
      var list = maskToList(bestCand);
      for (var x = 0; x < list.length; x++) {
        g[best] = list[x];
        if (existsCompletion(g, cap)) { g[best] = 0; return true; }
        g[best] = 0;
      }
      return false;
    }
    return {
      unique: found.length === 1,
      letters: found.map(function (v) { return v; }),
      answer: found.length === 1 ? found[0] : 0,
      nodes: nodes, capped: capped
    };
  }

  // 3. Solution-trace replay: an INDEPENDENT checker that walks the recorded
  //    steps and verifies every claimed deduction against the visible state
  //    (recomputing candidates from scratch, applying eliminations as it goes).
  function validateSolutionTrace(grid, target, steps, expectedAnswer) {
    var errs = [];
    var st = makeState(grid);
    var tR = rowOf(target), tC = colOf(target);
    for (var s = 0; s < steps.length; s++) {
      var step = steps[s];
      if (step.fill !== undefined && step.fill >= 0) {
        var i = step.fill, v = step.letter;
        if (st.vals[i]) { errs.push('step ' + s + ': cell already filled'); break; }
        if (!(st.cand[i] & bit(v))) { errs.push('step ' + s + ': letter not a candidate'); break; }
        var ok = false;
        if (st.cand[i] === bit(v)) ok = true; // naked single (covers T1/T4/T5/T8/T11)
        if (!ok) {
          // hidden single: letter v has exactly one possible cell in some line
          var lines = [lineCellsRow(rowOf(i)), lineCellsCol(colOf(i))];
          for (var li = 0; li < 2 && !ok; li++) {
            var spots = 0;
            for (var k = 0; k < 5; k++) { var j = lines[li][k]; if (!st.vals[j] && (st.cand[j] & bit(v))) spots++; }
            if (spots === 1) ok = true;
          }
        }
        if (!ok) { errs.push('step ' + s + ' (' + step.tech + '): deduction not forced'); break; }
        stateFill(st, i, v);
      } else {
        // elimination step: every removed (cell, letter) must have been a
        // real candidate just before this step (independent recomputation)
        var okE = true;
        (step.removed || []).forEach(function (rm) {
          if (!(st.cand[rm.cell] & bit(rm.letter))) okE = false;
          else st.cand[rm.cell] &= ~bit(rm.letter);
        });
        if (!okE) { errs.push('step ' + s + ': invalid elimination'); break; }
      }
    }
    if (!errs.length) {
      if (!st.vals[target]) errs.push('trace did not fill the target');
      else if (st.vals[target] !== expectedAnswer) errs.push('trace answer mismatch');
    }
    return errs;
  }

  // 4. Duplicate detection: canonical key of (givens pattern + letters + ? cell)
  //    under all row permutations x column permutations x transpose x relabels.
  function canonicalKey(grid, target) {
    var rowP = perms5(), colP = perms5();
    var best = null;
    for (var t = 0; t < 2; t++) {
      for (var ri = 0; ri < 120; ri++) {
        var rp = rowP[ri];
        for (var ci = 0; ci < 120; ci++) {
          var cp = colP[ci];
          var raw = '';
          for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) {
            var src = t ? (cp[r] * 5 + rp[c]) : (rp[r] * 5 + cp[c]);
            raw += (src === target) ? '?' : (grid[src] ? String.fromCharCode(64 + grid[src]) : '.');
          }
          // relabel letters by first appearance
          var map = {}, next = 0, key = '';
          for (var k = 0; k < 25; k++) {
            var ch = raw[k];
            if (ch >= 'A' && ch <= 'E') {
              if (!(ch in map)) map[ch] = String.fromCharCode(65 + next++);
              key += map[ch];
            } else key += ch;
          }
          if (best === null || key < best) best = key;
        }
      }
    }
    return best;
  }
  var _perms5 = null;
  function perms5() {
    if (_perms5) return _perms5;
    var out = [];
    function rec(arr, start) {
      if (start === 5) { out.push(arr.slice()); return; }
      for (var i = start; i < 5; i++) {
        var t = arr[start]; arr[start] = arr[i]; arr[i] = t;
        rec(arr, start + 1);
        t = arr[start]; arr[start] = arr[i]; arr[i] = t;
      }
    }
    rec([0, 1, 2, 3, 4], 0);
    _perms5 = out;
    return out;
  }
  function detectDuplicatePuzzle(grid, target, seenKeys) {
    var key = canonicalKey(grid, target);
    return { key: key, duplicate: seenKeys.has(key) };
  }

  /* ------------------------------------------------------------------ *
   *  buildQuestionBank — assembles 4 classes x 50 validated questions.  *
   *  quota: {className: {type: count}}. Progress + failure reasons are  *
   *  reported; the builder NEVER inserts an unvalidated question and    *
   *  NEVER lowers a class to fill a slot.                               *
   * ------------------------------------------------------------------ */
  function buildQuestionBank(opts) {
    opts = opts || {};
    var seed = opts.seed || 20261106;
    var rng = mulberry32(seed);
    var perClass = opts.perClass || 50;
    var quotas = opts.quotas || {
      Easy: { a: 50 },
      Medium: { b: 20, c: 18, e: 12 },
      Hard: { d: 12, e: 10, f: 10, h: 10, i: 8 },
      Extreme: { f: 16, g: 12, i: 10, j: 6, h: 6 }
    };
    var budget = opts.attemptBudget || 250000; // carve attempts overall
    var report = { seed: seed, generated: 0, rejected: 0, duplicates: 0, perClass: {}, perType: {}, perTech: {}, notes: [] };
    var seenKeys = new Set();
    var bank = { Easy: [], Medium: [], Hard: [], Extreme: [] };
    var classes = ['Easy', 'Medium', 'Hard', 'Extreme'];

    classes.forEach(function (cls) {
      var need = {};
      Object.keys(quotas[cls]).forEach(function (t) { need[t] = quotas[cls][t]; });
      var sinceHit = {};
      Object.keys(need).forEach(function (t) { sinceHit[t] = 0; });
      var attempts = 0, localBudget = Math.floor(budget / 4);
      while (bank[cls].length < perClass && attempts < localBudget) {
        attempts++;
        // Give up on stubborn types after 60% of the budget so the class still
        // fills (reported honestly in the notes — never silently relabelled).
        if (attempts === Math.floor(localBudget * 0.6)) {
          Object.keys(need).forEach(function (t) {
            if (need[t] > 0 && sinceHit[t] > localBudget * 0.2) {
              need[t] = 0;
              report.notes.push(cls + ': type ' + t + ' not reachable within budget; slots refilled with other types');
            }
          });
        }
        var square = generateLatinSquare(rng);
        var target = rngInt(rng, 25);
        // pick the type we still need most (proportional to remaining quota)
        var wantType = pickNeededType(need);
        var c = createPuzzle(square, target, cls, rng, { type: wantType, attempts: 6, earlyStop: 0.3 + 0.4 * rng() });
        if (!c || classifyPuzzle(c.trace).cls !== cls) { report.rejected++; tick(sinceHit); continue; }
        // accept rule: the type still has quota room, OR all quotas are done
        // and the class needs filler questions of any type.
        var quotaLeft = Object.keys(need).reduce(function (s, t) { return s + need[t]; }, 0);
        var wanted = quotaLeft > 0 ? need[c.type] > 0 : true;
        if (!wanted) { report.rejected++; tick(sinceHit); continue; }
        // full validation pipeline — nothing enters the bank unvalidated
        var solution = c.solution;
        // every solver fill must agree with the underlying square
        var fillMismatch = false;
        c.trace.steps.forEach(function (s) {
          if (s.fill !== undefined && s.fill >= 0 && solution[s.fill] !== s.letter) fillMismatch = true;
        });
        var errs = validatePuzzle(c.grid, c.target, solution, c.trace.answer);
        if (fillMismatch) errs.push('trace fill contradicts solution square');
        if (errs.length) { report.rejected++; tick(sinceHit); continue; }
        var ua = validateUniqueAnswer(c.grid, c.target);
        if (!ua.unique || ua.answer !== c.trace.answer) { report.rejected++; tick(sinceHit); continue; }
        var terrs = validateSolutionTrace(c.grid, c.target, c.trace.steps, c.trace.answer);
        if (terrs.length) { report.rejected++; tick(sinceHit); continue; }
        var dup = detectDuplicatePuzzle(c.grid, c.target, seenKeys);
        if (dup.duplicate) { report.duplicates++; tick(sinceHit); continue; }
        seenKeys.add(dup.key);
        if (need[c.type] > 0) need[c.type]--;
        Object.keys(sinceHit).forEach(function (t) { sinceHit[t]++; });
        sinceHit[c.type] = 0;
        bank[cls].push(makeQuestion(bank[cls].length + 1, cls, c));
        report.generated++;
      }
      report.perClass[cls] = bank[cls].length;
      if (bank[cls].length < perClass) {
        report.notes.push(cls + ': ' + bank[cls].length + '/' + perClass + ' after ' + attempts + ' attempts');
      }
    });
    function tick(map) { Object.keys(map).forEach(function (t) { map[t]++; }); }

    function count(arr) { return arr.length; }
    function pickNeededType(need) {
      var keys = Object.keys(need).filter(function (t) { return need[t] > 0; });
      if (!keys.length) return null;
      var sum = keys.reduce(function (s, t) { return s + need[t]; }, 0);
      var x = rng() * sum;
      for (var i = 0; i < keys.length; i++) { x -= need[keys[i]]; if (x <= 0) return keys[i]; }
      return keys[keys.length - 1];
    }
    // technique histogram
    classes.forEach(function (cls) {
      bank[cls].forEach(function (q) {
        q.techs.forEach(function (t) { report.perTech[t] = (report.perTech[t] || 0) + 1; });
        report.perType[q.type] = (report.perType[q.type] || 0) + 1;
      });
    });
    return { bank: bank, report: report, seenKeys: seenKeys };
  }

  function makeQuestion(num, cls, c) {
    var techs = [];
    c.trace.steps.forEach(function (s) { s.techs.forEach(function (t) { if (techs.indexOf(t) < 0) techs.push(t); }); });
    techs.sort(function (a, b) { return a - b; });
    return {
      id: cls.toUpperCase() + '-' + pad3(num),
      cls: cls, type: c.type,
      grid: c.grid, solution: c.solution, target: c.target,
      answer: c.trace.answer,
      givens: countGivens(c.grid),
      crossSeen: crossSeenOf(c.grid, c.target),
      steps: c.trace.steps.map(compactStep),
      stepsCount: c.trace.steps.length,
      phantoms: c.trace.totalPhantoms,
      maxPhantomRun: c.trace.maxPhantomRun,
      techs: techs,
      validated: true
    };
  }
  function compactStep(s) {
    return {
      fill: (s.fill === undefined ? -1 : s.fill),
      letter: s.letter || 0,
      tech: s.tech, techs: s.techs.slice(),
      reason: s.reason,
      cells: (s.cells || []).slice(),
      phantom: !!s.phantom,
      removed: s.removed ? s.removed.map(function (r) { return { cell: r.cell, letter: r.letter }; }) : [],
      data: s.data || null
    };
  }
  function crossSeenOf(grid, target) {
    var m = 0, tR = rowOf(target), tC = colOf(target);
    for (var k = 0; k < 5; k++) { if (grid[tR * 5 + k]) m |= bit(grid[tR * 5 + k]); if (grid[k * 5 + tC]) m |= bit(grid[k * 5 + tC]); }
    return popcount(m);
  }
  function pad3(n) { return (n < 10 ? '00' : n < 100 ? '0' : '') + n; }

  return {
    N: N, LTR: LTR, ALL: ALL,
    rowOf: rowOf, colOf: colOf, bit: bit, popcount: popcount, maskToList: maskToList,
    mulberry32: mulberry32, shuffle: shuffle, perm5: perm5,
    generateLatinSquare: generateLatinSquare,
    createPuzzle: createPuzzle,
    solveWithSteps: solveWithSteps,
    classifyPuzzle: classifyPuzzle,
    assignType: assignType,
    validatePuzzle: validatePuzzle,
    validateUniqueAnswer: validateUniqueAnswer,
    validateSolutionTrace: validateSolutionTrace,
    canonicalKey: canonicalKey,
    detectDuplicatePuzzle: detectDuplicatePuzzle,
    buildQuestionBank: buildQuestionBank,
    classifyMaster: classifyMaster,
    carveDeep: carveDeep,
    buildMasterBank: buildMasterBank,
    makeState: makeState, stateFill: stateFill,
    CLASS_RANK: CLASS_RANK
  };
});
