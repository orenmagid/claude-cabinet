## Friction

The `/pilot-synthesis` skill walks a pilot through phases 0-9 (extract → synthesize → dispositions → integrity → calibration → review sample → plant-and-verify → method record → close). After running it twice (ST pilot, LF pilot), we discovered a systematic blind spot: plant-and-verify misses sub-clause bad-merge defects (word-removal inside bullets that keeps the bullet syntactically correct but drops load-bearing sub-actions) with ~0% detection rate.

We built a mitigation — the **action-grid methodology**: 4 parallel subagents, each forced to enumerate every load-bearing sub-clause in the raw entries before checking coverage against the synth. Retroactively applied, it found 29 additional defects in LF, ~60 in ST, and ~251 in the project's base 56 principles (~40% average sub-clause loss at original synthesis, even by careful humans).

The methodology is documented in three places (audit doc, both pilot method records, omega memories). But the `/pilot-synthesis` skill itself doesn't mention it. A future pilot run by this skill would silently skip action-grid and ship with the same blind spot.

## Suggestion

Add an action-grid phase (call it Phase 8.5 per the LF pilot's naming) to the skill — either inline in the phase list or as a separate gate file that the skill references. Minimum viable: a paragraph in `/pilot-synthesis` that says "After Phase 7 plant-and-verify, run action-grid — see `framework/base-56-action-grid-audit.md` for the method" so the gap doesn't reopen.

More ambitious: factor action-grid into its own reusable sub-skill or script that any synthesis-shaped workflow can invoke, not just medical-legal pilots. The pattern (force sub-clause enumeration before coverage-check) generalizes to any structured-merge work.

## Session context

This arc closed Phase 3 of the medico-legal extension (ST + LF pilots), then retroactively applied action-grid to ST and to the project's fundamental 56 principles. Commits: ed3abfe (LF), 563f38c (ST retro), 0b7685c (base-56 retro). Tracking: act:6e434721 for formalization as `scripts/action-grid-check.py`.
