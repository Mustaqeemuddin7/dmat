/* ============================================================================
   dMAT Core Module Practice — Study Notes content (v6, original material)
   ----------------------------------------------------------------------------
   All prose is original to this platform. Every worked example referenced by a
   `walk` or `qex` block is a REAL bank question whose solution trace was
   verified by the platform's solver — nothing is hand-invented or copied.
   Block types:
     p  paragraph        f  formula box        b  bullets
     t  tricks (✓)       w  warnings (⚠)       svg  inline illustration
     table {head, rows}  walk {cls, pickTech?, pickElim?}   qex {type}
   Technique lessons (TL) add: def, steps[], why, summary — merged at compile
   time with the platform's technique metadata (when to use / common mistakes).
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DMATNotesContent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------- technique lessons (definition / steps / why / summary) ---- */
  const TL = {
    latin: {
      1: { def: "The merged reading of ?'s row and column as ONE list of letters.", steps: [
        "Read ?'s row left to right and note its letters.",
        "Read ?'s column top to bottom and add them to the same mental list (a letter seen twice counts once).",
        "Count the distinct letters: four visible means the fifth is the answer.",
        "Name the answer letter in your head and commit." ],
        why: "Every valid completion must place all five letters in ?'s row and in ?'s column. The four distinct letters you see eliminate four of the five options, so the missing one is forced in every completion — no guessing involved.",
        summary: "Merge row + column → the absent letter is the answer. Always your first move." },
      2: { def: "Counting where a LETTER can go, instead of reading a cell.", steps: [
        "Tally each letter's placements across the whole grid (A×?, B×? …).",
        "A letter with 4 placements is missing from exactly one row R and one column C.",
        "If cell (R, C) is empty, the letter is forced there — valid in every completion.",
        "If (R, C) is the ?, that letter is your answer." ],
        why: "Each of the 4 placements removes the letter from one row and one column. With five of each, exactly one row and one column still lack it — and their crossing cell is its only possible home.",
        summary: "4 placements = exactly 1 legal cell. Scan letters, not cells." },
      3: { def: "Resolving ?'s two candidates by inspecting the only other empty cell in its line.", steps: [
        "Confirm ? has exactly two candidates {x, y}.",
        "Find the other empty cell e in ?'s row or column (the line then has exactly two empties).",
        "Test x against e's crossing line: if x is already there, e cannot be x.",
        "Then e = y, and ? = x." ],
        why: "The line must contain both x and y somewhere; there are only two empty homes. Blocking one option at e forces the other letter into e and leaves x for ?.",
        summary: "Two candidates + one partner cell = one elimination decides both." },
      4: { def: "Starting from the line that already holds four letters.", steps: [
        "Scan all rows and columns for a line with exactly one empty cell.",
        "The line's missing letter is that cell's only row-candidate — check the crossing column confirms it.",
        "Fill it, and prefer lines that share a row or column with ?.",
        "Re-read the cross — it often completes it." ],
        why: "A line with four letters is missing exactly one; the empty cell's crossing line either allows or vetoes the candidate. The deduction is instant and usually feeds ?'s cross.",
        summary: "Four-filled lines solve themselves. Start there, never in an empty region." },
      5: { def: "The discipline of testing every row-based candidate against its column (and vice versa).", steps: [
        "List the letters missing from the cell's row.",
        "For each candidate, check the crossing column.",
        "A candidate already present in the column is eliminated — the veto.",
        "Continue until exactly one candidate survives, then fill." ],
        why: "A placement must satisfy both constraints at once. Checking only one line admits letters the other line forbids — the classic wrong answer.",
        summary: "Row proposes → column vetoes. Both lines, every time." },
      6: { def: "Solving a supporting cell in your head — outside ?'s lines — using it, and dropping it.", steps: [
        "Ask what information the cross is missing.",
        "Pick a road: an empty cell sharing a line with ? (or one step away from such a line).",
        "Derive that cell's forced value with the normal techniques.",
        "Use the phantom value to unlock ?'s line, then drop it. Never hold more than two phantoms." ],
        why: "The phantom's value is forced by the same row/column rules as any written fill, so conclusions built on it are exactly as valid — you simply skip the writing.",
        summary: "Mentally fill → unlock → drop. Two phantoms max; a longer chain means re-plan." },
      7: { def: "Working a puzzle whose cross shows almost nothing.", steps: [
        "Accept that the cross gives nothing yet — switch to letter-view.",
        "Tally placements; find letters with 4 or 3 placements.",
        "Force their remaining homes (letter scan); prefer fills on lines touching ?.",
        "Rebuild the cross from the new fills and repeat." ],
        why: "With a nearly empty cross, cell-view leaves too many candidates. Letter-view still produces forced fills, because few placements mean few legal homes.",
        summary: "Empty cross → chase letters, not cells." },
      8: { def: "A line with exactly two empty cells, missing exactly two letters.", steps: [
        "Spot a line with two empties; compute its two missing letters {x, y}.",
        "Test each letter against each empty cell's crossing line.",
        "One letter excluded from one cell → that cell takes the other letter.",
        "Placing one immediately places the partner." ],
        why: "Two letters, two homes, and one home refusing one letter forces the whole pair — this is the trapped-candidate logic seen from the line's perspective.",
        summary: "Resolve the pair together — one deduction fills both cells." },
      9: { def: "The routing discipline: spend ~10 seconds choosing which cells to solve so every fill walks toward ?.", steps: [
        "Ask: what would let me read the cross right now?",
        "Fill only cells in ?'s two lines — or one step away from them.",
        "Re-evaluate after each fill; abandon roads that stop paying.",
        "Ignore everything else on the grid." ],
        why: "The answer depends only on ?'s row and column. Unrelated fills cost time and mental space without touching the intersection you need.",
        summary: "Solve toward ?, not the whole grid." },
      10: { def: "The skip-and-return discipline for jammed questions.", steps: [
        "At 50–60 seconds without resolution, mark the question.",
        "Move on; return in a later pass with fresh eyes.",
        "If you must guess, eliminate what the cross rules out first.",
        "Never submit a blank — there is no negative marking." ],
        why: "One Extreme question can consume the time of three easy ones. Expected score rises when hard items wait their turn.",
        summary: "Skip early, return late, never blank." },
      11: { def: "A cell whose row and column leave exactly one candidate.", steps: [
        "Compute the row's missing letters and the column's missing letters.",
        "Intersect the two sets.",
        "One letter surviving → fill the cell.",
        "Re-scan for knock-on singles." ],
        why: "Both constraints must hold simultaneously; when the intersection of the two missing-sets has one member, that member is forced in every completion.",
        summary: "Row-missing ∩ column-missing = the fill. The Cross is this applied to ?." },
      12: { def: "A letter with exactly one possible home inside a line.", steps: [
        "Pick a line; list its missing letters.",
        "For each missing letter, check which empty cells of the line can host it (the letter must not appear in the cell's crossing line).",
        "Exactly one host → place the letter there.",
        "Update the line and continue." ],
        why: "The line must contain the letter exactly once; with a single legal home, the placement is forced regardless of that cell's other candidates.",
        summary: "A letter with one home in a line goes there — even if the cell shows other options." },
      13: { def: "Two cells in one line sharing the same two candidates.", steps: [
        "Find two empty cells in a line whose candidate sets are identical two-letter pairs {x, y}.",
        "Reserve x and y for those two cells.",
        "Remove x and y from the candidates of every other cell in the line.",
        "Re-scan — new singles often appear." ],
        why: "The line must place both letters; with only those two cells able to take them, no other cell in the line can use either letter.",
        summary: "Same two candidates, same line → reserve the pair, clean the line." },
      14: { def: "Two letters confined to the same two cells of a line.", steps: [
        "In a line with three or more empty cells, find two letters whose possible cells are the same two cells.",
        "Clear every other candidate from those two cells.",
        "The pair now acts as a fixed reservation inside the line.",
        "Combine with crossing-line information to finish." ],
        why: "Both letters must appear in the line; with only two homes available, those homes cannot take anything else.",
        summary: "Two letters, two cells, one line → the cells are theirs." },
      15: { def: "A letter locked into a rectangle across two rows and two columns.", steps: [
        "Find a letter with exactly two possible cells in row r1 — at columns c1 and c2.",
        "Find another row r2 where the letter has the same two-column footprint.",
        "Remove the letter from (r, c1) and (r, c2) for every other row r.",
        "Mirror the logic for columns when useful." ],
        why: "Whichever way the letter is arranged across the two rows, it occupies both columns. Other cells in those columns cannot take it.",
        summary: "Two rows, same two columns → clean those columns. Rare on 5×5 — phantoms first." },
      16: { def: "The A=1…E=5 arithmetic shortcut — used only where the puzzle's constraints support it.", steps: [
        "Map letters to values: A=1, B=2, C=3, D=4, E=5. A complete line sums to 15.",
        "Four distinct seen letters in the cross → ? = 15 − their sum.",
        "Two candidates left → their value-sum narrows the pair (remaining sum 7 → {B,E} or {C,D} — split them by column).",
        "Verify with elimination before committing." ],
        why: "The five value slots sum to 15 in every line; when the seen set is complete and distinct, the missing value is determined.",
        summary: "15 minus what you see. An accelerator and a check — never a proof." },
      17: { def: "The opening count of how often each letter is placed.", steps: [
        "Before solving a Hard+ grid, count placements: A×?, B×? …",
        "Letters with 4 placements are the cheapest to finish (letter scan).",
        "Letters with 3 placements are next — their home set is at most 4 cells.",
        "Return to the tally whenever you get stuck." ],
        why: "Placement count directly bounds the number of legal homes. The scarcest-letter information is the cheapest deduction available on the whole board.",
        summary: "Count first, solve second." }
    },
    math: {
      1: { def: "Starting at the ? letter and asking what its equation needs.", steps: [
        "Find the equation that contains the ? letter.",
        "List the other letters in it — those become your sub-goals.",
        "Solve the prerequisites first (fewest unknowns first), then return to the ? equation.",
        "Verify by substituting into an unused equation." ],
        why: "The ?'s equation is the last link of the chain. Solving its dependencies first guarantees every value is ready exactly when you need it.",
        summary: "Target first, prerequisites second, answer last." },
      2: { def: "Solving the equation with the fewest unknown letters and feeding values forward.", steps: [
        "Rank the equations by number of unknown letters.",
        "Solve any one-unknown equation immediately.",
        "Substitute known values into the next-smallest equation.",
        "Repeat until every letter is known." ],
        why: "Each substitution reduces the system's unknowns by one; working smallest-first means no step ever requires information you do not have.",
        summary: "Smallest equation first — then let the knowns cascade." },
      3: { def: "Combining two equations that share the same two unknown letters.", steps: [
        "Identify the pair of equations and the shared letters.",
        "Scale one equation so a coefficient matches the other's.",
        "Add (opposite signs) or subtract (same signs) to cancel one letter.",
        "Solve the survivor, then substitute back for the cancelled letter." ],
        why: "Cancellation removes an unknown without solving anything first — it is the designed shortcut when two equations interlock.",
        summary: "Two equations, shared pair → combine and cancel." },
      4: { def: "Reading two equations against each other to spot designed shortcuts.", steps: [
        "Group equations by the letters they contain.",
        "Compare coefficients: identical → subtract; opposite → add; multiples → scale first.",
        "Use the result to isolate a letter or bound a range." ],
        why: "Linked systems are built so pairs of equations interact; comparing them finds the intended shortcut before brute substitution.",
        summary: "Equations are messages to each other — read them side by side." },
      5: { def: "Prioritising the letter that appears in the most equations.", steps: [
        "Count each letter's appearances across the system.",
        "Solve the busiest letter first — one deduction unlocks many equations.",
        "Propagate its value everywhere immediately." ],
        why: "Hinge letters maximise information per deduction: one value known turns several equations into one-unknown solves.",
        summary: "Solve the busiest letter first." },
      6: { def: "Using the 1–20 whole-number domain to prune candidates.", steps: [
        "Derive each letter's possible values or range from its equations.",
        "Apply divisibility (÷2 even, ÷3 digit-sum, ÷5 ends in 0/5) and parity checks.",
        "Intersect the constraints across equations.",
        "One survivor → that is the letter's value." ],
        why: "Bounded whole-number domains make most candidate sets tiny; intersecting constraints finishes them without heavy algebra.",
        summary: "Every constraint shrinks the window — intersect them." },
      7: { def: "Ensuring every equation agrees with your solution.", steps: [
        "Substitute all values into ALL equations.",
        "Check left side = right side for each line.",
        "A single failure → recompute the step that produced the letter in that equation." ],
        why: "A consistent system confirms the solution; one violation pinpoints the exact erroneous deduction instead of a vague feeling.",
        summary: "All lines agree — or the answer is wrong." },
      8: { def: "Final verification against the unused equations and the domain.", steps: [
        "Substitute into equations NOT used during the solve (an independent check).",
        "Re-check the domain: whole numbers, 1–20 for every letter.",
        "Re-read the question: is the asked letter the one you solved for?" ],
        why: "Equations used for the solve are true by construction; unused equations are independent witnesses of correctness.",
        summary: "Verify with unused equations + the domain, then answer." }
    },
    figures: {
      1: { def: "Comparing consecutive frames to build a complete change ledger.", steps: [
        "Place frame 1 and frame 2 side by side (mentally).",
        "List every visible difference: position, rotation, shading, colour, count.",
        "Assign each difference to a rule.",
        "Repeat for the next pair; the rule list must explain everything." ],
        why: "A complete ledger guarantees no rule is missed and none is double-counted — the two failure modes of sequence solving.",
        summary: "Frame-to-frame differences → the rule list." },
      2: { def: "Following a single element across all frames before looking at anything else.", steps: [
        "Pick the most distinctive element (an arrow or L — not a circle).",
        "Tabulate its attribute frame by frame: rotation? position? shading?",
        "Lock its rule verbally: 'the arrow turns 90° clockwise each frame'.",
        "Repeat for the next element until every change is owned." ],
        why: "Sequential tracking avoids the two classic errors: attributing one change to two rules, and missing invisible-attribute changes (shading).",
        summary: "One element, one rule, then the next." },
      3: { def: "Reading rotation direction and step size from a chiral shape.", steps: [
        "Use a shape with a clear head (arrow, triangle apex, L).",
        "Compare its pointing direction between consecutive frames.",
        "Decide clockwise or anticlockwise and the step (90° or 180°).",
        "Verify on the next frame before trusting it." ],
        why: "Rotation is modular (90° steps wrap after 4), so a verified direction + step predicts every future frame exactly.",
        summary: "Head of the shape → direction → step. Verify twice." },
      4: { def: "Recognising mirror (left-right flip) rules.", steps: [
        "Use a chiral shape — one whose mirror image differs from itself.",
        "Compare the shape's 'handedness' between frames.",
        "If it flips each frame, the rule is a mirror toggle (2-frame period).",
        "Combine with rotation rules carefully — flip interacts with rotation." ],
        why: "Only asymmetric shapes show a mirror change, so they are the reliable signal for this rule.",
        summary: "Chiral shape changes handedness → mirror rule." },
      5: { def: "Counting the number of elements per frame.", steps: [
        "Count elements in each frame: 2, 3, 4, …",
        "A rising count = an addition rule; a falling count = a removal rule.",
        "Identify WHAT joins or leaves and WHEN (from frame n onward).",
        "Track the newcomer's own movement rule if it has one." ],
        why: "Count changes are the most visible signal in a sequence — they anchor the frame numbering and often explain the 'new' content of the answer frame.",
        summary: "Count per frame → addition or removal rule." },
      6: { def: "Mapping position changes onto paths.", steps: [
        "Mark the moving element's cell in each frame.",
        "Identify the path: a row, a column, a diagonal, or the 8-cell perimeter.",
        "Confirm the step is exactly one cell per frame.",
        "Compute the next position with the path cycle." ],
        why: "Paths are cyclic: position(n) = path[(start + n) mod length]. Verified on two frames, it predicts every later frame.",
        summary: "Cell-by-cell positions reveal the cyclic path." },
      7: { def: "Handling alternating rules and multiple simultaneous rules.", steps: [
        "If a change happens every SECOND frame only, tag the rule as alternating (period ×2).",
        "List all rules; compute the combined period as the LCM of the individual periods.",
        "Apply every rule one more time to produce the answer frame.",
        "Verify the answer frame against each rule individually." ],
        why: "Rules are independent — the combined pattern loops with the least common multiple of their periods, which tells you whether frame 6 is new or a repeat.",
        summary: "Tag rates, combine periods with LCM, apply all rules once more." },
      8: { def: "Computing the answer frame and verifying every option.", steps: [
        "Apply all rules one more time to build the answer frame.",
        "Score each option against each rule (cheapest rule first).",
        "The correct option satisfies ALL rules; each wrong option fails exactly one.",
        "If two options survive, a rule is missing — go back one step." ],
        why: "Options on real exams are built by breaking single rules; complete rule knowledge makes every wrong option fail visibly.",
        summary: "All rules satisfied by exactly one option." }
    }
  };

  /* ------------------------- module content trees ------------------------- */
  const CONTENT = {
    latin: {
      desc: "5×5 logic grids: place A–E so every row and column contains each letter once — and find the one letter the ? hides.",
      cats: [
        { id: 'fund', title: 'A · Fundamentals', topics: [
          { id: 'what', title: 'What is a Latin Square?', blocks: [
            { p: "A Latin square of order 5 is a 5×5 grid where each letter A, B, C, D and E appears exactly once in every row and exactly once in every column. Diagonals do not matter. In the exam, some cells are pre-filled and ONE cell shows a red question mark — your entire task is that single letter." },
            { f: ["a complete line  =  {A, B, C, D, E}", "every row misses exactly 1 letter  ·  every column misses exactly 1 letter"] },
            { p: "Because each line is a permutation of the five letters, every filled row 'uses up' five letter-positions. The whole subtest is built on counting what has been used and what is missing." },
            { b: [
              "Only the letters A, B, C, D, E may appear — nothing else, ever.",
              "A letter already in a row can never appear again in that row.",
              "A letter already in a column can never appear again in that column.",
              "The red ? is an ordinary empty cell — all normal logic applies to it."
            ] }
          ] },
          { id: 'cand', title: 'Candidates and elimination', blocks: [
            { p: "For any empty cell, its candidates are the letters that violate neither of its two lines:" },
            { f: ["candidates(cell)  =  (missing from its ROW)  ∩  (missing from its COLUMN)"] },
            { p: "Example: if the cell's row already holds A, B, D and its column holds B, E, the candidates are {C} — B is blocked by both lines, A and D by the row, E by the column." },
            { b: [
              "One candidate → the cell is forced (a 'naked single').",
              "Two candidates → some other deduction (a trap, a veto) must split them.",
              "Candidates only shrink as letters are placed — elimination is monotonic."
            ] },
            { w: ["A candidate check must cover BOTH lines. The row alone lies; the column alone lies; together they tell the truth."] }
          ] },
          { id: 'cellq', title: 'The red question mark', blocks: [
            { p: "The ? cell follows every normal rule of the grid — it is not special logically, only visually. Three facts about it:" },
            { b: [
              "Its candidates = (row's missing letters) ∩ (column's missing letters).",
              "The exam answer is whichever letter survives — the same one in every valid completion.",
              "You never need to complete the whole grid: only ?'s row and column (directly or through chains) matter."
            ] },
            { p: "This last point is the discipline of the whole subtest: work that does not reach ?'s two lines is wasted time." }
          ] },
          { id: 'restrict', title: 'Row and column restrictions', blocks: [
            { p: "Each placement radiates restrictions along two lines. Placing D in row 2, column 3 immediately: removes D from row 2's candidates, removes D from column 3's candidates, and can reduce some cells to a single candidate." },
            { f: ["place(L at r, c)  →  L forbidden in all of row r and all of column c"] },
            { p: "Chains form: one placement creates a single-candidate cell elsewhere, whose placement removes more candidates, and so on. Reading these chains quickly — instead of one cell at a time — is what separates fast solvers from slow ones." }
          ] }
        ] },
        { id: 'tech', title: 'B · Solving Techniques (T1–T17)', topics: 'TECH' },
        { id: 'diff', title: 'C · Difficulty Levels', topics: [
          { id: 'easy', title: 'Easy — direct elimination', blocks: [
            { p: "One step: the cross shows four distinct letters and the fifth is the answer. No chains, no phantoms." },
            { walk: { cls: 'Easy' } },
            { p: "What to practise: reading the merged row+column list fast and naming the missing letter without hesitation." }
          ] },
          { id: 'medium', title: 'Medium — basic combinations', blocks: [
            { p: "Two to three steps: a letter scan or a trapped candidate prepares the cross, which then resolves. At most one supporting fill." },
            { walk: { cls: 'Medium' } },
            { p: "What to practise: switching between cell-view and letter-view without losing your place." }
          ] },
          { id: 'hard', title: 'Hard — multiple interacting constraints', blocks: [
            { p: "Four to five steps: a busiest-line fill, a veto, a missing pair, or one or two phantom fills feed the cross. Several constraints interact." },
            { walk: { cls: 'Hard' } },
            { p: "What to practise: road choice — spending 10 seconds to pick fills that walk toward ?." }
          ] },
          { id: 'extreme', title: 'Extreme — advanced multi-stage reasoning', blocks: [
            { p: "Six or more steps, often with an almost-empty cross and long phantom chains; pairs appear occasionally. Plausible wrong letters stay plausible for a long time." },
            { walk: { cls: 'Extreme' } },
            { p: "What to practise: clean phantom bookkeeping — label each derived letter with its cell." }
          ] },
          { id: 'master', title: 'Master — complex chains and combined techniques', blocks: [
            { p: "Nine or more steps, or four-plus phantoms, or advanced eliminations on near-empty grids. Master questions combine several techniques across the whole solve and are calibrated above anything officially published." },
            { walk: { cls: 'Master' } },
            { p: "What to practise: full-board awareness — every line's missing set, updated live." }
          ] }
        ] },
        { id: 'types', title: 'D · Question Types', topics: [
          { id: 'a', title: 'Direct Cross', blocks: [ { p: "Four distinct letters are already visible in ?'s row and column — the answer is the fifth, in one step." }, { qex: { type: 'a' } } ] },
          { id: 'b', title: 'Letter Scan', blocks: [ { p: "A letter placed four times has one legal home left; using it (often off-cross) unlocks the answer." }, { qex: { type: 'b' } } ] },
          { id: 'c', title: 'Trapped Candidate', blocks: [ { p: "? has two candidates; the only other empty cell in its line cannot take one of them — the trap decides both cells." }, { qex: { type: 'c' } } ] },
          { id: 'd', title: 'Busiest Line', blocks: [ { p: "The cross is quiet, but a line with four letters fills itself and pays into ?." }, { qex: { type: 'd' } } ] },
          { id: 'e', title: 'Veto Trap', blocks: [ { p: "The row alone suggests a wrong letter that the column vetoes — the platform verifies that the row-only answer is genuinely wrong." }, { qex: { type: 'e' } } ] },
          { id: 'f', title: 'Phantom Chain', blocks: [ { p: "Two to five off-road fills lead to the answer; you hold derived letters mentally and drop them after use." }, { qex: { type: 'f' } } ] },
          { id: 'g', title: 'Empty Cross', blocks: [ { p: "The cross shows at most one letter — chase letters across the board instead of cells." }, { qex: { type: 'g' } } ] },
          { id: 'h', title: 'Missing Pair', blocks: [ { p: "A line with exactly two empty cells missing two letters resolves as one deduction." }, { qex: { type: 'h' } } ] },
          { id: 'i', title: 'Decoy-Rich', blocks: [ { p: "Many cells are instantly solvable — decoys — but only one route leads efficiently to ?." }, { qex: { type: 'i' } } ] },
          { id: 'j', title: 'Pair / Wing', blocks: [ { p: "Needs a naked pair, hidden pair or X-wing: advanced eliminations, Extreme/Master only." }, { qex: { type: 'j' } } ] }
        ] },
        { id: 'rev', title: 'E · Revision', topics: [
          { id: 'rules', title: 'Important rules summary', blocks: [
            { b: [
              "Each letter appears exactly once per row and once per column — diagonals never matter.",
              "candidates(cell) = row-missing ∩ column-missing. Both lines, always.",
              "A letter placed 4 times has exactly one legal home (its missing row ∩ missing column).",
              "A complete line of values sums to 15 (A=1 … E=5) — a check, not a proof.",
              "? is a normal cell: only its row and column (directly or by chain) decide the answer.",
              "No negative marking: a blank is worth 0, an eliminated guess is free equity."
            ] }
          ] },
          { id: 'compare', title: 'Technique comparison table', blocks: [
            { table: { head: ['Technique', 'Reach for it when', 'Cost'], rows: [
              ['T1 Cross', '4 letters visible in ?\'s lines', 'instant'],
              ['T2 Letter scan', 'a letter is placed 4×', 'seconds'],
              ['T3 Trapped candidate', '? has 2 candidates + a partner cell', 'seconds'],
              ['T4 Busiest line', 'a line holds 4 letters', 'seconds'],
              ['T5 Column veto', 'every placement (always on)', 'free'],
              ['T6 Phantom cells', 'the cross needs missing info', 'moderate'],
              ['T7 Empty cross', 'the cross shows ≤1 letter', 'moderate'],
              ['T8 Missing pair', 'a line misses 2 letters in 2 cells', 'moderate'],
              ['T9 Choose the road', 'always — before every fill', 'free'],
              ['T10 Skip & guess', 'jammed at 50–60 s', 'free'],
              ['T11 Naked single', 'a cell has 1 candidate', 'instant'],
              ['T12 Hidden single', 'a letter has 1 home in a line', 'low'],
              ['T13 Naked pair', 'two cells share {x,y} in a line', 'moderate'],
              ['T14 Hidden pair', 'two letters share 2 cells', 'moderate'],
              ['T15 X-wing', 'a letter forms a rectangle', 'high (rare)'],
              ['T16 Sum trick', '4 distinct letters in the cross', 'instant (check only)'],
              ['T17 Letter tally', 'before Hard+ grids', 'seconds']
            ] } },
            { p: "Cost is mental load, not difficulty — 'moderate' techniques occupy working memory and should not stack." }
          ] },
          { id: 'mistakes', title: 'Common mistakes checklist', blocks: [
            { w: [
              "Checking only the row and forgetting the column (or vice versa).",
              "Counting a letter twice in the merged cross — duplicates eliminate once.",
              "Holding three or more phantom letters at once.",
              "Filling cells that cannot reach ?'s two lines.",
              "Using the sum trick when the seen letters are not distinct.",
              "Applying a pair to cells that are not in the same line.",
              "Completing unrelated regions of the grid like a Sudoku.",
              "Staring at one Extreme question instead of skipping.",
              "Submitting with blanks — there is no negative marking."
            ] }
          ] },
          { id: 'strategy', title: 'Quick solving strategy', blocks: [
            { b: [
              "1. Cross first — always.",
              "2. Road scan: naked singles in ?'s lines, busiest line first.",
              "3. Letter tally → hidden singles / letter scans.",
              "4. Phantom chain toward ? (max two phantoms).",
              "5. Pairs only when nothing is forced anywhere.",
              "6. At 50–60 s: mark, skip, return."
            ] }
          ] },
          { id: 'timed', title: 'Timed-solving tips', blocks: [
            { t: [
              "Budget 75 seconds per question, including reading — the exam pace is 20 questions in 25 minutes.",
              "Say the cross letters silently as one word ('B-C-D-E… missing A') — naming beats reading.",
              "Keep a fixed mental order: row-missing, column-missing, intersect.",
              "On skip-and-return, re-read the cross from scratch — it is cheaper than resuming a half-chain.",
              "Practise with the platform's 50-second timer to build margin below the real 75."
            ] }
          ] }
        ] }
      ]
    },
    math: {
      desc: "Linked equation systems over letters A–F: every letter is a whole number 1–20 with exactly one solution — find the value behind the ?.",
      cats: [
        { id: 'fund', title: 'A · Fundamentals', topics: [
          { id: 'eq', title: 'Understanding the equations', blocks: [
            { p: "Each puzzle is a small system of equations over letters (A, B, C …). Every equation is linear — coefficients multiplied by letters, equal to a constant or another letter-expression." },
            { f: ["each letter  ∈  {1, 2, …, 20}   (whole numbers)", "equations are LINEAR:  (coefficient × letter) + …  =  constant / other letters", "the system has exactly one solution per letter"] },
            { p: "The one non-single-choice exception of the Core Module: the value is worked out, not picked from options — so precision matters more than speed alone." }
          ] },
          { id: 'unk', title: 'Unknown values and constraints', blocks: [
            { p: "An 'unknown' is any letter not yet fixed. Two constraints bound every letter:" },
            { f: ["1 ≤ letter ≤ 20   (whole numbers only)", "every equation must hold exactly"] },
            { b: [
              "Whole-number fitting: 3A = 45 → A = 15 ✓, but 3A = 46 is impossible.",
              "Bounds: A ∈ [1,20] → 7A ∈ [7, 140]. An equation outside that range is misread.",
              "Parity: from 2A = C, C must be even."
            ] }
          ] },
          { id: 'ops', title: 'Operations and relationships', blocks: [
            { p: "The systems use addition, subtraction and small multiples (2×, 3×). Each operation creates a different kind of relationship:" },
            { b: [
              "A + B = S  →  a sum relationship: knowing either letter bounds the other (B = S − A ≤ S − 1).",
              "A − B = D  →  an order relationship: A = B + D, so A > B.",
              "2A = C    →  a multiple relationship: C is even and C = 2A.",
              "A = B + C →  a decomposition: A splits into two positive parts."
            ] },
            { p: "Reading the TYPE of relationship first tells you which solving tool (substitution, elimination, divisibility) applies." }
          ] },
          { id: 'subst', title: 'Substitution', blocks: [
            { p: "Substitution means replacing a letter with its known value everywhere it appears. It is both the solving method and the verification method:" },
            { f: ["A + B = 12,  A = 7   →   7 + B = 12   →   B = 5"] },
            { b: [
              "Substitute as soon as a value is known — do not batch.",
              "Substitute into ALL equations at the end as a check (one line per equation).",
              "A substituted equation with an unknown on both sides is still progress: it may become one-unknown."
            ] }
          ] }
        ] },
        { id: 'con', title: 'B · Mathematical Concepts', topics: [
          { id: 'add', title: 'Addition relationships', blocks: [
            { p: "A + B = S pins the total of two letters. With one known, the other follows by subtraction; with both unknown, the pair is constrained to S − 1 possible splits." },
            { f: ["A + B = S   →   B = S − A   and   1 ≤ A ≤ S − 1   (both letters ≥ 1)", "A + B + C = S  →  each letter ≤ S − 2 (the other two need ≥ 1 each)"] },
            { walk: { cls: 'Easy' } }
          ] },
          { id: 'sub', title: 'Subtraction relationships', blocks: [
            { p: "A − B = D is an ordering statement: A = B + D. It creates order information, not just values:" },
            { f: ["A − B = D   →   A = B + D  →  A > B  and  A ≥ D + 1", "A − B = 19  →  (A, B) = (20, 1) — the only pair inside 1..20"] },
            { b: [
              "Sign discipline: rewrite A − B = D as A = B + D before substituting — never move terms in your head.",
              "Big differences are gifts: very few pairs fit the range."
            ] },
            { walk: { cls: 'Medium' } }
          ] },
          { id: 'mul', title: 'Multiplication relationships', blocks: [
            { p: "k·A = C is a divisibility statement: A = C ÷ k must be a whole number in range." },
            { f: ["2A = C  →  C even,  A = C ÷ 2", "3A = C  →  digit sum of C divisible by 3", "A ∈ [1,20]  →  kA ∈ [k, 20k]   (range check kills bad equations)"] },
            { b: [
              "Divisibility by 3: add the digits (45 → 4+5 = 9 ✓).",
              "÷4: last two digits divisible by 4, or C ÷ 2 even.",
              "Combined forms like 3A − B = C need the multiple solved first or substituted from a known B."
            ] },
            { walk: { cls: 'Medium', pickTech: 3 } }
          ] },
          { id: 'div', title: 'Division relationships', blocks: [
            { p: "True division appears as multiplication on the other side: 'C ÷ 2 = A' is written 2A = C. Read every division as a multiple of the unknown:" },
            { f: ["'C ÷ k = A'  ⇔  k·A = C   →   A = C ÷ k, exactly"] },
            { b: [
              "Verify divisibility before dividing — a remainder means a misread.",
              "Small k (2, 3) dominate the exam; halving and thirding are mental-math friendly."
            ] }
          ] },
          { id: 'miss', title: 'Missing-number equations', blocks: [
            { p: "Some equations hide the operation's result or a letter behind the ? — the missing item is whichever piece completes the equality:" },
            { f: ["A + ? = 12  with A = 7   →   ? = 5", "? × 3 = 51   →   ? = 17"] },
            { p: "Treat the missing slot exactly like a letter: isolate it by reversing the operation (subtract to undo addition, divide to undo multiplication)." }
          ] },
          { id: 'conn', title: 'Multiple connected equations', blocks: [
            { p: "Two or three equations share letters on purpose — the system is a small dependency web. The solving order is: fewest unknowns first, then propagate:" },
            { f: ["A = 7;  A + B = 12  →  B = 5;  B + C = 9  →  C = 4"] },
            { b: [
              "Rank equations by unknown count; solve one-unknown equations immediately.",
              "An equation with two unknowns becomes usable the moment either letter is known.",
              "Letters appearing in several equations are hinges — solve them first."
            ] },
            { walk: { cls: 'Hard' } }
          ] },
          { id: 'rel', title: 'Number relationships and consistency', blocks: [
            { p: "Consistency means every equation agrees with your values. It is both a property of well-formed systems and your verification step:" },
            { f: ["substitute ALL values into ALL equations  →  every line: left = right"] },
            { b: [
              "One failing line localises the error to the letter(s) in it.",
              "Consistency across UNUSED equations is an independent check — the used ones are true by construction."
            ] },
            { w: ["Checking only the last equation you used verifies nothing."] }
          ] },
          { id: 'con2', title: 'Constraint-based & multi-step solving', blocks: [
            { p: "Constraints (1–20, whole numbers, parity, divisibility) prune candidates before algebra does. Multi-step solving chains three or more deductions:" },
            { f: ["2B = 12 → B = 6;  B − A = 3 → A = 3;  A + C = 26 with C − A = 14 → C = 20, A = 6??  — recompute: C − A = 14 → C = A + 14; A + C = 26 → 2A + 14 = 26 → A = 6, C = 20 ✓"] },
            { b: [
              "Intersect constraints across equations — the whole-number domain does most of the pruning.",
              "Work in one direction (forwards from givens, or backwards from ?) and stick to it.",
              "Verify at the end: every equation, every value."
            ] },
            { walk: { cls: 'Extreme' } }
          ] }
        ] },
        { id: 'tech', title: 'C · Solving Techniques', topics: 'TECH' },
        { id: 'rev', title: 'D · Revision', topics: [
          { id: 'rules', title: 'Important rules summary', blocks: [
            { b: [
              "Letters are whole numbers 1–20 with one unique solution per letter.",
              "All equations are linear; equality must hold exactly.",
              "Rank equations by unknown count — solve one-unknown equations first.",
              "k·A = C requires C divisible by k and A in range.",
              "Sum & difference pair: X = (S+D)÷2, Y = (S−D)÷2 — check parity.",
              "Verify by substituting into unused equations."
            ] }
          ] },
          { id: 'mistakes', title: 'Common mistakes', blocks: [
            { w: [
              "Sign slips when moving terms across the equals sign.",
              "Accepting a non-integer or out-of-range value.",
              "Starting from a two-unknown equation with no known values.",
              "Forgetting to propagate a solved value into every equation.",
              "Checking only the last equation used.",
              "Misreading 2A as A + A + A (it is A + A — a factor, not a repeat)."
            ] }
          ] },
          { id: 'tips', title: 'Quick calculation tips & strategy', blocks: [
            { t: [
              "Halve twice for ÷4; add digits for ÷3; look at the last digit for ÷5.",
              "Make-ten: 7 + 6 → (7 + 3) + 3 = 13 — faster than column addition.",
              "Range-first: compute k·20 and k·1 before dividing — impossible equations vanish.",
              "Order info: A − B = D means A > B — prune options by size.",
              "Substitute forwards, verify backwards."
            ] },
            { p: "Strategy: read all equations → rank by unknowns → chain from the smallest → verify with an unused equation → answer. On the exam (75 s average), a system stuck at 40 s is marked and revisited." }
          ] }
        ] }
      ]
    },
    figures: {
      desc: "Rule-governed picture sequences: figures change position, colour and alignment — read the rules and predict the next frame.",
      cats: [
        { id: 'fund', title: 'A · Fundamentals', topics: [
          { id: 'what', title: 'What is figure-sequence reasoning?', blocks: [
            { p: "You see a row of frames where figures change in rule-governed ways — position, colour, alignment. The last frame is hidden behind a red ?; your task is the frame the rules produce next." },
            { f: ["frame n  =  start figure + (all rules applied n times)", "rules are deterministic — the same rule always gives the same change"] },
            { b: [
              "Frames are computed, never random: if your rules explain every difference between consecutive frames, they are complete.",
              "The answer must satisfy ALL rules at once — not just the most obvious one."
            ] }
          ] },
          { id: 'changes', title: 'Relationships between consecutive figures', blocks: [
            { p: "The core skill is comparing frame n with frame n+1 and listing every visible change:" },
            { b: [
              "A change nobody claims → you missed a rule.",
              "A change claimed by two rules → you double-attributed.",
              "Zero unclaimed changes → your rule set is complete; compute the answer mechanically."
            ] },
            { p: "This converts pattern-reading from a feeling into a checkable ledger." }
          ] },
          { id: 'multi', title: 'Multiple simultaneous rules', blocks: [
            { p: "Hard sequences run two to four rules at once — typically one per element, sometimes an alternating rate. The rules are independent: each applies to its own element and attribute." },
            { w: [
              "Sequential tracking beats parallel guessing: lock one element's rule completely, then move to the next element.",
              "The least visible attribute (shading, colour) is the most commonly missed rule — check it explicitly."
            ] }
          ] }
        ] },
        { id: 'pat', title: 'B · Pattern Types', topics: [
          { id: 'rotation', title: 'Rotation', blocks: [
            { p: "A figure turns by a fixed step each frame — usually 90° or 180°. Rotation needs a chiral (directional) shape to be visible: arrows, triangles and L-shapes show it; circles hide it completely." },
            { walk: { cls: 'Medium' } },
            { p: "Verification: after 4 steps of 90° the figure must point where it started. If not, the step size or direction is wrong." }
          ] },
          { id: 'reflection', title: 'Reflection', blocks: [
            { p: "A figure is mirrored left-right each frame (or every second frame). Only asymmetric shapes reveal a reflection — a mirrored circle looks identical." },
            { svg: '<svg width="150" height="56" viewBox="0 0 150 56"><polygon points="30,10 18,42 30,34 42,42" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><line x1="75" y1="6" x2="75" y2="50" stroke="#DC2626" stroke-width="2" stroke-dasharray="4 3"/><g transform="translate(150 0) scale(-1 1)"><polygon points="120,10 108,42 120,34 132,42" fill="#FFFFFF" stroke="#171717" stroke-width="2"/></g></svg>', note: "an arrow and its mirror image across the red axis — the arrowhead changes sides" },
            { p: "Reflection interacts with rotation: a flip changes handedness, so a rotated-then-flipped shape differs from a flipped-then-rotated one. Track one transform at a time." }
          ] },
          { id: 'movement', title: 'Movement', blocks: [
            { p: "An element hops one cell along a path each frame — a row, a column, a diagonal, or the 8-cell perimeter of the grid. Position at frame n = path[(start + n) mod length]." },
            { walk: { cls: 'Medium' } },
            { p: "Short paths (3 cells) cycle every 3 frames; the perimeter takes 8. Always check whether a position has repeated before inventing extra rules." }
          ] },
          { id: 'add', title: 'Addition of elements', blocks: [
            { p: "A new element joins the pattern from a given frame onward — the count rises by one. The newcomer usually carries its own movement or shading rule." },
            { walk: { cls: 'Hard' } },
            { p: "The answer frame often differs from earlier frames only by the newcomer — identify the join frame and the newcomer's properties first." }
          ] },
          { id: 'rem', title: 'Removal of elements', blocks: [
            { p: "An element leaves the pattern after a given frame — the count falls by one. It is the mirror image of an addition rule." },
            { svg: '<svg width="220" height="56" viewBox="0 0 220 56"><rect x="8" y="16" width="24" height="24" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><rect x="48" y="16" width="24" height="24" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><rect x="88" y="16" width="24" height="24" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><line x1="132" y1="28" x2="146" y2="28" stroke="#737373" stroke-width="2"/><rect x="156" y="16" width="24" height="24" fill="#FFFFFF" stroke="#737373" stroke-width="2" stroke-dasharray="4 3"/><text x="196" y="34" font-size="20" fill="#DC2626" font-weight="bold">?</text></svg>', note: "the dashed square is the one that disappears — the dashed outline is only a teaching aid; the real exam simply shows fewer figures" },
            { p: "Removal questions are read identically to additions: count per frame, identify what leaves and when, and make sure the answer frame respects the count." }
          ] },
          { id: 'alt', title: 'Alternating patterns', blocks: [
            { p: "An alternating rule applies every SECOND frame — e.g. the figure rotates only on odd transitions. Alternation doubles the rule's period." },
            { walk: { cls: 'Easy' } },
            { p: "Test for alternation when a change appears, disappears, then appears again — a constant rule would never do that." }
          ] },
          { id: 'trans', title: 'Shape transformation', blocks: [
            { p: "A concept lesson: some reasoning tests morph one shape into another (triangle → square → pentagon, i.e. sides increase). The underlying rule is a COUNT of sides, not a movement." },
            { svg: '<svg width="170" height="56" viewBox="0 0 170 56"><polygon points="30,10 15,40 45,40" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><line x1="60" y1="28" x2="74" y2="28" stroke="#737373" stroke-width="2"/><rect x="84" y="14" width="26" height="26" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><line x1="120" y1="28" x2="134" y2="28" stroke="#737373" stroke-width="2"/><polygon points="158,12 170,24 165,40 151,40 146,24" fill="#FFFFFF" stroke="#171717" stroke-width="2"/></svg>', note: "3 sides → 4 sides → 5 sides: count the sides to read the rule" },
            { p: "This bank's generated sequences move and shade figures rather than morphing them — treat transformation as background knowledge for the wider exam family." }
          ] },
          { id: 'size', title: 'Size variation', blocks: [
            { p: "Another concept lesson: an element grows or shrinks step by step (small → medium → large). The rule lives in a size attribute rather than position." },
            { svg: '<svg width="170" height="56" viewBox="0 0 170 56"><circle cx="30" cy="28" r="8" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><circle cx="80" cy="28" r="14" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><circle cx="136" cy="28" r="20" fill="#FFFFFF" stroke="#171717" stroke-width="2"/></svg>', note: "radius grows by a constant step — size rules are read exactly like shading cycles" },
            { p: "Size and shading rules behave the same way: a fixed cycle of states. Confirm the cycle length before answering." }
          ] },
          { id: 'shade', title: 'Shading patterns', blocks: [
            { p: "A figure cycles through outline → grey → solid (a 3-state cycle). Shading is the least visible rule and the most commonly missed — check it explicitly on every sequence." },
            { walk: { cls: 'Easy' } },
            { p: "Shading combines with other rules cleanly because it never interferes with position or rotation — it is a separate attribute." }
          ] },
          { id: 'dir', title: 'Direction changes', blocks: [
            { p: "Movement direction can reverse: a bouncing path turns the element around at the edge; a perimeter path turns at corners. The reversal IS part of the rule." },
            { walk: { cls: 'Hard' } },
            { p: "Verify direction on two consecutive turns — one reversal looks like an error until you see the second one." }
          ] },
          { id: 'comb', title: 'Combination patterns', blocks: [
            { p: "Most Hard and Master sequences run two to four rules simultaneously — one per element, sometimes an alternating rate. The combined period is the LCM of the individual periods; it decides whether the hidden frame is new or a repeat." },
            { walk: { cls: 'Extreme' } },
            { p: "Completeness test: your rules must explain every difference between consecutive frames — zero unclaimed, zero double-claimed." }
          ] },
          { id: 'matrix', title: 'Matrix patterns', blocks: [
            { p: "A concept lesson: some reasoning items arrange figures in a 3×3 matrix where rules run ACROSS rows and DOWN columns simultaneously. The missing cell is found by applying the row rule and the column rule together." },
            { svg: '<svg width="170" height="80" viewBox="0 0 170 80"><rect x="5" y="5" width="50" height="70" fill="none" stroke="#E5E5E5"/><rect x="60" y="5" width="50" height="70" fill="none" stroke="#E5E5E5"/><rect x="115" y="5" width="50" height="70" fill="none" stroke="#E5E5E5"/><polygon points="30,15 18,45 42,45" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><polygon points="85,15 73,45 97,45" fill="#9CA3AF" stroke="#171717" stroke-width="2"/><polygon points="140,15 128,45 152,45" fill="#171717" stroke="#171717" stroke-width="2"/><rect x="22" y="53" width="16" height="16" fill="#FFFFFF" stroke="#171717" stroke-width="2"/><rect x="77" y="53" width="16" height="16" fill="#9CA3AF" stroke="#171717" stroke-width="2"/><text x="140" y="67" font-size="18" fill="#DC2626" font-weight="bold">?</text></svg>', note: "rows share the shape; columns share the shading — the ? must be an outline square" },
            { p: "This bank generates linear sequences rather than matrices — treat matrix reasoning as background knowledge for the wider exam family." }
          ] }
        ] },
        { id: 'tech', title: 'C · Solving Techniques', topics: 'TECH' },
        { id: 'rev', title: 'D · Revision', topics: [
          { id: 'checklist', title: 'Pattern recognition checklist', blocks: [
            { b: [
              "Count the elements per frame — rising or falling?",
              "Track the most distinctive element: rotation step and direction?",
              "Check shading and colour — the least visible attributes.",
              "Mark each element's position — which path, which step?",
              "Test for alternation — does the change appear every second frame?",
              "Compute the combined period (LCM) — is the hidden frame new or a repeat?"
            ] }
          ] },
          { id: 'mistakes', title: 'Common mistakes', blocks: [
            { w: [
              "Attributing one change to two rules (double-counting).",
              "Missing the shading or colour rule — the least visible one.",
              "Reading rotation on a circle, where it is invisible.",
              "Assuming the hidden frame must be 'new' — cycling sequences repeat.",
              "Forgetting an alternation rate (every second frame).",
              "Choosing an option that satisfies all rules except one."
            ] }
          ] },
          { id: 'strategy', title: 'Quick-solving strategy', blocks: [
            { b: [
              "0–30 s: build the rule list (track one element → difference ledger).",
              "30–60 s: compute the answer frame; eliminate options rule by rule.",
              "60–75 s: commit — a 2-of-3-rule elimination usually leaves one survivor.",
              "Verify the winner against ALL rules before moving on."
            ] }
          ] },
          { id: 'compare', title: 'Pattern comparison table', blocks: [
            { table: { head: ['Pattern', 'Attribute', 'Signal'], rows: [
              ['Rotation', 'alignment', 'a head points a new way each frame'],
              ['Reflection', 'mirror', 'handedness flips (chiral shapes only)'],
              ['Movement', 'position', 'one cell along a path per frame'],
              ['Addition', 'count', 'element count rises'],
              ['Removal', 'count', 'element count falls'],
              ['Alternating', 'rate', 'the change appears every 2nd frame'],
              ['Transformation', 'shape', 'sides or shape type changes'],
              ['Size variation', 'size', 'radius/length grows by a step'],
              ['Shading', 'fill', 'outline → grey → solid cycle'],
              ['Direction change', 'position', 'movement reverses at edges'],
              ['Combination', 'all', '2–4 rules at once'],
              ['Matrix', 'row + column', 'rules run across and down a grid']
            ] } }
          ] }
        ] }
      ]
    },
    study: {
      desc: "Timing, strategy and the habits that turn knowledge into marks — shared by all three subtests.",
      cats: [
        { id: 'time', title: 'A · Time Management', topics: [
          { id: 'pace', title: 'Managing the 75-second pace', blocks: [
            { p: "Each subtest gives 20 questions in 25 minutes — an average of 75 seconds, including reading. The clock belongs to the subtest, not to any single question." },
            { b: [
              "Practise with a timer set BELOW the real pace (this platform uses 50 s) so the exam feels slow.",
              "Split the budget: 10 s reading/orienting, 45 s solving, 10 s answering, 10 s of slack.",
              "Track your average time per class in Performance — the class where time explodes is where the marks are hiding."
            ] }
          ] },
          { id: 'skip', title: 'When to skip and return', blocks: [
            { b: [
              "Skip at 50–60 seconds without a resolution — earlier on Master items.",
              "Mark the question (the exam navigator supports it) and take pass 2 later.",
              "On return, re-read from scratch: resuming a half-chain costs more than restarting.",
              "Reserve the final 3 minutes to answer every blank — there is no negative marking."
            ] }
          ] },
          { id: 'speed', title: 'How to actually get faster', blocks: [
            { b: [
              "Speed comes from recognition, not rushing: drill the Easy and Medium pools until the patterns are instant.",
              "Name your steps verbally during practice — naming forces a method.",
              "Review wrong answers by technique (Performance tab) and read the linked note before retrying.",
              "Use the Group tab: a friend's pace on a class you find slow is free coaching data."
            ] }
          ] }
        ] },
        { id: 'gen', title: 'B · General Problem-Solving Strategy', topics: [
          { id: 'steps', title: 'The five-step routine', blocks: [
            { b: [
              "1. Read the instructions and the whole stimulus once, completely.",
              "2. Identify the constraints (letters/rows/columns; 1–20 domain; rule attributes).",
              "3. Eliminate impossible options immediately — every elimination shrinks the search.",
              "4. Apply the matching technique (cross, substitution, tracking…).",
              "5. Verify the final answer before committing."
            ] },
            { w: ["Step 1 is the most skipped and the most costly: a misread constraint poisons every later step."] }
          ] }
        ] },
        { id: 'mis', title: 'C · Common Mistakes', topics: [
          { id: 'list', title: 'The universal mistake list', blocks: [
            { w: [
              "Misreading a constraint (a letter/number/attribute you thought was forbidden or required).",
              "Making assumptions without checking them against the stimulus.",
              "Ignoring one of several simultaneous restrictions.",
              "Spending too long on one question and starving the easy ones.",
              "Failing to verify the final answer (one substitution, one rule check).",
              "Leaving blanks — there is no negative marking anywhere in the Core Module."
            ] }
          ] }
        ] },
        { id: 'sim', title: 'D · Exam Simulation Strategy', topics: [
          { id: 'run', title: 'Running the timed test', blocks: [
            { b: [
              "First 30 seconds: read the subtest instructions — the format never changes, but confirm it.",
              "Use the three-pass routine: Easy/Medium first, Hard second, Extreme/Master last.",
              "The question navigator is your friend: answer everything you can, then hop to marked items.",
              "Mark (M) anything you skip — marked items show amber in the navigator."
            ] }
          ] },
          { id: 'press', title: 'Handling difficulty and pressure', blocks: [
            { b: [
              "A difficult question is a scheduling decision, not a challenge to your ability — skip is a strategy, not a defeat.",
              "If the timer turns red with items left, answer every blank by elimination — blank = 0.",
              "Never restart a whole subtest mentally after one bad question; the next question is independent.",
              "Review mode after submission is where the learning happens: read every explanation, not only the wrong ones."
            ] }
          ] }
        ] }
      ]
    }
  };

  return { TECH_LESSONS: TL, CONTENT: CONTENT };
});
