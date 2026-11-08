# Depth-100 exploratory pilot

The user requested the same two small models at depth 100. Run a separate fixed population, leaving all prior inputs, scores and accounting unchanged.

## Object and feasibility

The standard exact suite generator stops at 80; its affine envelopes at depth 100 would exceed the unchanged 512-node verifier boundary. Use a separately versioned research population rather than widening either boundary or padding an expression with identities. The native smooth verifier remains unchanged too.

Let C_n(x) be a left-associated sum of n terms |x-c_i| on [-1,1]. Centers are distinct interior rationals: ±j/d for j=1..49 and d in {64,68,72}; the 99-term version additionally includes zero. The nine tasks are C_99 (convex), -C_98 (concave), and x*C_98 (neither), each at the three denominator choices. Measured depth is 100 for each. Node counts are 494, 490, and 491, below the existing 512-node ceiling.

Sums of absolute-affine terms are convex; the interior kinks exclude affine overlap. Negation reverses curvature. Symmetry makes C_98 even, and C_98(1)>C_98(1/2), so x*C_98 has strictly opposite exact Jensen gaps on [-1,0] and [0,1]. Retain exact witnesses and an independent reference review of the actual ASTs before live inference.

## Frozen execution and verification

1. Generate the nine references deterministically and replay the existing verifier, with exact node/depth and label checks. Independently verify mathematical references and uniqueness with rational arithmetic; freeze population/review and prior-ledger hashes before model replies are inspected.
2. Use gpt-4.1-mini and gpt-4o-mini, three fresh calls per task, one-shot-json-v1, provider-default settings and 4,096 output tokens. Maximum 54 new inference sends, no retries. Initial two calls may raise concurrency to 12 only with sufficient observed header headroom. Stop new work on provider, persistence or unexpected worker failure. Standard metadata 20s/inference 180s and overall 15min deadlines apply.
3. Prior requests 7908 plus at most 54 yield 7962 cumulative, within the unchanged 8192 ceiling. Preserve all earlier unknown sends. Persist dispatch authorization before each wire call, and keep raw outcomes private; public local progress contains aggregate classification and result hashes.
4. Reuse the shared classifier for this custom research artifact. It is not a standard suite/RunView/full scorer report and is not eligible for the product leaderboard. Independently recompute scores and inspect wrong/unusable outcomes without repairing grades.
5. Run focused generation, prompt, scheduler, SDK/transport and classification checks; API lint, types and build; retain actual outcomes and limitations in the research result record.

## Interpretation boundary

All nine tasks come from one highly templated summed-absolute construction. Their distinct kink locations establish distinct functions, but parameter variants and repeated trials are not independent mathematical families. Class-specific term counts and outer forms permit shortcuts. Associativity allows flattening the nested sums; AST depth increases alongside length and kink count. This is an exploratory structural stress pilot, without matched shallower controls, a causal depth claim, a universal failure threshold, or a frontier-model claim. The two requested models are legacy small models. Results are not directly comparable to the depth-60 envelope population or the prior research benchmark.
