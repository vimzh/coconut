import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PublicResults } from "@/components/leaderboard/public-results";

export const metadata: Metadata = {
  title: "Published evaluation · Coconut",
  description:
    "Read the retained answers, scores and certified mathematical references of a published evaluation.",
};
export default async function PublicResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <PublicResults key={id} id={id} />
    </AppShell>
  );
}
