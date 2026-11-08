// Injected HTTP and immutable documentary fixtures verify the research method without live inference or key reads.
import { beforeAll, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import OpenAI from "openai";
import type { InferenceRequest } from "../inference/types";
import { buildNumericalPrompts } from "../numerics";
import { qualityDataHash } from "../quality";
import { loadRunSuite } from "../runs/registry";
import { createLongReserveStudy, executeLongAttempt, freezeLongReserveStudy, LONG_RESERVE_DEADLINE_MS, LONG_RESERVE_STUDY_MS, parseLongReserveArguments,
  readLongBody, runLongReserveStudy, scheduleLongTrials, summarizeLongModel, type LongAttempt, type LongReserveAccounting, type LongReserveInputs, type LongTrial } from "./long-reserve";
import type { ReservePriorAccounting } from "./reserve-experiment";

let data: LongReserveInputs, request: InferenceRequest;
const credential = "sk-long-reserve-fixture-123456789";
const body = (text = '{"label":"convex","explanation":"Controlled fixture; no live inference."}') => ({ model: "gpt-6-astra", status: "completed", max_output_tokens: 16384, reasoning: { effort: "max" }, truncation: "disabled",
  output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }] });
beforeAll(async () => {
  const artifact = (path: string) => Bun.file(new URL(`../../../../${path}`, import.meta.url)).json(), prefix = "apps/api/data/experiments/";
  const earlier = await artifact(`${prefix}conditional-reserve-prior-accounting-v1.json`) as ReservePriorAccounting;
  const manifestPath = `${prefix}conditional-reserve-matrix-v1.json`, ledgerPath = `${prefix}conditional-reserve-progress-v1.json`, reconciliationPath = `${prefix}conditional-reserve-reconciliation-v1.json`, sendEvidencePath = `${prefix}conditional-reserve-send-evidence-v1.json`;
  const fifth = { key: "conditional-reserve" as const, manifest: await artifact(manifestPath), ledger: await artifact(ledgerPath), reconciliation: await artifact(reconciliationPath), sendEvidence: await artifact(sendEvidencePath) };
  const accounting: LongReserveAccounting = { ...earlier, checkedAt: new Date().toISOString(), studies: [...earlier.studies, { key: "conditional-reserve", manifestPath, manifestSha256: qualityDataHash(fifth.manifest), ledgerPath, ledgerSha256: qualityDataHash(fifth.ledger), reconciliationPath, reconciliationSha256: qualityDataHash(fifth.reconciliation), sendEvidencePath, sendEvidenceSha256: qualityDataHash(fifth.sendEvidence), inferenceRequests: 8, unknownRemoteInferenceRequests: 8 }], totalPriorInferenceRequests: 7746 };
  const decision = await artifact("apps/api/data/research/conditional-reserve-decision-v1.json"), suite = await loadRunSuite("reserve-v1", "one-shot-json-v2-max"); if (suite.generatorVersion !== "reserve-v1") throw new Error("Reserve fixture unavailable.");
  data = { accounting, decision, suite, baseSuiteId: (await loadRunSuite("reserve-v1", "one-shot-json-v1")).id, prompts: await buildNumericalPrompts(suite.cases.map(entry => entry.reference), "one-shot-json-v2-max", "smooth-v2"),
    controls: (await artifact(`${prefix}capabilities-v1.json`)).probes, amendment: await artifact("apps/api/data/research/conditional-reserve-amendment-v1.json"), review: await artifact("apps/api/data/quality/reserve-reference-review-v1.json"), proposalFileSha256: "766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85",
    p5Views: await Promise.all(decision.p5.cells.map((cell: { runId: string }) => artifact(`${prefix}interior-progress-v1-published/${cell.runId}.json`))),
    priorStudies: [...await Promise.all(earlier.studies.map(async study => ({ key: study.key, manifest: await artifact(study.manifestPath), ledger: await artifact(study.ledgerPath), reconciliation: await artifact(study.reconciliationPath), sendEvidence: await artifact(study.sendEvidencePath) }))), fifth] };
  request = { selection: { provider: "openai", modelId: "gpt-6-astra", servingProvider: null, profileId: "one-shot-json-v2-max", verification: "metadata" }, prompt: data.prompts[0], acceptCharges: true };
}, 30000);
const metadata = () => data.controls.find(control => control.modelId === "gpt-6-astra" && control.effort === "max")!.result.metadata!;
const trials = (): LongTrial[] => (["gpt-6-astra", "gpt-6.1-sol"] as const).flatMap(modelId => data.suite.cases.flatMap(entry => [0, 1, 2].map(trialIndex => ({ modelId, caseId: entry.id, trialIndex, state: "unattempted" as const, inferenceRequests: 0, result: null }))));

