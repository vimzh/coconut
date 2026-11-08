// Static pitch content; examples illustrate the task and are separate from measured results.
import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatedGraph } from "@/components/marketing/animated-graph";
import { FunctionGraph } from "@/components/marketing/function-graph";
import { AgentScenarios } from "./agent-scenarios";
import { OptimizationVisual } from "./optimization-visuals";
import styles from "./pitch.module.css";

function SlideHeading({ children }: { children: ReactNode }) {
  return <div className={styles.heading}><h2>{children}</h2></div>;
}

export function IntroductionSlide() {
  return (
    <div className={styles.introduction}>
      <h1 className={styles.title}>CoconutEval<span>.</span></h1>
      <p className={styles.introCopy}>How well does a language model understand<br className={styles.desktopBreak} /> the shape of a function?</p>
      <div className={styles.functionStudy}>
        <AnimatedGraph curve="M60 22Q240 226 420 22" viewBox="0 0 480 156" role="img" aria-label="The convex curve y equals x squared, with a chord above the curve">
          <defs><pattern id="pitch-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#ededed" strokeWidth="1" /></pattern></defs>
          <rect width="480" height="156" fill="url(#pitch-grid)" />
          <path d="M20 124H460 M240 12V144" className={styles.axis} />
          <path data-graph="curve" pathLength="1" d="M60 22Q240 226 420 22" className={styles.curve} />
          <path data-graph="chord" d="M126 83H354" className={styles.chord} />
          <circle data-graph="point" cx="126" cy="83" r="3.5" /><circle data-graph="point" cx="354" cy="83" r="3.5" />
          <text x="450" y="143">x</text><text x="249" y="19">f(x)</text>
        </AnimatedGraph>
        <div className={styles.equation}><span>f(x) = x<sup>2</sup></span><span className={styles.equationDomain}>x ∈ [−1, 1]</span></div>
      </div>
      <p className={styles.introFootnote}>Classify the function as convex, concave, or neither on the given interval.</p>
    </div>
  );
}

export function TaskSlide() {
  return (
    <div className={styles.definitionSlide}>
      <SlideHeading>Convex, concave, or neither.</SlideHeading>
      <p className={styles.lead}>All three functions use the interval D = [−1, 1].</p>
      <div className={styles.classificationGrid}>
        <article className={styles.classification}>
          <h3>Convex</h3>
          <p className={styles.sampleEquation}>f(x) = x<sup>2</sup></p>
          <div className={styles.classificationPlot}><FunctionGraph kind="convex" className={styles.functionGraph} /></div>
          <p className={styles.shapeExplanation}>Curves upward like a cup (∪).</p>
          <p className={styles.definitionEquation}>f(z) ≤ tf(x) + (1 − t)f(y)</p>
        </article>
        <article className={styles.classification}>
          <h3>Concave</h3>
          <p className={styles.sampleEquation}>f(x) = −x<sup>2</sup></p>
          <div className={styles.classificationPlot}><FunctionGraph kind="concave" className={styles.functionGraph} /></div>
          <p className={styles.shapeExplanation}>Curves downward like an upside-down cup (∩).</p>
          <p className={styles.definitionEquation}>f(z) ≥ tf(x) + (1 − t)f(y)</p>
        </article>
        <article className={styles.classification}>
          <h3>Neither</h3>
          <p className={styles.sampleEquation}>f(x) = x<sup>3</sup></p>
          <div className={styles.classificationPlot}><FunctionGraph kind="neither" className={styles.functionGraph} /></div>
          <p className={styles.shapeExplanation}>Some chords lie above the graph; others lie below it.</p>
          <p className={styles.neitherDefinition}>Neither convex nor concave on D.</p>
        </article>
      </div>
      <p className={styles.definitionSetup}>A chord joins two graph points with a straight segment. For f: D → ℝ, any x, y ∈ D and t ∈ [0, 1], set z = tx + (1 − t)y.</p>
      <div className={styles.bottomNote}><span>Each inequality must hold for every x, y and t above.</span><span>Affine functions satisfy both; this evaluation excludes them.</span></div>
    </div>
  );
}

const technicalUseCases = [
  { kind: "control", title: "Optimal control", detail: "Check whether a control cost and its constraints form a convex problem." },
  { kind: "inverse", title: "Inverse problems", detail: "Check whether adding a regularizer keeps a data-fitting objective convex." },
  { kind: "allocation", title: "Resource allocation", detail: "Check costs and capacity constraints before choosing a convex solver." },
] as const;

export function RelevanceSlide() {
  return (
    <div>
      <SlideHeading>Check the objective<br />and the constraints.</SlideHeading>
      <div className={styles.useCaseGrid}>
        {technicalUseCases.map(({ kind, title, detail }, index) => (
          <article className={styles.useCase} key={title}>
            <span className={styles.itemIndex}>0{index + 1}</span>
            <h3>{title}</h3>
            <OptimizationVisual kind={kind} />
            <p>{detail}</p>
          </article>
        ))}
      </div>
      <p className={styles.caveat}>CoconutEval measures scalar function classification. These applications are illustrative; transfer to full optimization systems remains untested.</p>
    </div>
  );
}

export function AgentSlide() {
  return (
    <div className={styles.agentSlide}>
      <SlideHeading>Simple rules. Nested exceptions.</SlideHeading>
      <AgentScenarios />
      <p className={styles.caveat}>Hypothetical policies illustrate condition tracking. CoconutEval tests mathematical function classification; transfer to agent workflows remains untested.</p>
    </div>
  );
}

