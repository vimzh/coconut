// Fixed run operations keep provider keys, private access, and retained evidence separate.
import type { ProviderId } from "./provider-types";

export type RunSuiteKey = "reference-v1" | "smooth-v2" | "challenge-v1" | "screening-v1" | "interior-v1";
export type RunState = "running" | "cancelling" | "completed" | "cancelled" | "timed-out" | "failed" | "interrupted";
export interface RunRequest {
  readonly suiteKey: RunSuiteKey;
  readonly provider: ProviderId;
  readonly modelId: string;
  readonly servingProvider: string | null;
  readonly profileId: string;
  readonly concurrency: number;
  readonly acceptCharges: true;
}
export interface RunProgress {
  readonly plannedTrials: number;
  readonly startedTrials: number;
  readonly activeTrials: number;
  readonly finishedTrials: number;
  readonly modelOutcomes: number;
  readonly infrastructureFailures: number;
  readonly remainingTrials: number;
  readonly inferenceRequests: number;
}
export interface RunPolicy {
  readonly version: "1";
  readonly policyId: "foreground-runs-v1";
  readonly trialsPerInstance: 3;
  readonly attemptsPerTrial: 1;
  readonly retries: 0;
  readonly maxConcurrency: number;
  readonly defaultConcurrency: number;
  readonly maxActiveRuns: number;
  readonly maxCases: number;
  readonly metadataTimeoutMs: number;
  readonly inferenceTimeoutMs: number;
  readonly runTimeoutMs: number;
  readonly retentionDays: number;
  readonly visibility: "private-until-explicit-publication";
  readonly resumption: "unsupported";
  readonly credentials: string;
  readonly charges: string;
  readonly cancellation: string;
}
export interface RunSuiteDescription {
  readonly key: RunSuiteKey;
  readonly name: string;
  readonly description: string;
  readonly suiteId: string;
  readonly caseCount: number;
  readonly depths: readonly number[];
  readonly generatorVersion: string;
  readonly promptVersion: string;
  readonly recommended: boolean;
}
export type RunEvent =
  | { readonly type: "started"; readonly runId: string; readonly accessCode: string; readonly progress: RunProgress; readonly expiresAt: string }
  | { readonly type: "progress"; readonly runId: string; readonly state: RunState; readonly progress: RunProgress }
  | { readonly type: "finished"; readonly runId: string; readonly state: RunState; readonly progress: RunProgress; readonly report: unknown }
  | { readonly type: "error"; readonly runId: string | null; readonly code: string; readonly message: string }
  | { readonly type: "heartbeat" };

const messages = {
  configuration: "The evaluation service address is invalid. Configure a secure API origin.",
  "invalid-input": "Check the run settings, charge acknowledgement, and required credential.",
  "network-error": "The connection failed. Inspect any retained run before starting another paid evaluation. No automatic retry was made.",
  cancelled: "The connection was cancelled. Dispatched work and provider charges may remain uncertain.",
  "http-error": "The evaluation service rejected this operation. Check access and run availability.",
  "unexpected-response": "The evaluation service returned an invalid or incomplete response. Inspect any retained run before starting another paid evaluation.",
  "response-too-large": "The evaluation response exceeded its permitted size and was discarded.",
};
export class RunApiError extends Error {
  constructor(readonly code: keyof typeof messages, readonly status: number | null = null) {
    super(messages[code]);
    this.name = "RunApiError";
  }
}

