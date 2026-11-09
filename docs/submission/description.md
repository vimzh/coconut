# Submission description

Draft text for the written-description field. The portal field has not been filled or verified by this audit.

## Title

Coconut: Certified Convexity Evaluation

## Description

Coconut tests whether language models correctly classify a scalar function as convex, concave or neither on an exact interval. It independently certifies reference labels, keeps them outside model prompts, and retains answers and execution outcomes for inspection.

We report six models across eight requested generator depths in two exploratory, single-response studies: a 620-question reasoning study and an 800-question fast screen. Different reasoning budgets and populations are disclosed. Astra returned one independently checked mathematical misclassification: its explanation missed a negation and reversed a derivative-jump sign. Truncations and infrastructure failures are reported separately; this observation does not establish a repeat-consistent failure threshold.

The project provides a deterministic label grader, a browser workbench and configurable terminal generation, verification and evaluation. Its contribution is certified exact-display admission and inspectable evidence around adapted generation, rather than a claim that expression length alone establishes difficulty.

## Before pasting

The imported generation method is prior work credited in the [README](../../README.md#prior-work-and-review). Raw-question/transcript redistribution clearance, representative transcript inclusion, the public video and the author's personal review remain open in the [readiness record](readiness.md). This draft does not imply those requirements are complete or that anything has been uploaded.
