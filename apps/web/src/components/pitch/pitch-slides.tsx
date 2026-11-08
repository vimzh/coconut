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
    <div>
      <SlideHeading>Check the whole rule.</SlideHeading>
      <AgentScenarios />
      <p className={styles.caveat}>These examples explain why conditions matter. We have not tested whether CoconutEval scores predict success in these agent workflows.</p>
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
  { title: "All three classes are handled well", detail: "Check that recall is high for convex, concave, and neither." },
  { title: "The interval is used correctly", detail: "Check answers to tasks that depend on the interval’s endpoints." },
  { title: "The expression is read correctly", detail: "Check explanations for correct use of parentheses and minus signs." },
];

const failureSignals = [
  { title: "One class is often missed", detail: "Check whether the model keeps choosing the same label." },
  { title: "The expression or interval is misread", detail: "Look for a missed restriction or a misplaced minus sign." },
  { title: "The reply cannot be scored as a label", detail: "Check for invalid JSON or a reply cut short by its output limit." },
];

export function InterpretationSlide() {
  return (
    <div>
      <SlideHeading>What does the score tell us?</SlideHeading>
      <p className={styles.scoreDefinition}>Macro-F1 averages the F1 scores for convex, concave, and neither. A higher value means better classification on the tested tasks.</p>
      <div className={styles.interpretationGrid}>
        <div className={styles.strongPanel}>
          <h3 className={styles.columnHeading}>High score: verify these three things</h3>
          {strongSignals.map(({ title, detail }) => <article className={styles.signal} key={title}><h4>{title}</h4><p>{detail}</p></article>)}
        </div>
        <div className={styles.failurePanel}>
          <h3 className={styles.columnHeading}>Low score: check these three causes</h3>
          {failureSignals.map(({ title, detail }) => <article className={styles.signal} key={title}><h4>{title}</h4><p>{detail}</p></article>)}
        </div>
      </div>
      <div className={styles.closing}>
        <p>Read the answers, per-class recall, and variation across trials.<br />A high score alone does not prove correct reasoning or reliable agent behavior.</p>
        <Link href="/evaluate">Explore CoconutEval <span aria-hidden="true">↗</span></Link>
      </div>
    </div>
  );
}
