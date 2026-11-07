# Module 01 Handoff: Mathematical Verifier

## Status and Gate

**Complete. G-MATH: Go for the bounded exact-arithmetic target below.** Implementation checks, project checks, direct public-entry verification, and independent code review pass. This verdict does not certify unsupported functions or the usefulness of a future benchmark suite.

The implementation is a bounded mathematical library. It adds no HTTP endpoint, model execution, random generator, user interface, or published benchmark suite.

## Decision and Technical Plan

- **D-01:** Resolved in [the technical plan](../plans/01-mathematical-verifier.md).
- **Environment checked:** macOS, Bun 1.4.4, Node.js 24.22.1, existing project dependencies.
- **New dependencies:** None. No provider credentials or paid model calls were used.

## Implemented Artifacts

- [Public entry point](../../apps/api/src/math/index.ts): `verifyReference`, `checkCertificate`, `VERIFIER_VERSION`, and public types.
- [Exact arithmetic](../../apps/api/src/math/rational.ts): normalized bounded rational arithmetic and strict literal parsing.
- [Expression inputs](../../apps/api/src/math/expression.ts): runtime validation, canonical representation, rendering, exact evaluation, and structural limits.
- [Curvature analysis](../../apps/api/src/math/curvature.ts): sufficient composition proofs, range enclosures, depth, and postorder evidence.
- [Verifier](../../apps/api/src/math/verifier.ts): independent label derivation, exact strict midpoint witnesses, input binding, and certificate replay.
- Tests: [arithmetic](../../apps/api/src/math/rational.test.ts), [expressions and ranges](../../apps/api/src/math/expression.test.ts), and [verification and replay](../../apps/api/src/math/verifier.test.ts).

## Accepted Mathematical Boundary

One real variable on a finite closed rational interval with `min < max`. Supported operations are `variable`, `constant`, `add`, `negate`, `multiply`, `square`, `abs`, `max`, and `min`. These operations are defined at every real input. Unsupported operations are rejected, including exponential, logarithm, and square root. This is not a general expression parser or convexity oracle.

Constants, domain endpoints, and supplied witness coordinates must be exact strings: integers, finite decimals with digits on both sides of the point, or integer fractions. Whitespace, exponent notation, non-string numbers, and zero denominators are rejected. Canonical values are reduced fractions or integers. The canonical expression tree is the task's mathematical source of truth; rendering preserves its exact coefficients.

Curvature flags are sufficient proofs. General multiplication has no curvature proof unless a factor is established constant. For example, `square(x)` can be certified, while `multiply(x, x)` remains unverified by these rules despite being mathematically convex.

Convex acceptance additionally requires a strict exact midpoint gap against concavity; concave acceptance requires the opposite sign. Neither requires both signs, potentially at different pairs. Proven affine/constant overlap is excluded. Hidden cancellation without adequate evidence remains unverified.

## Public Contract and Example

`verifyReference(input: unknown)` validates and canonicalizes the case, then derives the label independently of `claimedLabel`. An optional `witnessPairs` array supplies candidate endpoints; their actual function values and gaps are recomputed. Otherwise the verifier searches distinct pairs on a deterministic nine-point grid, including pairs within each half of the interval.

```ts
import { checkCertificate, verifyReference } from "./apps/api/src/math/index";

const input = {
  expression: { op: "square", arg: { op: "variable" } },
  domain: { min: "-1", max: "1" },
  claimedLabel: "convex",
  witnessPairs: [{ x: "-1", y: "1" }],
};
const result = verifyReference(input);
if (result.status === "verified") {
  checkCertificate(input, result.certificate); // true
}
```

Outcomes:

| Status | Meaning |
| --- | --- |
| `verified` | The independently derived label matches the claim and includes a certificate. |
| `excluded` | Curvature is proved affine/constant, so convex and concave labels overlap. |
| `unverified` | Proof/witness evidence is insufficient, or an arithmetic/structural resource limit was reached. |
| `rejected` | Input/domain/operation is invalid or unsupported, or the claimed label disagrees with the derived label. |