type Data = Record<string, unknown>;
const JSON_LIMIT = 64 * 1024 * 1024;
const EXPORT_LIMIT = 256 * 1024 * 1024;
const LINE_LIMIT = 4 * 1024 * 1024;
const suiteKeys = ["reference-v1", "smooth-v2", "challenge-v1", "screening-v1", "interior-v1"] as const;
const states = ["running", "cancelling", "completed", "cancelled", "timed-out", "failed", "interrupted"] as const;
function invalid(): never { throw new RunApiError("unexpected-response"); }
function data(value: unknown): Data {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Data : invalid();
}
function text(value: unknown, maximum = 1024): string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/\p{Cc}/u.test(value) ? value : invalid();
}
function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : invalid();
}
function positive(value: unknown): number { const result = count(value); return result > 0 ? result : invalid(); }
function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : invalid();
}
function timestamp(value: unknown): string {
  const result = text(value, 64); return Number.isFinite(Date.parse(result)) ? result : invalid();
}
function identifier(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value) ? value : invalid();
}
function fields(value: Data, expected: readonly string[]) {
  if (Object.keys(value).length !== expected.length || expected.some((key) => !Object.hasOwn(value, key))) invalid();
}
function apiOrigin(): string {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3201");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) throw new Error();
    return url.origin;
  } catch { throw new RunApiError("configuration"); }
}
function validateCredential(value: string, privateAccess = false): string {
  if (typeof value !== "string" || (privateAccess ? !/^[A-Za-z0-9_-]{43}$/.test(value) : value.length < 16 || value.length > 4096 || !/^[A-Za-z0-9._~+/-]+=*$/.test(value))) throw new RunApiError("invalid-input");
  return value;
}
function reflected(serialized: string, secret: string): boolean {
  return [secret, encodeURIComponent(secret), btoa(secret)].some((form) => serialized.includes(form));
}
function safeResult(value: unknown, credential: string | null): unknown {
  if (credential !== null && reflected(JSON.stringify(value), credential)) invalid();
  return value;
}
function safeError(error: unknown, signal?: AbortSignal): never {
  if (signal?.aborted) throw new RunApiError("cancelled");
  if (error instanceof RunApiError) throw error;
  throw new RunApiError("network-error");
}
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new RunApiError("cancelled"); }

// Each request owns its reader and signal; a cancellation request never aborts the run stream.
async function responseFor(path: string, method: "GET" | "POST" | "DELETE", body: unknown, credential: string | null, signal?: AbortSignal, stream = false): Promise<Response> {
  checkAbort(signal);
  const serialized = method === "POST" ? JSON.stringify(body) : undefined;
  if (credential !== null && serialized !== undefined && reflected(serialized, credential)) throw new RunApiError("invalid-input");
  const response = await fetch(`${apiOrigin()}${path}`, {
    method,
    headers: { Accept: stream ? "application/x-ndjson" : "application/json", ...(method === "POST" ? { "Content-Type": "application/json" } : {}), ...(credential === null ? {} : { Authorization: `Bearer ${credential}` }) },
    ...(serialized === undefined ? {} : { body: serialized }),
    credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal,
  });
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    throw new RunApiError("http-error", response.status);
  }
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== (stream ? "application/x-ndjson" : "application/json") || !response.body) {
    void response.body?.cancel().catch(() => {});
    invalid();
  }
  return response;
}
async function readBody(response: Response, maximum: number, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body!.getReader(), chunks: Uint8Array[] = [];
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  let size = 0;
  try {
    checkAbort(signal);
    while (true) {
      const next = await reader.read();
      checkAbort(signal);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) throw new RunApiError("response-too-large");
      chunks.push(next.value);
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
function parseJson(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)) as unknown; }
  catch { invalid(); }
}
async function requestJson(path: string, method: "GET" | "POST" | "DELETE", body: unknown, credential: string | null, signal?: AbortSignal): Promise<unknown> {
  try { return safeResult(parseJson(await readBody(await responseFor(path, method, body, credential, signal), JSON_LIMIT, signal)), credential); }
  catch (error) { safeError(error, signal); }
}

