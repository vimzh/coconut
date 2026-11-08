import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { LandingBackground } from "@/components/marketing/landing-background";
import { CurvatureExamples } from "@/components/marketing/curvature-examples";
import { CurvatureIllustration } from "@/components/marketing/curvature-illustration";
import { ModelScores } from "@/components/marketing/model-scores";
import { NestedPolicyExample } from "@/components/marketing/nested-policy-example";
import { Button } from "@/components/ui/button";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Coconut | Convexity evaluation",
  description: "Evaluate how a language model classifies scalar functions on exact intervals. Inspect reference evidence, three fresh trials, and every reported score.",
};

const steps = [
  { title: "Choose your model", description: "Select a provider, model, suite and answer format. Review the planned requests and approve your provider’s charges." },
  { title: "Run three fresh trials", description: "Each request receives one function and its exact interval. Reference labels and verification evidence stay outside the model prompt." },
  { title: "Inspect each answer", description: "Read returned text beside its reference evidence. Explore macro-F1, accuracy, class detail and the work that remains incomplete." },
] as const;

export default function Home() {
  return (
    <AppShell className={`${styles.landing} py-0`} surfaceClassName={styles.paper}>
      <LandingBackground />
      <section aria-labelledby="home-title" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="mb-5 text-sm text-muted-foreground">A workbench for mathematical evaluation</p>
          <h1 id="home-title" className={styles.heroTitle}>
            Test a model’s convexity judgment
          </h1>
          <p className={styles.heroDescription}>
            Give a language model a function and an exact interval. Compare its answer with a verified reference, then inspect the evidence behind the score.
          </p>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">Use your own provider key. Provider charges apply.</p>
          <div className={styles.heroActions}>
            <Button asChild size="lg" className="h-12 px-5"><Link href="/evaluate">Evaluate a model</Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-5"><Link href="/leaderboard">View leaderboard</Link></Button>
          </div>
        </div>
        <div className={styles.heroGraph}><CurvatureIllustration /></div>
      </section>

      <ModelScores />

      <section aria-labelledby="basic-idea-title" className="grid gap-8 border-t border-border py-12 sm:py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-x-16">
        <h2 id="basic-idea-title" className="text-2xl leading-tight font-medium sm:text-3xl lg:col-span-2">The basic idea</h2>
        <div>
          <p className="text-base leading-7 text-muted-foreground">
            Each individual rule is easy. The correct final answer depends on applying those rules in the right order through many layers of nesting.
          </p>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            An agent may need to follow an exception to an exception in a policy. In mathematics, a sign or domain restriction can still matter several composition steps later.
          </p>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The model sees the whole nested expression at once and has to get the final classification right. Each trial is one fresh request.
          </p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            The hypothetical laptop policy illustrates how conditions combine. CoconutEval measures mathematical function classification; transfer to agent workflows remains untested.
          </p>
        </div>
        <NestedPolicyExample />
      </section>

      <section aria-labelledby="task-title" className="grid gap-8 border-t border-border py-12 sm:py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-x-16">
        <h2 id="task-title" className="text-2xl leading-tight font-medium sm:text-3xl lg:col-span-2">Classify the whole interval</h2>
        <div>
          <p className="text-base leading-7 text-muted-foreground">
            A function can be convex on one interval and neither on another. The task asks for convex, concave or neither on exactly the domain supplied.
          </p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Affine and constant functions satisfy both curvature definitions and are excluded from this three-label task.
          </p>
        </div>
        <CurvatureExamples />
      </section>

      <section aria-labelledby="workflow-title" className="border-t border-border py-12 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="workflow-title" className="text-2xl leading-tight font-medium sm:text-3xl">From a function to an inspectable result</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The curvature challenge contains 72 certified tasks across eight function families and 24 related parameter groups. Three trials per task make 216 planned requests.
          </p>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(({ title, description }, index) => (
            <li key={title} className="rounded-lg border border-border bg-card p-6 text-center sm:p-8">
              <span className="font-mono text-sm text-muted-foreground">{index + 1}</span>
              <h3 className="mt-3 text-lg font-medium">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-6 text-muted-foreground">
          Depth describes the expression tree. It also changes with function family and size, so a depth plot does not isolate mathematical difficulty.
        </p>
      </section>

    </AppShell>
  );
}