Each certificate records verifier version `1`, canonical verification input, SHA-256 fingerprint, exact rendering, depth/node count, range/rule trace, and strict witness evidence. `checkCertificate(input, certificate)` recomputes verification and compares the full evidence; a matching fingerprint alone is insufficient. JSON round trips preserve valid evidence. Altered values, extra fields, accessors, and mismatched inputs fail replay.

## Exact Fixture Evidence

The midpoint gap is `f((x+y)/2) - (f(x)+f(y))/2`. Positive disproves convexity; negative disproves concavity.

| Function and domain | Evidence | Outcome |
| --- | --- | --- |
| `x²`, `[-1, 1]` | Convex composition proof; endpoints `-1, 1` give gap `-1`. | Verified convex |
| `-x²`, `[-1, 1]` | Concave composition proof; endpoints `-1, 1` give gap `1`. | Verified concave |
| `x*x²`, `[-1, 1]` | Endpoints `-1, 0` give `3/8`; endpoints `0, 1` give `-3/8`. | Verified neither |
| Affine or constant expressions | Both curvature directions proved. | Excluded |
| `x*x`, `[-1, 1]` | Convex proof unavailable; samples cannot establish it. | Unverified |
| `x² + (-x²)`, `[-1, 1]` | No strict midpoint gap; no arbitrary three-way label. | Unverified |
| Wrong claimed labels | Independent proof/witness result disagrees. | Rejected |

## Resource and Failure Boundary

- Operation depth: at most **128**; variable/constant leaves have depth zero. A valid depth-100 structural case passes. This demonstrates structural support, not meaningful benchmark difficulty.
- Expression occurrences: at most **512** nodes. Repeated branches count separately; cycles are rejected.
- Input and canonical literal length: at most **96** characters. Normalization can reveal a longer canonical value and produce a resource-limit outcome.
- Retained rational numerator/denominator: at most **4096** bits; bounded intermediate arithmetic permits cancellation before checking retained size.
- Arithmetic work: at most **200,000** arithmetic operations per verification.
- Supplied witness pairs: at most **16**, with distinct endpoints inside the domain.

Resource exhaustion is visible and never becomes a reference label. Exact arithmetic uses no floating-point tolerance. A failed finite witness search proves nothing globally. Conservative range bounds can reject or leave valid functions unverified; this is intentional incomplete certification, not incorrect classification.

## Verification Commands and Results

Executed from the repository root:

| Command | Result |
| --- | --- |
| `bun test apps/api/src/math/rational.test.ts` | Pass: 12 tests, 94 assertions. |
| `bun test apps/api/src/math/expression.test.ts` | Pass: 7 tests; final integrated run includes the added numeric-property rejection case. |
| `bun test apps/api/src/math/verifier.test.ts` | Pass: 29 tests, 132 assertions. |
| `bun run test` | Pass: 50 tests, 0 failures, 745 assertions across 4 files. |
| `bun run lint` | Pass for API and web. |
| `bun run typecheck` | Pass for API and web. |
| `bun run build` | Pass: API bundle and web production build. |

The initial integrated type check found a test-builder type narrowed to a variable-only expression. Its annotation was corrected; the full checks above then passed. No warnings remained in the final check output.

An additional direct Bun invocation of the public entry point verified the three exact fixture rows above and replayed their certificates after JSON serialization. No running server or browser was needed for this library module.

## Review

An independent read-only review inspected every source and test file, the mathematical plan, and the module requirements. It found no actionable defects in exact arithmetic, composition/range proofs, input validation, midpoint witnesses, resource limits, or certificate replay. The reviewer also confirmed no prohibited research references appear in source or tests. The project check results above were observed separately by the implementing agent, not inferred from the review.

## Downstream Inputs and Ownership

Module 02 receives exact expression/domain representation, label/overlap meanings, explicit failure statuses, and the depth convention. It must keep certificate/reference material outside model-visible prompts.

Module 03 receives the verifier contract, supported operations/domains, exact rendering, resource limits, and replayable evidence. It owns random generation, coverage, duplicate policies, suite identity, and frozen membership. Every generated candidate still requires independent verification.

No later module may reinterpret unsupported or unverified outcomes as ordinary three-way labels. Expansion to additional operations or numerical evidence requires a new verified boundary and version. Useful benchmark diversity and frontier-model limitations remain unproven until later modules supply their own evidence.
