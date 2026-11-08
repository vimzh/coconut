import type { Metadata } from "next";

import { PitchDeck } from "@/components/pitch/pitch-deck";
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
  description: "An eight-slide introduction to function classification, explicit task conditions, evaluation, and model scoring.",
};

export default function PitchPage() {
  return (
    <PitchDeck titles={["CoconutEval", "Curvature definitions", "Why convexity matters", "Agent scenarios", "Explicit rules and composition", "How it works", "Practical failure modes", "Evaluation and scoring"]}>
      <IntroductionSlide />
      <TaskSlide />
      <RelevanceSlide />
      <AgentSlide />
      <CompositionSlide />
      <MethodSlide />
      <InterpretationSlide />
      <ScoringSlide />
    </PitchDeck>
  );
}