it("declares a separate 600-second research method and counts all five prior studies including eight unknown sends", () => {
  const manifest = createLongReserveStudy(data);
  expect(manifest).toMatchObject({ kind: "research-long-reserve-study", methodId: "long-reserve-v1", budget: { inferenceTimeoutMs: 600000, studyTimeoutMs: 5400000, maxNewInferenceRequests: 108, cumulativeInferenceCeiling: 7854, maxConcurrency: 8, concurrencyPerModel: 4, retries: 0 } });
  expect(manifest.cells.map(cell => cell.plannedTrials)).toEqual([54, 54]); expect(manifest.accounting.totalPriorInferenceRequests).toBe(7746);
  expect(() => createLongReserveStudy({ ...data, accounting: { ...data.accounting, totalPriorInferenceRequests: 7738 } })).toThrow("7746 prior sends");
  expect(() => createLongReserveStudy({ ...data, accounting: { ...data.accounting, studies: data.accounting.studies.slice(1) } })).toThrow("five terminal");
  const changed = data.priorStudies.map(source => source.key === "conditional-reserve" ? { ...source, ledger: { ...source.ledger, state: "running" } } : source);
  expect(() => createLongReserveStudy({ ...data, priorStudies: changed })).toThrow("deadline-censored");
  expect(() => createLongReserveStudy({ ...data, priorStudies: data.priorStudies.map(source => source.key === "conditional-reserve" ? { ...source, reconciliation: { ...source.reconciliation, kind: "aggregate-only" as typeof source.reconciliation.kind } } : source) })).toThrow("eight unknown sends");
  expect(() => createLongReserveStudy({ ...data, prompts: data.prompts.slice(1) })).toThrow("exact prompts");
});

it("uses one isolated SDK Responses POST only after dispatch retention, with exact settings and explicit 600s bounds", async () => {
  let retained = false, calls = 0;
  const result = await executeLongAttempt(request, metadata(), credential, new AbortController().signal, async () => { retained = true; }, async (url, options) => {
    calls++; expect(retained).toBe(true); expect(url).toBe("https://api.openai.com/v1/responses"); expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }); expect(options).toMatchObject({ redirect: "manual", credentials: "omit", timeout: false });
    const sent = JSON.parse(options.body as string); expect(sent).toEqual({ model: "gpt-6-astra", input: request.prompt.messages, max_output_tokens: 16384, store: false, truncation: "disabled", reasoning: { effort: "max" } });
    for (const token of ["case-reserve", "cluster-reserve", "analyticCertificate", "claimedLabel"]) expect(JSON.stringify(sent.input)).not.toContain(token);
    return Response.json(body());
  });
  expect(calls).toBe(1); expect(LONG_RESERVE_DEADLINE_MS).toBe(600000); expect(LONG_RESERVE_STUDY_MS).toBe(5400000);
  expect(result).toMatchObject({ methodId: "long-reserve-v1", inferenceTimeoutMs: 600000, inferenceRequests: 1, failure: null, outcome: { kind: "answer", label: "convex" } });
  expect(result).not.toHaveProperty("budget"); expect(result).not.toHaveProperty("report");
});

