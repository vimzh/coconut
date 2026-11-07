// Verify native Bun socket cancellation reaches the provider operation without live calls.
import { expect, it } from "bun:test";
import { createProviderAccessClient } from "./client";
import { createProviderRoutes } from "./routes";

it("propagates a real HTTP client disconnect through Bun to the upstream abort signal", async () => {
  const entered = Promise.withResolvers<void>();
  const stopped = Promise.withResolvers<void>();
  const cleanup = new AbortController();
  const provider = createProviderAccessClient(async (_url, init) => {
    entered.resolve();
    return await new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => {
        stopped.resolve();
        reject(new Error("Controlled fixture cancellation."));
      }, { once: true });
    });
  });
  const routes = createProviderRoutes({ accessClient: (request, key, signal) => provider(request, key, AbortSignal.any([signal!, cleanup.signal])) });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: routes.fetch });
  const caller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<Response | undefined> | undefined;
  try {
    pending = fetch(`http://127.0.0.1:${server.port}/access`, {
      method: "POST", signal: caller.signal,
      headers: { Authorization: "Bearer VISITOR_DISCONNECT_FIXTURE_0123456789", "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", operation: "authenticate" }),
    }).catch(() => undefined);
    await Promise.race([entered.promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Fixture did not start.")), 2000); })]);
    clearTimeout(timer);
    caller.abort();
    await pending;
    const propagated = await Promise.race([stopped.promise.then(() => true), new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), 2000); })]);
    expect(propagated).toBe(true);
  } finally {
    clearTimeout(timer);
    caller.abort();
    cleanup.abort();
    await pending;
    await server.stop(true);
  }
});
