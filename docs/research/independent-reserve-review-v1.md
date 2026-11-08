# Independent reserve runtime review

A separate AI-assisted reviewer found **no blocking mathematical or source defect** in the fixed 18-case runtime population. This is not human approval or a model-performance result. The [machine-readable record](../../apps/api/data/quality/reserve-reference-review-v1.json) has canonical SHA-256 `2c69ff774dce5b6b90f0b1d3c709d7bd102b4e4cca1aefed2dcb6564ccd851e3` and binds every reference, native/analytic certificate, source-file snapshot and review limitation.

The reviewer confirmed the original 633,276-byte proposal at raw SHA-256 `766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85`, the 349,464-byte runtime artifact at `2abd3bc34737a3bfed4e6ba28a67cb28dd42c26e8f92b96a8688cad399cd5d49`, suite ID `suite-reserve-v1-54c719576846a0437a431372204593bd8ea47f4af99def6a654db4a93502e7c7`, and membership fingerprint `195d6616cc365b2d69b704d8be7ea74c8b9dc7f2d8dd2c2867aa137b0fe5f615`. Runtime construction derives its 18 members from source code rather than trusting the static research proposal.

## Separate mathematical checks

Using an independently written Python `Fraction` and polynomial implementation, the reviewer reconstructed both degree-nine/ten source polynomials and all 18 AST/domain/label/family/source-group/quadratic-coefficient bindings. It independently derived all six degree-34/38 curvature numerators, recomputed 39 exact Bernstein cells and checked the retained enclosing bounds. These prove all 12 strict global convex/concave cases. Both strict interior witnesses were verified for all six neither cases.

The reviewer checked 54 deliberately misleading coarse curvature probes and 96 grid-closed Jensen triples; these are diagnostics, not the label proofs. All 153 unordered pair separations were verified: 144 by disjoint native value-probe enclosures and nine same-family/same-label cross-source pairs at `x=-15/16`. For those nine, `p1²=(289/256)p0²` and strict outer monotonicity supplies exact value inequality. Zero pairs remain unresolved.

## Runtime checks

Fresh `validateReserveSuite` native replay reproduced the artifact. Max-profile generation retained identical cases/certificates with its distinct documented suite identity. All certificates retain 192-bit precision; the largest cover has 132 leaves, corresponding to at most 263 processed binary cells. Depth 32, 256 nodes, 512 cells and 200,000 node evaluations remain unchanged.

All 18 generated prompts were inspected for case/cluster/family IDs, analytic certificates, claimed labels and separation metadata; none leaked. Source inspection confirmed strict full replay, accessor rejection, bounded CLI input, exclusive outputs, explicit incomplete/cancelled outcomes and no successful suite identity on failure. Whitespace checks passed. The reviewer inspected the working tree at `395ad4d`; coordinator-captured source hashes preserve the completed source snapshot separately.

The reviewer did not independently reimplement Arb, inspect active/private model runs, read credentials or make inference calls. Full repository checks were not rerun by this reviewer; the [runtime handoff](../handoffs/reserve-runtime-v1.md) records implementer checks. This mathematical review does not establish difficulty or improve the statistical population: 18 tasks, three families and two related source groups remain exploratory, unranked and ineligible for the frozen confidence interval or stronger confirmation claim.