it("ignores ambient SDK credentials, organization/project, custom headers, endpoints and logging in an isolated child", async () => {
  const root = await mkdtemp(join(tmpdir(), "long-sdk-env-"));
  try {
    const modulePath = new URL("./long-reserve.ts", import.meta.url).pathname;
    const script = `import {executeLongAttempt} from ${JSON.stringify(modulePath)};let wire;const r=await executeLongAttempt(${JSON.stringify(request)},${JSON.stringify(metadata())},${JSON.stringify(credential)},new AbortController().signal,async()=>{},async(url,options)=>{wire={url,headers:options.headers};return Response.json(${JSON.stringify(body())});});process.stdout.write(JSON.stringify({wire,failure:r.failure}));`;
    const child = Bun.spawn([process.execPath, "-e", script], { cwd: root, env: { PATH: "/usr/bin:/bin", OPENAI_API_KEY: "ambient-fixture-key", OPENAI_ADMIN_KEY: "ambient-fixture-admin", OPENAI_ORG_ID: "ambient-org", OPENAI_PROJECT_ID: "ambient-project", OPENAI_BASE_URL: "https://untrusted.invalid/v1", OPENAI_CUSTOM_HEADERS: "Invalid Header: ambient-private", OPENAI_LOG: "debug" }, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(code).toBe(0); expect(stderr).toBe(""); expect(JSON.parse(stdout)).toEqual({ wire: { url: "https://api.openai.com/v1/responses", headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" } }, failure: null });
    expect(stdout).not.toContain("ambient-");
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("never retries HTTP, network, timeout or peer cancellation and never calls a timeout a wrong label", async () => {
  for (const [status, code] of [[401, "authentication-rejected"], [429, "rate-limited"], [503, "service-unavailable"]] as const) {
    let calls = 0; const result = await executeLongAttempt(request, metadata(), credential, new AbortController().signal, async () => {}, async () => { calls++; return Response.json({ error: { code: "fixture", message: "private failure" } }, { status }); });
    expect(calls).toBe(1); expect(result.failure?.code).toBe(code); expect(result.outcome.kind).toBe("provider-error");
  }
  let calls = 0; const timed = await executeLongAttempt(request, metadata(), credential, new AbortController().signal, async () => {}, async () => { calls++; throw new OpenAI.APIConnectionTimeoutError(); });
  expect(calls).toBe(1); expect(timed.failure).toEqual({ code: "timeout", remoteOutcome: "unknown" }); expect(timed.outcome.kind).toBe("provider-error");
  const peer = new AbortController(); const cancelled = await executeLongAttempt(request, metadata(), credential, peer.signal, async () => {}, async () => { peer.abort(); throw new Error(credential); });
  expect(cancelled.failure).toEqual({ code: "cancelled", remoteOutcome: "unknown" }); expect(JSON.stringify(cancelled)).not.toContain(credential);
});

it("bounds whole bodies and visible text, discards reflected keys and aborts stalled reads", async () => {
  let cancelled = 0;
  const oversized = await executeLongAttempt(request, metadata(), credential, new AbortController().signal, async () => {}, async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1048577)); }, cancel() { cancelled++; } })));
  expect(oversized.failure?.code).toBe("response-too-large"); expect(cancelled).toBe(1);
  const visible = await executeLongAttempt(request, metadata(), credential, new AbortController().signal, async () => {}, async () => Response.json(body("a".repeat(131073)))); expect(visible.failure?.code).toBe("response-too-large");
  const reflected = await executeLongAttempt(request, metadata(), credential, new AbortController().signal, async () => {}, async () => Response.json(body(credential)));
  expect(reflected.failure?.code).toBe("credential-reflection"); expect(reflected.rawResponse).toBe(null); expect(JSON.stringify(reflected)).not.toContain(credential);
  const escaped = await executeLongAttempt(request, metadata(), credential, new AbortController().signal, async () => {}, async () => new Response(JSON.stringify(body(credential)).replaceAll("sk-", "\\u0073k-"), { status: 302 }));
  expect(escaped.failure?.code).toBe("credential-reflection"); expect(escaped.rawResponse).toBe(null);
  await expect(readLongBody(new Response(new ReadableStream({ start() {}, cancel() {} })), credential, AbortSignal.timeout(10))).rejects.toThrow();
  let wires = 0; await expect(executeLongAttempt(request, metadata(), credential, new AbortController().signal, async () => { throw new Error("fixture persistence failure"); }, async () => { wires++; return Response.json(body()); })).rejects.toThrow("Dispatch evidence"); expect(wires).toBe(0);
});

it("dispatches at most108 trials with four per model/eight globally and retains unattempted work after abort", async () => {
  const population = trials(), active = new Map<string, number>(); let max = 0, total = 0, calls = 0;
  const results = await scheduleLongTrials(population, new AbortController().signal, async row => {
    calls++; total++; max = Math.max(max, total); active.set(row.modelId, (active.get(row.modelId) ?? 0) + 1); expect(active.get(row.modelId)!).toBeLessThanOrEqual(4);
    await new Promise(resolve => setTimeout(resolve, 1)); active.set(row.modelId, active.get(row.modelId)! - 1); total--;
  });
  expect(results.every(row => row.status === "fulfilled")).toBe(true); expect(calls).toBe(108); expect(max).toBeLessThanOrEqual(8);
  const stop = new AbortController(); let stoppedCalls = 0; await scheduleLongTrials(trials(), stop.signal, async () => { stoppedCalls++; stop.abort(); }); expect(stoppedCalls).toBe(1);
  await expect(scheduleLongTrials([population[0], ...population.slice(0, -1)], new AbortController().signal, async () => {})).rejects.toThrow("108 unique");
});

it("keeps full/unavailable denominators and counts unknown authorizations without an official score", async () => {
  const rows = trials(), labels = new Map(data.suite.cases.map(entry => [entry.id, entry.label])); rows[0].state = "active"; rows[0].inferenceRequests = 1;
  expect(summarizeLongModel("gpt-6-astra", rows, labels)).toMatchObject({ plannedTrials: 54, retainedOutcomes: 0, modelOutcomes: 0, unattemptedTrials: 53, unknownRemoteInferenceRequests: 1, populationStatus: "unavailable", accuracyAmongValidAnswers: { denominator: 0, value: null } });
  const valid = await executeLongAttempt(request, metadata(), credential, new AbortController().signal, async () => {}, async () => Response.json(body()));
  for (const row of rows.filter(row => row.modelId === "gpt-6-astra")) { row.state = "settled"; row.inferenceRequests = 1; row.result = { ...valid, outcome: { ...valid.outcome, kind: "answer", label: labels.get(row.caseId)!, explanation: "Controlled fixture." } as LongAttempt["outcome"] }; }
  expect(summarizeLongModel("gpt-6-astra", rows, labels)).toMatchObject({ plannedTrials: 54, modelOutcomes: 54, correctLabels: 54, populationStatus: "complete" });
  expect(() => summarizeLongModel("gpt-6-astra", [rows[0], ...rows.slice(0, -1)], labels)).toThrow("identities");
});

it("refuses overwrite and accidental paid launch without changing standard artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "long-reserve-freeze-")), path = join(root, "fixture.json");
  try { await writeFile(path, "original-study\n"); await expect(freezeLongReserveStudy(path, "missing.json")).rejects.toThrow("already exists"); expect(await readFile(path, "utf8")).toBe("original-study\n"); }
  finally { await rm(root, { recursive: true, force: true }); }
  expect(() => parseLongReserveArguments(["run", "--manifest", "missing.json", "--output", "unused.json"])).toThrow("consent");
  await expect(runLongReserveStudy("missing.json", "unused.json", credential, false, false)).rejects.toThrow("consent");
});
