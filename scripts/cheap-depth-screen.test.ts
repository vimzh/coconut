// Offline fixtures verify the small paid screen's selection, wire isolation and one-attempt accounting.
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelMetadata } from "../apps/api/src/discovery";
import type { Label } from "../apps/api/src/math";
import { sha256 } from "../apps/api/src/quality/data";
import type { ImportedCase } from "../apps/api/src/randomized/types";
import { acceptedIdentity, assertAttemptReplay, buildBody, executeAttempt, MODELS, operatorSha256, reconstructReport,
  scheduleRows, selectCases, SETTINGS, type Attempt, type ModelId, type Row } from "./cheap-depth-screen";

const DEPTHS = [5, 10, 20, 40, 80, 160, 320, 512] as const, LABELS = ["convex", "concave", "neither"] as const;
const credential = "sk-screen-offline-fixture-123456789";
const answer = (label: Label = "convex") => JSON.stringify({ label, explanation: "Offline accounting fixture." });

function population(): ImportedCase[] {
  return DEPTHS.flatMap((requestedDepth, d) => LABELS.flatMap((label, l) => Array.from({ length: 33 + Number(d % 3 === l) }, (_, n) => {
    const id = `screen-fixture-${requestedDepth}-${label}-${n}`;
    return { id, label, expression: `${label === "concave" ? "-x^2" : label === "convex" ? "x^2" : "x^3"}+${300 * d + 100 * l + n + 1}`,
      domain: { min: "-1", max: "1" }, referenceSha256: sha256({ reference: id }), coreHashes: [sha256({ core: id })],
      requestedDepth, actualDepth: requestedDepth + n % 2, astDepth: 2, nonlinearPath: 1, nodeCount: 4 };
  })));
}
function parentIds(cases: readonly ImportedCase[]): string[] {
  return cases.filter(task => task.requestedDepth < 320 || Number(task.id.split("-").at(-1)) <
    3 + Number(task.label === (task.requestedDepth === 320 ? "convex" : "concave"))).map(task => task.id);
}
function metadata(modelId: ModelId): ModelMetadata {
  return { modelId, canonicalId: null, displayName: "Offline fixture", providerModelId: null, servingProvider: null,
    providerDisplayName: null, routeStatus: null, hosted: "available", exactRoute: true,
    capabilities: { textInput: "supported", textOutput: "supported", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    structuredOutput: "unknown", contextWindow: null, maxOutputTokens: null, tokenParameter: "max_output_tokens", supportedParameters: null, pricing: null };
}
const task = population()[0];
function raw(modelId: ModelId, text = answer(), overrides: Record<string, unknown> = {}) {
  return { model: modelId, status: "completed", max_output_tokens: 8192, truncation: "disabled",
    ...(modelId === "gpt-5.6-luna" ? { reasoning: { effort: "none" } } : {}),
    output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }], ...overrides };
}
const infer = (modelId: ModelId, fetcher: Parameters<typeof executeAttempt>[6], signal = new AbortController().signal, onDispatch = async () => {}) =>
  executeAttempt(task, modelId, metadata(modelId), credential, signal, onDispatch, fetcher);

