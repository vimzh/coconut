# Upstream import integration: source and mathematical scope

Date: 2026-11-08. This is an implementation/provenance record for [14b](../modules/14b-randomized-certified-evaluation.md). External-source summaries are paraphrases; admission rules are Coconut's implementation choices. Live results, when available, belong to the module handoff and private evidence ledger.

## Provenance and permission

The reused generator is from [ConvexBench's official repository](https://github.com/yepengliu/ConvexBench), pinned to `6f156c8c9b6b0b85f6a191bd4eb912e12e670082`. The [complete pinned tree](https://api.github.com/repos/yepengliu/ConvexBench/git/trees/6f156c8c9b6b0b85f6a191bd4eb912e12e670082?recursive=1), [package metadata](https://github.com/yepengliu/ConvexBench/blob/6f156c8c9b6b0b85f6a191bd4eb912e12e670082/pyproject.toml), [repository metadata](https://api.github.com/repos/yepengliu/ConvexBench), local tracked-file search and remote heads/tags were checked. Main still equals the pin; no software or output/data license was found. The README requests citation and describes generation; those statements do not establish redistribution permission. GitHub distinguishes public repository access from broader licensing rights in its [licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) and [Terms §D.5](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#5-license-grant-to-other-users).

No upstream implementation is copied into tracked Coconut source, application assets or dependency packages. The original adapter invokes a separately supplied checkout and retains provenance hashes. Upstream implementation and generated development artifacts remain outside public/submission bundles pending applicable clearance. This boundary is not a legal finding that every local use or generated output is unrestricted.

The upstream generation method is prior work by Yepeng Liu, Yu Huang, Yu-Xiang Wang, Yingbin Liang and Yuheng Bu. Credit that method and its authors in project/submission documentation. Coconut's contribution here is the exact-display importer, independent actual-domain admission, exposure accounting, isolated execution and evidence analysis. Reuse is not an original generator invention.

## Reproduction environment and semantics

Generation uses Python 3.13.17, NumPy 2.1.2, pandas 2.3.1 and tqdm 4.67.1 in an isolated generation-only environment. The actual environment's complete distribution/version map is retained in each private receipt, including transitive dependencies. The external checkout's existing environment had newer packages and was not used for the frozen generation. The independent checker reuses Coconut's pinned Python 3.13/python-flint 0.9.0 environment.

The pinned scalar CLI emits a rounded LaTeX expression, a hierarchical tree presentation, realized depth/node counts, label and numerical-check status. Its coefficient formatter uses three significant digits, while underlying closures retain higher-precision values. The CSV contains neither a finite interval nor strict witness coordinates. Consequently, source labels and numerical flags do not certify the displayed task on a chosen Coconut interval. See the [pinned renderer](https://github.com/yepengliu/ConvexBench/blob/6f156c8c9b6b0b85f6a191bd4eb912e12e670082/convexbench/synth/latex.py) and [CLI](https://github.com/yepengliu/ConvexBench/blob/6f156c8c9b6b0b85f6a191bd4eb912e12e670082/scripts/generate_dataset.py).

Imported mathematical meaning is the exact displayed scalar body on [−1, 1]. Removing only the outer `$f(x) = ...$` assignment does not change the expression. Decimal/scientific literals are exact rational values; frozen instructions explicitly define e/E notation as powers of ten. The allowlisted parser never evaluates strings as code. Rounded displays are independently re-proved, not treated as lossless serialization of hidden coefficients.

Requested source depth, realized source depth, parsed expression-tree depth, variable-dependent nonlinear path, node count and input length remain different measurements. Source D/D+1 behavior is checked explicitly; no reported source depth is relabeled as that many nonlinear stages.

## Independent reference boundary

The separate `deep-import-reference-v1` policy leaves ordinary depth-32/node-256 admission unchanged. Whole-interval sign/range and sufficient composition rules establish domains and convex/concave curvature. Strict structural composition or a rigorous signed Jensen gap excludes the opposite label. Neither requires both directions of strict Jensen violation with retained rational points and outward Arb bounds.

This policy accepts only its proved subset. Unresolved range/curvature, affine overlap, unsupported syntax, arithmetic limits, overflow, insufficient strictness or witness exhaustion do not become reference labels. A source `not_evaluable` flag neither proves nor disproves the symbolic class. Accepted-population conditioning and rejection rates must accompany results.

Independent review found and repaired these pre-inference defects, with regressions:

- Undefined operands could disappear through constant scaling/division. Every original child domain now remains mandatory, including `(0*log(-1)+1)*x^2`, analogous sqrt/division cases and log/exp simplifications.
- Adjacent numeric tokens could be interpreted as multiplication despite LaTeX digit spacing. Such ambiguous input now rejects.
- Mismatched grouping could parse. Matching delimiter kinds are now required.
- Exact affine coefficients could grow beyond the stated arithmetic budget. Their coefficients and evaluated bounds now reject beyond 4,096 bits.

No model call occurred before these repairs. Earlier offline preparations remain retained as superseded development exposure. The same frozen source batches were regenerated, not replaced using model feedback.

## Execution and interpretation

The new method is a private single-response research study, with its own panel/search identities. It reuses the isolated pinned official SDK, canonical max-reasoning profile, strict answer extractor and single-trial scorer. Ordinary three-trial runs, leaderboard eligibility and historical studies are unchanged.

The current [official Astra documentation](https://developers.openai.com/api/docs/models/gpt-6-astra) supports `max` reasoning. The experiment retains the already verified `one-shot-json-v2-max` configuration: 16,384 requested output tokens, no retries, 180-second inference deadline and disabled truncation. Access and reported settings must still be checked on each actual response. Truncation, deadlines, refusal or service failure stop the search for diagnosis and cannot establish a mathematical-error endpoint.

Adaptive panels start at 216, then 512/1000 only after complete all-correct panels; reviewed deeper errors permit bounded midpoint exploration. Every actual panel is frozen before sends. This is exploratory interval narrowing, not proof of monotonicity or a universal failure threshold. The 27-question/three-probe allowances share 30 total development sends; final 800-case execution is outside 14b.
