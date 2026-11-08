// This public read endpoint applies comparison policy to the retained API summaries.
import { buildLeaderboard } from "@/lib/leaderboard";
import { fetchPublishedSummaries } from "@/lib/leaderboard-fetch";

export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (new URL(request.url).search)
    return Response.json(
      { error: "Comparison queries are not supported." },
      { status: 400, headers },
    );
  try {
    const summaries = await fetchPublishedSummaries(request.signal);
    buildLeaderboard(summaries);
    return Response.json(summaries, { headers });
  } catch {
    return Response.json(
      {
        error:
          "Public comparisons could not be loaded. Check the evaluation service and try again.",
      },
      { status: 503, headers },
    );
  }
}