export async function loadRunPolicy(signal?: AbortSignal): Promise<RunPolicy> {
  const p = data(await requestJson("/runs/policy", "GET", null, null, signal));
  if (p.version !== "1" || p.policyId !== "foreground-runs-v1" || p.trialsPerInstance !== 3 || p.attemptsPerTrial !== 1 || p.retries !== 0 || p.visibility !== "private-until-explicit-publication" || p.resumption !== "unsupported") invalid();
  const result: RunPolicy = {
    version: "1", policyId: "foreground-runs-v1", trialsPerInstance: 3, attemptsPerTrial: 1, retries: 0,
    maxConcurrency: positive(p.maxConcurrency), defaultConcurrency: positive(p.defaultConcurrency), maxActiveRuns: positive(p.maxActiveRuns), maxCases: positive(p.maxCases),
    metadataTimeoutMs: positive(p.metadataTimeoutMs), inferenceTimeoutMs: positive(p.inferenceTimeoutMs), runTimeoutMs: positive(p.runTimeoutMs), retentionDays: positive(p.retentionDays),
    visibility: "private-until-explicit-publication", resumption: "unsupported", credentials: text(p.credentials), charges: text(p.charges), cancellation: text(p.cancellation),
  };
  if (result.maxConcurrency > 12 || result.defaultConcurrency > result.maxConcurrency || result.maxCases > 75) invalid();
  return result;
}
export async function loadRunSuites(signal?: AbortSignal): Promise<readonly RunSuiteDescription[]> {
  const response = data(await requestJson("/runs/suites", "GET", null, null, signal));
  if (response.version !== "1" || !Array.isArray(response.suites) || response.suites.length < 1 || response.suites.length > suiteKeys.length) invalid();
  const result = response.suites.map((value): RunSuiteDescription => {
    const s = data(value);
    if (!Array.isArray(s.depths) || s.depths.length < 1 || s.depths.length > 75 || typeof s.recommended !== "boolean") invalid();
    const depths = s.depths.map(count), caseCount = positive(s.caseCount);
    if (new Set(depths).size !== depths.length || caseCount > 75 || depths.length > caseCount) invalid();
    return { key: choice(s.key, suiteKeys), name: text(s.name), description: text(s.description), suiteId: text(s.suiteId), caseCount, depths, generatorVersion: text(s.generatorVersion), promptVersion: text(s.promptVersion), recommended: s.recommended };
  });
  if (new Set(result.map((s) => s.key)).size !== result.length) invalid();
  return result;
}
function progress(value: unknown): RunProgress {
  const p = data(value);
  const result: RunProgress = {
    plannedTrials: positive(p.plannedTrials),
    startedTrials: count(p.startedTrials),
    activeTrials: count(p.activeTrials),
    finishedTrials: count(p.finishedTrials),
    modelOutcomes: count(p.modelOutcomes),
    infrastructureFailures: count(p.infrastructureFailures),
    remainingTrials: count(p.remainingTrials),
    inferenceRequests: count(p.inferenceRequests),
  };
  if (
    result.plannedTrials > 225 ||
    result.startedTrials > result.plannedTrials ||
    result.activeTrials > 12 ||
    result.finishedTrials + result.activeTrials > result.startedTrials ||
    result.remainingTrials !== result.plannedTrials - result.finishedTrials ||
    result.modelOutcomes + result.infrastructureFailures !== result.finishedTrials ||
    result.inferenceRequests > result.finishedTrials
  ) invalid();
  return result;
}
function runInput(input: RunRequest): RunRequest {
  try {
    const r = data(input);
    fields(r, ["suiteKey", "provider", "modelId", "servingProvider", "profileId", "concurrency", "acceptCharges"]);
    const provider = choice(r.provider, ["openai", "openrouter", "hugging-face"] as const),
      modelId = text(r.modelId, 256),
      servingProvider = r.servingProvider === null ? null : text(r.servingProvider, 128),
      profileId = text(r.profileId, 80),
      concurrency = positive(r.concurrency);
    if (
      r.acceptCharges !== true || concurrency > 12 ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(modelId) ||
      modelId.split("/").some((part) => part === "" || part === "." || part === "..") ||
      (provider !== "openai" && (modelId.split("/").length !== 2 || modelId.includes(":"))) ||
      (provider === "openai" && servingProvider !== null) ||
      (provider !== "openai" && servingProvider === null) ||
      (servingProvider !== null && (
        !/^[a-z0-9][a-z0-9._/-]*$/.test(servingProvider) ||
        ["auto", "fastest", "cheapest", "preferred"].includes(servingProvider) ||
        servingProvider.split("/").some((part) => part === "" || part === "." || part === "..")
      )) ||
      !/^one-shot-(json|schema)-(v1|v2-(none|minimal|low|medium|high|xhigh|max))$/.test(profileId) ||
      (provider !== "openai" && profileId.includes("-v2-"))
    ) throw new Error();
    return { suiteKey: choice(r.suiteKey, suiteKeys), provider, modelId, servingProvider, profileId, concurrency, acceptCharges: true };
  } catch { throw new RunApiError("invalid-input"); }
}

