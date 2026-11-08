// Operator settlement accepts timely terminal evidence without dispatching replacement work.
import { afterEach, expect, it, mock, spyOn } from "bun:test";
import { launchForegroundRun, PrivateRunSettlementError, readSettledPrivateRun } from "./http";
import type { RunRequest } from "../runs/types";

afterEach(() => mock.restore());
const id = "settlement-fixture", accessCode = "a".repeat(43), credential = "sk-settlement-fixture-123456789";
function snapshot(state: string, activeTrials: unknown = 0) {
  return { publishedAt: null, record: { id, version: "1", state, progress: { activeTrials, finishedTrials: 0, plannedTrials: 9, inferenceRequests: 0 }, results: [] } };
}

it("returns every settled state with one fresh private GET and no polling or inference", async () => {
  for (const state of ["completed", "cancelled", "timed-out", "failed", "interrupted"]) {
    const final = snapshot(state), wire = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(final));
    expect<unknown>(await readSettledPrivateRun(id, accessCode, credential)).toEqual(final);
    expect(wire).toHaveBeenCalledTimes(1);
    const [url, options] = wire.mock.calls[0];
    expect(url).toBe(`http://localhost:3201/runs/${id}`);
    expect(options).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", redirect: "error" });
    expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${accessCode}`);
    expect(options?.signal?.aborted).toBe(false);
    wire.mockRestore();
  }
});

it("waits through pending trials, running work, and zero-active cancellation before returning final counts", async () => {
  const views: unknown[] = [snapshot("running"), snapshot("running", 2), snapshot("cancelling", 1), snapshot("cancelling")];
  const final = { ...snapshot("cancelled"), record: { ...snapshot("cancelled").record, progress: { activeTrials: 0, finishedTrials: 2, plannedTrials: 9, inferenceRequests: 1 }, results: [{ retained: "original attempt" }, { retained: "cancelled attempt" }] } };
  views.push(final);
  const wire = spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected additional request."));
  for (const view of views) wire.mockResolvedValueOnce(Response.json(view));
  expect<unknown>(await readSettledPrivateRun(id, accessCode, credential)).toEqual(final);
  expect(wire).toHaveBeenCalledTimes(5);
  expect(wire.mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
});

it("requires zero active trials even when a snapshot already names a terminal state", async () => {
  const wire = spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json(snapshot("cancelled", 1))).mockResolvedValueOnce(Response.json(snapshot("cancelled")));
  expect((await readSettledPrivateRun(id, accessCode, credential)).record.progress.activeTrials).toBe(0);
  expect(wire).toHaveBeenCalledTimes(2);
});

it("leaves a never-terminal run unresolved under one bounded deadline without retrying inference", async () => {
  const wire = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(snapshot("cancelling")));
  const started = Date.now();
  await expect(readSettledPrivateRun(id, accessCode, credential, 25)).rejects.toThrow("Private receipt retained; final execution settlement did not finish within its read deadline");
  expect(Date.now() - started).toBeLessThan(1000);
  expect(wire).toHaveBeenCalledTimes(1);
  expect(wire.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

it("rejects terminal evidence parsed after the acceptance deadline before its abort timer can fire", async () => {
  const response = Response.json({ ...snapshot("cancelled"), retained: "x".repeat(32 * 1024 * 1024) });
  const wire = spyOn(globalThis, "fetch").mockResolvedValue(response);
  await expect(readSettledPrivateRun(id, accessCode, credential, 1)).rejects.toThrow("Private receipt retained; final execution settlement did not finish within its read deadline");
  expect(wire).toHaveBeenCalledTimes(1);
  expect(wire.mock.calls[0][1]?.signal?.aborted).toBe(false);
});

it("rejects unknown states, malformed counts, and mismatched receipts without polling", async () => {
  const invalid = [snapshot("unknown"), snapshot("cancelled", -1), snapshot("cancelled", 0.5), snapshot("cancelled", null), { record: { id, version: "1", state: "cancelled" } }, { record: { ...snapshot("cancelled").record, id: "other-run" } }];
  for (const view of invalid) {
    const wire = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(view));
    await expect(readSettledPrivateRun(id, accessCode, credential)).rejects.toBeInstanceOf(PrivateRunSettlementError);
    expect(wire).toHaveBeenCalledTimes(1);
    wire.mockRestore();
  }
  await expect(readSettledPrivateRun(id, accessCode, credential, 20001)).rejects.toThrow("deadline");
});

it("fails clearly on a GET or storage response failure without another read", async () => {
  const wire = spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("controlled read failure"));
  await expect(readSettledPrivateRun(id, accessCode, credential)).rejects.toThrow("Private receipt retained; final execution settlement could not be read or verified");
  expect(wire).toHaveBeenCalledTimes(1);
  wire.mockResolvedValueOnce(Response.json({ error: "controlled storage failure" }, { status: 500 }));
  await expect(readSettledPrivateRun(id, accessCode, credential)).rejects.toThrow("Private receipt retained");
  expect(wire).toHaveBeenCalledTimes(2);
});

it("aborts a stalled response-body read when the settlement deadline expires", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  const wire = spyOn(globalThis, "fetch").mockResolvedValue(response);
  await expect(readSettledPrivateRun(id, accessCode, credential, 25)).rejects.toThrow("read deadline");
  expect(cancelled).toBe(true);
  expect(wire).toHaveBeenCalledTimes(1);
});

it("retains one start receipt and collects existing evidence after the shared foreground abort", async () => {
  const controller = new AbortController(), receipts: { runId: string; accessCode: string }[] = [];
  const request: RunRequest = { provider: "openai", modelId: "fixture-model", servingProvider: null, profileId: "one-shot-json-v1", suiteKey: "screening-v1", concurrency: 4, acceptCharges: true };
  const foreground = new Response(new ReadableStream({ start(stream) {
      stream.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: "started", runId: id, accessCode })}\n`));
      controller.signal.addEventListener("abort", () => stream.error(controller.signal.reason), { once: true });
    } }), { headers: { "Content-Type": "application/x-ndjson" } });
  const wire = spyOn(globalThis, "fetch").mockResolvedValueOnce(foreground).mockResolvedValueOnce(Response.json(snapshot("cancelling"))).mockResolvedValueOnce(Response.json(snapshot("cancelled")));
  await expect(launchForegroundRun(request, credential, controller.signal, event => {
    if (event.type === "started") { receipts.push({ runId: event.runId, accessCode: event.accessCode }); controller.abort(); }
  })).rejects.toThrow();
  expect(controller.signal.aborted).toBe(true);
  expect((await readSettledPrivateRun(receipts[0].runId, receipts[0].accessCode, credential)).record.state).toBe("cancelled");
  expect(receipts).toEqual([{ runId: id, accessCode }]);
  expect(wire.mock.calls.map(([, options]) => options?.method)).toEqual(["POST", "GET", "GET"]);
});
