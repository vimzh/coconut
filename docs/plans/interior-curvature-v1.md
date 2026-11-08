# Interior curvature exploration, version 1

## Scope and assumptions

Add a separately identified exploratory population after the fixed challenge experiment reached ceiling in its first completed high-effort cells. Preserve all existing suite membership, artifacts, native verifier rules, prompts and scores. Model difficulty is an empirical hypothesis; no construction guarantees failure.

The fixed exploratory population has 72 tasks: three nonlinear families × eight quintic parameter groups × three labels. Each source-polynomial group shares one cluster across all nine related tasks, giving eight clusters. This has only three broad families and does not inherit the six-family minimum or richer coverage claims of `quality-criteria-v1`. It supports descriptive characterization without a confidence interval, broad ranking or general failure claim.

## Steps and checks

1. Implement the fixed quintics, domains and separately derived second derivatives. Check global signs by exact rational Bernstein coefficient bounds and independently bounded exponential series; check strict interior witnesses and misleading endpoint/midpoint signs.
2. Add the `interior-v1` generator and CLI with profile-bound requests, complete native certification, pairwise same-domain separation, immutable output and strict full replay. Check altered requests, evidence, order, getters, cancellation and incomplete admission.
3. Generate `apps/api/data/suites/interior-v1.json`, replay all 72 members and record the identity, measured structure, certificate bounds and rejected exploratory domains. Run focused tests and API lint, type checking and build.

## Ownership and boundaries

This work owns `apps/api/src/interior/`, the new suite artifact, this plan, its design note and handoff. The coordinator owns central suite dispatch, registry, public/UI types, experiment integration and independent review. No provider inference, credential access or commit occurs in this implementation.

Coordinator integration adds the `interior-v1` allowlist entry to shared artifact dispatch, API run policy/store/registry and browser run types. Historical keys and identities remain valid. Public summaries identify this population as exploratory; leaderboard policy explicitly withholds ranks for it. Quality audits retain all eight cross-family clusters and report unsupported confirmation/interval claims. Regression checks cover full replay, profile binding, private result retention, public population/rank exclusion and the built API's fifth suite. The currently running frozen matrix uses the previous process image and is not restarted for these source edits. A separate two-cell experiment must freeze these inputs, highest verified model efforts, exposure history and at most 432 additional sends before any model receives a new task.

## Retained design revision

The first offline reciprocal-family concave domain `[1/2,5/8]` was wrong for all eight supported parameter groups: independent sign bounds crossed zero and native certification returned `rejected:label-mismatch` because the functions are neither there. The fixed final domain is `[17/32,5/8]`, selected before any model outcome on these candidates. Preserve all eight rejected attempts in the design record and a boundary regression; do not silently describe the original claims as uncertain accepted cases.
