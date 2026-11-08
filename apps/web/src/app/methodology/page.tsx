import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CurvatureExamples } from "@/components/marketing/curvature-examples";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Methodology | Coconut",
  description: "How Coconut certifies curvature references, runs three fresh trials, scores answers, and separates meaningful comparisons from incomplete evidence.",
};

const contents = [
  ["task", "The task"], ["suites", "Suites and depth"], ["references", "Reference validation"],
  ["execution", "Trials and settings"], ["scoring", "Scores and missing work"], ["comparisons", "Comparisons and uncertainty"],
  ["access", "Keys, charges and records"],
] as const;

function MethodSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8 border-t border-border pt-8">
      <h2 id={`${id}-title`} className="mb-5 text-2xl font-medium">{title}</h2>
      <div className="space-y-5 text-base leading-7 text-muted-foreground [&>p]:max-w-[72ch]">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <AppShell activePage="methodology">
      <header className="max-w-3xl pb-10 sm:pb-12">
        <h1 className="text-3xl font-medium sm:text-4xl">How the evaluation works</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">
          Coconut measures three-way curvature classification on explicit scalar domains. The reference, model reply and evaluation settings stay inspectable together.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-16">
        <aside>
          <nav aria-label="Methodology sections" className="flex flex-wrap gap-x-5 gap-y-3 text-sm lg:sticky lg:top-8 lg:flex-col lg:gap-1">
            {contents.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-md py-2 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{label}</a>)}
          </nav>
        </aside>

        <article className="min-w-0 max-w-4xl space-y-10 sm:space-y-12">
          <MethodSection id="task" title="The function and its domain define the task">
            <p>A model receives one exact expression and a finite closed interval. It chooses <span className="font-mono text-sm text-foreground">convex</span>, <span className="font-mono text-sm text-foreground">concave</span> or <span className="font-mono text-sm text-foreground">neither</span> and gives a brief mathematical justification.</p>
            <p>A convex function lies at or below every chord connecting points on its graph. A concave function lies at or above every chord. A neither label needs evidence that both properties fail on the supplied interval.</p>
            <CurvatureExamples />
            <p>For x³, restricting the domain to [0, 1] makes it convex; on [−1, 0] it is concave. On [−1, 1] it is neither. Affine and constant functions satisfy both definitions, so they are excluded from the three-label population.</p>
          </MethodSection>

          <MethodSection id="suites" title="Separate suites, measured depth">
            <p>Each suite is frozen with its exact tasks and reference evidence. Scores from different suites or prompt versions belong to separate comparison populations.</p>
            <Table>
              <TableCaption>Task counts and actual operation depths for the evaluation suites</TableCaption>
              <TableHeader><TableRow><TableHead>Suite</TableHead><TableHead>Tasks</TableHead><TableHead>Measured depths</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell><span className="font-medium text-foreground">Curvature challenge</span><br /><span className="font-mono text-xs">challenge-v1</span></TableCell><TableCell>72</TableCell><TableCell className="font-mono">3, 4, 5, 6, 14</TableCell></TableRow>
                <TableRow><TableCell><span className="font-medium text-foreground">Smooth reference</span><br /><span className="font-mono text-xs">smooth-v2</span></TableCell><TableCell>27</TableCell><TableCell className="font-mono">7, 9, 11</TableCell></TableRow>
                <TableRow><TableCell><span className="font-medium text-foreground">Exact reference</span><br /><span className="font-mono text-xs">reference-v1</span></TableCell><TableCell>75</TableCell><TableCell className="font-mono">5, 10, 20, 40, 80</TableCell></TableRow>
                <TableRow><TableCell><span className="font-medium text-foreground">Interior exploration · unranked</span><br /><span className="font-mono text-xs">interior-v1</span></TableCell><TableCell>72</TableCell><TableCell className="font-mono">13</TableCell></TableRow>
              </TableBody>
            </Table>
            <p>The challenge has eight families and three parameter groups per family. Each group contains all three labels: 24 related-task groups and 24 tasks per class. Its families cover logarithmic, reciprocal, exponential, rational, mixed-branch and polynomial curvature.</p>
            <p>The separate interior exploration applies three nonlinear functions to eight source quintics. Each source polynomial is shared across nine related tasks, giving eight groups and 24 tasks per class. Its interior curvature changes can be missed by checking endpoints and midpoint alone. This narrower population is descriptive and unranked; it does not meet the confirmation coverage or confidence-interval requirements.</p>
            <p>A leaf has depth zero; each operation adds one to its deepest child. For example, x has depth 0, x² has depth 1 and exp(x²) has depth 2. Simplifying or rebalancing an expression can change depth while preserving its function.</p>
            <p><span className="font-medium text-foreground">Depth is descriptive.</span> Each challenge family occurs at one depth, so family and depth cannot be separated. Expression size and mathematical structure also vary. The exact and smooth reference suites have their own confounds; these plots do not establish a causal effect of nesting.</p>
            <p>The nine-task screening set uses separate parameter groups for exploratory checks. It is distinct from the full 72-task confirmation set. Public teaching examples are separate from both.</p>
          </MethodSection>

          <MethodSection id="references" title="Reference labels need global evidence">
            <p>For smooth functions, outward-rounded interval arithmetic encloses the second derivative over a complete cover of the domain. A consistent nonnegative or nonpositive sign establishes convexity or concavity. Strict evidence excludes the opposite label. Neither requires strict second-derivative signs in both directions at interior points, together with domain validity.</p>
            <p>The challenge also retains independently derived curvature formulas and exact polynomial identities. These provide a separate mathematical check. The exact reference suite uses exact rational arithmetic, sufficient composition rules and strict midpoint witnesses for its supported piecewise expressions.</p>
            <p>Interior references additionally use exact rational Bernstein bounds and rigorously bounded exponential series to check the derived curvature formulas. Neither cases retain strict opposite-sign witnesses inside the supplied interval.</p>
            <p>A failed sufficient rule is inconclusive. Invalid domains, unresolved bounds and exhausted certification budgets never become a neither label. Native arithmetic and the implemented differentiation/domain rules remain trusted dependencies; this is bounded computational certification.</p>
            <p>Models receive the function and interval. They do not receive the reference label, family tag, task ID, proof or witness coordinates. Reference evidence is available when inspecting the retained result.</p>
          </MethodSection>

          <MethodSection id="execution" title="Three fresh trials under explicit settings">
            <p>A task is evaluated in three fresh conversations. The prompt contains its expression, domain and neutral instructions. Tools are disabled. Each returned JSON label is graded separately, with a brief explanation retained for inspection. Only the label determines mathematical correctness.</p>
            <Table>
              <TableCaption>Different profiles remain separate comparison populations</TableCaption>
              <TableHeader><TableRow><TableHead>Profile family</TableHead><TableHead>Output ceiling</TableHead><TableHead>Reasoning</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell>Original profiles</TableCell><TableCell className="font-mono">4,096 tokens</TableCell><TableCell className="whitespace-normal">Provider default</TableCell></TableRow>
                <TableRow><TableCell>Explicit-effort profiles</TableCell><TableCell className="font-mono">16,384 tokens</TableCell><TableCell className="whitespace-normal">Named effort, verified for the model</TableCell></TableRow>
              </TableBody>
            </Table>
            <p>Original profiles use each provider’s sampling and reasoning defaults. Explicit-effort profiles fix the named reasoning setting while retaining provider-default sampling.</p>
            <p>Prompted JSON and native strict-schema enforcement are distinct formats. Explicit reasoning profiles currently require OpenAI. A token ceiling limits requested output; it is neither measured usage nor an equal-compute guarantee across models. Unsupported settings do not silently fall back to another profile.</p>
            <p>Each logical trial has one inference attempt and no automatic retry. Cancellation stops new work and aborts active requests. A lost connection, timeout or cancellation may leave remote execution and charges uncertain.</p>
          </MethodSection>

          <MethodSection id="scoring" title="Scores retain their denominators">
            <p>The headline score is pooled macro-F1. Returned trial outcomes are pooled, a separate F1 score is calculated for each fixed class, and the three class scores receive equal weight. Accuracy is the fraction of included outcomes with the correct label.</p>
            <div className="rounded-lg border border-border bg-card px-5 py-4 font-mono text-sm leading-7 text-foreground">
              F1 = 2TP / (2TP + FP + FN)<br />
              Macro-F1 = (F1convex + F1concave + F1neither) / 3
            </div>
            <p>TP counts correct predictions of a class. FP counts predictions assigned to that class incorrectly. FN counts reference-class outcomes that were missed.</p>
            <Table>
              <TableCaption>Model outcomes and incomplete execution have different score treatment</TableCaption>
              <TableHeader><TableRow><TableHead>Outcome</TableHead><TableHead>Score treatment</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell className="whitespace-normal">Valid returned label</TableCell><TableCell className="whitespace-normal">Included; graded against the reference</TableCell></TableRow>
                <TableRow><TableCell className="whitespace-normal">Invalid or empty reply, refusal, truncation</TableCell><TableCell className="whitespace-normal">Included as unusable; contributes reference support and a false negative, with no predicted-class false positive</TableCell></TableRow>
                <TableRow><TableCell className="whitespace-normal">Provider error, interruption, cancellation, unattempted work</TableCell><TableCell className="whitespace-normal">Excluded from mathematical counts; retained against the planned workload</TableCell></TableRow>
              </TableBody>
            </Table>
            <p>Incomplete execution leaves scores provisional, or unavailable when no model outcome is included. A complete population can still contain wrong or unusable replies. Reports also show class precision/recall, confusion counts, depth slices, agreement and eligible three-trial spread. Missing usage, cost or timing remains unknown rather than zero.</p>
            <p>A zero F1 denominator contributes zero for that class in a nonempty population. An empty population has no macro-F1 value. Truncated JSON is unusable even when a partial label looks valid; explanations never silently repair the grade.</p>
            <p>Unusable replies lower performance under the answer policy. They do not by themselves establish a mathematical reasoning error.</p>
          </MethodSection>

          <MethodSection id="comparisons" title="Comparison limits and uncertainty">
            <p>Compare the exact suite, prompt/protocol, answer format, reasoning setting, output ceiling, concurrency and trial count. Requested and reported model/provider identities stay visible. Different serving routes, defaults or incomplete work can change the interpretation of a score difference.</p>
            <p>Three trials are repeated requests on the same tasks. They are not three independent sets of mathematical problems. Ordinary trial spread is descriptive, not a confidence interval. The challenge’s related parameter/domain variants stay grouped when uncertainty is assessed.</p>
            <p>Eligible uncertainty analysis uses 10,000 seeded bootstrap repetitions that resample whole groups within families and preserve all their trials. It requires complete compared populations, at least 20 effective groups overall and at least three per family. Sparse or incomplete evidence cannot support that interval. Its interpretation remains conditional on the fixed families and the group-exchangeability assumption.</p>
            <p>A valid wrong label supports an inspected point error under its recorded settings. A reproducible mathematical-failure claim needs at least two valid wrong answers out of three on each of two distinct core-task groups in two families, at the model’s highest verified effort in the experiment. All trials must finish without truncation and the references require independent review. Format, budget or provider failures do not establish that claim.</p>
            <p>These synthetic scalar tasks do not establish general mathematical ability or production usefulness. Public tasks may have been exposed elsewhere.</p>
          </MethodSection>

          <MethodSection id="access" title="Your credentials, provider charges and retained evidence">
            <p>Visitors supply their own OpenAI, OpenRouter or Hugging Face Inference Providers credential and pay the selected provider. A searchable model is not necessarily hosted, permitted or compatible. OpenAI has live inference checks. OpenRouter/Hugging Face adapters have controlled software tests; live execution remains unverified.</p>
            <p>Your key stays in current-page memory and is sent to the evaluation server for the selected foreground provider operation. It is excluded from saved runs and public exports. Refresh or disconnect clears the page-held credential. A compatibility check can itself make a charged inference request; review its consent separately from evaluation launch.</p>
            <p>Runs are private by default and retained for seven days. The separate private access code is returned once; save it to return after a refresh. Publishing is an explicit, reversible action, and public ranking additionally requires the leaderboard’s eligibility checks. Expiry or deletion removes public visibility with the retained record.</p>
            <p>Keep the evaluation page open while the run executes. Disconnect, cancellation or server restart preserves recorded work but does not resume paid requests. Starting again requires a fresh intentional launch and provider credential. Requests already sent may still incur charges.</p>
            <div className="flex flex-wrap items-center gap-5 pt-2">
              <Button asChild size="lg"><Link href="/evaluate">Evaluate a model</Link></Button>
              <Link href="/leaderboard" className="rounded-sm text-sm font-medium text-foreground underline underline-offset-4">View public comparisons</Link>
            </div>
          </MethodSection>
        </article>
      </div>
    </AppShell>
  );
}