async function isolated(source: string, environment: Record<string, string> = {}) {
  const root = await mkdtemp(join(tmpdir(), "cheap-screen-fixture-"));
  try {
    const imports = `import {executeAttempt} from ${JSON.stringify(new URL("./cheap-depth-screen.ts", import.meta.url).pathname)};
      const task=${JSON.stringify(task)},metadata=${JSON.stringify(metadata("gpt-4.1-mini"))},credential=${JSON.stringify(credential)},raw=${JSON.stringify(raw("gpt-4.1-mini"))};`;
    const child = Bun.spawn([process.execPath, "-e", imports + source], { cwd: root, env: { PATH: "/usr/bin:/bin", ...environment }, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(code).toBe(0); expect(stderr).toBe(""); return JSON.parse(stdout);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("selects the same balanced80 source-order cases, including the exact20 parent high cases", () => {
  const cases = population(), ids = parentIds(cases), original = structuredClone(cases), selected = selectCases(cases, ids);
  expect(ids).toHaveLength(620); expect(selected).toHaveLength(80); expect(cases).toEqual(original);
  expect(LABELS.map(label => selected.filter(task => task.label === label).length)).toEqual([27, 27, 26]);
  for (const [d, depth] of DEPTHS.entries()) {
    const rows = selected.filter(task => task.requestedDepth === depth); expect(rows).toHaveLength(10);
    expect(LABELS.map(label => rows.filter(task => task.label === label).length)).toEqual(LABELS.map((_label, l) => 3 + Number(d % 3 === l)));
    const expected = cases.filter(task => task.requestedDepth === depth && Number(task.id.split("-").at(-1)) < 3 + Number(LABELS[d % 3] === task.label));
    expect(rows.map(task => task.id)).toEqual(expected.map(task => task.id));
    if (depth >= 320) expect(rows.map(task => task.id)).toEqual(ids.filter(id => cases.find(task => task.id === id)!.requestedDepth === depth));
  }
  expect(() => selectCases(cases.slice(1), ids)).toThrow();
  expect(() => selectCases(cases, ids.slice(1))).toThrow();
  expect(() => selectCases(cases, [...ids.slice(1), ids[1]])).toThrow();
});

test("freezes8192/180s and keeps labels, certificates, identifiers and requested depths out of messages", async () => {
  expect(Bun.version).toBe("1.4.4");
  expect(MODELS.map(({ modelId, reasoningEffort }) => ({ modelId, reasoningEffort }))).toEqual([
    { modelId: "gpt-4.1-mini", reasoningEffort: null }, { modelId: "gpt-4o-mini", reasoningEffort: null }, { modelId: "gpt-5.6-luna", reasoningEffort: "none" }]);
  expect(SETTINGS).toMatchObject({ maxOutputTokens: 8192, inferenceTimeoutMs: 180000, retries: 0 });
  expect(Object.isFrozen(SETTINGS)).toBe(true); expect(Object.isFrozen(MODELS)).toBe(true);
  for (const model of MODELS) {
    const body = buildBody(task, model.modelId), text = JSON.stringify(body);
    expect(body).toMatchObject({ model: model.modelId, max_output_tokens: 8192, store: false, truncation: "disabled" });
    if (model.reasoningEffort === null) expect(Object.hasOwn(body, "reasoning")).toBe(false);
    else expect(body).toHaveProperty("reasoning", { effort: "none" });
    expect(text).not.toContain(task.id); expect(text).not.toContain(task.referenceSha256); expect(text).not.toContain(task.coreHashes[0]);
    expect(buildBody({ ...task, id: "changed", label: "neither", requestedDepth: 512, referenceSha256: sha256("changed") }, model.modelId)).toEqual(body);
  }
  const expectedHash = createHash("sha256").update(await readFile(new URL("./cheap-depth-screen.ts", import.meta.url))).digest("hex");
  expect(await operatorSha256()).toBe(expectedHash);
});

for (const model of ["gpt-4.1-mini", "gpt-4o-mini", "gpt-5.6-luna"] as const) test(`one exact isolated wire request and replay for ${model}`, async () => {
  let sent = 0, retained = false;
  const result = await infer(model, async (url, options) => {
    sent++; expect(retained).toBe(true); expect(url).toBe("https://api.openai.com/v1/responses");
    expect(options).toMatchObject({ method: "POST", redirect: "manual", credentials: "omit", timeout: false });
    expect(options.headers).toEqual({ Authorization: `Bearer ${credential}`, "Content-Type": "application/json" });
    expect(JSON.parse(String(options.body))).toEqual(buildBody(task, model)); return Response.json(raw(model));
  }, new AbortController().signal, async () => { retained = true; });
  expect(sent).toBe(1); expect(result).toMatchObject({ inferenceTimeoutMs: 180000, inferenceRequests: 1, failure: null, httpStatus: 200,
    normalized: { effective: { maxOutputTokens: 8192, reasoningEffort: model === "gpt-5.6-luna" ? "none" : null } }, outcome: { kind: "answer", label: "convex" } });
  expect(() => assertAttemptReplay(result, model, metadata(model))).not.toThrow();
  expect(() => assertAttemptReplay({ ...result, outcome: { ...result.outcome, kind: "invalid" } } as Attempt, model, metadata(model))).toThrow();
});

test("waits for dispatch persistence and sends zero requests when persistence or inherited cancellation prevents wire", async () => {
  let sent = 0, entered = false; const gate = Promise.withResolvers<void>();
  const pending = infer("gpt-4.1-mini", async () => { sent++; return Response.json(raw("gpt-4.1-mini")); }, new AbortController().signal,
    async () => { entered = true; await gate.promise; });
  await Bun.sleep(10); expect(entered).toBe(true); expect(sent).toBe(0); gate.resolve(); await pending; expect(sent).toBe(1);
  await expect(infer("gpt-4.1-mini", async () => { sent++; return Response.json(raw("gpt-4.1-mini")); }, new AbortController().signal,
    async () => { throw new Error("Synthetic persistence failure"); })).rejects.toThrow(); expect(sent).toBe(1);
  const stopped = new AbortController(); stopped.abort(); let retained = 0;
  const cancelled = await infer("gpt-4.1-mini", async () => { sent++; return Response.json(raw("gpt-4.1-mini")); }, stopped.signal, async () => { retained++; });
  expect(cancelled).toMatchObject({ inferenceRequests: 0, failure: { code: "cancelled", remoteOutcome: "not-sent" } }); expect(sent).toBe(1); expect(retained).toBe(0);
});

test("isolates ambient credentials, routing, organization, project, custom headers and debug logging", async () => {
  const result = await isolated(`let wire;const result=await executeAttempt(task,"gpt-4.1-mini",metadata,credential,new AbortController().signal,async()=>{},async(url,options)=>{
    wire={url,headers:options.headers};return Response.json(raw);});process.stdout.write(JSON.stringify({wire,failure:result.failure}));`,
  { OPENAI_API_KEY: "ambient-test-key", OPENAI_ADMIN_KEY: "ambient-test-admin", OPENAI_ORG_ID: "ambient-org", OPENAI_PROJECT_ID: "ambient-project",
    OPENAI_BASE_URL: "https://untrusted.invalid/v1", OPENAI_CUSTOM_HEADERS: "Invalid Header: private", OPENAI_LOG: "debug" });
  expect(result).toEqual({ wire: { url: "https://api.openai.com/v1/responses", headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" } }, failure: null });
  expect(JSON.stringify(result)).not.toContain("ambient-");
});

test("never retries provider/network failures and preserves unknown remote cancellation", async () => {
  for (const [status, code] of [[401, "authentication-rejected"], [429, "rate-limited"], [503, "service-unavailable"], [302, "redirect-blocked"]] as const) {
    let sent = 0; const result = await infer("gpt-4.1-mini", async () => { sent++; return Response.json({ error: { message: "Synthetic private error" } }, { status }); });
    expect(sent).toBe(1); expect(result.failure).toEqual({ code, remoteOutcome: "response-received" });
  }
  let sent = 0; const network = await infer("gpt-4.1-mini", async () => { sent++; throw new Error(credential); });
  expect(sent).toBe(1); expect(network.failure).toEqual({ code: "network-error", remoteOutcome: "unknown" }); expect(JSON.stringify(network)).not.toContain(credential);
  const abort = new AbortController(); const cancelled = await infer("gpt-4.1-mini", async () => { sent++; abort.abort(); throw new Error(credential); }, abort.signal);
  expect(sent).toBe(2); expect(cancelled.failure).toEqual({ code: "cancelled", remoteOutcome: "unknown" });
});

test("bounds response bytes, rejects malformedUTF8 and discards reflected credentials", async () => {
  let cancelled = 0;
  const oversized = await infer("gpt-4.1-mini", async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1048577)); }, cancel() { cancelled++; },
  })));
  expect(oversized.failure?.code).toBe("response-too-large"); expect(oversized.rawResponse).toBeNull(); expect(cancelled).toBe(1);
  const malformed = await infer("gpt-4.1-mini", async () => new Response(new Uint8Array([0xc3, 0x28])));
  expect(malformed.failure?.code).toBe("invalid-provider-response");
  const reflected = await infer("gpt-4.1-mini", async () => Response.json(raw("gpt-4.1-mini", credential)));
  expect(reflected.failure?.code).toBe("credential-reflection"); expect(reflected.rawResponse).toBeNull(); expect(reflected.normalized).toBeNull();
  expect(JSON.stringify(reflected)).not.toContain(credential);
});

test("enforces180s deadlines and keeps truncations, invalid JSON and identity acceptance distinct", async () => {
  const timeout = await isolated(`const original=setTimeout;const deadlines=[];globalThis.setTimeout=(fn,ms,...args)=>{if(ms===180000){deadlines.push(ms);return original(fn,10,...args);}return original(fn,ms,...args);};
    const result=await executeAttempt(task,"gpt-4.1-mini",metadata,credential,new AbortController().signal,async()=>{},async()=>new Response(new ReadableStream({start(){},cancel(){}})));
    process.stdout.write(JSON.stringify({deadlines,requests:result.inferenceRequests,failure:result.failure}));`);
  expect(timeout.deadlines.length).toBeGreaterThan(0); expect(timeout.deadlines.every((value: number) => value === 180000)).toBe(true);
  expect(timeout).toMatchObject({ requests: 1, failure: { code: "timeout", remoteOutcome: "unknown" } });
  const truncated = await infer("gpt-5.6-luna", async () => Response.json(raw("gpt-5.6-luna", "", { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } })));
  expect(truncated.failure).toBeNull(); expect(truncated.outcome.kind).toBe("truncated");
  const invalid = await infer("gpt-4o-mini", async () => Response.json(raw("gpt-4o-mini", "not-json")));
  expect(invalid.failure).toBeNull(); expect(invalid.outcome.kind).toBe("invalid");
  for (const changed of [{ max_output_tokens: 16384 }, { truncation: "auto" }, { reasoning: { effort: "low" } }, { reasoning: null },
    { usage: { input_tokens: 5, output_tokens: 8193, total_tokens: 8198 } }]) {
    const mismatch = await infer("gpt-5.6-luna", async () => Response.json(raw("gpt-5.6-luna", answer(), changed)));
    expect(mismatch.failure).toEqual({ code: "invalid-provider-response", remoteOutcome: "response-received" });
  }
  for (const modelId of ["gpt-4.1-mini", "gpt-4o-mini"] as const) {
    const explicitNone = await infer(modelId, async () => Response.json(raw(modelId, answer(), { reasoning: { effort: "none" } })));
    expect(explicitNone.failure).toBeNull(); expect(explicitNone.normalized?.effective.reasoningEffort).toBe("none");
  }
  for (const model of MODELS) { expect(acceptedIdentity(model.modelId, model.modelId)).toBe(true); expect(acceptedIdentity(model.modelId, "unrelated-model")).toBe(false); expect(acceptedIdentity(model.modelId, null)).toBe(false); }
});

