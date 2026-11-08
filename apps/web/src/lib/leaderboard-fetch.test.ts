// Public reads never inherit provider credentials, redirects or unbounded response bodies.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchLeaderboardSummaries,
  fetchPublishedSummaries,
  LeaderboardFetchError,
} from "./leaderboard-fetch";

async function mocked<T>(
  implementation: typeof fetch,
  run: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });

describe("bounded anonymous comparison reads", () => {
  it("uses the fixed public API path with no credential or cookie forwarding", async () => {
    await mocked(
      (async (input, options) => {
        assert.equal(input, "http://localhost:3201/runs/published");
        assert.equal(options?.credentials, "omit");
        assert.equal(options?.cache, "no-store");
        assert.equal(options?.redirect, "error");
        const headers = new Headers(options?.headers);
        assert.equal(headers.get("authorization"), null);
        assert.equal(headers.get("cookie"), null);
        return json({ version: "1", runs: [] });
      }) as typeof fetch,
      async () =>
        assert.deepEqual(await fetchPublishedSummaries(), {
          version: "1",
          runs: [],
        }),
    );
  });
  it("loads the local listing route separately from provider operations", async () => {
    await mocked(
      (async (input) => {
        assert.equal(input, "/api/leaderboard");
        return json({ version: "1", runs: [] });
      }) as typeof fetch,
      async () =>
        assert.deepEqual(await fetchLeaderboardSummaries(), {
          version: "1",
          runs: [],
        }),
    );
  });
  it("rejects service failures, malformed JSON, wrong media types and invalid UTF-8", async () => {
    for (const response of [
      new Response("error", { status: 503 }),
      new Response("{", { headers: { "content-type": "application/json" } }),
      new Response("[]", { headers: { "content-type": "text/plain" } }),
      new Response(new Uint8Array([255]), {
        headers: { "content-type": "application/json" },
      }),
    ]) {
      await mocked((async () => response) as typeof fetch, async () =>
        assert.rejects(fetchPublishedSummaries(), LeaderboardFetchError),
      );
    }
  });
  it("bounds chunked responses without trusting content-length", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32 * 1024 * 1024 + 1));
      },
      cancel() {
        cancelled = true;
      },
    });
    await mocked(
      (async () =>
        new Response(body, {
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
      async () =>
        assert.rejects(fetchPublishedSummaries(), LeaderboardFetchError),
    );
    assert.equal(cancelled, true);
  });
  it("keeps cancellation observable and does not retry", async () => {
    let calls = 0;
    const controller = new AbortController();
    controller.abort();
    await mocked(
      (async (_input, options) => {
        calls++;
        assert.equal(options?.signal?.aborted, true);
        throw new DOMException("Aborted", "AbortError");
      }) as typeof fetch,
      async () =>
        assert.rejects(
          fetchPublishedSummaries(controller.signal),
          LeaderboardFetchError,
        ),
    );
    assert.equal(calls, 1);
  });
  it("rejects insecure or credential-bearing configured destinations before fetching", async () => {
    const previous = process.env.NEXT_PUBLIC_API_ORIGIN;
    try {
      for (const value of [
        "http://remote.example",
        "https://user:password@example.com",
        "https://example.com/path",
        "https://example.com/?token=secret",
      ]) {
        process.env.NEXT_PUBLIC_API_ORIGIN = value;
        await mocked(
          (async () => {
            throw new Error("Must not fetch");
          }) as typeof fetch,
          async () =>
            assert.throws(
              () => fetchPublishedSummaries(),
              LeaderboardFetchError,
            ),
        );
      }
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_API_ORIGIN;
      else process.env.NEXT_PUBLIC_API_ORIGIN = previous;
    }
  });
});

describe("public listing route", () => {
  it("returns a no-store empty list and never forwards incoming authorization", async () => {
    const { GET } = await import("../app/api/leaderboard/route");
    await mocked(
      (async (_input, options) => {
        assert.equal(new Headers(options?.headers).get("authorization"), null);
        return json({ version: "1", runs: [] });
      }) as typeof fetch,
      async () => {
        const response = await GET(
          new Request("http://localhost:3200/api/leaderboard", {
            headers: { Authorization: "Bearer synthetic-secret" },
          }),
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.deepEqual(await response.json(), { version: "1", runs: [] });
      },
    );
  });
  it("returns unavailable for invalid upstream evidence and rejects query forwarding", async () => {
    const { GET } = await import("../app/api/leaderboard/route");
    await mocked(
      (async () => json({ version: "1", runs: [{}] })) as typeof fetch,
      async () => {
        const response = await GET(
          new Request("http://localhost:3200/api/leaderboard"),
        );
        assert.equal(response.status, 503);
        assert.equal(
          JSON.stringify(await response.json()).includes("runs"),
          false,
        );
      },
    );
    await mocked(
      (async () => {
        throw new Error("Must not fetch");
      }) as typeof fetch,
      async () => {
        const response = await GET(
          new Request(
            "http://localhost:3200/api/leaderboard?url=https://example.com",
          ),
        );
        assert.equal(response.status, 400);
      },
    );
  });
});
