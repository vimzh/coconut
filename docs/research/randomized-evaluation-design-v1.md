# Research record: randomized certified evaluation

## Status and reading contract

Prepared on 2026-11-08 for [Module 14b](../modules/14b-randomized-certified-evaluation.md), then amended the same day to prefer upstream integration and a small Astra pilot over a bespoke generator. This historical research/planning artifact had no inference calls. Later implementation and the terminal, inconclusive two-send pilot are recorded separately in the [14b handoff](../handoffs/14b-randomized-certified-evaluation.md); the source summaries below are not themselves benchmark results.

Source summaries below are explicitly **paraphrases**. Project requirements and proposed experiments are **design inferences**, not findings established by the cited authors. Primary publications and official documentation were checked for the specific stated claims; historical papers provide methods, not current model inventories or guaranteed failure rates. No external source was vendored into Coconut; the upstream reuse investigation used a separate local clone and temporary generated samples.

## What the repository already establishes

The [composition repair](composition-design-v1.md) uses 27 verified tasks in nine related groups at 2/4/6 nonlinear stages, AST depths 7/13/19. Its atoms are two increasing convex rational maps; it retains contraction, coefficient and shared-prefix limitations. Its [completed comparison](composition-results-v1.md) reports Mini 30/81 correct and Luna 65/81 correct; Luna's eleven truncations are separate from its five wrong valid labels. These observations do not establish that arbitrary randomized expressions will be harder.

The normal numerical admission path is bounded to operation depth 32 and 256 nodes. The [quality policy](quality-criteria-v1.md) also bounds its current offline report and fixed-three-trial uncertainty procedure. Inspection of [bootstrap.ts](../../apps/api/src/quality/bootstrap.ts) confirms that it expects three outcomes per task and at most 256 cases. It cannot analyze the planned single-trial 800-case study unchanged. The [structural analyzer](../../apps/api/src/quality/structure.ts) provides useful bounded identities and signatures, not complete mathematical equivalence or split independence.

[Module 15](../modules/15-deep-composition-stress-evaluation.md) now targets 100 admitted tasks at each requested upstream generator depth 5/10/20/40/80/160/320/512, explicitly recording actual upstream depth and nonlinear paths separately. Its single-trial, Astra-inclusive final study and 30 + 800 × M ceiling remain intact. The sequence is 14a cleanup → 14b upstream integration and adaptive Astra search → 15 fresh deep study. The earlier 24-question pilot is superseded: at most nine three-question panels (27 sends) and three inference probes share the same 30-send development ceiling, separate from the final 800.

## Upstream-first MVP amendment and offline observations

**User-directed design amendment:** Reuse the official generator pinned to `6f156c8c9b6b0b85f6a191bd4eb912e12e670082`; implement a thin importer, independent reference/domain admission and a small Astra pilot before considering bespoke mathematical construction routes. The older research below remains background, not a requirement to implement three sampling engines or every diagnostic before an MVP.

