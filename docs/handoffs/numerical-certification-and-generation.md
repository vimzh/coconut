# Numerical certification and smooth generation handoff

## Delivered boundary

The smooth track is the recommended starting point for new evaluation-run and interface development. It adds rigorous numerical certification and seven smooth function families, while preserving the exact engine and every retained version-1 artifact. This extension connects generation, full replay, model-visible prompts, existing answer extraction, and shared scoring. It does not implement model discovery, evaluation inference, run persistence, or UI modules.

The trusted numerical implementation is Python 3.13 with `python-flint==0.9.0` and observed/required FLINT `3.6.0`. `uv.lock` fixes package distributions; the bridge rejects an unexpected native identity. The worker uses fixed 192-bit precision and outward-rounded Arb endpoints. Exact rational endpoints are serialized directly, without converting through Python floats or decimal display strings.

## Mathematical contract

Supported expressions contain rational constants, the scalar variable, addition, negation, multiplication, square, division, natural exponential/logarithm, and the nonnegative square root. Every accepted expression is proved twice continuously differentiable on its entire closed rational interval, including endpoints; the strict elementary-operation domain conditions also provide smoothness in a neighborhood. Nonsmooth `abs`, `max`, and `min` remain under the historical exact engine.

Each subtree carries an enclosing value, first derivative, and second derivative. For a product the second derivative is `u''v + 2u'v' + uv''`; reciprocal and elementary-function rules use outward interval operations throughout. A dedicated square enclosure handles intervals crossing zero. Logarithm and square-root arguments require strictly positive lower bounds; denominators must exclude zero.