const taskDesignChecks = [
  { title: "Every condition is visible", detail: "The complete expression, exact interval, operator meanings, and response format are supplied together." },
  { title: "The reference is checked first", detail: "Each admitted task has a verified label. Unresolved references stay out of the evaluation." },
  { title: "Any valid method is allowed", detail: "Use simplification, derivatives, inequalities, or composition rules. The grade checks the final label." },
];

const compositionChecks = [
  { title: "Combine familiar operations", detail: "A sign or input range can change which mathematical rule applies to the next operation." },
  { title: "Carry earlier restrictions forward", detail: "Simplifying an expression does not erase the original function’s domain restrictions." },
  { title: "Get the whole expression right", detail: "One fresh request contains the whole expression. The answer must hold over the entire supplied interval." },
];

export function CompositionSlide() {
  return (
    <div className={styles.interpretationSlide}>
      <SlideHeading>Every condition is stated.</SlideHeading>
      <p className={styles.scoreDefinition}>Simple pieces, stacked together. The intended challenge is preserving stated conditions through the composition. The task is designed to avoid hidden assumptions and trick wording.</p>
      <div className={styles.interpretationGrid}>
        <div className={styles.strongPanel}>
          <h3 className={styles.columnHeading}>What makes the task clear</h3>
          {taskDesignChecks.map(({ title, detail }) => <article className={styles.signal} key={title}><h4>{title}</h4><p>{detail}</p></article>)}
        </div>
        <div className={styles.failurePanel}>
          <h3 className={styles.columnHeading}>The composition we ask it to handle</h3>
          {compositionChecks.map(({ title, detail }) => <article className={styles.signal} key={title}><h4>{title}</h4><p>{detail}</p></article>)}
        </div>
      </div>
      <div className={styles.closing}><p>All output rules are stated. We inspect format failures separately from mathematical errors; model difficulty must be measured.</p></div>
    </div>
  );
}

const methodSteps = [
  { title: "Verify the reference answer", detail: "Generate a function and interval. Verify its label before adding it to the evaluation." },
  { title: "Ask the model", detail: "Send the expression and interval in three fresh requests. Keep the reference answer and proof out of the prompt." },
  { title: "Score and inspect the answers", detail: "Report macro-F1 and each class’s recall. Track unusable replies and provider failures separately. Read the wrong answers." },
];

export function MethodSlide() {
  return (
    <div>
      <SlideHeading>Verify, ask, and score.</SlideHeading>
      <div className={styles.methodGrid}>
        <ol className={styles.steps}>
          {methodSteps.map(({ title, detail }, index) => (
            <li key={title}><span className={styles.stepNumber}>{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>
          ))}
        </ol>
        <aside className={styles.scopeStudy}>
          <h3 className={styles.studyTitle}>Where the minus sign sits matters</h3>
          <div className={styles.scopeExamples}>
            <figure className={styles.scopeExample}>
              <figcaption><span>−(x − 1)<sup>2</sup></span><span>Concave</span></figcaption>
              <FunctionGraph kind="shifted-concave" className={styles.scopeGraph} />
            </figure>
            <figure className={styles.scopeExample}>
              <figcaption><span>(−(x − 1))<sup>2</sup></span><span>Convex</span></figcaption>
              <FunctionGraph kind="shifted-convex" className={styles.scopeGraph} />
            </figure>
          </div>
          <p>The first squares the term, then negates it. The second negates the term, then squares it.</p>
          <p className={styles.studyCaption}>Examples on [−1, 1]. These are not measured model errors.</p>
        </aside>
      </div>
      <p className={styles.evidenceNote}><strong>The evidence so far</strong> All labels were correct in four reviewed frontier-model confirmation runs. Some exploratory runs with older or non-frontier models had errors. We have not established a frontier-model limitation.</p>
    </div>
  );
}

const strongSignals = [
  { title: "Apply the final override", detail: "Alex gets a standard laptop because the training from 3 months ago overrides the customer-data restriction." },
  { title: "Change the answer when a condition changes", detail: "Make the training 7 months old: Alex now needs a restricted laptop with extra monitoring." },
  { title: "Keep exceptions inside their branch", detail: "Recent training alone does not qualify a contractor whose special project was never approved by Security." },
];

const failureSignals = [
  { title: "Stop one exception too early", detail: "Reject Alex because the project uses customer data, without checking the recent-training exception." },
  { title: "Apply an override too broadly", detail: "Give every trained contractor a standard laptop, even without a Security-approved special project." },
  { title: "Contradict its own conclusion", detail: "Return “standard laptop” while the explanation concludes that Alex must get a restricted one." },
];

export function InterpretationSlide() {
  return (
    <div className={styles.interpretationSlide}>
      <SlideHeading>What would fail in practice?</SlideHeading>
      <p className={styles.scoreDefinition}>A strong score is evidence of correct final decisions on this test. Alex’s policy illustrates the practical checks an agent would need to pass.</p>
      <div className={styles.interpretationGrid}>
        <div className={styles.strongPanel}>
          <h3 className={styles.columnHeading}>What getting it right looks like</h3>
          {strongSignals.map(({ title, detail }) => <article className={styles.signal} key={title}><h4>{title}</h4><p>{detail}</p></article>)}
        </div>
        <div className={styles.failurePanel}>
          <h3 className={styles.columnHeading}>Where an LLM or agent could fail</h3>
          {failureSignals.map(({ title, detail }) => <article className={styles.signal} key={title}><h4>{title}</h4><p>{detail}</p></article>)}
        </div>
      </div>
      <div className={styles.closing}>
        <p>Hypothetical policy pitfalls. Transfer from CoconutEval scores to agent workflows remains untested.</p>
        <Link href="/evaluate">Explore CoconutEval <span aria-hidden="true">↗</span></Link>
      </div>
    </div>
  );
}
