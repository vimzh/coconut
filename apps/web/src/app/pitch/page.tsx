import type { Metadata } from "next";

import { PitchDeck } from "@/components/pitch/pitch-deck";
import { ConstraintBuildSlide } from "@/components/pitch/constraint-build-slide";
import { FunctionCaseSlide } from "@/components/pitch/function-case-slide";
import { ScoringSlide } from "@/components/pitch/scoring-slide";
import { CurrentResultsSlide, TerminalWorkflowSlide } from "@/components/pitch/current-evaluation-slides";
import {
  AgentSlide,
  CompositionSlide,
  IntroductionSlide,
  InterpretationSlide,
  MethodSlide,
  RelevanceSlide,
  TaskSlide,
} from "@/components/pitch/pitch-slides";

export const metadata: Metadata = {
  title: "CoconutEval | The pitch",
  description: "A twelve-slide introduction to function classification, certified tasks, audited model results, scoring and configurable terminal evaluations.",
};

export default function PitchPage() {
  return (
    <PitchDeck titles={["CoconutEval", "Curvature definitions", "Why convexity matters", "Keep every rule intact", "Agent scenarios", "Explicit rules and composition", "A complete function test case", "How it works", "Practical failure modes", "Evaluation and scoring", "Current measured results", "Configurable terminal workflow"]}>
      <IntroductionSlide />
      <TaskSlide />
      <RelevanceSlide />
      <ConstraintBuildSlide />
      <AgentSlide />
      <CompositionSlide />
      <FunctionCaseSlide />
      <MethodSlide />
      <InterpretationSlide />
      <ScoringSlide />
      <CurrentResultsSlide />
      <TerminalWorkflowSlide />
    </PitchDeck>
  );
}
