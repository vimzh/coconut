import type { Metadata } from "next";

import { PitchDeck } from "@/components/pitch/pitch-deck";
import { FunctionCaseSlide } from "@/components/pitch/function-case-slide";
import { ScoringSlide } from "@/components/pitch/scoring-slide";
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
  description: "A nine-slide introduction to function classification, a worked mathematical task, evaluation, and model scoring.",
};

export default function PitchPage() {
  return (
    <PitchDeck titles={["CoconutEval", "Curvature definitions", "Why convexity matters", "Agent scenarios", "Explicit rules and composition", "A complete function test case", "How it works", "Practical failure modes", "Evaluation and scoring"]}>
      <IntroductionSlide />
      <TaskSlide />
      <RelevanceSlide />
      <AgentSlide />
      <CompositionSlide />
      <FunctionCaseSlide />
      <MethodSlide />
      <InterpretationSlide />
      <ScoringSlide />
    </PitchDeck>
  );
}
