# Pitch update handoff

## User amendment: remove results slide

The user requested removal of slide 11, “Current measured results.” The deck now has 11 slides; the terminal workflow becomes the final slide 11. Its route metadata and navigation titles match. The removed results component, imports and unused table styles are deleted; homepage results remain available. Lint, types and production build passed; production-browser navigation verified all 11 slides, the terminal ending and disabled final Next button. Original verification below describes the earlier 12-slide checkpoint.

## Original checkpoint

`/pitch` now contains 12 slides. Existing mathematical and policy teaching examples remain; current results and configurable terminal evaluation have dedicated slides. The route metadata, navigation labels and slide count agree.

The results slide consumes the same validated aggregate helpers as the homepage. Separate 620-task reasoning and 800-task fast-screen tables show macro-F1/100, accuracy and correct/model-outcome counts for all six models. Settings, different high-depth populations, the single observed Astra misclassification, truncation distinction, 16 unknown infrastructure exclusions and limits on interpretation remain explicit. No private question, proof trace, case identity or provider transcript was added.

Method/scoring copy now distinguishes research single responses, visitor three-response runs and configurable CLI trials. The synthetic scoring fixture remains clearly synthetic and now shows its corresponding 0–100 score. Requested depth is not presented as a standalone measure of difficulty.

The terminal slide shows actual depth/count/seed generation, verification and exact-file evaluation commands, with trial accounting, source/runtime prerequisites, own-key consent and private artifact cleanup. Keyboard navigation leaves focused code/table regions their native scroll keys.

Verification:

- Web tests: 88 passed; lint, type checking and production build passed.
- Production browser: all 12 slide labels/headings and navigation bounds checked at desktop width 1440; all six model rows matched the public aggregates, including each F1, accuracy and denominator.
- Mobile width 390: new tables and code blocks scroll locally without document overflow; vertical slide content remains scrollable. Home/End and previous/next navigation passed; focused code/table arrow keys did not change slides or suppress native default scrolling. Mobile screenshot inspected.
- Slide/title count, source wording and diff checks passed. Only existing CSS-preload timing warnings appeared in the browser; there were no runtime errors or failed rendering. This route-level timing warning is outside the factual update and was already recorded in previous browser verification.
- No backend changes or model calls. Existing homepage global sorting and its public data were preserved. The final verified web build serves port 3200; the API was not restarted.

This is an exploratory scalar-classification pitch. Hypothetical agent examples do not establish transfer to real agent workflows, and single responses do not establish repeat consistency or a universal failure depth. Hosted deployment and submission remain outside this change.