**Source paraphrase:** The upstream CLI generates expressions, tree presentation, actual depth, node count, label and a Jensen-test status. Requested depth can become D+1 after final negation. Its depth convention includes some affine steps and omits affine aggregation steps. A shared random stream depends on the batch call/order as well as its seed. [Pinned generation script](https://github.com/yepengliu/ConvexBench/blob/6f156c8c9b6b0b85f6a191bd4eb912e12e670082/scripts/generate_dataset.py).

**Source paraphrase:** Convex/concave labels rely on symbolic DCP construction, with finite-sample Jensen checks as a rejecting sanity check; unavailable floating-point evaluation is explicitly recorded. Neither requires finding numerical violations in both directions. The CSV does not retain a Coconut finite interval or strict witness coordinates. [Pinned reference entry points](https://github.com/yepengliu/ConvexBench/blob/6f156c8c9b6b0b85f6a191bd4eb912e12e670082/convexbench/synth/api.py), [Jensen implementation](https://github.com/yepengliu/ConvexBench/blob/6f156c8c9b6b0b85f6a191bd4eb912e12e670082/convexbench/synth/jensen.py).

**Observed local feasibility:** An unmodified checkout at `/Users/vanshgaur/projects/convexbench-reference` ran generation-only calls separately for requested depths 5, 20, 100 and 512, one candidate per class, seed 0, Python 3.13.17, NumPy 2.1.2, pandas 2.3.1 and tqdm 4.67.1. All twelve candidates were generated. At requested 100, realized depths were 101/101/100; at requested 512 all three were 512. The 512-node counts were 1339/1362/891, expression lengths 14289/14794/9511 characters, and numerical statuses not_evaluable/not_evaluable/verified. The three-case CSV was 5,293,284 bytes, mostly expanded tree presentation. Its first inspection exceeded Python's default 131,072-character CSV-field limit; a replay with an explicit 16 MiB field bound succeeded. These are exposed development samples, not independently admitted pilot cases, throughput estimates, exact historical paper questions or model-hardness findings.

The generation command for each separate smoke run was `python scripts/generate_dataset.py --depths D --n-per-class 1 --seed 0 --out <new-directory>`. Module 14b's production plan must additionally freeze source/environment, actual artifacts and bounded admission, rather than treating these smoke results as proof of domain/label validity.

**Observed provenance limit:** No code license file/declaration was found in the inspected tracked source or package metadata. The external clone and generation check do not establish incorporation or redistribution rights. Record permission before shipping reused source; do not assume the manuscript license applies to code. [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

**Adaptive pilot amendment:** Start with three admitted development questions at requested depth 216, one per label and one Astra response each. If all three valid labels are correct, try 512; if again all correct, try 1000. A verified error at 216 supplies the initial signal. If a deeper panel supplies a verified error after an all-correct lower panel, explore that interval with fresh panels: 750 first for 512–1000, otherwise floor midpoint. At most nine panels/27 question sends plus three inference probes fit the unchanged shared 30-send development ceiling. Stop at an interval width of 16, budget/panel exhaustion, all-correct through 1000, observed inversion, or an unsupported/inconclusive panel. Only panels with three valid labels establish endpoints; independently checked point errors in inconclusive panels remain reportable without interval updates. Freeze the search algorithm, seeds/settings and stop rules before outcomes, then freeze each actual panel before its calls. No search inference had occurred at that planning checkpoint; later terminal evidence is recorded in the 14b handoff.

**Design limitation:** The sampled-error predicate is stochastic and depends on which three functions were drawn. It is not monotonic in depth, so midpoint exploration is not a correct binary-search algorithm for a unique failure threshold. Report the adaptive trajectory, all successes and errors, exposure and scope. A below-100 result due only to truncation, malformed output, refusal, service failure or an incorrect reference is not a mathematical signal. Requested 1000/possible realized 1001 requires fresh bounded generation/reference/context feasibility; the existing smoke observations stop at 512. Any selected candidate region is development evidence; confirm on fresh final cases before stronger claims or final-depth amendments.

## Primary-source findings and bounded implications

### 1. Random generation needs a declared distribution

**Source paraphrase:** Duchon, Flajolet, Louchard and Schaeffer develop random samplers from recursive combinatorial specifications, with precise distributional statements and size-conditioned uniformity under their assumptions. Arbitrary random production choices do not acquire those guarantees. [Boltzmann Samplers for the Random Generation of Combinatorial Structures](https://algo.inria.fr/flajolet/Publications/DuFlLoSc04.pdf)

**Design inference:** Specify grammar, size/termination rules and probabilities. Do not claim uniformity over mathematical functions, or assume structural randomness implies difficulty. Boltzmann sampling is a research reference, not a required dependency or an already selected algorithm.

### 2. Sufficient curvature rules are incomplete

**Source paraphrase:** CVXPY distinguishes convex/concave/affine/unknown and gives sufficient composition rules using curvature and monotonicity. It illustrates a truly convex expression that is not recognized in one representation. [Official DCP tutorial, curvature rules and Example 2](https://www.cvxpy.org/tutorial/dcp/)

**Design inference:** Keep rule recognition separate from mathematical truth. A construction guided entirely by these rules can be useful and sound while supplying an easy or narrow accepted population. Never turn unknown into neither or exclude correct short proofs as illegitimate solutions.

### 3. Global references require explicit mathematical assumptions

**Source paraphrase:** The second-order condition relates convexity to nonnegative Hessian on the appropriate differentiable convex domain; in one dimension this is the second derivative. Strict convexity does not require that derivative to be strictly positive at every point. [Boyd and Vandenberghe, Convex Optimization, §3.1.4](https://www.stanford.edu/~boyd/cvxbook/bv_cvxbook.pdf)

**Design inference:** State regularity/domain assumptions and verify global signs plus exclusion of affine overlap. Distinguish a convenient positive-margin admission policy from the definition of convexity. Require opposing rigorous witnesses for neither and full domain validity.

### 4. Rigorous numerics do not remove dependency or implementation risks

**Source paraphrase:** Arb uses rigorous ball/interval error bounds, and its discussion identifies enclosure overestimation and tests using alternative algorithms, identities and varied precision. [Johansson, Arb: Efficient Arbitrary-Precision Midpoint-Radius Interval Arithmetic](https://fredrikj.net/math/arbpaper.pdf)

**Design inference:** Reuse the pinned project backend and bounded certificates; do not infer that floating-point agreement, overlapping intervals or more precision alone proves a reference. Independent identities and domain checks are needed. Unresolved work remains unresolved, with selection rates disclosed.

### 5. Property-based testing exposes sampling and reduction obligations

**Source paraphrase:** QuickCheck documents generated-value coverage, how restrictive preconditions can distort or discard samples, invariant-preserving shrinking, and limitations of seed replay across library versions. [QuickCheck 2.16 official documentation](https://hackage-content.haskell.org/package/QuickCheck-2.16.0.0/docs/Test-QuickCheck.html)

**Design inference:** Retain rejection/coverage evidence and actual cases; use bounded reduction preserving reference validity and the diagnosed failure. This is a methodological reference to a versioned document, not a recommendation to add or pin a Haskell dependency.

### 6. A seed alone is not a complete reproduction contract

**Source paraphrase:** NEP 19 explains limits of numerical random-stream reproducibility across versions/builds and the need to control more of a software stack than its seed. [NumPy random-number generator policy](https://numpy.org/neps/nep-0019-rng-policy.html)

**Design inference:** Retain algorithm/configuration/source/backend versions, candidate order and exact artifacts. Parallel scheduling must not choose which candidate enters a frozen suite. This does not require adding NumPy or using its random generator.

### 7. Procedural mathematics benefits from controlled splits

**Source paraphrase:** Saxton et al. describe procedural mathematics generation, note pitfalls of unconditional random sampling, and distinguish interpolation from extrapolation. They also discuss semantic repetition that superficial question hashing can miss. [Analysing Mathematical Reasoning Abilities of Neural Models, §§2.1–2.3](https://arxiv.org/html/1904.01557v1)

**Design inference:** Use bounded meaningful parameter regions, record semantic/ancestry diagnostics and label each split's purpose. A new string/seed can be a new instantiation of an exposed core, not a structural-generalization test. None of that source's sampling or learning results automatically transfers to Coconut.

### 8. Random instantiations can reveal variation without proving internal mechanisms

**Source paraphrase:** GSM-Symbolic uses symbolic templates with variable/domain conditions and examines performance across instantiations. [GSM-Symbolic, arXiv v2, §§3.1–3.2](https://arxiv.org/html/2410.05229v2)

**Design inference:** Sample and retain multiple mathematical groups, not just repeated replies. Do not adopt its model-answer-based validity filter or infer hidden reasoning from a score change. Coconut's reference labels must come from independent mathematics rather than model agreement.

### 9. Adaptive inspection can spend the holdout

**Source paraphrase:** Dwork et al. explain how repeated adaptive selection after inspecting holdout results can overfit the holdout, and develop specialized methods with formal reuse guarantees. [Generalization in Adaptive Data Analysis and Holdout Reuse, arXiv v2, introduction and §1.1.1](https://arxiv.org/html/1506.02629v2)

**Design inference:** Separate development and fresh final groups, freeze the generator/analysis before scored outcomes, and retain exposure. Ordinary freezing and fresh seeds do not inherit differential-privacy or reusable-holdout guarantees from that paper. Changing a seed after model-informed design is not proof of structural independence.

### 10. Split dependence and mismatched claims are leakage risks

**Source paraphrase:** Kapoor and Narayanan's final article distinguishes duplication, nonindependence between partitions, illegitimate features and mismatch between the evaluation sample and the claimed population. [Leakage and the reproducibility crisis in machine-learning-based science, Patterns 4(9):100804, taxonomy section](https://pmc.ncbi.nlm.nih.gov/articles/PMC10499856/)

**Design inference:** Preserve significant construction ancestors and paired variants as groups; define the accepted distribution and restrict claims to it. This identifies possible failure modes, not evidence that any particular retained Coconut result contains training contamination.

### 11. Test a heuristic and the opposite of that heuristic

**Source paraphrase:** HANS creates cases consistent with and contradictory to specific heuristic rules, with controls against alternative cues. [McCoy, Pavlick and Linzen, Right for the Wrong Reasons, ACL 2019, §§2–3](https://aclanthology.org/P19-1334/)

**Design inference:** For root/sign/coefficient/domain shortcuts, retain supporting and contradicting mathematical controls. A panel containing only a baseline's failures changes the population and can reward the inverse rule. Language-inference experiments do not establish which convexity heuristics will succeed.

### 12. Paired interventions test local decisions, not universal robustness

**Source paraphrase:** Contrast sets use small meaningful changes to probe local decision boundaries and discuss both construction bias and limits of positive evidence. [Gardner et al., Evaluating Models' Local Decision Boundaries via Contrast Sets, §§2.4–2.5](https://aclanthology.org/2020.findings-emnlp.117/)

**Design inference:** Independently certify same-form coefficient/domain changes; report both-members-correct rather than mere prediction flips. Keep pairs together in splits and analysis. Passing finite pairs does not prove that a model uses a particular reasoning process.

### 13. Correctness, invariance and directional behavior are different tests

**Source paraphrase:** CheckList distinguishes minimum-functionality, invariance and directional-expectation tests. [Ribeiro et al., Beyond Accuracy, ACL 2020, §2.2](https://aclanthology.org/2020.acl-main.442/)

**Design inference:** Include simple valid controls, equivalent representations and certified label-changing interventions, with separate diagnostic metrics. Invariance alone is insufficient because two agreeing answers can both be wrong. The behavioral matrix is finite diagnostic coverage, not exhaustive correctness.

### 14. Mathematical relations can test the testing machinery

**Source paraphrase:** The original metamorphic-testing report uses known relationships between related inputs/outputs to find defects beyond individual examples. [Chen, Cheung and Yiu, Metamorphic Testing: A New Approach for Generating Next Test Cases](https://arxiv.org/abs/2002.12543)

**Design inference:** Check independent implementations and known domain-preserving transformations without claiming that transformed tasks are independent. For example, output negation swaps convex/concave while preserving neither. An invalid transformation relation is itself a test-generator bug.

### 15. Related requests do not multiply independent support

**Source paraphrase:** Saravanan, Berman and Sober discuss pseudoreplication in nested observations and dependence-aware resampling. [Application of the Hierarchical Bootstrap to Multi-Level Data in Neuroscience, arXiv v2](https://arxiv.org/html/2007.07797v2)

**Design inference:** Preserve base groups, pairs, depths and repeats during uncertainty analysis. Define task versus group weighting when group sizes differ. This motivates the dependence policy; it does not prove the coverage of Coconut's current or future bootstrap procedure.

### 16. Prior convexity results are a reference design, not an expected outcome

**Source paraphrase:** The original motivating study synthesizes compositions under curvature rules and filters neither cases using counterexamples, then compares raw and decomposed/recursive evaluation methods. [ConvexBench, arXiv v2, §§3–5](https://arxiv.org/html/2602.01075v2)

**Design inference:** Preserve prior-work attribution and distinguish its construction, models and budgets from ours. Its results do not imply that every newly sampled function must cause a model failure. Project code, prompts, fixtures and public application assets continue to use original project terminology without paper references.

## Initial proposed experimental contract — background, superseded for MVP scope

These are original project proposals, not validated outcomes. The upstream-first amendment above and current Module 14b determine the MVP implementation scope; broader routes, trained baselines and paired challenge panels below are deferred unless later justified:

1. Define a bounded grammar and exact input distribution, with property-directed, proposal-then-certify and curvature-construction routes considered independently.
2. Establish actual-domain labels and opposite-label exclusion before including any task; keep all failed/unknown proposals visible by stratum.
3. Measure structural diversity and meaningful dependence, then group known transformations, shared cores and pairs. Do not claim full semantic equivalence checking.
4. Freeze cheap shortcut baselines and sound-math coverage baselines. Short correct proofs remain allowed. Record baseline uncertainty/budgets and which decisions used exposed data.
5. Keep an ordinary certified sample separate from challenge selection. The population after certification/quotas is already conditional, and further filtering conditions it again.
6. Freeze group-separated final data only after development/validation decisions. Structural-generalization panels and adaptive searches need distinct identities and disclosures.
7. Reuse existing execution/scoring infrastructure with the consuming study's declared trial contract. One-trial, three-trial, format, budget and model settings remain distinct comparisons.
8. Publish observed correctness, unusable/budget outcomes, coverage and narrow failure findings. Neither a large expression nor baseline failure establishes intrinsic difficulty.

## An exact diagnostic against predetermined sparse probes

The following is an independently derived elementary control, not a copied benchmark task or a claim of model difficulty.

For a finite predetermined curvature probe set P in [0,1], choose rational r strictly inside the interval and outside P. Choose a rational positive epsilon smaller than every distance from r to a probe and to either endpoint. Set

    f(x) = (x-r)^4/12 - epsilon^2*(x-r)^2/2.
    f''(x) = (x-r)^2 - epsilon^2.

Every predetermined probe has strictly positive second derivative. At the interior point r it is strictly negative; an interior point outside (r-epsilon,r+epsilon) has positive curvature. Thus the polynomial is neither despite the positive probe results. All quantities can be checked exactly. Derivative computation verifies the identity directly.

Use a finite margin/range policy and publish it. Do not make epsilon arbitrarily small to create an unresolvable numerical problem. Keep this alongside examples where the probe heuristic works; the purpose is to validate the diagnostic and reference boundary, not to assemble a final population consisting only of probe failures.

## Feasibility questions that research does not settle

These include broader questions from the original generator proposal. The upstream MVP must establish its actual admitted support and requested/realized depth policy, not prove every speculative construction route or exact nonlinear-stage target below.

- Can the accepted grammar cover the requested mechanism/label/level cells without overwhelming rejection or certifier bias?
- Can independent, bounded proofs support useful randomness at 160–512 true nonlinear stages without collapsing into a closed form or a narrow recurrence?
- Do the chosen baselines detect important superficial cues, and are there enough independent groups to assess them?
- How much of the measured difficulty is arithmetic, range contraction, representation or token budget rather than the intended dependent reasoning?
- Which significant-core rules are justified for splits and uncertainty, and what equivalence remains unknown?

Record these as gate questions and measured limitations. A literature citation cannot close them. At that research checkpoint, Module 14b was planned; the smoke check alone supplied no independent reference or Astra evidence. The later implementation, independent admission, retained exposure ledgers and inconclusive live pilot are separate in the [handoff](../handoffs/14b-randomized-certified-evaluation.md).