export async function startRun(input: RunRequest, key: string, onEvent: (event: RunEvent) => void, signal?: AbortSignal): Promise<void> {
  try {
    const request = runInput(input), credential = validateCredential(key);
    const response = await responseFor("/runs", "POST", request, credential, signal, true), reader = response.body!.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    const abort = () => { void reader.cancel().catch(() => {}); };
    signal?.addEventListener("abort", abort, { once: true });
    let bytes = 0, lineBytes = 0, line = "", runId: string | null = null, accessCode: string | null = null;
    let previous: RunProgress | null = null, terminal: "finished" | "error" | null = null;
    const consume = (source: string) => {
      let value: unknown;
      try { value = JSON.parse(source); } catch { invalid(); }
      safeResult(value, credential);
      const event = data(value);
      if (event.type !== "started" && accessCode !== null) safeResult(event, accessCode);
      if (event.type === "heartbeat") {
        fields(event, ["type"]);
        if (terminal !== null) invalid();
        onEvent({ type: "heartbeat" }); return;
      }
      if (event.type === "error") {
        fields(event, ["type", "runId", "code", "message"]);
        if (terminal === "finished" || (event.runId !== null && identifier(event.runId) !== runId) || typeof event.message !== "string") invalid();
        const code = text(event.code, 64);
        if (!/^[a-z][a-z0-9-]*$/.test(code)) invalid();
        // The server can emit its operation error and then its stream-level error.
        if (terminal === null) onEvent({ type: "error", runId, code, message: "The evaluation could not finish. Inspect any retained private record before starting another paid run." });
        terminal = "error"; return;
      }
      if (terminal !== null) invalid();
      const id = identifier(event.runId), current = progress(event.progress);
      if (previous !== null && (current.plannedTrials !== previous.plannedTrials || (["startedTrials", "finishedTrials", "modelOutcomes", "infrastructureFailures", "inferenceRequests"] as const).some((field) => current[field] < previous![field]))) invalid();
      if (event.type === "started") {
        fields(event, ["type", "runId", "accessCode", "progress", "expiresAt"]);
        if (runId !== null || typeof event.accessCode !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(event.accessCode)) invalid();
        if (reflected(id, event.accessCode)) invalid();
        runId = id; accessCode = event.accessCode;
        onEvent({ type: "started", runId: id, accessCode, progress: current, expiresAt: timestamp(event.expiresAt) });
      } else {
        if (id !== runId) invalid();
        const state = choice(event.state, states);
        if (event.type === "progress") {
          fields(event, ["type", "runId", "state", "progress"]);
          if (state !== "running" && state !== "cancelling") invalid();
          onEvent({ type: "progress", runId: id, state, progress: current });
        } else if (event.type === "finished") {
          fields(event, ["type", "runId", "state", "progress", "report"]);
          const report = data(event.report);
          if (state === "running" || state === "cancelling" || current.activeTrials !== 0 || (state === "completed" && (current.finishedTrials !== current.plannedTrials || current.infrastructureFailures !== 0)) || report.reportVersion !== "1" || data(report.identity).runId !== id) invalid();
          onEvent({ type: "finished", runId: id, state, progress: current, report });
          terminal = "finished";
        } else invalid();
      }
      previous = current;
    };
    try {
      checkAbort(signal);
      while (true) {
        const next = await reader.read();
        checkAbort(signal);
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > JSON_LIMIT) throw new RunApiError("response-too-large");
        let offset = 0;
        while (offset < next.value.byteLength) {
          const newline = next.value.indexOf(10, offset), end = newline === -1 ? next.value.byteLength : newline;
          const segment = next.value.subarray(offset, end);
          lineBytes += segment.byteLength;
          if (lineBytes > LINE_LIMIT) throw new RunApiError("response-too-large");
          try { line += decoder.decode(segment, { stream: true }); } catch { invalid(); }
          if (newline !== -1) {
            try { line += decoder.decode(); } catch { invalid(); }
            consume(line); line = ""; lineBytes = 0;
          }
          offset = end + 1;
        }
      }
      if (lineBytes !== 0 || terminal === null) invalid();
    } finally {
      signal?.removeEventListener("abort", abort);
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } catch (error) { safeError(error, signal); }
}

