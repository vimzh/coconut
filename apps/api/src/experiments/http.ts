// Development orchestration uses the same foreground HTTP stream and private access boundary as visitors.
import { reflectsCredential } from "../providers/responses";
import type { RunEvent, RunRequest, RunView } from "../runs/types";

export const LOCAL_API = "http://localhost:3201";
export async function readApplicationJson(response: Response, credential?: string): Promise<unknown> {
  if (!response.ok || !response.body) { void response.body?.cancel().catch(() => {}); throw new Error(`Application request failed with HTTP ${response.status}.`); }
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, text = "", drained = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) { drained = true; break; }
      bytes += chunk.value.byteLength;
      if (bytes > 256 * 1024 * 1024) throw new Error("Retained run exceeds the application export budget.");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const parsed: unknown = JSON.parse(text);
    if (credential && reflectsCredential(JSON.stringify(parsed), credential)) throw new Error("Unsafe application evidence.");
    return parsed;
  } finally { if (!drained) void reader.cancel().catch(() => {}); }
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

export async function readPrivateRun(id: string, accessCode: string, credential?: string): Promise<RunView> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(accessCode)) throw new Error("Invalid private run receipt.");
  const response = await fetch(`${LOCAL_API}/runs/${id}`, { headers: { Authorization: `Bearer ${accessCode}` }, cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) });
  const view = await readApplicationJson(response, credential) as RunView;
  if (view.record?.id !== id || view.record.version !== "1") throw new Error("Private run identity did not match its receipt.");
  return view;
}