function cohort() { const parent = population(); return selectCases(parent, parentIds(parent)); }
function freshRows(cases: readonly ImportedCase[]): Row[] {
  return cases.flatMap(task => MODELS.map(model => ({ modelId: model.modelId, caseId: task.id, trialIndex: 0, dispatch: null, result: null })));
}
function authorize(rows: Row[], index: number, cases: readonly ImportedCase[], result: Attempt) {
  const row = rows[index], task = cases.find(task => task.id === row.caseId)!;
  row.dispatch = { studyId: "screen-offline-study", ordinal: rows.filter(row => row.dispatch !== null).length + 1, modelId: row.modelId, caseId: task.id, trialIndex: 0,
    referenceSha256: task.referenceSha256, requestBodySha256: sha256(buildBody(task, row.modelId)), authorizedAt: result.startedAt, remoteOutcomeUntilRetained: "unknown" };
}
async function attempts() {
  return Object.fromEntries(await Promise.all(MODELS.map(async model => [model.modelId,
    await infer(model.modelId, async () => Response.json(raw(model.modelId)))]))) as Record<ModelId, Attempt>;
}

test("runs first scored compatibility cells sequentially, then at most24, retaining wrong/invalid without stopping", async () => {
  const cases = cohort(), rows = freshRows(cases), responses = await attempts(), starts: number[] = [], events: string[] = [];
  const invalid = await infer("gpt-4.1-mini", async () => Response.json(raw("gpt-4.1-mini", "not-json")));
  const release = Promise.withResolvers<void>(), filled = Promise.withResolvers<void>(); let active = 0, peak = 0, poolStarts = 0;
  const pending = scheduleRows(rows, { persistControl: async event => { events.push(event.kind); }, execute: async index => {
    active++; peak = Math.max(peak, active); starts.push(index);
    if (index < 3) expect(active).toBe(1);
    else { if (++poolStarts === 24) filled.resolve(); await release.promise; }
    const result = index === 0 || index === 3 ? invalid : responses[rows[index].modelId]; authorize(rows, index, cases, result); active--; return result;
  } });
  await filled.promise; expect(starts.slice(0, 3)).toEqual([0, 1, 2]); expect(starts).toHaveLength(27); expect(active).toBe(24); release.resolve();
  const state = await pending;
  expect(state).toMatchObject({ stopped: false, failures: 0 }); expect(peak).toBe(24); expect(active).toBe(0);
  expect(starts).toHaveLength(240); expect(new Set(starts).size).toBe(240); expect(events).toEqual(["model-pin", "model-pin", "model-pin"]);
  expect(rows[0].result?.outcome.kind).toBe("invalid"); expect(rows[3].result?.outcome.kind).toBe("invalid"); expect(rows.every(row => row.result !== null)).toBe(true);
  let resent = 0; await expect(scheduleRows(rows, { execute: async () => { resent++; return responses["gpt-4.1-mini"]; } })).rejects.toThrow(); expect(resent).toBe(0);
});

