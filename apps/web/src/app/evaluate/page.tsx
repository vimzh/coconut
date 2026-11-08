import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { EvaluationWorkspace } from "@/components/evaluation/evaluation-workspace";

export const metadata: Metadata = {
  title: "Evaluate models · Coconut",
  description:
    "Run a private convexity evaluation with your own provider credential and inspect retained task and answer evidence.",
};

export default function EvaluatePage() {
  return (
    <AppShell activePage="evaluate">
      <EvaluationWorkspace />
    </AppShell>
  );
}
