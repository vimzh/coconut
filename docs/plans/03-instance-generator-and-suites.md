# Module 03 Technical Plan: Instance Generator and Suites

## Scope and prerequisite boundary

Implement an offline, deterministic suite builder using the existing mathematical verifier and protocol. Module 01 remains the only label authority. Module 02 remains the only model-visible prompt builder. No HTTP endpoints, provider calls, scoring, or interface changes belong to this module.

## D-04 policy

- Generator, suite format, and depth-policy version: `1`; verifier/protocol versions are recorded separately.
- Domain: the exact closed interval `[-1, 1]`. Supported actual depths are every integer from 5 through 80. Default levels: 5, 10, 20, 40, 80, with five instances of each class per level: 75 instances total.
- Requests contain exactly seed, ascending distinct depths, cases per class per depth, profile ID, and purpose (`evaluation` or `illustration`). Seeds are 1–64 ASCII letters, digits, underscores, or hyphens. Workloads must satisfy the selected protocol's 1,000-instance limit. Other domains/families require a future version, not an implicit relaxation.
- Depth counts leaves as zero and each operation as one plus the greatest child depth. Repeated occurrences are counted separately for node limits. Generation settings are checked against the verifier's measured depth.
- Convex/concave cores are maximum envelopes of tangents `2*t*x - t^2`, or minimum envelopes of their negatives, with distinct rational centers. A left fold of `n = depth - 3` affine lines has core depth `n + 1`. Every line is active at its center. A nonzero scalar and an affine term add two levels: at depth 5, two depth-2 lines form a depth-3 envelope and the common wrapper produces depth 5; at depth 80, 77 lines produce depth 80 and 469 nodes.
- Neither cores at depths 6–80 multiply `x` by an even tangent envelope with `n = depth - 4` symmetric centers. Depth 5 uses `x * abs(x + k)`, with `abs(k) < 1/4`. The same outer wrapper is used for all classes. Exact witness pairs accompany raw references, but the existing verifier independently checks every accepted label.
- Depth also increases expression length and active piece count. Associative rebalancing can change nesting without changing the function. This suite does not isolate nesting as a causal difficulty variable or establish that a frontier model will struggle. Operator structure supplies legitimate classification clues.
- Reject duplicate functions using exact piecewise-polynomial signatures for these generated families on the fixed domain. This covers compensated max/min orientations and affine reparameterizations; it is not a general equivalence solver for arbitrary expressions. Canonical expression/domain/label plus mathematical versions define case identity; certificate fingerprints remain separate evidence identities.
- Suite identity binds the exact ordered cases, certificates, requested coverage, achieved coverage, rejection summary, seed, profile, purpose, and all versions. No timestamps enter identity. Exact accepted instances are retained; seeds alone are insufficient artifacts. Public illustrations have a distinct purpose and suite identity and must not be represented as evaluation evidence.
- Each requested class/depth slot permits at most 12 candidates. Verifier rejection, measured-depth mismatch, and duplicate rejection are counted. Exhaustion or cancellation returns an explicit incomplete result with achieved coverage and partial instances, without a frozen suite identity. No easier substitutions or undersized completed suites.

## Architecture and interfaces

- `apps/api/src/suites/types.ts`: request, candidate, frozen case, coverage, summary, and result types.
- `candidates.ts`: counter-based SHA-256 seeded choices and exact family construction/signatures. Independently owned implementation; no label certification here.
- `generator.ts`: strict request validation, bounded asynchronous generation, cancellation checkpoints, verifier acceptance, coverage, frozen manifests, case/suite hashing. Public `generateSuite(request, signal?)` returns complete or incomplete.
- `manifest.ts`: `validateFrozenSuite(input)` regenerates the declared version/request through the verifier and compares every data field against the expected frozen artifact. Strict comparison rejects extra fields, altered evidence, getters, malformed arrays, and mismatched identities. Returning the regenerated immutable artifact avoids trusting uploaded objects. Version 1 regeneration must remain available while version 1 suites are supported.
- `cli.ts`: generate or verify a JSON artifact using the public interface. New files are created exclusively; existing frozen files cannot be overwritten. Verification reports identity and coverage. This is a local development CLI, not an execution endpoint.
- `index.ts`: public exports. `apps/api/data/suites/reference-v1.json`: the actual default evaluation suite, including private verification evidence. It is server-side data and must not be shipped as a browser asset.
- No new dependencies and no changes to verifier/protocol semantics. Root Bun scripts expose generation and verification.

## Verification checkpoints

1. Candidate tests cover every supported depth and class, both orientations/signs, exact depth/node limits, semantic equivalence signatures, and strict mathematical verification.
2. Suite tests cover deterministic seed reproduction, different seeds, complete class/depth coverage, structural/semantic duplicates, invalid/empty/oversized requests, unknown profiles/fields, verifier failures, attempt exhaustion, and cancellation before/during generation.
3. Manifest tests mutate expression, domain, label, depth, membership/order, versions, purpose, identifiers, summaries, and certificates. JSON round trips validate. Model-visible integration passes raw retained references through module 02 and checks that evidence does not enter prompts.
4. Generate and verify the checked-in 75-case artifact, then reproduce it independently and compare exact bytes/identity. Exercise CLI existing-file protection and invalid input.
5. Run `bun test apps/api/src/suites`, `bun run test`, and `bun run lint`. Run `bun run typecheck` then `bun run build` sequentially. Request independent code/behavior review and resolve material findings.

Planned commands: `bun run suite:generate --output <new-path>` and `bun run suite:verify --input apps/api/data/suites/reference-v1.json`. Generation uses the documented default seed `coconut-reference-v1` unless an explicit request JSON file is supplied. No paid model calls are needed to establish these properties.

## Handoff

Write `docs/handoffs/03-instance-generator-and-suites.md` with exact versions, identity, coverage, rejections, commands/results, reproduction and privacy guidance, limits, and D-04 resolution. Update the roadmap's owned status/decision entries while preserving concurrent work on later modules. Commit the plan and completed implementation as separate meaningful checkpoints and push to the existing private repository.