test("a first identity failure disables only that model and never substitutes another served identity", async () => {
  const cases = cohort(), rows = freshRows(cases), responses = await attempts(), starts: number[] = [];
  const unknown = await infer("gpt-4.1-mini", async () => Response.json(raw("gpt-4.1-mini", answer(), { model: "unrelated-model" })));
  expect(unknown.failure).toBeNull(); expect(unknown.normalized?.reportedModelId).toBe("unrelated-model");
  const result = await scheduleRows(rows, { execute: async index => {
    starts.push(index); const result = index === 0 ? unknown : responses[rows[index].modelId]; authorize(rows, index, cases, result); return result;
  } });
  expect(starts.filter(index => rows[index].modelId === "gpt-4.1-mini")).toEqual([0]);
  expect(starts.filter(index => rows[index].modelId === "gpt-4o-mini")).toHaveLength(80);
  expect(starts.filter(index => rows[index].modelId === "gpt-5.6-luna")).toHaveLength(80);
  expect(result.pins["gpt-4.1-mini"]).toBeNull(); expect(result.failures).toBe(1); expect(rows[0].result).toEqual(unknown);
});

test("provider failure or midstream identity drift stops fresh calls and drains the24 authorized peers without retries", async () => {
  const cases = cohort(), responses = await attempts();
  for (const failure of [await infer("gpt-4.1-mini", async () => { throw new Error("Synthetic network fixture"); }),
    await infer("gpt-4.1-mini", async () => Response.json(raw("gpt-4.1-mini", answer(), { model: "gpt-4.1-mini-2025-04-14" })))]) {
    const rows = freshRows(cases), starts: number[] = [], filled = Promise.withResolvers<void>(), fail = Promise.withResolvers<void>(), drain = Promise.withResolvers<void>();
    let active = 0, poolStarts = 0;
    const pending = scheduleRows(rows, { execute: async index => {
      starts.push(index); active++;
      if (index >= 3) { if (++poolStarts === 24) filled.resolve(); if (index === 3) await fail.promise; else await drain.promise; }
      const result = index === 3 ? failure : responses[rows[index].modelId]; authorize(rows, index, cases, result); active--; return result;
    } });
    await filled.promise; expect(starts).toHaveLength(27); fail.resolve(); await Bun.sleep(0); expect(starts).toHaveLength(27);
    drain.resolve(); const state = await pending;
    expect(state).toMatchObject({ stopped: true, failures: 1 }); expect(active).toBe(0); expect(new Set(starts).size).toBe(27);
    expect(rows.filter(row => row.result !== null)).toHaveLength(27); expect(rows[3].result).toEqual(failure);
  }
});

