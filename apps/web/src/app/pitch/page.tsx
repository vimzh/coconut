import type { Metadata } from "next";

import { PitchDeck } from "@/components/pitch/pitch-deck";
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
  description: "A seven-slide visual introduction to function classification, explicit task conditions, and the rules agents must preserve.",
};

export default function PitchPage() {
  return (
    <PitchDeck titles={["CoconutEval", "Curvature definitions", "Why convexity matters", "Agent scenarios", "Explicit rules and composition", "How it works", "Practical failure modes"]}>
      <IntroductionSlide />
      <TaskSlide />
      <RelevanceSlide />
      <AgentSlide />
      <CompositionSlide />
      <MethodSlide />
      <InterpretationSlide />
    </PitchDeck>
  );
}
