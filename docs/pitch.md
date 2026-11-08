CoconutEval tests one specific question: can a language model correctly identify whether a function is convex, concave, or neither on a given interval?

That decision matters in mathematical optimization. Engineers use convexity when choosing solvers and deciding which guarantees apply. If a model gets the curvature wrong, it can recommend an unsuitable approach or claim a guarantee the problem does not support.

The task looks simple. Give the model a function and an interval, then ask for a classification.

For example, x squared is convex. Negative x squared is concave. X cubed is neither on the interval from minus one to one, but convex from zero to one. The interval is part of the problem.

With nested expressions, the model has to track parentheses, signs, and the domains of intermediate operations. Recognizing a familiar function is only the beginning.

Our confirmation challenge contains 72 tasks across eight function families. Every family includes convex, concave, and neither cases. Each task gets three fresh model requests, producing 216 answers per run.

Before testing a model, we establish the reference answer. Independent analytic checks and rigorous interval arithmetic agree on the admitted tasks. Global derivative bounds support convex and concave classifications. Opposite curvature signs at verified interior points establish neither.

The model sees only the expression, interval, and instructions. Reference labels and certificates stay outside its prompt.

Grading is deterministic. We compare the returned label against the certified answer and report macro-F1, accuracy, and per-class recall. We retain the explanation for inspection. Malformed responses, truncated answers, and provider failures remain distinguishable.

Here is what we actually found.

Two predeclared frontier models, tested with high and maximum reasoning settings, each achieved 216 correct labels out of 216 in all four reviewed confirmation runs.

That means our current confirmation suite does not establish a frontier-model limitation. We report that result directly.

Older-model screening did reveal concrete errors. In one example, GPT-4.1 classified a reciprocal-exponential function as concave on an interval where its second derivative is positive throughout. Its visible sign argument overlooked a leading minus sign.

That is an observed mathematical error in the exploratory screen. It does not establish frontier failure.

We also found why reading transcripts matters. One comparator produced a correct curvature argument inside invalid JSON. The response fails our output protocol, but describing it as a failure to understand convexity would be misleading.

CoconutEval makes those distinctions inspectable. A judge can examine the exact task, reference evidence, model response, settings, and score.

CoconutEval connects certified task coverage, reference checks, repeated model requests, retained outcomes, and reproducible reporting.

Judges can verify the frozen tasks and run the grader checks without model charges. Live evaluations use the visitor’s own credentials.

The main finding so far is precise: we have verified older-model screening errors and perfect frontier confirmation results. Any stronger claim must come from further evidence.