test("a persistence rejection stops fresh scheduling while authorized peer wires remain live and finish", async () => {
  const cases = cohort(), rows = freshRows(cases), responses = await attempts(), starts: number[] = [];
  const stopFresh = new AbortController(), wire = new AbortController(), filled = Promise.withResolvers<void>(), fail = Promise.withResolvers<void>(), drain = Promise.withResolvers<void>();
  let active = 0, poolStarts = 0, stopCalls = 0;
  const operation = scheduleRows(rows, { signal: stopFresh.signal, abort: () => { stopCalls++; stopFresh.abort(); }, execute: async index => {
    starts.push(index);
    if (index >= 3) {
      active++; if (++poolStarts === 24) filled.resolve();
      try {
        if (index === 3) { await fail.promise; throw new Error("Synthetic receipt persistence failure"); }
        authorize(rows, index, cases, responses[rows[index].modelId]);
        await Promise.race([drain.promise, new Promise<never>((_resolve, reject) => wire.signal.addEventListener("abort", () => reject(new Error("Authorized peer was aborted")), { once: true }))]);
        expect(wire.signal.aborted).toBe(false);
      } finally { active--; }
    } else authorize(rows, index, cases, responses[rows[index].modelId]);
    return responses[rows[index].modelId];
  } });
  void operation.catch(() => {});
  await filled.promise; expect(starts).toHaveLength(27); fail.resolve(); await Bun.sleep(0);
  expect(stopFresh.signal.aborted).toBe(true); expect(wire.signal.aborted).toBe(false); expect(active).toBe(23); expect(starts).toHaveLength(27);
  drain.resolve(); await expect(operation).rejects.toThrow("Synthetic receipt persistence failure");
  expect(stopCalls).toBe(1); expect(active).toBe(0); expect(starts).toHaveLength(27); expect(new Set(starts).size).toBe(27);
  expect(rows.filter(row => row.result !== null)).toHaveLength(26); expect(rows[3].dispatch).toBeNull();
});

