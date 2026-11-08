// Static pitch content; examples illustrate the task and are separate from measured results.
import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./pitch.module.css";

function SlideHeading({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.heading}><p className={styles.eyebrow}>{label}</p><h2>{children}</h2></div>;
}

export function IntroductionSlide() {
  return (
    <div className={styles.introduction}>
      <p className={styles.eyebrow}>A mathematical lens on model reasoning</p>
      <h1 className={styles.title}>CoconutEval<span>.</span></h1>
      <p className={styles.introCopy}>How well does a language model understand<br className={styles.desktopBreak} /> the shape of a function?</p>
      <div className={styles.functionStudy}>
        <svg viewBox="0 0 480 156" role="img" aria-label="The convex curve y equals x squared, with a chord above the curve">
          <defs><pattern id="pitch-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#ededed" strokeWidth="1" /></pattern></defs>
          <rect width="480" height="156" fill="url(#pitch-grid)" />
          <path d="M20 124H460 M240 12V144" className={styles.axis} />
          <path d="M60 22Q240 226 420 22" className={styles.curve} />
          <path d="M126 83H354" className={styles.chord} />
          <circle cx="126" cy="83" r="3.5" /><circle cx="354" cy="83" r="3.5" />
          <text x="450" y="143">x</text><text x="249" y="19">f(x)</text>
        </svg>
        <div className={styles.equation}><span>f(x) = x<sup>2</sup></span><span className={styles.equationDomain}>x ∈ [−1, 1]</span></div>
      </div>
      <p className={styles.introFootnote}>One function. A stated domain. A verifiable answer.</p>
    </div>
  );
}

export function TaskSlide() {
  return (
    <div>
      <SlideHeading label="The evaluation">Classify the function.<br />Keep the whole domain in view.</SlideHeading>
      <p className={styles.lead}>CoconutEval asks a model to identify curvature, then checks its answer against a mathematically certified reference.</p>
      <div className={styles.classificationGrid}>
        <article className={styles.classification}>
          <span className={styles.mathIndex}>I</span><h3>Convex</h3>
          <p className={styles.sampleEquation}>x<sup>2</sup></p>
          <p>The curve sits below every chord connecting two of its points.</p>
        </article>
        <article className={styles.classification}>
          <span className={styles.mathIndex}>II</span><h3>Concave</h3>
          <p className={styles.sampleEquation}>−x<sup>2</sup></p>
          <p>The curve sits above every chord connecting two of its points.</p>
        </article>
        <article className={styles.classification}>
          <span className={styles.mathIndex}>III</span><h3>Neither</h3>
          <p className={styles.sampleEquation}>x<sup>3</sup></p>
          <p>Both curvature conditions fail somewhere in the domain.</p>
        </article>
      </div>
      <div className={styles.bottomNote}><span>All three examples use x ∈ [−1, 1]</span><span>Illustrations, separate from scored tasks</span></div>
    </div>
  );
}

const technicalUseCases = [
  { title: "Optimal control", detail: "Check a quadratic control objective together with its penalties and feasible region." },
  { title: "Inverse problems", detail: "Track curvature when a data-fitting loss is composed with a regularizer." },
  { title: "Resource allocation", detail: "Verify the objective and constraints before relying on a convex formulation." },
];

const everydayUseCases = [
  { title: "A travel-planning agent", detail: "Keep a connection-time requirement intact when rearranging an itinerary." },
  { title: "A customer-support agent", detail: "Apply a refund policy together with its nested eligibility exceptions." },
  { title: "A coding agent", detail: "Preserve scope and prerequisites when editing a conditional workflow." },
];

