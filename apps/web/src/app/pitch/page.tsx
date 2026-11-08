import type { Metadata } from "next";

import { PitchDeck } from "@/components/pitch/pitch-deck";
import {
  IntroductionSlide,
  InterpretationSlide,
  MethodSlide,
  RelevanceSlide,
  TaskSlide,
} from "@/components/pitch/pitch-slides";

export const metadata: Metadata = {
  title: "CoconutEval | The pitch",
  description: "A five-slide introduction to measuring compositional reasoning through mathematical curvature.",
};

export default function PitchPage() {
  return (
    <PitchDeck titles={["CoconutEval", "The evaluation", "Why it matters", "How it works", "Reading the score"]}>
      <IntroductionSlide />
      <TaskSlide />
      <RelevanceSlide />
      <MethodSlide />
      <InterpretationSlide />
    </PitchDeck>
  );
}