test("reconstructs fixed-three-class metrics independently and separates infrastructure, missing and identity drift", async () => {
  const cases = cohort(), rows = freshRows(cases), responses = await attempts();
  for (const index of [0, 1, 2]) { authorize(rows, index, cases, responses[rows[index].modelId]); rows[index].result = responses[rows[index].modelId]; }
  const eligible = (label: Label) => rows.map((row, index) => ({ row, index })).filter(({ row }) => row.modelId === "gpt-4.1-mini" && !row.dispatch && cases.find(task => task.id === row.caseId)!.label === label);
  const wrong = eligible("concave")[0].index, [unusable, infrastructure, missing, drift] = eligible("neither").slice(0, 4).map(row => row.index);
  const invalid = await infer("gpt-4.1-mini", async () => Response.json(raw("gpt-4.1-mini", "not-json")));
  const network = await infer("gpt-4.1-mini", async () => { throw new Error("Synthetic network fixture"); });
  for (const [index, result] of [[wrong, responses["gpt-4.1-mini"]], [unusable, invalid], [infrastructure, network]] as const) { authorize(rows, index, cases, result); rows[index].result = result; }
  authorize(rows, missing, cases, responses["gpt-4.1-mini"]);
  const report = reconstructReport(cases, rows, true), model = report.models.find(model => model.modelId === "gpt-4.1-mini")!;
  expect(model.overall).toMatchObject({ planned: 80, dispatched: 5, modelOutcomes: 3, correct: 1, wrongValid: 1, unusable: 1, providerFailures: 2, unknownRemote: 2, inFlight: 0, unattempted: 75, accuracy: 1 / 3 });
  expect(model.overall.macroF1).toBeCloseTo(2 / 9, 12); expect(model.byDepth.map(depth => depth.score.planned)).toEqual(DEPTHS.map(() => 10));
  const live = reconstructReport(cases, rows, false).models.find(model => model.modelId === "gpt-4.1-mini")!;
  expect(live.overall).toMatchObject({ providerFailures: 1, unknownRemote: 1, inFlight: 1 });
  const changed = await infer("gpt-4.1-mini", async () => Response.json(raw("gpt-4.1-mini", answer(), { model: "gpt-4.1-mini-2025-04-14" })));
  expect(acceptedIdentity("gpt-4.1-mini", changed.normalized!.reportedModelId)).toBe(true);
  authorize(rows, drift, cases, changed); rows[drift].result = changed;
  expect(() => assertAttemptReplay(changed, "gpt-4.1-mini", metadata("gpt-4.1-mini"))).not.toThrow();
  const withDrift = reconstructReport(cases, rows, true).models.find(model => model.modelId === "gpt-4.1-mini")!;
  expect(withDrift.overall).toMatchObject({ modelOutcomes: 3, correct: 1, wrongValid: 1, unusable: 1, providerFailures: 3, identityFailures: 1, unknownRemote: 2 });
  expect(withDrift.overall.macroF1).toBeCloseTo(2 / 9, 12); expect(rows[drift].result?.rawResponse).toEqual(changed.rawResponse);
});

