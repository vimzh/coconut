import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CurvatureExamples } from "@/components/marketing/curvature-examples";
import { CurvatureIllustration } from "@/components/marketing/curvature-illustration";
import { ModelDirectory } from "@/components/marketing/model-directory";
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
      <section aria-labelledby="home-title" className="grid items-center gap-10 py-12 sm:gap-12 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-20">
        <div>
          <p className="mb-5 text-sm text-muted-foreground">A workbench for mathematical evaluation</p>
          <h1 id="home-title" className="max-w-xl text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl xl:text-[56px]">
            Test a model’s convexity judgment
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Give a language model a function and an exact interval. Compare its answer with a verified reference, then inspect the evidence behind the score.
          </p>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">Use your own provider key. Provider charges apply.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 px-5"><Link href="/evaluate">Evaluate a model</Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-5"><Link href="/leaderboard">View leaderboard</Link></Button>
          </div>
        </div>
        <CurvatureIllustration />
      </section>

      <ModelDirectory />

      <section aria-labelledby="task-title" className="grid gap-8 border-t border-border py-12 sm:py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
        <div>
          <h2 id="task-title" className="text-2xl leading-tight font-medium sm:text-3xl">Classify the whole interval</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            A function can be convex on one interval and neither on another. The task asks for convex, concave or neither on exactly the domain supplied.
          </p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Affine and constant functions satisfy both curvature definitions and are excluded from this three-label task.
          </p>
        </div>
        <CurvatureExamples />
      </section>

      <section aria-labelledby="workflow-title" className="border-t border-border py-12 sm:py-16">
        <div className="max-w-3xl">
          <h2 id="workflow-title" className="text-2xl leading-tight font-medium sm:text-3xl">From a function to an inspectable result</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The curvature challenge contains 72 certified tasks across eight function families and 24 related parameter groups. Three trials per task make 216 planned requests.
          </p>
        </div>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {steps.map(({ title, description }, index) => (
            <li key={title} className="border-t border-border pt-5">
              <span className="font-mono text-sm text-muted-foreground">{index + 1}</span>
              <h3 className="mt-3 text-lg font-medium">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-3xl text-sm leading-6 text-muted-foreground">
          Depth describes the expression tree. It also changes with function family and size, so a depth plot does not isolate mathematical difficulty.
        </p>
      </section>

      <section aria-labelledby="before-title" className="grid gap-8 border-t border-border py-12 sm:py-16 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 id="before-title" className="text-2xl font-medium">Your key and your run</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Your provider key is held in current-page memory and passed through the evaluation server for your requested operation. It is excluded from saved runs. Results are private by default, expire after seven days and use a separate access code.
          </p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Save that access code to return to a record. Publication is explicit and reversible. Interrupted work does not resume automatically; requests already sent may still incur provider charges.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-medium">Compare with the settings in view</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Suite membership, answer format, reasoning effort and output ceiling define a comparison. Inspect incomplete work and format failures alongside the score. A result on these tasks does not establish general mathematical ability.
          </p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            OpenAI has live execution checks. OpenRouter and Hugging Face Inference Providers have passed controlled software tests; their live execution remains unverified.
          </p>
          <Link href="/methodology" className="mt-5 inline-flex rounded-sm text-sm font-medium underline underline-offset-4">Read the methodology</Link>
        </div>
      </section>
    </AppShell>
  );
}
