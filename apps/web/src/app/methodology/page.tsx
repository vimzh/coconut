import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { LandingBackground } from "@/components/marketing/landing-background";
import styles from "./page.module.css";
import { CurvatureExamples } from "@/components/marketing/curvature-examples";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cheapDepthSummary } from "@/lib/cheap-depth-summary";
import { deepStudySummary, deepStudyTaskCounts, deepStudyTaskTotal } from "@/lib/deep-study-summary";

export const metadata: Metadata = {
  title: "Methodology | Coconut",
  description: "How Coconut generates verified curvature tasks, evaluates models, scores answers and retains the evidence behind each result.",
};

const contents = [
  ["task", "The task"], ["suites", "Studies and workbench"], ["references", "Reference validation"],
  ["execution", "Trials and settings"], ["scoring", "Scores and coverage"], ["comparisons", "Comparing results"],
  ["terminal", "Terminal workflow"],
  ["access", "Keys, charges and records"],
] as const;

const publishedStudies = [
  { name: "Reasoning study", summary: deepStudySummary },
  { name: "Fast screen", summary: cheapDepthSummary },
];

function MethodSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.section}>
      <h2 id={`${id}-title`} className={styles.sectionTitle}>{title}</h2>
      <div className={styles.prose}>{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <AppShell activePage="methodology" surfaceClassName={styles.surface} className={styles.page}>
      <LandingBackground />
      <header className={styles.intro}>
        <h1 className={styles.title}>How the evaluation works</h1>
        <p className={styles.description}>
          Generate a function, verify its curvature, ask a model and score the answer. Every result connects the exact question, model settings and returned outcome so you can inspect how the score was produced.
        </p>
        <Link href="/#model-scores-title" className="mt-5 inline-block text-sm underline underline-offset-4">View current results</Link>
      </header>

      <div className={styles.layout}>
        <aside className={styles.index}>
          <span className={styles.indexLabel}>On this page</span>
          <nav aria-label="Methodology sections" className={styles.contents}>
            {contents.map(([id, label]) => <a key={id} href={`#${id}`} className={styles.contentsLink}>{label}</a>)}
          </nav>
        </aside>

        <article className={styles.article}>
          <MethodSection id="task" title="The function and its domain define the task">
            <p>A model receives one exact expression and a finite closed interval. It chooses <span className="font-mono text-sm text-foreground">convex</span>, <span className="font-mono text-sm text-foreground">concave</span> or <span className="font-mono text-sm text-foreground">neither</span> and gives a brief mathematical justification.</p>
            <p>A convex function lies at or below every chord connecting points on its graph. A concave function lies at or above every chord. A neither label needs evidence that both properties fail on the supplied interval.</p>
            <CurvatureExamples />
            <p>For x³, restricting the domain to [0, 1] makes it convex; on [−1, 0] it is concave. On [−1, 1] it is neither. Affine and constant functions satisfy both definitions, so they are excluded from the three-label population.</p>
          </MethodSection>

          <MethodSection id="suites" title="Published studies and the evaluation workbench">
            <p>The homepage shows two audited studies. Within each study, every model receives the same admitted task set with one response per task. The reasoning study and fast screen retain their own task populations and inference settings.</p>
            <Table>
              <TableCaption>Published populations; counts are tasks per model</TableCaption>
              <TableHeader><TableRow><TableHead>Study</TableHead><TableHead>Planned tasks</TableHead><TableHead className="whitespace-normal">Tasks at each requested depth</TableHead></TableRow></TableHeader>
              <TableBody>
                {publishedStudies.map(({ name, summary }) => <TableRow key={summary.studyId}>
                  <TableCell>{name}</TableCell><TableCell>{deepStudyTaskTotal(summary)}</TableCell>
                  <TableCell>{deepStudyTaskCounts(summary).map(row => `${row.requestedDepth}: ${row.tasks}`).join(" · ")}</TableCell>
                </TableRow>)}
              </TableBody>
            </Table>
            <p>The workbench opens with <span className="font-mono text-sm">composition-v1</span>: 27 tasks, three fresh responses each, giving 81 planned requests per model. Nine related base chains apply quadratic and reciprocal atoms in three sequence patterns at 2, 4 and 6 nonlinear stages. Every pattern and stage count includes all three labels.</p>
            <p><span className="font-medium text-foreground">Read the depth measure with the task.</span> The published studies use requested generator depth; realized source depth is that setting or its successor. Expression-tree depth counts operations from a leaf at zero: x has depth 0, x² has depth 1 and exp(x²) has depth 2. Nonlinear stages count the successive nonlinear functions on a path. The workbench’s 2, 4 and 6 stages have expression-tree depths 7, 13 and 19.</p>
            <details className={styles.details}>
              <summary>Advanced workloads</summary>
              <p>Six additional suites are available in evaluation setup. Each has a frozen task set and retained reference evidence.</p>
              <Table>
                <TableCaption>Separate workloads; the depths below are expression-tree depths</TableCaption>
                <TableHeader><TableRow><TableHead>Suite</TableHead><TableHead>Tasks</TableHead><TableHead>Expression-tree depths</TableHead></TableRow></TableHeader>
                <TableBody>
                <TableRow><TableCell><span className="font-medium text-foreground">Curvature challenge</span><br /><span className="font-mono text-xs">challenge-v1</span></TableCell><TableCell>72</TableCell><TableCell className="font-mono">3, 4, 5, 6, 14</TableCell></TableRow>
                <TableRow><TableCell><span className="font-medium text-foreground">Exploratory screening</span><br /><span className="font-mono text-xs">screening-v1</span></TableCell><TableCell>9</TableCell><TableCell className="font-mono">3, 5, 14</TableCell></TableRow>
                <TableRow><TableCell><span className="font-medium text-foreground">Smooth reference</span><br /><span className="font-mono text-xs">smooth-v2</span></TableCell><TableCell>27</TableCell><TableCell className="font-mono">7, 9, 11</TableCell></TableRow>
                <TableRow><TableCell><span className="font-medium text-foreground">Exact reference</span><br /><span className="font-mono text-xs">reference-v1</span></TableCell><TableCell>75</TableCell><TableCell className="font-mono">5, 10, 20, 40, 80</TableCell></TableRow>
                <TableRow><TableCell><span className="font-medium text-foreground">Interior exploration</span><br /><span className="font-mono text-xs">interior-v1</span></TableCell><TableCell>72</TableCell><TableCell className="font-mono">13</TableCell></TableRow>
                <TableRow><TableCell><span className="font-medium text-foreground">Fine-scale curvature exploration</span><br /><span className="font-mono text-xs">reserve-v1</span></TableCell><TableCell>18</TableCell><TableCell className="font-mono">17, 23</TableCell></TableRow>
                </TableBody>
              </Table>
              <p>The challenge spans eight function families and 24 related-task groups. Interior exploration tests curvature changes inside the interval. Fine-scale exploration uses logarithm, reciprocal and square-root families with narrow curvature changes checked by exact witnesses. The composition, interior and fine-scale suites are exploratory workloads excluded from public leaderboard ranking. Teaching examples are kept separate from these scored suites.</p>
            </details>
          </MethodSection>

          <MethodSection id="references" title="Verify the exact question before asking the model">
            <p>Admission requires mathematical evidence for the selected label on the entire supplied interval. The independent verifier for imported deep tasks parses the exact displayed scalar expression, preserves its written coefficients, checks the fixed domain [−1, 1] and replays its reference proof. Every admitted task retains its expression hash, domain, label and verification evidence.</p>
            <p>Native smooth suites use outward-rounded interval arithmetic to enclose the second derivative over a complete cover of the domain. A nonnegative or nonpositive enclosure proves convexity or concavity, with strict evidence distinguishing the labels. Neither cases retain strict witnesses for both curvature directions inside the interval.</p>
            <p>Other supported families use exact rational arithmetic, independently derived derivative formulas, polynomial bounds, composition rules and strict midpoint witnesses. The nested composition suite supplements whole-domain numerical certificates with exact rational derivative checks and an independent implementation.</p>
            <p>Invalid domains, unresolved proofs and exhausted verification budgets stay in the rejection record. A neither label requires evidence that convexity and concavity both fail. Sampling points alone cannot certify a global curvature label.</p>
            <p>The prompt contains the expression, interval and neutral response instructions. Reference labels, family tags, task IDs, proofs and witness coordinates stay outside the model’s prompt. Retained evidence supports replay and answer inspection.</p>
          </MethodSection>

          <MethodSection id="execution" title="Fresh requests with recorded settings">
            <p>The published studies use one response per task. The visitor workbench uses three fresh conversations per task. Exact-file terminal evaluations support 1–10 trials. Each request starts with fresh conversation history, disables tools and requests a structured answer containing a label and explanation.</p>
            <Table>
              <TableCaption>Output ceilings and per-request deadlines; model-specific settings are retained with results</TableCaption>
              <TableHeader><TableRow><TableHead>Workload / profile</TableHead><TableHead>Output tokens</TableHead><TableHead>Deadline</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell>Published reasoning study</TableCell><TableCell>32,768</TableCell><TableCell>600 seconds</TableCell></TableRow>
                <TableRow><TableCell>Published fast screen</TableCell><TableCell>8,192</TableCell><TableCell>180 seconds</TableCell></TableRow>
                <TableRow><TableCell>Workbench / CLI default profiles</TableCell><TableCell>4,096</TableCell><TableCell>180 seconds</TableCell></TableRow>
                <TableRow><TableCell>Workbench / CLI explicit-effort profiles</TableCell><TableCell>16,384</TableCell><TableCell>180 seconds</TableCell></TableRow>
              </TableBody>
            </Table>
            <p>Default profiles retain provider sampling and reasoning defaults. Explicit-effort profiles select a named OpenAI reasoning setting. Prompted JSON and native strict-schema enforcement have separate profile identities. Research runs retain their own model-specific effort settings, shown in the homepage’s study details.</p>
            <p>Each result records its requested and reported model identities, prompt version, profile, reasoning setting, token ceiling and execution settings. Requested ceilings and actual token usage are reported separately. Unsupported settings produce a visible error.</p>
            <p>Each logical trial has one inference attempt, with automatic retries disabled. Terminal evaluations default to four concurrent requests and support up to twelve. Cancellation stops new work and aborts active requests; dispatched work can still incur provider charges or leave its remote outcome unknown.</p>
          </MethodSection>

          <MethodSection id="scoring" title="Scores retain their denominators">
            <p>The headline score is pooled macro-F1. Returned trial outcomes are pooled, a separate F1 score is calculated for each fixed class, and the three class scores receive equal weight. Accuracy is the fraction of included outcomes with the correct label.</p>
            <div className="rounded-lg border border-border bg-card px-5 py-4 font-mono text-sm leading-7 text-foreground">
              F1 = 2TP / (2TP + FP + FN)<br />
              Macro-F1 = (F1convex + F1concave + F1neither) / 3
            </div>
            <p>TP counts correct predictions of a class. FP counts predictions assigned to that class incorrectly. FN counts reference-class outcomes that were missed.</p>
            <p>The homepage displays macro-F1 on a 0–100 scale by multiplying this fraction by 100. Machine-readable reports retain the 0–1 value. Each final label is scored against the verified reference; explanations are retained for inspection and remain ungraded.</p>
            <Table>
              <TableCaption>Model outcomes and incomplete execution have different score treatment</TableCaption>
              <TableHeader><TableRow><TableHead>Outcome</TableHead><TableHead>Score treatment</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell className="whitespace-normal">Valid returned label</TableCell><TableCell className="whitespace-normal">Included; graded against the reference</TableCell></TableRow>
                <TableRow><TableCell className="whitespace-normal">Invalid or empty reply, refusal, truncation</TableCell><TableCell className="whitespace-normal">Included as unusable; contributes reference support and a false negative, with no predicted-class false positive</TableCell></TableRow>
                <TableRow><TableCell className="whitespace-normal">Provider error, interruption, cancellation, unattempted work</TableCell><TableCell className="whitespace-normal">Excluded from mathematical counts; retained against the planned workload</TableCell></TableRow>
              </TableBody>
            </Table>
            <p>Every score shows its included model outcomes against the planned workload. Incomplete execution leaves scores provisional, or unavailable when no model outcome is included. Reports include class precision and recall, confusion counts and depth slices; repeated-trial reports also show agreement and score spread. Missing usage, cost or timing is recorded as unknown.</p>
            <p>A zero F1 denominator contributes zero for that class in a nonempty population. An empty population has no macro-F1 value. Truncated JSON is unusable even when a partial label looks valid; explanations never silently repair the grade.</p>
            <p>Wrong valid labels and unusable replies have separate counts. Both lower the score; the wrong-label count identifies classification errors.</p>
          </MethodSection>

          <MethodSection id="comparisons" title="Compare the same tasks under matching settings">
            <p>For a controlled comparison, use the same verified task file, prompt version, answer format, reasoning setting, output ceiling and trial count. Keep provider routing and concurrency consistent, then inspect completion coverage alongside the score.</p>
            <p>The homepage orders all model rows by overall macro-F1. Each row identifies its study, planned population and completion status. The reasoning study and fast screen share a reviewed source pool, with different populations at the highest depths and different execution settings. Open a score cell to inspect its denominator and outcome counts.</p>
            <p>Read requested-depth slices alongside expression size and mathematical structure. Repeated trials measure response agreement on the same questions. Related tasks retain their group identities, and eligible statistical analyses resample those groups together. Trial spread describes variation between repeated runs.</p>
            <p>For answer-level inspection, follow the retained question, verified reference, final label and explanation. This makes each observed classification error traceable to a specific expression, domain and model configuration.</p>
          </MethodSection>

          <MethodSection id="terminal" title="Generate, verify and evaluate from the terminal">
            <p>Choose requested depths, cases per depth and a seed with <span className="font-mono text-sm">tasks:generate</span>. The generator fills near-balanced class quotas from independently verified candidates, excludes exact duplicates and saves the admission record with the task file. Generation supports depths 1–1,000 and up to 1,000 total tasks.</p>
            <p>Keep the generated JSON and its sibling <span className="font-mono text-sm">.evidence</span> directory together. Run <span className="font-mono text-sm">tasks:verify</span> to replay the source receipts, expression identities, domains and reference proofs. Generation retains an incomplete artifact if it exhausts the proposal budget before filling its quotas. Verification exits with an error when the saved artifact is invalid or incomplete.</p>
            <p>Pass that exact file to <span className="font-mono text-sm">eval:run --input</span>, selecting the model, registered profile, trials, concurrency and credential environment variable. Planned inference requests equal admitted tasks × selected trials. Charge consent is required before dispatch.</p>
            <p>The output directory retains the frozen manifest, per-attempt evidence, run record and score report. These local results stay under your control; web publication is a separate action. Run <span className="font-mono text-sm">bun scripts/tasks.ts --help</span> or <span className="font-mono text-sm">bun run eval:run --help</span> for all flags.</p>
            <Link href="/#terminal-commands-title" className="text-foreground underline underline-offset-4">Open the terminal command examples</Link>
          </MethodSection>

          <MethodSection id="access" title="Your credentials, provider charges and retained evidence">
            <p>The published studies run through OpenAI. The workbench offers OpenAI, OpenRouter and Hugging Face Inference Providers connections using your own credential. Access checks cover provider authentication. A separately approved compatibility request tests inference with the selected model and settings.</p>
            <p>Your key stays in current-page memory and is sent to the evaluation server for the selected foreground provider operation. It is excluded from saved runs and public exports. Refresh or disconnect clears the page-held credential. A compatibility check can itself make a charged inference request; review its consent separately from evaluation launch.</p>
            <p>Web runs are private by default and retained for seven days. The separate private access code is returned once; save it to return after a refresh. Publishing and withdrawal are explicit actions. Public comparison eligibility is checked separately. Expiry or deletion removes public visibility with the retained record. Terminal output stays in your chosen directory until you remove it.</p>
            <p>Keep the evaluation page open while the run executes. Disconnect, cancellation or server restart preserves recorded work but does not resume paid requests. Starting again requires a fresh intentional launch and provider credential. Requests already sent may still incur charges.</p>
            <div className="flex flex-wrap items-center gap-5 pt-2">
              <Button asChild size="lg"><Link href="/evaluate">Open the workbench</Link></Button>
              <Link href="/#model-scores-title" className="rounded-sm text-sm font-medium text-foreground underline underline-offset-4">View results</Link>
            </div>
          </MethodSection>
        </article>
      </div>
    </AppShell>
  );
}