test("rejects altered reference/request/ordinal/result bindings and unknown or repeated planned cells", async () => {
  const cases = cohort(), rows = freshRows(cases), responses = await attempts();
  for (const index of [0, 1, 2]) { authorize(rows, index, cases, responses[rows[index].modelId]); rows[index].result = responses[rows[index].modelId]; }
  expect(() => reconstructReport(cases, rows, true)).not.toThrow();
  for (const changed of [{ referenceSha256: sha256("changed") }, { requestBodySha256: sha256("changed") }, { ordinal: 2 }, { ordinal: 4 },
    { caseId: "unknown-fixture" }, { studyId: "different-fixture" }]) {
    const tampered = structuredClone(rows); tampered[0].dispatch = { ...tampered[0].dispatch!, ...changed };
    expect(() => reconstructReport(cases, tampered, true)).toThrow();
  }
  const alteredResult = structuredClone(rows); alteredResult[0].result = { ...alteredResult[0].result!, outcome: { ...alteredResult[0].result!.outcome, kind: "invalid" } } as Attempt;
  expect(() => reconstructReport(cases, alteredResult, true)).toThrow();
  const repeated = structuredClone(rows); repeated[1] = repeated[0]; expect(() => reconstructReport(cases, repeated, true)).toThrow();
  const unknown = structuredClone(rows); unknown[1] = { ...unknown[1], caseId: "unknown-fixture" }; expect(() => reconstructReport(cases, unknown, true)).toThrow();
  expect(() => reconstructReport(cases.slice(1), rows, true)).toThrow();
});
