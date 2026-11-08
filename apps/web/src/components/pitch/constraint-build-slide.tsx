"use client";

// Build one expression slowly while keeping its original interval and derived constraints visible.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import deck from "./pitch.module.css";
import styles from "./constraint-build-slide.module.css";

const stepDuration = 5_000;
const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function prefersReducedMotion() { return window.matchMedia(motionQuery).matches; }
function serverMotionSnapshot() { return false; }

const steps = [
  {
    label: "Start", title: "Start with a range.",
    expression: <>x</>, spoken: "x", range: "[−1, 1]",
    rule: "Every operation starts with the same x ∈ [−1, 1].",
    caption: "The original interval stays with us through the whole expression.",
  },
  {
    label: "Square", title: "Square the input.",
    expression: <>x<sup className={styles.addition}>2</sup></>, spoken: "x squared", range: "[0, 1]",
    rule: "Squaring makes the output nonnegative.",
    caption: "The input is still in [−1, 1]. Only the output range has changed.",
  },
  {
    label: "Negate", title: "One small sign changes the shape.",
    expression: <><span className={styles.minus}>−</span>x<sup>2</sup></>, spoken: "negative x squared", range: "[−1, 0]",
    rule: "The minus sign turns convex x² into concave −x².",
    caption: "That minus sign must survive every operation we add next.",
  },
  {
    label: "Shift", title: "Shift the range upward.",
    expression: <><span className={styles.addition}>2</span> <span className={styles.minus}>−</span> x<sup>2</sup></>, spoken: "two minus x squared", range: "[1, 2]",
    rule: "Adding 2 shifts the output. It keeps the concavity.",
    caption: "The earlier minus sign now helps establish the next operation’s valid range.",
  },
  {
    label: "Log", title: "Check the next operation’s restriction.",
    expression: <><span className={styles.addition}>log(</span>2 <span className={styles.minus}>−</span> x<sup>2</sup><span className={styles.addition}>)</span></>, spoken: "natural log of two minus x squared", range: "[0, log 2]",
    rule: "The log input is in [1, 2], so it is always positive.",
    caption: "The logarithm is valid because we kept track of the range several steps back.",
  },
  {
    label: "Classify", title: "Classify everything together.",
    expression: <>log(2 <span className={styles.minus}>−</span> x<sup>2</sup>)</>, spoken: "natural log of two minus x squared", range: "[0, log 2]",
    rule: "Log is increasing and concave; its input is positive and concave.",
    caption: "CoconutEval asks for the final classification over the original interval.",
  },
] as const;

export function ConstraintBuildSlide() {
  const reducedMotion = useSyncExternalStore(subscribeToMotion, prefersReducedMotion, serverMotionSnapshot);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [replay, setReplay] = useState(0);
  const active = reducedMotion ? steps.length - 1 : step;
  const complete = active === steps.length - 1;
  const current = steps[active];

  useEffect(() => {
    if (!playing || reducedMotion || step === steps.length - 1) return;
    const timer = window.setTimeout(() => setStep((index) => index + 1), stepDuration);
    return () => window.clearTimeout(timer);
  }, [step, playing, replay, reducedMotion]);

  function restart() {
    setStep(0);
    setPlaying(true);
    setReplay((value) => value + 1);
  }

  return (
    <div className={styles.study}>
      <div className={`${deck.heading} ${styles.heading}`}><h2>One expression.<br />Every rule intact.</h2></div>
      <p className={styles.lead}>A sign, a range, a restriction. Each small detail still matters later.</p>
      <ol className={styles.sequence} aria-label="Expression building steps">
        {steps.map(({ label }, index) => (
          <li key={label} data-reached={index <= active} aria-current={index === active ? "step" : undefined}>
            <span className={styles.marker} aria-hidden="true">{index + 1}</span><span>{label}</span>
          </li>
        ))}
      </ol>
      <div className={styles.expressionPanel}>
        <div key={`${replay}-${active}`} className={styles.frame}>
          <p className={styles.stepTitle}>{current.title}</p>
          <p className={styles.expression} aria-label={current.spoken}>{current.expression}</p>
          <p className={styles.caption}>{current.caption}</p>
        </div>
        <p className={styles.result} data-complete={complete}>{complete ? "Concave on [−1, 1]" : "The whole expression is still growing…"}</p>
      </div>
      <div className={styles.constraints}>
        <div className={styles.original}><h3>Original interval · retained</h3><p>x ∈ [−1, 1]</p></div>
        <div><h3>Current output range</h3><p key={`${replay}-${active}`} className={styles.range}>{current.range}</p></div>
        <div className={styles.rule}><h3>Rule to carry forward</h3><p>{current.rule}</p></div>
      </div>
      <div className={styles.playback}>
        <p>{reducedMotion ? "Completed view · reduced motion" : complete ? "All conditions carried through." : "Slow build · 25 seconds"}</p>
        {!reducedMotion && <div className={styles.buttons}>
          <Button variant="outline" size="sm" onClick={() => setPlaying((value) => !value)} disabled={complete} aria-label={playing ? "Pause animation" : "Resume animation"}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{playing ? "Pause" : "Resume"}
          </Button>
          <Button variant="outline" size="sm" onClick={restart} aria-label="Replay animation"><RotateCcw aria-hidden="true" />Replay</Button>
        </div>}
      </div>
    </div>
  );
}
