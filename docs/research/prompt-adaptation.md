# Domain-aware curvature prompt

## Source and attribution

Reference: Yepeng Liu, Yu Huang, Yu-Xiang Wang, Yingbin Liang, and Yuheng Bu, *ConvexBench: Can LLMs Recognize Convex Functions?*, [arXiv v2](https://arxiv.org/abs/2602.01075v2), revised February 4, 2026. The one-shot template is in [Appendix B, PDF page 17](https://arxiv.org/pdf/2602.01075v2#page=17); the agentic template continues on page 18. Both prompt boxes are absent from the experimental HTML conversion. The complete PDF was read and the two pages were visually checked.

**Source paraphrase:** The baseline asks for decomposition into dependent terms, tracking their curvature and ranges, applying sufficient composition rules, and returning detailed JSON analysis plus a conclusion. It differs from the decomposed and agentic methods, which supply or process intermediate states. Coconut retains one function per fresh request and uses newly written instructions for its scalar interval population.

The manuscript links [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). The inspected [implementation revision](https://github.com/yepengliu/ConvexBench/blob/6f156c8c9b6b0b85f6a191bd4eb912e12e670082/convexbench/prompts.py) differs from the PDF and has no declared repository license in the inspected root/package metadata. Its rule list includes a misleading square-root/exponential example: mathematically, `sqrt(exp(x)) = exp(x/2)` is strictly convex. The application instructions are independently worded and include no source-specific rule table. This record preserves attribution and the substantive changes; changing wording alone is not a novel evaluation method.

## Adaptation decisions

- Classify the actual function on its exact closed interval, respecting the original domain during simplification.
- Attend to signs, nesting, ranges, and curvature, while allowing simplification, derivatives, inequalities, or sufficient composition rules. Failure of a sufficient rule establishes uncertainty, not the opposite mathematical property; see the [CVXPY explanation and counterexample](https://www.cvxpy.org/tutorial/dcp/index.html#example-2).
- Preserve the exclusive three-class policy: affine/constant inputs are excluded. Require a short mathematical justification rather than a detailed reasoning transcript; only the final label is graded.
- Retain the existing `label`/`explanation` JSON schema, extractor, profiles, three trials, output limits, and provider-default settings. No demonstrations, parsed dependency lists, intermediate curvature annotations, certificates, or hidden labels enter prompts.

## Exact instructions

The following system text is rendered from the application builder. The user message separately supplies only the canonical expression and interval.

```text
Determine the curvature of the scalar function in the user message on exactly the supplied closed interval.
Read the complete expression, including parentheses and coefficient signs. Account for the domains, ranges, and curvature of nested terms where they affect the conclusion.
Use any valid mathematical argument: simplification, composition rules, derivatives, or inequalities. Preserve the original function's domain when simplifying.
Choose "convex" if the function is convex and not concave throughout the interval; choose "concave" if it is concave and not convex; choose "neither" if it has neither property on that interval.
A composition rule that does not apply is inconclusive; it does not establish "neither". The input population excludes affine and constant functions.
The only variable is x. Rational numbers are exact, ^2 denotes a square, and / denotes real division. exp and log use base e; sqrt denotes the nonnegative real square root.
Respond with one JSON object containing exactly two fields: "label" and "explanation", both strings, each appearing once.
Set "label" to exactly one of "convex", "concave", or "neither", in lowercase.
Use "explanation" for a brief mathematical justification tied to this function and interval, with 1 to 4096 Unicode code points of well-formed text and at least one non-whitespace character.
The complete response must fit within 65536 UTF-16 code units. Include no markdown fences, extra fields, or surrounding prose.
```

User-message template:

```text
f(x) = <canonical expression>
Domain: x in [<exact minimum>, <exact maximum>].
```

## Version and reproduction

New default numerical requests add exactly `promptVersion: "smooth-v2"` to the existing five request fields. Legacy five-field requests continue selecting `smooth-v1`; explicit unknown/legacy version fields and extra fields are rejected. The saved request binds the wording version, and the suite hash binds that request and version. The mathematical generator stays `smooth-v1`, so case IDs, expressions, certificates, attempts, and ordering remain identical between the two default suites.

The current artifact is `apps/api/data/suites/smooth-v2.json`, with 27 certified cases and no candidate rejections. Historical `smooth-v1.json` remains unchanged. Prompt builders default to v2 for new raw tasks; scoring explicitly renders the validated saved suite's version and records it in report identity. Results from different prompt versions belong to separate comparison populations.

Current suite ID: `suite-smooth-v1-8806b2856918ad1add284101d685e16252e8d03f6f4bf0ba8e55937e2ff1e5f4`. Artifact SHA-256: `e14febe1b80398f0a602a34013a56a104f359550d93e54949fe268e876cb0a83` (214,588 bytes including final newline). The ID prefix names the unchanged mathematical generator; the separate prompt-version field identifies the wording.

```sh
bun run numerics:verify --input apps/api/data/suites/smooth-v2.json
bun run numerics:verify --input apps/api/data/suites/smooth-v1.json
bun run numerics:generate --output /tmp/coconut-smooth-v2-new.json
```

Verification covers exact text for both wording versions, old artifact bytes, identical mathematical cases, strict version validation, prompt privacy, both answer profiles/extraction, and version-correct scoring identity and prompt lengths. Hand-derived examples cover convex `sqrt(exp(x))` and a function whose class changes with its interval. All 394 Bun tests / 16,352 assertions pass across 27 files; root lint, type checking, and production build pass. Both numerical artifacts replay successfully, the documented instructions match the application builder exactly, and independent propagation review found no confirmed gaps. No model calls or measured performance claims are part of this prompt update; the effect on model accuracy and explanation quality remains unmeasured.
