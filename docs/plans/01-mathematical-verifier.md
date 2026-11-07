# Module 01 Technical Plan: Mathematical Verifier

## Scope and Decision D-01

Implement a local, bounded verifier in the existing Bun/TypeScript backend. There are no verifier callers yet. No HTTP endpoint, model integration, random instance generator, frontend change, or benchmark-suite publication belongs in this module.

The supported target is a scalar function on a nondegenerate finite closed interval with rational endpoints. Expressions support a variable, rational constants, addition, negation, multiplication, square, absolute value, maximum, and minimum. All these operations are defined on the whole real line. Other operations, malformed expressions, and invalid domains are rejected explicitly.

An alternative is a separate real-number backend with rigorous numerical enclosures for transcendental functions. That would add a runtime, precision policies, and deployment requirements. The exact subset avoids rounding assumptions and new dependencies. It does not promise certification of exponential, logarithmic, or square-root expressions; expanding that boundary requires a new verified contract.

### Label Semantics

- A convex instance requires a sufficient convexity proof and an exact strict midpoint Jensen witness against concavity.
- A concave instance requires a sufficient concavity proof and a witness against convexity.
- A neither instance requires exact witnesses against both properties, possibly at different pairs of points.
- Certified affine/constant cases are excluded from the three-class benchmark because their labels overlap.
- Unknown curvature, hidden cancellations without strict witnesses, and exhausted resources remain unverified. A failed proof rule is never a neither label.

This resolves D-01 for the first verifier version. G-MATH remains unproven until the implementation, fixture checks, and review pass.

## Architecture and Files

Create a focused `apps/api/src/math/` library:

- `rational.ts`: exact normalized rational values, strict decimal/fraction parsing, arithmetic budgets, and bit limits.
- `types.ts`: shared mathematical input, outcome, and serializable evidence types.
- `expression.ts`: validated canonical expression tree, domain, tree limits, rendering, and exact evaluation.
- `curvature.ts`: bottom-up composition/range analysis and proof trace.
- `verifier.ts`: independent reference-label derivation, strict midpoint witness search, explicit outcomes, bound certificates, and replay.
- Corresponding Bun tests: independent arithmetic expectations, hand-checkable mathematical examples, and adversarial evidence/input cases.
- `index.ts`: narrow exports for later modules.

No new package is needed. Existing API tests and application behavior remain unchanged. Tests under the backend are discovered by the current root test command; the backend's current lint and type-check commands cover the library.

## Inputs and Interfaces

`verifyReference` accepts untrusted input containing an expression, domain, claimed label, and optional candidate midpoint-witness pairs. Constants and domain/witness coordinates are strings so decimals and fractions retain their exact intended values. Runtime validation checks all fields; supplied labels, ranges, and proof metadata are never trusted.

The canonical tree is the mathematical source of truth. Its rendering uses exact canonical rational constants and explicit parentheses. Module 03 will render from that tree rather than attach an independently rounded expression string.

Results distinguish verified, excluded overlap, unverified, and rejected inputs. Verified evidence contains the exact canonical expression/domain, rendered expression, actual depth/node count, verifier version, bottom-up rule/range trace, and strict Jensen witnesses. A deterministic fingerprint binds these fields to their expression and domain. Certificate replay independently recomputes evidence rather than trusting a hash or embedded flags.

Depth is zero for variable/constant leaves and one plus the greatest child depth for an operation. Count actual expression occurrences, including repeated branches. Reject cyclic inputs. Cap depth at 128 and total nodes at 512; demonstrate a valid depth-100 input without claiming useful difficulty merely from nesting.

## Mathematical Invariants

Track independent sufficient convex and concave flags, plus rational lower/upper enclosures. Both flags imply affine behavior. Singleton enclosures prove constants even when curvature rules alone are inconclusive.

Addition combines corresponding flags. Negation swaps flags. Multiplication has a curvature proof only when a factor is proved constant, using its sign. Square and absolute value preserve convexity for affine inputs, convex nonnegative inputs, or concave nonpositive inputs. Maximum preserves convexity; minimum preserves concavity. General multiplication remains unverified by these sufficient rules but may supply neither counterexamples.

For endpoints `x` and `y`, compute the exact midpoint gap `f((x+y)/2) - (f(x)+f(y))/2`. A positive gap disproves convexity; a negative gap disproves concavity. Search a deterministic nine-point rational grid including pairs in each half of the domain, not only the endpoints. Recompute any supplied candidate pair independently and validate domain membership. A finite unsuccessful search supplies no global proof.

Do not mark an expression verified merely because a label was requested or all sampled gaps had one sign. Exclude proven overlap; otherwise require the appropriate proof/witness combination.

## Resource and Failure Handling

Reject invalid literals, zero denominators, non-string numeric inputs, malformed trees, unknown fields/operations, invalid labels, reversed or singleton domains, and invalid witness pairs with actionable reasons. Limit literal length before integer parsing, rational bit lengths, tree size/depth, and arithmetic operations. Bound intermediate products before allocating them; fail visibly when the result cannot be retained within policy.

Arithmetic exhaustion is an unverified limit outcome. It cannot become an accepted label or ordinary model failure. Witness evidence is exact, so arbitrarily small nonzero gaps remain valid within resource bounds; there is no floating-point tolerance pretending to certify a sign.

## Verification Plan

Write hand-checkable expectations for rational normalization and arithmetic, a quadratic and its negative, a cubic spanning zero, affine/constant overlap, concealed cancellations, unsupported logarithm/square-root inputs, and a mathematically convex product form whose curvature rules are inconclusive. Include corrupted labels, expression/domain changes, altered certificate fields, outside-domain witnesses, malformed/cyclic trees, depth/node/literal limits, rational growth, and a valid depth-100 case.

Commands from the repository root:

```sh
bun test apps/api/src/math
bun run test
bun run lint
bun run typecheck
bun run build
```

Run type generation and production build sequentially to avoid generated-file races. Perform a code review focused on false certifications, trust boundaries, and resource limits. Inspect staged changes for forbidden source/commit wording, credentials, generated files, and local-only instructions before committing.

## Documentation and Handoff

Update D-01 and module progress in `docs/ROADMAP.md` without marking unrelated modules complete. Update the current implementation-state statement in `docs/idea.md`. Write `docs/handoffs/01-mathematical-verifier.md` with interfaces, example inputs/outcomes, limits, exact commands/results, review findings, accepted boundaries, and an explicit G-MATH verdict. Keep research references in documentation, not source or commit messages.

This module establishes mathematical correctness for its stated subset. G-SIGNAL, model capabilities, provider access, and the usefulness of generated benchmark suites remain later work.