Adaptive dyadic subdivision produces a complete gap-free domain cover. Nonnegative second-derivative lower bounds on every cell prove convexity; nonpositive upper bounds prove concavity. A strictly positive second derivative at a certified interior rational point excludes concavity, and a strictly negative value excludes convexity. Both strict signs establish neither, provided the entire domain has also passed smoothness checks. An exact zero derivative cover excludes affine overlap. These conditions follow the second-order criterion in [Convex Optimization, section 3.1.4](https://www.stanford.edu/~boyd/cvxbook/bv_cvxbook.pdf).

A finite sample cannot establish global curvature or domain validity. The nine fixed point probes support strict counterexamples and pairwise distinctness only. Unresolved enclosures, unsupported smoothness boundaries, and exhausted budgets remain unverified. For example, `sqrt(x)` on `[0,1]` remains `unverified/non-smooth-boundary`, although it is a valid concave function. An enclosure merely crossing zero is refined rather than called mathematically invalid. A proved invalid point or wholly invalid argument enclosure rejects the reference.

Certificates retain canonical expression/domain/label, backend and policy identity, measured depth/node count, exact derivative bounds on every covering cell, strict interior witnesses, and the nine value/derivative probes. Replay recomputes all fields. This is a replayable computational certificate whose trusted boundary includes our rules and the native arithmetic library; it is not a proof-assistant derivation or a second independent numerical-library check.

Sources checked: [python-flint 0.9.0 Arb API](https://python-flint.readthedocs.io/en/stable/arb.html), [binding general concepts](https://python-flint.readthedocs.io/en/stable/general.html), [FLINT ball arithmetic](https://flintlib.org/doc/guide/types/ball-arithmetic.html), and the [FLINT 3.6 release record](https://flintlib.org/doc/history/flint3/v3-6.html). The FLINT guide describes the enclosure inclusion principle; the implementation uses endpoint APIs exercised against independent rational identities and a factorial-series exponential bound.

## Bounded policy

- AST depth at most 32, node occurrences at most 256, rational literal/canonical input at most 96 characters.
- Shared budget of 200,000 subtree evaluations per reference; at most 512 processed cells and subdivision depth 20. The cell budget counts processed cells, not retained leaves.
- Exact endpoint representations bounded to 4,096 bits before rational serialization. Exponential argument enclosures restricted to `[-256,256]`.
- At most 64 references per worker batch, 2 MiB input, 32 MiB stdout, 16 KiB stderr, and a 60-second process deadline. Timeout, output limits, and caller cancellation kill and reap the worker. Dependency/runtime failures are explicit; there is no nonrigorous fallback.
- The fixed worker runs under isolated Python with a minimal environment containing no inherited provider credentials. Only structured expression data crosses stdin; no caller code, shell commands, or arbitrary module paths are executed.

## Suite and identity

Numerical suite format `2`, generator/depth policy/task wording `smooth-v1`, verifier `arb-jet-v1`, and distinctness policy `disjoint-value-enclosures-v1` are independent from the existing exact versions. Answer protocol and profiles remain `1`: prompted JSON or strict schema, three fresh trials, 4,096 output tokens, existing extraction and scoring semantics. Numerical reports additionally record backend/task identity. Evidence binds to the exact suite ID. Different tracks must not share a comparison population.

Generation supports measured depths `[7,9,11]`, one through ten cases per label per requested depth, and the existing seed/profile/purpose fields. Seven families cover rounded norms, exponential-minus-quadratic, local logarithms, reciprocal exponentials, and logarithmic/rational/quartic curvature changes. Both core orientations and shared affine/scalar presentation avoid an outer-sign shortcut. Additional depth introduces substantive nonlinear transformations with linear tree growth rather than identity padding. Family/structure can still provide classification clues; these are not controlled causal experiments on depth.

Every accepted pair has a retained common point with disjoint certified value intervals. That proves the functions differ; coincident or overlapping probes establish nothing and cause a conservative rejection if no separation is proved. Accepted suites retain every candidate attempt and rejection reason, requested/achieved coverage, and exact ordered instances. Twelve attempts per slot are permitted; exhaustion/cancellation returns an incomplete result without an approved suite ID.

Retained artifact: `apps/api/data/suites/smooth-v1.json`.

- ID: `suite-smooth-v1-d2ea0a44aa5a2c57182f538664801d7c50556258ba43be336c555aba6eb66e09`.
- SHA-256: `98a60ff3a65ce9ee1f481ce94f1513970d8609dc694de0bc8b8659070bcd4379`; 214,560 bytes including final newline.
- 27 accepted cases / 27 attempts / zero rejections, with three cases per label at each depth. All seven families occur. Node counts range 16–35; retained covers have 1–12 leaves.
- Full replay reproduces exact bytes. The historical 75-case suite and golden scoring report retain their original identities and bytes.

## Differentiation and claim limits

The project's implementation contribution is a separate smooth-function track with native rigorous derivative certification, adaptive domain proofs, strict curvature counterexamples, point-separation evidence for semantic distinctness, reproducible artifacts, and direct integration into the existing evaluation pipeline. The formulas and elementary families are standard mathematics. Required prior-work attribution remains in project and submission documentation.

This evidence establishes broader certified coverage and software behavior. It does not establish harder questions, frontier-model failure, useful score separation, or reduced confounding. Structural depth also changes function family/shape, expression length, and derivative scale. Those questions remain with the later execution and benchmark-quality modules. No model calls were made for this extension.

## Performance evidence

`apps/api/data/suites/smooth-v1.timing.json` retains all five samples from the final experiment, rerun after concurrent verification finished. Environment: Apple M5, macOS arm64, Bun 1.4.4, the native versions above. Every native timing includes serialization, new-process startup, certification, and response validation; this is not a persistent worker benchmark.

| Workload | Exact engine | Numerical engine |
| --- | --- | --- |
| Same 32 algebraic expression inputs: 16 shifted squares and those same functions written as products | 16 certified / 16 unverified; median 8.01 ms total | 32 certified / zero unverified; median 50.05 ms total |
| 27 smooth candidates across all default depths/labels | Unsupported workload; not timed | 27 certified; median 91.65 ms total, 3.39 ms per case |
| One cold algebraic case | Not part of this measurement | 48.69 ms including startup |

The numerical path is slower on this matched small workload and certifies more representations. The 32 inputs represent only 16 distinct functions by design; they measure recognition coverage, not task diversity. Batching amortizes startup. These local results do not predict deployment throughput or model latency, and no speedup is claimed.

## Verification and reproduction

From the repository root:

```sh
bun run numerics:setup
bun run numerics:test
bun run numerics:lint
bun run numerics:verify --input apps/api/data/suites/smooth-v1.json
bun run numerics:generate --output /tmp/coconut-smooth-new.json
bun run numerics:benchmark --output /tmp/coconut-timing-new.json
```

Use unused output paths; generation, benchmark, and scoring commands refuse overwrites. `--request <json-path>` selects a supported custom numerical request. `buildNumericalPrompt(s)` certifies raw references before rendering; only expression/domain and neutral instructions reach the model. The existing `scoreEvaluation` and `score:report` dispatch by suite format; all numerical metrics tests use explicitly synthetic model replies.

Verification completed:

- Python: 29 tests, including hand-derived derivatives, adaptive quarter-cell bounds, a narrow curvature reversal missed by the old nine-point Jensen grid, hidden log/divisor poles, downward-kink rejection, affine cancellation, independent exponential bounds, and resource limits.
- Bun: 383 tests / 16,191 assertions pass across 26 files, including native bridge/replay, all families, frozen artifact bytes, numerical prompt/scoring integration, batch-boundary requests, retained failed attempts, exhaustion, cancellation, and CLI overwrite protection.
- Root lint, type checking, and production build pass; numerical Ruff lint passes. Both suite replay commands pass, and the historical scoring golden result is unchanged.
- Independent mathematical code review found no blocking defects and stress-tested 3,000 generated expression trees without uncaught exceptions. A separate propagation audit found no confirmed gaps in the inspected generation/replay/prompt/scoring paths.

The review did not compare every transcendental bound with another rigorous library. Interval dependence and finite precision/work limits remain completeness limitations. Native wheel/runtime availability must be checked on any new deployment platform. Current commands run from a checkout; the future hosted inference/run layer must package the worker, its locked environment, and its expected relative path. This extension does not resolve later product feasibility gates or mark unfinished roadmap modules complete.
