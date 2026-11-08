// Operator HTTP parsing retains receipts and fails closed on malformed streams without retrying.
import { afterEach, expect, it, mock, spyOn } from "bun:test";
import { launchForegroundRun, readApplicationJson } from "./http";
import type { RunRequest } from "../runs/types";

afterEach(() => mock.restore());
const request: RunRequest = { provider: "openai", modelId: "fixture-model", servingProvider: null, profileId: "one-shot-json-v1", suiteKey: "screening-v1", concurrency: 4, acceptCharges: true };
const credential = "sk-operator-fixture-123456789";
const receipt = { type: "started", runId: "fixture-run", accessCode: "a".repeat(43) };
function stream(lines: unknown[]): Response {
  return new Response(lines.map(line => JSON.stringify(line)).join("\n") + "\n", { headers: { "Content-Type": "application/x-ndjson" } });
}

it("uses one fixed-origin foreground request and retains ordered receipts across heartbeat events", async () => {
  const wire = spyOn(globalThis, "fetch").mockResolvedValue(stream([receipt, { type: "heartbeat" }, { type: "progress" }, { type: "finished" }]));
  const seen: string[] = [];
  await launchForegroundRun(request, credential, new AbortController().signal, event => seen.push(event.type));
  expect(seen).toEqual(["started", "progress", "finished"]);
  expect(wire).toHaveBeenCalledTimes(1);
  const [url, options] = wire.mock.calls[0];
  expect(url).toBe("http://localhost:3201/runs");
  expect(options).toMatchObject({ method: "POST", redirect: "error", credentials: "omit", cache: "no-store" });
  expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${credential}`);
});

it("rejects duplicate, missing, reflected, or out-of-order terminal evidence without another request", async () => {
  const cases = [[receipt], [{ type: "finished" }], [receipt, receipt], [receipt, { type: "finished" }, { type: "progress" }], [receipt, { type: "error" }], [receipt, { type: "finished", unsafe: credential }]];
  for (const lines of cases) {
    const wire = spyOn(globalThis, "fetch").mockResolvedValue(stream(lines));
    await expect(launchForegroundRun(request, credential, new AbortController().signal, () => {})).rejects.toThrow();
    expect(wire).toHaveBeenCalledTimes(1);
    wire.mockRestore();
  }
});

it("cancels an unread foreground stream when persistence of its receipt fails", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`${JSON.stringify(receipt)}\n`)); }, cancel() { cancelled = true; } }), { headers: { "Content-Type": "application/x-ndjson" } });
  spyOn(globalThis, "fetch").mockResolvedValue(response);
  await expect(launchForegroundRun(request, credential, new AbortController().signal, () => { throw new Error("Controlled checkpoint failure."); })).rejects.toThrow("checkpoint");
  expect(cancelled).toBe(true);
});

it("never treats rejected or credential-reflecting application JSON as safe evidence", async () => {
  await expect(readApplicationJson(new Response("error", { status: 403 }))).rejects.toThrow("403");
  await expect(readApplicationJson(Response.json({ value: credential }), credential)).rejects.toThrow("Unsafe");
  await expect(readApplicationJson(new Response(new Uint8Array([0xff])))).rejects.toThrow();
  expect(await readApplicationJson(Response.json({ ok: true }), credential)).toEqual({ ok: true });
});
