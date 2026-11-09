import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { LandingBackground } from "@/components/marketing/landing-background";
import { CurvatureIllustration } from "@/components/marketing/curvature-illustration";
import { CompositionResults } from "@/components/marketing/composition-results";
import { ProjectFaq } from "@/components/marketing/project-faq";
import { EvaluationPrompt } from "@/components/marketing/evaluation-prompt";
import { TerminalCommands } from "@/components/marketing/terminal-commands";
import { Button } from "@/components/ui/button";
import { deepStudySummary, deepStudyTaskTotal, hasPublishedDeepStudy } from "@/lib/deep-study-summary";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Coconut | Convexity evaluation",
  description: "Evaluate how a language model classifies scalar functions on exact intervals. Inspect verified references, study coverage, and every reported score.",
};

export default function Home() {
  return (
    <AppShell className={`${styles.landing} py-0`} surfaceClassName={styles.paper}>
      <LandingBackground />
      <section aria-labelledby="home-title" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="mb-5 text-sm text-muted-foreground">A workbench for mathematical evaluation</p>
          <h1 id="home-title" className={styles.heroTitle}>
            Find where models get the math wrong.
          </h1>
          <p className={styles.heroDescription}>
            Give a language model a function and an exact interval. Compare its answer with a verified reference, then inspect the evidence behind the score.
          </p>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            {hasPublishedDeepStudy
              ? `Reasoning study: ${deepStudyTaskTotal(deepStudySummary)} planned tasks per model at eight requested generator depths, from 5 to 512, plus an 800-task fast screen below. One response per task. The visitor workbench remains a separate 27-task study with three responses per task.`
              : "Current benchmark: 27 tasks at 2, 4 and 6 nonlinear composition stages. Three fresh responses per task make 81 requests per model."}
          </p>
          <div className={styles.heroActions}>
            <Button asChild size="lg" className="h-12 px-5"><Link href="/#model-scores-title">View results</Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-5"><Link href="/evaluate">{hasPublishedDeepStudy ? "Open 27-task workbench" : "Run this benchmark"}</Link></Button>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Runs use your own provider key. Provider charges apply.</p>
          <Link href="#terminal-commands-title" className="mt-3 inline-block text-sm underline underline-offset-4">Run from the terminal</Link>
        </div>
        <div className={styles.heroGraph}><CurvatureIllustration /></div>
      </section>

      <CompositionResults />

      <TerminalCommands />

      <section aria-labelledby="task-title" className="grid gap-8 border-t border-border py-12 sm:py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-x-16">
        <h2 id="task-title" className="text-2xl leading-tight font-medium sm:text-3xl lg:col-span-2">Classify the whole interval</h2>
        <div>
          <p className="text-base leading-7 text-muted-foreground">
            A function can be convex on one interval and neither on another. The task asks for convex, concave or neither on exactly the domain supplied.
          </p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Nested functions add signs, domain restrictions and dependencies to track. Reference labels stay outside the model prompt.</p>
          <Link href="/methodology" className="mt-5 inline-block text-sm underline underline-offset-4">Read the methodology</Link>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
          <p className="font-mono text-xl">f(x) = x³ · f″(x) = 6x</p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            On [0, 1], the second derivative is nonnegative: convex. On [−1, 0], it is nonpositive: concave. On [−1, 1], its sign changes: neither.
          </p>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">This teaching example is separate from the scored tasks. Affine and constant functions satisfy both curvature definitions and are excluded.</p>
        </div>
      </section>

      <ProjectFaq />
      <EvaluationPrompt />
    </AppShell>
  );
}
