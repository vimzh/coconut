# Rigorous numerical certification and smooth suites

## Purpose and guarantees

Add a distinct numerical engine that certifies richer smooth scalar functions on finite closed rational intervals. Accepted labels require rigorous enclosures, not floating point sampling. The engine does not guarantee that every candidate is decidable, that structural depth measures model difficulty, or that additional compute improves model scores.

The existing exact verifier, generator, suite artifact, answer protocol, and scoring fixture retain their version 1 reproduction semantics. A separate numerical suite format records its task wording and backend identity. The existing answer format, budgets, extraction, and scoring policy remain reusable; numerical results have different suite, generator, verifier, and prompt identities.

## Implementation

1. Use a pinned Python 3.13 / python-flint worker with native Arb ball arithmetic. Implement bounded interval automatic differentiation for variable, rational constant, negation, sum, product, square, division, exp, log, and sqrt. Require a proof of twice continuous differentiability throughout the stated domain. Nonsmooth operations remain supported by the existing engine only.
2. Adaptively bisect rational domain cells. A complete cover with nonnegative second-derivative bounds proves convexity; nonpositive bounds prove concavity. Strict opposite-sign derivative witnesses rule out the opposite property. Two strict interior witnesses of opposite signs prove neither. Failure to prove domain validity or exhaustion remains unverified. Affine overlap is excluded only when proved. No classification follows from the absence of a counterexample.
3. Retain exact rational outward bounds, complete domain cover, strict witnesses, canonical input, measured structure, bounded policy, and native library versions. Replay recomputes all evidence. The Bun bridge uses a fixed local worker, bounded input/output/time, batches independent cases, and does not pass provider credentials.
4. Generate deterministic smooth suites using multiple elementary-function families, shared label-neutral presentation, real nonlinear structure, and an explicit depth range. Every accepted candidate passes independent certification. Pairwise disjoint value enclosures at retained common points prove distinctness; structural hashes alone do not establish inequivalence. Preserve candidate failures and requested/achieved coverage.
5. Add numerical generation/replay commands, a prompt adapter exposing expression and domain only, and version dispatch in scoring. Preserve legacy outputs. Check in a modest numerical reference artifact and a reproducible performance experiment.

## Verification

- Hand-derived derivative examples, adaptive subdivision, narrow curvature reversal, hidden log singularities, boundary sqrt, nonzero denominators, affine cancellation, resource exhaustion, unsupported kinks, and certificate tampering.
- Deterministic generation/replay, all three labels, family diversity, semantic distinctness evidence, coverage accounting, prompt leakage checks, scoring integration, strict CLI input, and existing-file protection.
- Report native worker cold startup separately from batched certification. Compare matched algebraic cases with the old verifier and report certification coverage alongside time. Do not infer a speedup from unlike workloads.
- Run Python checks plus Bun tests, lint, type checking, and build. Replay the retained version 1 artifact and preserve golden scoring results. Request independent review of mathematical obligations and connected execution behavior.

## Sources and limits

Arb propagates rigorous enclosures under its inclusion principle ([FLINT ball arithmetic](https://flintlib.org/doc/guide/types/ball-arithmetic.html)); the binding documents real-number error tracking and exact endpoint access ([python-flint](https://python-flint.readthedocs.io/en/stable/arb.html)). Enclosure width and finite budgets make this a sound but incomplete certification method. Native library correctness and the implemented derivative/domain rules form the trusted computation boundary.

This is an engine extension. It does not complete the later benchmark-quality, reporting, interface, or model-inference modules. Prior-work provenance remains in project/submission documentation; application behavior and new contributions use the project's own terminology.
