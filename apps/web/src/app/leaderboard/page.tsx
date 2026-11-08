import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { LeaderboardWorkspace } from "@/components/leaderboard/leaderboard-workspace";

export const metadata: Metadata = {
  title: "Public comparisons · Coconut",
  description:
    "Inspect comparable published convexity evaluations, eligibility and retained mathematical evidence.",
};
export default function LeaderboardPage() {
  return (
    <AppShell activePage="leaderboard">
      <LeaderboardWorkspace />
    </AppShell>
  );
}
