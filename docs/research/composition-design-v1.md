# Nonlinear composition exploration, version 1

## Repair target

The historical structural-depth studies remain reproducible, but associative absolute-value sums do not require a long chain of dependent nonlinear curvature decisions. This suite measures a different construction. It does not reproduce the published experiment or inherit its failure rates. Prior-work attribution remains in the project research documentation and roadmap; the new construction and reference implementation use the project's own code.

## Frozen construction

Use Q(t)=(t+2)^2/16 and R(t)=1/(4-t). Compose the atom sequence on x, taking the result of each stage as the input of the next. The three patterns are all-Q, Q/R alternating, and R/Q alternating. At each of 2, 4 and 6 nonlinear stages, construct H(x)-a*x² for each label on [-1,1]. Thus there are 27 tasks, 9 shared-chain clusters and 9 tasks per class. These are three sequence patterns sharing two atoms, not three independent mathematical families. All classes share the root operation, sign and domain. No pure reciprocal chain, identity wrapper or additive reassociation supplies stage count.

Operation-tree depths are 7, 13 and 19. Nonlinear stage count is a separate diagnostic; neither is a proved measure of model difficulty. Native policy remains depth 32/nodes 256 and is not enlarged merely to reach a larger number.

## Two reference paths

Each atom preserves [-1,1] and maps it into (0,1). On this invariant interval, both atoms have strictly positive first and second derivatives, and nonnegative third derivatives. Q'''=0 and R'''>0. For two or more stages, the chain-rule term 3*g''*h'*h'' is strictly positive, so H'''>0 and H'' is strictly increasing throughout the domain.

The generator's exact rational recurrence computes H'' at endpoints and at -3/4,+3/4. Positive dyadic coefficients on a fixed 2^-48 grid are chosen before inference: below the global convex threshold, above the global concave threshold, or between strict interior curvature thresholds. Exact comparisons must establish the intended sign, not merely a failed sufficient rule.

An independently authored Python Fraction implementation parses every actual AST, matches the allowed atom structure, validates invariant image intervals and the global third-derivative argument, independently differentiates through third order, and reproduces all endpoint and interior evidence. Its hash-bound review also checks coverage, exact duplicates, canonical structure, stages, node counts and coefficient ranges. Pairwise overlap of coefficient ranges is a limited lexical-cue check; it does not prove that no coefficient heuristic works.

The unchanged native Arb interval automatic-differentiation verifier separately certifies every actual expression across the entire domain and retains strict witnesses. All 27 candidates were accepted; no model-informed replacement occurred. Certificate replay and request/suite identity reject drift. Reference checks are AI-assisted software/mathematical review, not human expert or proof-assistant approval.

## Protocol and interpretation

Normal application suite key: `composition-v1`. Format2; generator `composition-v1`; depth policy `nonlinear-chain-and-ast-v1`; reference policy `exact-atom-chain-v1`; verifier `arb-jet-v1`; prompt `smooth-v2`. The suite is exploratory, unranked and recommended for new composition runs. Historical challenge/reference suites remain available with their original identities.

Model-visible inputs contain only the expression/domain and neutral instructions. Certificates, labels, atoms, sequence names, thresholds and cluster IDs are not added to prompts. Existing JSON extraction, macro-F1, accuracy and unusable/infrastructure policies apply unchanged. Three fresh trials yield 81 requests per model; they are not 81 independent functions. The final classification is scored; explanations require a separate qualitative review.

The prospective two-model diagnostic freezes both requested identities, suite/prompt/source hashes, 162-send cap, 6 workers/model, 12 aggregate concurrency, 4,096 output tokens and zero retries. Prior 8,511 conservative sends and the separately authorized new maximum 8,673 remain explicit; older ceilings are unchanged. The normal foreground service and pinned official SDK execute the study and retain every outcome. Unknown/failed work cannot be published as a complete score.

## Reproduction

- `python3 docs/research/composition-reference-review-v1.py` rechecks the retained artifact/evidence, including coefficient tampering.
- `bun test apps/api/src/composition apps/api/src/suites/composition-artifact.test.ts apps/api/src/experiments/composition.test.ts` checks reference replay, integration and paid-dispatch guards.
- `bun scripts/export-suite-previews.ts` regenerates public task previews.
- `python3 docs/research/composition-results-audit-v1.py` reconstructs observed scores and public data from retained private original records after completion.

Frozen execution is not resumable or overwriteable. Re-running a paid study requires a new version and accounting, rather than deleting evidence. The suite and public task previews are exposed for transparency; no contamination-free claim is made.

## Remaining limits

Only two rational atoms and nine base chains are covered. All chains are increasing and convex before the quadratic correction; coefficient cues and contraction can simplify the task. Shared prefixes, changing range, function shape and expression length confound stage comparisons. The suite fixes associative depth inflation and class-specific outer forms within this construction; it is not a general symbolic-composition benchmark. Strong scores remain valid observations. Neither lower scores nor higher stage counts establish a universal failure threshold, a causal depth effect or general model reliability.
