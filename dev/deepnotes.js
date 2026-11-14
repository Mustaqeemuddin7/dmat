/* ============================================================================
   dMAT Core Module Practice — Deep Dives curriculum (v5, original content)
   ----------------------------------------------------------------------------
   All wording is original to this platform. Formulas are elementary and
   machine-checkable; every worked walkthrough references a real bank question
   whose solution trace was verified by the platform's own solver, so nothing
   shown can contradict the engine.
   Block types per section:
     p  paragraph          f  formula box (array of lines)
     b  bullets            t  tricks (✓ list)        w  warnings (⚠ list)
     walk {cls, pickTech?} — render a verified bank question walkthrough
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DMATDeepNotes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    shared: {
      title: 'The Core Module game plan (applies to all three subtests)',
      blocks: [
        { b: [
          "Each subtest = 20 questions in 25 minutes → an average of 75 seconds per question, including reading time. The three subtests run back-to-back with two 2-minute desk breaks inside the Core Module.",
          "There is NO negative marking anywhere in the Core Module. A blank is worth 0 — an answer is worth ≥ 0. Never submit a blank.",
          "The three-pass routine: pass 1 — solve everything that feels Easy or Medium; pass 2 — the Hard items; pass 3 — Extreme/Master leftovers. Marking and returning beats staring at one item.",
          "Your Group tab shows the group's accuracy and pace per class — use it to see which class is eating your time."
        ] },
        { w: [
          "Do not 'bank' time by racing Easy items at 15 s and then drowning in one Master question — the clock belongs to the whole subtest, not to one question.",
          "Do not leave a subtest early: a guessed answer after elimination is free equity."
        ] }
      ]
    },
    latin: [
      { id: 'L1', title: '1 · The mathematics under the hood', blocks: [
        { p: "A Latin square of order 5 is a 5×5 grid in which each letter A–E appears exactly once in every row and exactly once in every column. Diagonals play no role. Every row and every column is a permutation of A–E — which means each row is missing exactly one letter, and each column is missing exactly one letter." },
        { f: ["a complete line  =  {A, B, C, D, E}", "every row misses exactly 1 letter  ·  every column misses exactly 1 letter"] },
        { p: "How many different 5×5 Latin squares exist? 161,280 — the 56 'reduced' squares times 5! × 4! rearrangements. You will practically never see the same grid twice, but every puzzle you meet is one of these structures." },
        { p: "One formula drives the entire subtest. Every technique in your list is a way of shrinking this set to a single letter:" },
        { f: ["candidates(cell)  =  (letters missing from its ROW)  ∩  (letters missing from its COLUMN)"] },
        { p: "The ? is just a cell. Once enough information is in place, the answer is the single letter left in both missing-sets." }
      ] },
      { id: 'L2', title: '2 · The Cross — read two lines as one', blocks: [
        { p: "Merge ?'s row and ?'s column into one list (a letter seen in both counts once). The answer is the letter absent from that merged list:" },
        { f: ["answer(?)  =  {A,…,E}  \\  ( row(?) ∪ column(?) )", "4 distinct letters visible in the cross  →  the 5th letter is the answer"] },
        { p: "The 15-sum shortcut (optional speed aid): give A=1, B=2, C=3, D=4, E=5. Every complete line sums to 15, so the missing letter follows from simple subtraction:" },
        { f: ["?  =  15  −  sum of the four distinct letters visible in the cross", "example: seen B, C, D, E  →  sum 14  →  ? = 15 − 14 = 1 → A", "two candidates {x, y} left  →  value(x) + value(y)  =  15 − sum(other three seen)"] },
        { t: [
          "If the cross shows four distinct letters, answer immediately — do not read further.",
          "Scan the row left→right, the column top→bottom, then name the absent letter in your head — naming it locks it in.",
          "The sum trick also works with two missing letters: their value-sum narrows the pair before you even look at the columns."
        ] },
        { w: [
          "The sum trick assumes the four seen letters are DISTINCT. If a letter appears twice in the cross, fall back to plain elimination.",
          "It is a check, not a proof — the column veto can only be seen by looking, not by adding."
        ] },
        { walk: { cls: 'Easy' } }
      ] },
      { id: 'L3', title: '3 · Letter scan — count placements, do not stare', blocks: [
        { p: "Flip the question: instead of 'what can this cell be?', ask 'where can this LETTER go?'. A letter already placed 4 times is missing from exactly one row R and one column C — their crossing cell is its forced fifth home:" },
        { f: ["letter placed 4×  →  missing from exactly 1 row R and 1 column C", "cell (R, C) empty  →  the letter is forced there — valid in every completion"] },
        { p: "If (R, C) is the ?, you are done. If not, it is a free fill that usually completes a line your cross needs. Letters placed 3 times are the next best targets: 2 missing rows × 2 missing columns leave at most 4 candidate cells." },
        { b: [
          "Tally once at the start of Hard+ grids: A×4 B×3 C×3 D×2 E×3 — fifteen seconds that pays for itself.",
          "Scan 4-placement letters first, then 3.",
          "The tally also tells you which letters are scarcest — those are usually the last to resolve."
        ] },
        { w: ["Do not re-tally mid-solve; update it mentally as you fill."] },
        { walk: { cls: 'Medium', pickTech: 2 } }
      ] },
      { id: 'L4', title: '4 · Trapped candidate — the two-cell squeeze', blocks: [
        { p: "When ? has exactly two candidates {x, y} and its row (or column) has exactly one other empty cell e, that line is missing exactly {x, y}. Whatever e cannot take is trapped in ?:" },
        { f: ["line of ? has empty cells {?, e}  →  line misses {x, y}  =  candidates(?)", "x ∉ candidates(e)   →   e = y   →   ? = x"] },
        { p: "Why it is valid: any completion must place both x and y somewhere in that line; there are only two homes; one of them (e) refuses x — so x belongs to ? and y to e. This is naked-single logic applied across a pair, and it is the crux of most Medium questions." },
        { w: [
          "Check BOTH lines of ? — the trap may live in the row or the column.",
          "The partner cell e must be EMPTY. A filled line with three letters visible is a different situation (plain cross)."
        ] }
      ] },
      { id: 'L5', title: '5 · Phantom cells — derive, use, drop', blocks: [
        { p: "A phantom fill is a cell you solve in your head that is NOT in ?'s row or column. Its value is forced by the same row/column logic as any other fill, so it is exactly as reliable as a written one — you simply never write it. The examiners explicitly expect this: 'sometimes you have to fill other cells in your head first'." },
        { b: [
          "Choose the road: only derive cells that share a line with ? — directly, or through one intermediate cell. Fills that cannot reach the cross are wasted thought.",
          "Budget: hold at most TWO phantom letters at once. A chain of three or more means you picked a bad road — drop everything and re-scan.",
          "Label phantoms with their cell: 'C at row 2, column 5'. Vague phantoms cause wrong placements.",
          "The moment a phantom unlocks a cross letter, use it and drop it — do not keep carrying it."
        ] },
        { w: [
          "The classic error: keeping a phantom from an ABANDONED road after re-planning. Reset your mental scratchpad when you switch strategy.",
          "Phantoms chain: one phantom often creates the naked single for the next. That is fine — that is what 'long chain' questions test."
        ] },
        { walk: { cls: 'Hard', pickTech: 6 } }
      ] },
      { id: 'L6', title: '6 · Pairs & X-wing — the advanced artillery', blocks: [
        { p: "Naked pair: two cells in ONE line whose candidates are the same two letters {x, y}. Those letters are reserved for those cells — remove x and y from every other cell of that line." },
        { p: "Hidden pair: two letters that can each go only in the same two cells of a line. Those cells belong to that pair — remove every OTHER candidate from those two cells." },
        { p: "X-wing: a letter with exactly two possible cells in each of two rows, sharing the same two columns. Wherever the letter sits, it occupies both columns across those rows — so it is impossible elsewhere in those columns. The mirror version swaps rows and columns." },
        { f: ["X-wing:  letter L possible only at (r1,c1),(r1,c2) and (r2,c1),(r2,c2)", "→  remove L from (r, c1) and (r, c2) for every other row r"] },
        { w: [
          "Honest numbers from this platform's verified bank: fewer than 3% of 250 generated questions needed a pair or wing, and those were all Master-level. Reach for phantoms first — pairs only when NOTHING on the board is forced.",
          "A pair only counts when both cells share ONE line (same row or same column)."
        ] },
        { walk: { cls: 'Extreme', pickTech: 15 } }
      ] },
      { id: 'L7', title: '7 · Exam routine — the 75-second drill', blocks: [
        { b: [
          "0–10 s: read the cross as one merged list. Four distinct letters → answer, move on.",
          "10–25 s: road scan — naked singles in ?'s two lines (busiest line first), then hidden singles by letter tally.",
          "25–50 s: phantom chain toward ? (maximum two phantoms in your head).",
          "50–60 s: still stuck → mark it, skip it, return in pass 2 or 3.",
          "Last resort: guess AFTER eliminating. Once the cross narrows to two candidates, a guess is worth 50%; a blank is worth 0."
        ] },
        { w: [
          "Never complete the grid 'for beauty'. Every fill must walk toward the ? — that is the whole discipline of this subtest.",
          "Two candidates you cannot separate after 60 s is a legitimate coin-flip: pick one, mark it, move on."
        ] }
      ] }
    ],
    math: [
      { id: 'M1', title: '1 · The format decoded', blocks: [
        { p: "You get a small system of equations over letters (A, B, C, …). Every letter is a WHOLE NUMBER between 1 and 20, and the system has exactly one solution per letter — the official task is to find 'which numbers fit the unknown letters to make the equations fit'. There are no answer options: the value is worked out." },
        { f: ["each letter  ∈  {1, 2, …, 20}   (whole numbers only)", "every equation is LINEAR:  (coefficients × letters)  =  constant", "the system has a unique solution  →  every correct deduction is forced"] },
        { p: "The bounded whole-number domain is your superpower. Arithmetic that 'almost works' — a fraction, a zero, a 21 — is instantly wrong. You are not solving algebra on paper; you are fitting whole numbers." },
        { w: ["Two different letters may occasionally share the same value, but you never need to assume that — the equations alone force everything."] }
      ] },
      { id: 'M2', title: '2 · Substitution — solve the smallest equation first', blocks: [
        { p: "Rank the equations by how many UNKNOWN letters they contain. One unknown → solve it now. Then feed known values forwards:" },
        { f: ["A + B = S,   A = a   →   B = S − a", "A − B = D,   A = a   →   B = a − D      (valid because B ≥ 1 → a ≥ D + 1)", "k·A = C   →   A = C ÷ k      (must divide exactly — see divisibility)"] },
        { b: [
          "Write each solved value next to its letter once, and reuse it in every later equation.",
          "Work strictly forwards from the givens toward the ? — every verified trace on this platform does exactly that.",
          "An equation you cannot use yet is not useless: it tells you what you are waiting for."
        ] },
        { w: ["Starting from a two-unknown equation with no known values burns ~20 seconds. Rank before you compute."] },
        { walk: { cls: 'Easy' } }
      ] },
      { id: 'M3', title: '3 · Elimination — the sum & difference formulas', blocks: [
        { p: "When two equations contain exactly the same two unknown letters, combine them to cancel one letter. The classic pair — a sum and a difference of the same two letters — has a closed-form solution:" },
        { f: ["X + Y = S      X − Y = D", "→   X = (S + D) ÷ 2        Y = (S − D) ÷ 2", "example:  A + C = 20,  A − C = 8   →   A = 14,  C = 6"] },
        { p: "Parity check (2-second sanity test): S and D must have the same parity — both even or both odd — or X would not be a whole number. If the parity fails, you misread an equation." },
        { p: "With general coefficients, scale and combine: multiply each equation so ONE letter shares the same coefficient, then add (opposite signs) or subtract (same signs):" },
        { f: ["2X + Y = S      X + Y = T      →   subtract:  X = S − T", "3X + 2Y = S,  X + 2Y = T   →   subtract:  2X = S − T  →  X = (S − T) ÷ 2"] },
        { b: [
          "Adding cancels a letter whose coefficients are opposite (+1 vs −1, +2 vs −2 …).",
          "Subtracting cancels a letter whose coefficients are identical.",
          "After cancelling, divide out any common factor before dividing into the constant."
        ] },
        { w: ["Sign slips are the number-one error in this subtest. Rewrite each equation with moved terms BEFORE combining — never combine in your head."] },
        { walk: { cls: 'Hard', pickElim: true } }
      ] },
      { id: 'M4', title: '4 · Multiples, divisibility & the 1–20 domain', blocks: [
        { p: "k·A = C forces A = C ÷ k — so C must be divisible by k AND the result must land inside 1..20. Mental divisibility rules:" },
        { b: [
          "÷2 — C is even.",
          "÷3 — the digit sum of C is divisible by 3 (45 → 4+5 = 9 ✓).",
          "÷4 — the last two digits are divisible by 4 (equivalently: C ÷ 2 is even).",
          "÷5 — C ends in 0 or 5."
        ] },
        { p: "The range check kills impossible equations without any division:" },
        { f: ["A ∈ [1, 20]   →   k·A ∈ [k, 20k]", "7A = 150  →  impossible (150 ÷ 7 is not whole, and 7·20 = 140 < 150)"] },
        { p: "The domain is also a solver: if one equation leaves a letter with candidates {3, 9, 15}, a second equation usually kills two of the three instantly. Whole-number fitting is the whole game." },
        { walk: { cls: 'Medium', pickTech: 3 } }
      ] },
      { id: 'M5', title: '5 · Differences create ORDER, not just values', blocks: [
        { p: "A − B = D is an ordering statement in disguise: A = B + D, so A > B, and every valid pair (A, B) has B ≥ 1 and A ≤ 20:" },
        { f: ["A − B = D   →   A = B + D  →  A > B   and   A ≥ D + 1", "A − B = 19   →   (A, B) = (20, 1)   — the only pair inside 1..20"] },
        { b: [
          "Combine a SUM and a DIFFERENCE of the same pair: half their sum ± half their difference (the formulas in section 3).",
          "Use order information early: if the equations force A > C and the ? is the smaller letter, the ? is capped — sometimes enough to finish by elimination of options.",
          "A difference equal to a big number is a gift: very few pairs fit the range."
        ] },
        { w: ["A difference larger than 19 is impossible in this domain — that always means a misread sign."] }
      ] },
      { id: 'M6', title: '6 · Check by substitution — the 5-second error trap', blocks: [
        { p: "After solving, substitute your values into every equation you did NOT use. One violation = a sign or division slip, and the failing equation localizes it immediately:" },
        { f: ["plug ALL values into ALL equations  →  left side = right side, every line"] },
        { t: [
          "Verify with the domain too: a 0, a 21, or a fraction means an arithmetic slip — the puzzle will never demand one.",
          "If exactly one equation fails, recompute only the step that produced the letter in it."
        ] },
        { w: ["Checking only the equation you used last is checking nothing — it is true by construction."] }
      ] },
      { id: 'M7', title: '7 · Exam routine — attempt, do not guess', blocks: [
        { b: [
          "0–10 s: read ALL equations. Rank them by unknown count.",
          "10–50 s: substitution chain toward the ?; elimination when a pair of equations shares two unknowns.",
          "50–60 s: verify by substitution (10 s — it catches 90% of errors).",
          "Stuck at 40 s? Mark and return. A fresh look usually finds the substitution you missed."
        ] },
        { w: [
          "Unlike Latin Squares, a blind guess here is worth ~1/20. The value of an educated partial deduction (range, parity, divisibility) is real — narrow before you commit.",
          "Never leave a blank at the end: write your best bounded estimate rather than nothing."
        ] },
        { walk: { cls: 'Extreme' } }
      ] }
    ],
    figures: [
      { id: 'F1', title: '1 · Anatomy of a rule', blocks: [
        { p: "Every sequence is a set of rules applied to every frame, in a fixed order. Each rule has four parts — learn to name them and you can 'read' any sequence:" },
        { f: ["RULE  =  ELEMENT  +  ATTRIBUTE  +  OPERATION  +  RATE", "element   : which figure (the arrow, the square, the L…)", "attribute : position · rotation · shading (outline/grey/solid) · colour · mirror", "operation : rotate ±90° · move one cell · cycle shading · swap · join the pattern", "rate      : every frame — or every 2nd frame (alternating)"] },
        { p: "Frames are computed, never random: frame n = the start figure with all rules applied n times. If your rule list explains EVERY difference between consecutive frames with nothing left over, your rules are complete — that is the success criterion." },
        { w: ["The official format changes 'position, colour and/or alignment' — so at least one rule almost always touches position or shading. If you only found rotation, keep looking."] }
      ] },
      { id: 'F2', title: '2 · The tracking method — one element at a time', blocks: [
        { b: [
          "Pick the most DISTINCTIVE element — an arrow or an L-shape, not a circle (rotation is invisible on a circle).",
          "Follow it through all five frames: does it turn? move? darken? change colour?",
          "Lock its rule verbally: 'the arrow turns 90° clockwise each frame'. Saying it precisely is half the solve.",
          "Repeat for the next element until every visible change is owned by exactly one rule."
        ] },
        { w: [
          "Do not track two elements simultaneously — sequential tracking, then combining, is faster and far less error-prone."
        ] },
        { walk: { cls: 'Medium' } }
      ] },
      { id: 'F3', title: '3 · The difference method — a ledger for changes', blocks: [
        { p: "Compare frame n with frame n+1 and list EVERY visible change. Each change must be claimed by exactly one rule:" },
        { b: [
          "A change nobody claims → you missed a rule. Look for shading or colour first — the least visible attributes.",
          "A change claimed by two rules → you double-attributed; merge or split the rules.",
          "Zero unclaimed changes → your rule set is complete; compute the answer frame mechanically."
        ] },
        { p: "This converts a 'do I see the pattern?' feeling into a checkable ledger — the fastest reliable way to crack Hard and Master sequences." }
      ] },
      { id: 'F4', title: '4 · Path arithmetic — where movement rules go', blocks: [
        { p: "Positions form a 3×3 grid. A movement rule is a cyclic path; the element hops one cell along it per frame:" },
        { f: ["position(frame n)  =  path[ (startIndex + n)  mod  pathLength ]", "rows / columns / diagonals  =  3-cell paths  →  cycle every 3 frames", "perimeter of the grid  =  8-cell path  →  cycles every 8 frames"] },
        { p: "Example: an element starting at the top-left corner on the perimeter path visits top-middle → top-right → middle-right → bottom-right → … one cell per frame, hopping around the edge." },
        { w: [
          "Short paths cycle quickly: after 3 frames the element is back where it started. Always check 'has this position repeated?' before inventing extra rules."
        ] },
        { walk: { cls: 'Hard' } }
      ] },
      { id: 'F5', title: '5 · Combined period — when the whole pattern loops', blocks: [
        { p: "Each rule has a period: a rotation step of 90° returns after 4 frames (180° after 2); shading and colour cycle in 3; a swap or flip in 2; the perimeter path in 8. The WHOLE sequence loops with the least common multiple of the individual periods:" },
        { f: ["period(sequence)  =  LCM( period(rule₁), period(rule₂), … )", "rotate(4) + move-on-a-row(3)   →   LCM = 12   →  frame 6 is brand new", "shade(3) + move-on-a-row(3)    →   LCM = 3    →  the pattern cycles within the shown frames"] },
        { p: "Easy sequences frequently cycle inside the shown frames — that is the tested skill, not a flaw. Detect the period and the answer is simply the frame that continues the cycle: answer = frame ((hidden index) mod period)." },
        { walk: { cls: 'Easy' } }
      ] },
      { id: 'F6', title: '6 · Distractor elimination — verify, do not vibe', blocks: [
        { p: "On this platform every wrong option breaks exactly ONE rule — that is how the distractors are constructed, and real exams are similar. Treat the rules as a checklist and score each option against it:" },
        { b: [
          "Check the cheapest rule first (shading, colour), the most expensive last (exact positions).",
          "The correct option satisfies ALL rules simultaneously; each wrong option fails exactly one.",
          "If TWO options satisfy all your rules, a rule is missing or misread — go back one step rather than guessing between them."
        ] },
        { w: ["Do not eliminate by 'looks wrong' — name the broken rule. Naming is what makes elimination reliable under time pressure."] }
      ] },
      { id: 'F7', title: '7 · Exam routine — 30 + 30 + 15', blocks: [
        { b: [
          "0–30 s: build the rule list (tracking method + difference ledger).",
          "30–60 s: compute the answer frame; eliminate options rule by rule.",
          "60–75 s: commit. On Master sequences a partial elimination (2 of 3 rules verified) usually already leaves a single survivor."
        ] },
        { w: [
          "If nothing is verifiable at 60 s (rare), pick the option that respects the most CONCRETE rules (positions) over ones that only differ in subtle shading."
        ] },
        { walk: { cls: 'Extreme' } }
      ] }
    ]
  };
});
