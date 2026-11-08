// Development orchestration uses the same foreground HTTP stream and private access boundary as visitors.
import { setTimeout as delay } from "node:timers/promises";
import { reflectsCredential } from "../providers/responses";
import type { RunEvent, RunRequest, RunState, RunView } from "../runs/types";

export const LOCAL_API = "http://localhost:3201";
export async function readApplicationJson(response: Response, credential?: string, signal?: AbortSignal): Promise<unknown> {
  if (!response.ok || !response.body) { void response.body?.cancel().catch(() => {}); throw new Error(`Application request failed with HTTP ${response.status}.`); }
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  let bytes = 0, text = "", drained = false;
  try {
    signal?.throwIfAborted();
    while (true) {
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) { drained = true; break; }
      bytes += chunk.value.byteLength;
      if (bytes > 256 * 1024 * 1024) throw new Error("Retained run exceeds the application export budget.");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const parsed: unknown = JSON.parse(text);
    if (credential && reflectsCredential(JSON.stringify(parsed), credential)) throw new Error("Unsafe application evidence.");
    return parsed;
  } finally { signal?.removeEventListener("abort", abort); if (!drained) void reader.cancel().catch(() => {}); }
}

export async function launchForegroundRun(request: RunRequest, credential: string, signal: AbortSignal, onEvent: (event: RunEvent) => void): Promise<void> {
  const response = await fetch(`${LOCAL_API}/runs`, { method: "POST", headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }, body: JSON.stringify(request), signal, cache: "no-store", credentials: "omit", redirect: "error" });
  if (!response.ok || !response.body || !response.headers.get("Content-Type")?.startsWith("application/x-ndjson")) { void response.body?.cancel().catch(() => {}); throw new Error("The foreground evaluation stream was not established."); }
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "", bytes = 0, started = false, finished = false, drained = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as RunEvent | { type: "heartbeat" };
    if (reflectsCredential(JSON.stringify(event), credential)) throw new Error("Unsafe application stream.");
    if (event.type === "heartbeat") return;
    if (event.type === "started") {
      if (started || !/^[A-Za-z0-9_-]{1,128}$/.test(event.runId) || !/^[A-Za-z0-9_-]{43}$/.test(event.accessCode)) throw new Error("Invalid start receipt.");
      started = true;
    } else if (event.type === "progress" || event.type === "finished") {
      if (!started || finished) throw new Error("Evaluation events are out of order.");
      if (event.type === "finished") finished = true;
    } else if (event.type === "error") throw new Error("Evaluation stream reported failure; inspect its retained private record.");
    else throw new Error("Unknown evaluation event.");
    onEvent(event);
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) { drained = true; break; }
      bytes += chunk.value.byteLength;
      if (bytes > 64 * 1024 * 1024) throw new Error("Evaluation progress exceeded its bounded stream budget.");
      buffer += decoder.decode(chunk.value, { stream: true });
      if (buffer.length > 4 * 1024 * 1024) throw new Error("Evaluation event exceeds its line budget.");
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
    if (!started || !finished) throw new Error("The evaluation stream ended without a terminal record.");
  } finally { if (!drained) void reader.cancel().catch(() => {}); }
}

export async function readPrivateRun(id: string, accessCode: string, credential?: string, signal = AbortSignal.timeout(20000)): Promise<RunView> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(accessCode)) throw new Error("Invalid private run receipt.");
  const response = await fetch(`${LOCAL_API}/runs/${id}`, { method: "GET", headers: { Authorization: `Bearer ${accessCode}` }, cache: "no-store", credentials: "omit", redirect: "error", signal });
  const view = await readApplicationJson(response, credential, signal) as RunView;
  if (view.record?.id !== id || view.record.version !== "1") throw new Error("Private run identity did not match its receipt.");
  return view;
}

type SettledRunView = RunView & { readonly record: RunView["record"] & { readonly state: Exclude<RunState, "running" | "cancelling"> } };

export class PrivateRunSettlementError extends Error {
  constructor(reason: string) { super(`Private receipt retained; final execution settlement ${reason}. Inspect the original private run before further paid work.`); }
}

export async function readSettledPrivateRun(id: string, accessCode: string, credential?: string, timeoutMs = 20000): Promise<SettledRunView> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) throw new Error("Private settlement deadline must be between 1 and 20000 milliseconds.");
  // Already-started evidence gets an independent deadline; elapsed checks also cover synchronous parsing.
  const deadline = performance.now() + timeoutMs, signal = AbortSignal.timeout(timeoutMs);
  try {
    while (performance.now() < deadline) {
      const view = await readPrivateRun(id, accessCode, credential, signal);
      if (performance.now() >= deadline) break;
      const { state, progress } = view.record;
      if (!["running", "cancelling", "completed", "cancelled", "timed-out", "failed", "interrupted"].includes(state)
        || !Number.isSafeInteger(progress?.activeTrials) || progress.activeTrials < 0) throw new PrivateRunSettlementError("has an invalid state or active-trial count");
      if (state !== "running" && state !== "cancelling" && progress.activeTrials === 0) {
        if (performance.now() >= deadline) break;
        return view as SettledRunView;
      }
      await delay(250, undefined, { signal });
    }
    throw new PrivateRunSettlementError("did not finish within its read deadline");
  } catch (error) {
    if (error instanceof PrivateRunSettlementError) throw error;
    throw new PrivateRunSettlementError(signal.aborted || performance.now() >= deadline ? "did not finish within its read deadline" : "could not be read or verified");
  }
}
