# review-ui: single-line inputs truncate longer feedback awkwardly

**Source:** scripts/review-ui.html (shipped with CC)
**Impact:** Users writing multi-sentence review notes have them wrap/scroll in a 28px-tall single-line input. They can't see what they've written.
**Fix (shipped locally, worth upstreaming):** Change `<input>` to `<textarea rows="2">` with `resize: vertical`. Applies to both per-item feedback AND group notes.
**Diff:** see commit 5dab5db in orenmagid/article-rewriter.
