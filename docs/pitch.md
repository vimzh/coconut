Hi guys, my name is Vansh, and this is CoconutEval, my submission to the micro1 Eval Hackathon.

When we build agentic apps, an exclusion rule given at the start still matters at the end. Imagine telling an agent, “Process these refunds, except for accounts under investigation.” After working through more instructions and exceptions, it still has to respect that original restriction. Overlooking it can change the final decision.

Think of a minus sign in front of a very long mathematical expression. It takes up almost no space, but everything inside still depends on it. Working through a hundred more operations does not make that sign less important.

That concern motivates CoconutEval: can a model keep track of small but decisive mathematical details as expressions grow? We test that with questions whose answers we can verify. Whether these scores predict an agent’s ability to preserve exclusion rules is a separate question that still needs testing.

Let's start with a dead simple example: is x squared convex?

It is. Put a minus sign in front, and negative x squared is concave.

Now take x cubed. From minus one to one, it's neither convex nor concave. From zero to one, it's convex. Same function, different interval, different answer.

Each individual piece is small: a sign, a range, a restriction. The challenge is keeping all of them intact as the expression grows. A rule established at the start still has to hold several operations later. CoconutEval tests the final mathematical classification when those details are combined.

That decision matters when choosing optimization methods for allocating resources, controlling a system, or fitting a model to data. Curvature helps determine which solvers and guarantees apply. A wrong classification can lead to an unsuitable method or an unjustified guarantee.

Now let's put that in nontechnical terms. Imagine a customer-support agent handling this refund policy: within 30 days, the item must be unopened or have arrived damaged. The customer opened a damaged delivery and requested a refund on day 12. If the agent fixates on the word opened, it can reject a valid request by overlooking the damage exception.

It’s like checking whether a deeply nested set of policy rules (eligibility, access control, insurance exceptions) still holds after many layers of “unless” and overrides. Each individual rule is simple. The question is whether a model that handles a couple of layers can keep track as those rules become deeply nested. CoconutEval measures function classification; whether those scores predict agent behavior still needs testing.

Let me walk through the pipeline in plain language: generate questions, verify the answers, send the questions to models, compare their responses, and calculate a score.

The judges described a strong eval as realistic tasks a professional would face, with everything graded stated in the task. It grades the result produced, has a reference solution that passes every grader, and supports a verdict two experts would independently agree on. It also needs multiple trials with variance reported, a clear spread across models with failures explained, public, synthetic or properly licensed data, reproduction instructions in the README, and every task and answer written or checked by the author. Those are the standards we are working against.

For CoconutEval, the professional connection is checking objectives and constraints before choosing an optimization method. Our generated scalar functions are a controlled slice of that work; they do not reproduce a complete professional workflow. Everything graded is stated in the task: the expression, interval, operator meanings and required answer format. We grade the final classification produced.

The generator builds mathematical expressions at different requested depths and pairs each expression with an interval. Think of nesting as feeding the result of one operation into another. The depth shown in our latest table is the generator’s requested setting, not a count of the model’s reasoning steps or a guarantee that a question is harder.

How do we know the correct answer? We check the exact expression before sending it to a model. For the latest deep study, retained mathematical proof checks establish the curvature classification, and a separate reference review checks those answers again. We do not simply trust the generator’s proposed label or ask another language model to vote on it. The proof has to apply to the stated interval, rather than a handful of sampled points. In plain language, the checks establish that the expression bends upward throughout, bends downward throughout, or has verified evidence ruling out both classifications. Only admitted, verified questions enter the study.

We then freeze the question set so every model receives the same questions. In the latest deep study, we send 100 questions at each requested depth of 5, 10, 20, 40, 80 and 160, plus 10 each at 320 and 512. That makes 620 questions per model, with one response per question. The model sees the expression, interval and instructions, but never the reference answer.

Here is an illustrative scoring example, not a measured result. Imagine a 100-question group with 33 convex questions, 33 concave questions and 34 neither questions. We compare every returned label with its verified answer. If the model gets 90 right and all 100 requests produce retained model outcomes, its accuracy is 90 percent.

Our main score goes one step further. For each of the three labels, we check two things: did the model find the cases that belong to that label, and were its predictions of that label correct? Missing a convex case hurts its convex score. Calling a concave case convex also hurts its convex score. We combine those two checks into an F1 score for each label, average the three equally, and put the result on a scale from zero to 100. That final number is macro-F1. Getting 90 answers right is enough to calculate accuracy, but we also need to know which labels were confused to calculate macro-F1.

A malformed, refused or cut-off reply counts as an unsuccessful model outcome. A provider failure or missing request stays separate and makes the score incomplete; it is not silently counted as a mathematical mistake. The table shows a score for each depth, with accuracy and outcome counts alongside it. We score the final label and retain the explanation for inspection; a correct label does not prove that every step of the explanation is correct.

The latest study’s construction, outcomes and limitations are documented in [the deep-study results](research/deep-study-results-v2.md). It is exploratory and unranked, and it is separate from the earlier confirmation challenge described next.

There is a clear spread across models in that study: provisional macro-F1 is 99.76 for Astra, 56.09 for Luna and 50.27 for Mini. We explain failures rather than treating every low score as a reasoning mistake. For one inspected Astra error, we can say: “The model fails because it doesn’t account for the outer negation when determining the curvature of a negative absolute-value term.” Its final label was wrong, and fresh mathematical checks corroborated the reference. Truncated replies and provider failures remain separate diagnoses.

Our earlier confirmation challenge contains 72 tasks across eight function families. Every family includes convex, concave, and neither cases. Each task gets three fresh model requests, producing 216 answers per run.

That earlier protocol supports multiple trials and reports trial spread. The latest deep study uses one response per question, so it cannot establish repeat consistency or trial-to-trial variance.

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

Judges can follow the README to verify the public frozen tasks and run grader checks without model charges. Live evaluations use the visitor’s own credentials. The private deep-study expressions and transcripts are not yet available for full public reproduction because redistribution clearance remains unresolved.

Every admitted deep-study task has retained reference checks and a separate reference review. These reviews were AI-assisted; we do not claim two independent human experts reviewed every answer, or that I personally hand-checked every generated expression. To establish the judges’ expert-agreement and author-review criteria fully, we would need documented independent expert verdicts and an author review record covering every task and answer. Likewise, “the reference solution passes every grader” requires an end-to-end pass record across all claimed grading paths; our current claim is verified labels and independently reconstructed scores.

The main finding so far is precise: we have verified older-model screening errors and perfect frontier confirmation results. Any stronger claim must come from further evidence.