export function RelevanceSlide() {
  return (
    <div>
      <SlideHeading label="Why it matters">One missed condition<br />can change the answer.</SlideHeading>
      <div className={styles.useCaseGrid}>
        <div className={styles.useCaseColumn}>
          <h3 className={styles.columnHeading}>In mathematical optimization</h3>
          {technicalUseCases.map(({ title, detail }, index) => (
            <article className={styles.useCase} key={title}>
              <span className={styles.itemIndex}>0{index + 1}</span><div><h4>{title}</h4><p>{detail}</p></div>
            </article>
          ))}
        </div>
        <div className={styles.useCaseColumn}>
          <h3 className={styles.columnHeading}>The same dependency pattern in agents</h3>
          {everydayUseCases.map(({ title, detail }, index) => (
            <article className={styles.useCase} key={title}>
              <span className={styles.itemIndex}>0{index + 1}</span><div><h4>{title}</h4><p>{detail}</p></div>
            </article>
          ))}
        </div>
      </div>
      <p className={styles.caveat}>Applications and analogies. This evaluation measures curvature classification; transfer to these workflows remains untested.</p>
    </div>
  );
}

const methodSteps = [
  { title: "Certify the task", detail: "Generate a function and interval. Admit it only with reference evidence." },
  { title: "Ask the model", detail: "Send the expression and domain in three fresh trials. Hide reference labels and proofs." },
  { title: "Check every answer", detail: "Report macro-F1 and recall. Separate unusable replies from provider failures. Inspect wrong labels." },
];

export function MethodSlide() {
  return (
    <div>
      <SlideHeading label="How it works">We ask a small question.<br />Every condition still counts.</SlideHeading>
      <div className={styles.methodGrid}>
        <ol className={styles.steps}>
          {methodSteps.map(({ title, detail }, index) => (
            <li key={title}><span className={styles.stepNumber}>{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>
          ))}
        </ol>
        <aside className={styles.scopeStudy}>
          <p className={styles.eyebrow}>A sign changes the shape</p>
          <div className={styles.scopeExample}><span>−(x − 1)<sup>2</sup></span><span>Concave</span></div>
          <div className={styles.scopeExample}><span>(−(x − 1))<sup>2</sup></span><span>Convex</span></div>
          <p>Parentheses, operator scope, and the domain all belong to the task.</p>
          <p className={styles.studyCaption}>Illustrative expressions on [−1, 1]</p>
        </aside>
      </div>
      <p className={styles.evidenceNote}><strong>The evidence so far</strong> Four completed high/max frontier confirmation runs were label-perfect. Exploratory errors in older/non-frontier settings do not establish a frontier limitation.</p>
    </div>
  );
}

const strongSignals = [
  { title: "Distinguishes the classes", detail: "Gets convex, concave, and neither right rather than favoring one label." },
  { title: "Respects the stated domain", detail: "Recognizes x³ as neither on [−1, 1], and convex on [0, 1]." },
  { title: "Preserves operator scope", detail: "Distinguishes −(x − 1)² from (−(x − 1))²." },
];

const failureSignals = [
  { title: "Defaults to a label", detail: "Predicts neither even when the whole interval is certified convex." },
  { title: "Overlooks a condition", detail: "Misses a domain restriction or moves a minus sign outside its scope." },
  { title: "Fails the answer contract", detail: "Returns invalid JSON or runs out of output budget. Inspect these separately." },
];

export function InterpretationSlide() {
  return (
    <div>
      <SlideHeading label="Reading the score">A score starts<br />the investigation.</SlideHeading>
      <div className={styles.interpretationGrid}>
        <div>
          <h3 className={styles.columnHeading}>With a high score, look for</h3>
          {strongSignals.map(({ title, detail }) => <article className={styles.signal} key={title}><h4>{title}</h4><p>{detail}</p></article>)}
        </div>
        <div>
          <h3 className={styles.columnHeading}>With a low score, check for</h3>
          {failureSignals.map(({ title, detail }) => <article className={styles.signal} key={title}><h4>{title}</h4><p>{detail}</p></article>)}
        </div>
      </div>
      <div className={styles.closing}>
        <p>Read the transcripts, class recall, and trial variation alongside the score.<br />Results describe the tested suite and settings; general agent reliability remains a separate question.</p>
        <Link href="/evaluate">Explore CoconutEval <span aria-hidden="true">↗</span></Link>
      </div>
    </div>
  );
}
