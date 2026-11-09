import Link from "next/link";

const questions = [
  {
    question: "What does Coconut test?",
    answer: "Coconut tests whether a language model can correctly classify the curvature of a mathematical function over a specified interval. Each question has three possible answers: convex, concave or neither. We compare the model’s answer with a verified reference and retain execution evidence behind the score.",
  },
  {
    question: "Why test this particular skill?",
    answer: "A model can recognize individual operations yet struggle to track how they interact inside a larger expression. Curvature classification gives us a precise question with checkable answers. Coconut combines task generation, reference verification, model execution and evidence-based scoring so visitors can inspect what succeeded, what failed and what remains unknown.",
  },
  {
    question: "What do convex, concave and neither mean?",
    answer: "A convex function bends upward: the straight line joining any two points on its graph lies on or above the graph. A concave function bends downward, with that line on or below the graph. Neither means the function satisfies neither condition across the whole interval. Straight-line functions satisfy both definitions and are excluded from these tasks.",
  },
  {
    question: "Why does the interval matter?",
    answer: "The same function can have different curvature on different intervals. For example, x³ is convex on [0, 1], concave on [−1, 0] and neither on [−1, 1]. The model must classify the entire stated interval; checking a few points is not enough to prove the answer.",
  },
  {
    question: "What is depth?",
    answer: "Nested expressions feed the result of one operation into another, such as taking the logarithm of a square-root expression. Depth describes structure, but its definition depends on the study. In the current deep function table, “requested depth” is a setting supplied to the task generator. The realized source depth can equal that setting or be one greater. It is not a count of model reasoning steps, expression-tree levels or nonlinear composition stages.",
  },
  {
    question: "Does a higher depth always mean a harder question?",
    answer: "No. A long expression may simplify, while a shorter expression may require a delicate argument. Expression length and mathematical structure can change alongside depth. The table describes performance on these task groups; it does not prove that depth alone caused a change or identify a universal failure threshold.",
  },
  {
    question: "How do you know the reference answers are correct?",
    answer: "Tasks are admitted with retained mathematical verification evidence, and the current published deep study is bound to an independent reference review. Depending on the suite, verification uses exact analytic arguments or rigorous interval bounds that cover the domain. Unresolved cases are not treated as certified tasks. Reference labels and verification evidence are kept out of the model’s prompt.",
  },
  {
    question: "What does the score tell me?",
    answer: "The main score is macro-F1 on a 0–100 scale. It gives convex, concave and neither equal weight, accounting for both missed cases and incorrect predictions of each class. Accuracy is the percentage of retained model outcomes with a correct label. The formulas appear directly below the table. Only the final label is scored; a correct label does not certify the model’s explanation.",
  },
  {
    question: "What happens when a model gives no usable answer?",
    answer: "Malformed answers, refusals and output-limit truncations count as unsuccessful model outcomes. Provider failures and missing work are tracked separately and make scores provisional or unavailable. Expand a score cell to inspect the counts. A cut-off answer or service error does not by itself establish a mathematical reasoning error.",
  },
  {
    question: "Is the results table a ranking of the best AI models?",
    answer: "The deep function study is exploratory and unranked. Its models receive the same admitted tasks, with one response per task, but their recorded reasoning settings and output limits can differ. One response does not measure repeat consistency. A score here describes this task population under those settings; it does not establish general mathematical ability or overall model superiority.",
  },
  {
    question: "Can I run the same study myself?",
    answer: "The visitor workbench currently offers a separate 27-task nested composition study, with three fresh responses per task: 81 planned inference requests. It is different from the deep function research table. You supply your own provider credential and approve provider charges before launching. Model availability depends on the provider, your access and compatibility with the selected settings.",
  },
  {
    question: "Are my API key and results public?",
    answer: "Your API key is held in current-page memory and sent to the evaluation server for the selected provider operation. It is excluded from saved runs and public exports. Runs are private by default for seven days; save the separate access code to return to them. Publishing is an explicit action that you can reverse. Keep the page open during execution; interrupted runs do not automatically resume.",
  },
] as const;

export function ProjectFaq() {
  return (
    <section aria-labelledby="faq-title" className="border-t border-border py-12 sm:py-16">
      <h2 id="faq-title" className="text-2xl font-medium sm:text-3xl">Questions about the evaluation</h2>
      <div className="mt-8 divide-y divide-border">
        {questions.map(({ question, answer }) => (
          <details key={question} className="py-5">
            <summary className="cursor-pointer rounded-sm text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{question}</summary>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{answer}</p>
          </details>
        ))}
      </div>
      <Link href="/methodology" className="mt-6 inline-block text-sm underline underline-offset-4">Read the full methodology</Link>
    </section>
  );
}
