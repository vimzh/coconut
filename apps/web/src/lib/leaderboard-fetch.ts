// Anonymous public listings use one fixed destination and never forward visitor credentials.
export class LeaderboardFetchError extends Error {
  constructor(
    readonly code: "configuration" | "unavailable" | "invalid-response",
  ) {
    super(
      "Public comparisons could not be loaded. Check the evaluation service and try again.",
    );
    this.name = "LeaderboardFetchError";
  }
}
function origin(): string {
  try {
    const url = new URL(
      process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3201",
    );
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new LeaderboardFetchError("configuration");
  }
}
async function readPublicJson(
  destination: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController(),
    abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 20000);
  try {
    if (signal?.aborted) controller.abort();
    const response = await fetch(destination, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new LeaderboardFetchError("unavailable");
    }
    if (
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json") ||
      !response.body
    )
      throw new LeaderboardFetchError("invalid-response");
    const reader = response.body.getReader(),
      decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0,
      source = "";
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > 32 * 1024 * 1024)
          throw new LeaderboardFetchError("invalid-response");
        source += decoder.decode(next.value, { stream: true });
      }
      source += decoder.decode();
      return JSON.parse(source) as unknown;
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof LeaderboardFetchError) throw error;
    throw new LeaderboardFetchError("unavailable");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function fetchPublishedSummaries(
  signal?: AbortSignal,
): Promise<unknown> {
  return readPublicJson(`${origin()}/runs/published`, signal);
}
export function fetchLeaderboardSummaries(
  signal?: AbortSignal,
): Promise<unknown> {
  return readPublicJson("/api/leaderboard", signal);
}
