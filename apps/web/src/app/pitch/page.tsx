import type { Metadata } from "next";

import { PitchDeck } from "@/components/pitch/pitch-deck";
import {
  AgentSlide,
  IntroductionSlide,
  InterpretationSlide,
  MethodSlide,
  RelevanceSlide,
  TaskSlide,
} from "@/components/pitch/pitch-slides";

export const metadata: Metadata = {
  title: "CoconutEval | The pitch",
  description: "A six-slide visual introduction to function classification, optimization, and the conditions agents must preserve.",
};

export default function PitchPage() {
  return (
    <PitchDeck titles={["CoconutEval", "Curvature definitions", "Why convexity matters", "Agent scenarios", "How it works", "Reading the score"]}>
      <IntroductionSlide />
      <TaskSlide />
      <RelevanceSlide />
      <AgentSlide />
      <MethodSlide />
      <InterpretationSlide />
    </PitchDeck>
  );
}