function privatePath(id: string, code: string): string {
  validateCredential(code, true);
  try { identifier(id); } catch { throw new RunApiError("invalid-input"); }
  if (reflected(id, code)) throw new RunApiError("invalid-input");
  return `/runs/${id}`;
}
function view(value: unknown, id: string): unknown {
  const envelope = data(value), meta = parseRunViewMeta(value);
  if (meta.id !== id) invalid();
  return { record: envelope.record, publishedAt: meta.publishedAt };
}
export function parseRunViewMeta(input: unknown): { id: string; state: RunState; expiresAt: string; progress: RunProgress; publishedAt: string | null } {
  const envelope = data(input), record = data(envelope.record);
  if (record.version !== "1") invalid();
  const state = choice(record.state, states), current = progress(record.progress);
  if ((state !== "running" && state !== "cancelling" && current.activeTrials !== 0) || (state === "completed" && (current.remainingTrials !== 0 || current.infrastructureFailures !== 0))) invalid();
  return { id: identifier(record.id), state, expiresAt: timestamp(record.expiresAt), progress: current, publishedAt: envelope.publishedAt === null ? null : timestamp(envelope.publishedAt) };
}
export async function cancelRun(id: string, accessCode: string, signal?: AbortSignal): Promise<{ cancellationRequested: boolean }> {
  const result = data(await requestJson(`${privatePath(id, accessCode)}/cancel`, "POST", {}, accessCode, signal));
  if (typeof result.cancellationRequested !== "boolean") invalid();
  return { cancellationRequested: result.cancellationRequested };
}
export async function loadPrivateRun(id: string, accessCode: string, signal?: AbortSignal): Promise<unknown> {
  return view(await requestJson(privatePath(id, accessCode), "GET", null, accessCode, signal), id);
}
export async function loadPublicRun(id: string, signal?: AbortSignal): Promise<unknown> {
  try { identifier(id); } catch { throw new RunApiError("invalid-input"); }
  const result = view(await requestJson(`/runs/${id}/public`, "GET", null, null, signal), id);
  if (data(result).publishedAt === null) invalid();
  return result;
}
export async function deleteRun(id: string, accessCode: string, signal?: AbortSignal): Promise<void> {
  const result = data(await requestJson(privatePath(id, accessCode), "DELETE", null, accessCode, signal));
  if (result.deleted !== true) invalid();
}
export async function exportRun(id: string, accessCode: string, signal?: AbortSignal): Promise<Blob> {
  const path = `${privatePath(id, accessCode)}/export`;
  try {
    const bytes = await readBody(await responseFor(path, "GET", null, accessCode, signal), EXPORT_LIMIT, signal);
    view(safeResult(parseJson(bytes), accessCode), id);
    return new Blob([bytes], { type: "application/json" });
  } catch (error) { safeError(error, signal); }
}
export async function setRunPublication(id: string, accessCode: string, published: boolean, signal?: AbortSignal): Promise<unknown> {
  if (typeof published !== "boolean") throw new RunApiError("invalid-input");
  const result = view(await requestJson(`${privatePath(id, accessCode)}/publication`, "POST", { published }, accessCode, signal), id);
  if ((data(result).publishedAt !== null) !== published) invalid();
  return result;
}
