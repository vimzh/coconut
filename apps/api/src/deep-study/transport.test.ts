// Injected wire responses verify the distinct research budget without model calls or development-key reads.
import { expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import OpenAI from "openai";
import type { ModelMetadata } from "../discovery";
import { getProfile, listProfiles } from "../protocol";
import { buildImportedPrompt } from "../randomized/pilot";
import type { ImportedCase } from "../randomized/types";
import { buildDeepRequestBody, DEEP_MODELS, DEEP_SETTINGS, executeDeepAttempt, readDeepBody, type DeepModelId } from "./transport";

const credential = "sk-deep-transport-fixture-123456789";
const task: ImportedCase = { id: "deep-fixture", label: "convex", expression: "x^2", domain: { min: "-1", max: "1" },
  referenceSha256: "a".repeat(64), coreHashes: ["b".repeat(64)], requestedDepth: 5, actualDepth: 5, astDepth: 1, nonlinearPath: 1, nodeCount: 2 };
const answer = '{"label":"convex","explanation":"Controlled fixture; no live inference."}';
function metadata(modelId: DeepModelId = "gpt-6-astra", overrides: Partial<ModelMetadata> = {}): ModelMetadata {
  return { modelId, canonicalId: null, displayName: "Fixture model", providerModelId: null, servingProvider: null, providerDisplayName: null,
    routeStatus: null, hosted: "available", exactRoute: true, capabilities: { textInput: "supported", textOutput: "supported", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    structuredOutput: "unknown", contextWindow: null, maxOutputTokens: null, tokenParameter: "max_output_tokens", supportedParameters: null, pricing: null, ...overrides };
}
function responseBody(modelId: DeepModelId = "gpt-6-astra", text = answer) {
  return { model: modelId, status: "completed", max_output_tokens: 32768,
    reasoning: { effort: DEEP_MODELS.find(model => model.modelId === modelId)!.reasoningEffort }, truncation: "disabled",
    output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }] };
}
const infer = (fetcher: Parameters<typeof executeDeepAttempt>[6], signal = new AbortController().signal, onDispatch = async () => {}) =>
  executeDeepAttempt(task, "gpt-6-astra", metadata(), credential, signal, onDispatch, fetcher);

async function isolated(source: string, environment: Record<string, string> = {}) {
  const root = await mkdtemp(join(tmpdir(), "deep-sdk-fixture-"));
  try {
    const imports = `import {executeDeepAttempt} from ${JSON.stringify(new URL("./transport.ts", import.meta.url).pathname)};
      import OpenAI from ${JSON.stringify(import.meta.resolve("openai"))};
      const task=${JSON.stringify(task)},metadata=${JSON.stringify(metadata())},credential=${JSON.stringify(credential)},responseBody=${JSON.stringify(responseBody())};`;
    const child = Bun.spawn([process.execPath, "-e", imports + source], { cwd: root, env: { PATH: "/usr/bin:/bin", ...environment }, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(code).toBe(0); expect(stderr).toBe("");
    return JSON.parse(stdout);
  } finally { await rm(root, { recursive: true, force: true }); }
}

it("freezes a separate 32k/600s research identity and preserves ordinary profiles and neutral messages", () => {
  expect(DEEP_SETTINGS).toEqual({ methodId: "deep-single-response-v1", profileId: "deep-research-32k-600s-v1", maxOutputTokens: 32768,
    inferenceTimeoutMs: 600000, retries: 0, maxResponseBytes: 1048576, maxVisibleCodeUnits: 131072 });
  expect(DEEP_MODELS).toEqual([{ modelId: "gpt-6-astra", reasoningEffort: "max" }, { modelId: "gpt-5.4-mini", reasoningEffort: "xhigh" }, { modelId: "gpt-6-luna", reasoningEffort: "max" }]);
  expect(Object.isFrozen(DEEP_SETTINGS)).toBe(true); expect(Object.isFrozen(DEEP_MODELS)).toBe(true);
  for (const model of DEEP_MODELS) {
    expect(Object.isFrozen(model)).toBe(true);
    const body = buildDeepRequestBody(task, model.modelId);
    expect(body).toEqual({ model: model.modelId, input: buildImportedPrompt(task).messages, max_output_tokens: 32768, store: false, truncation: "disabled", reasoning: { effort: model.reasoningEffort } });
    expect(JSON.stringify(body)).not.toContain(task.id); expect(JSON.stringify(body)).not.toContain(task.referenceSha256);
    expect(JSON.stringify(body)).not.toContain(task.coreHashes[0]);
    expect(buildDeepRequestBody({ ...task, id: "changed", label: "neither", referenceSha256: "c".repeat(64), requestedDepth: 512 }, model.modelId)).toEqual(body);
  }
  expect(getProfile("one-shot-json-v2-max").maxOutputTokens).toBe(16384);
  expect(listProfiles().every(profile => profile.maxOutputTokens <= 16384)).toBe(true);
  expect(() => getProfile(DEEP_SETTINGS.profileId)).toThrow("registered versioned profile");
  expect(() => buildDeepRequestBody(task, "unregistered" as DeepModelId)).toThrow("frozen deep-study roster");
});

for (const model of DEEP_MODELS) it(`sends one exact isolated Responses request for ${model.modelId}:${model.reasoningEffort}`, async () => {
  let retained = false, calls = 0;
  const result = await executeDeepAttempt(task, model.modelId, metadata(model.modelId), credential, new AbortController().signal,
    async () => { retained = true; }, async (url, options) => {
      calls++; expect(retained).toBe(true); expect(url).toBe("https://api.openai.com/v1/responses");
      expect(options).toMatchObject({ method: "POST", redirect: "manual", credentials: "omit", timeout: false });
      expect(options.headers).toEqual({ Authorization: `Bearer ${credential}`, "Content-Type": "application/json" });
      expect(JSON.parse(String(options.body))).toEqual(buildDeepRequestBody(task, model.modelId));
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return Response.json(responseBody(model.modelId));
    });
  expect(calls).toBe(1);
  expect(result).toMatchObject({ methodId: "deep-single-response-v1", inferenceTimeoutMs: 600000, inferenceRequests: 1, httpStatus: 200, failure: null,
    normalized: { effective: { maxOutputTokens: 32768, reasoningEffort: model.reasoningEffort } }, outcome: { kind: "answer", label: "convex", profileId: `one-shot-json-v2-${model.reasoningEffort}` } });
  expect(Date.parse(result.finishedAt)).toBeGreaterThanOrEqual(Date.parse(result.startedAt));
});

it("awaits completed dispatch persistence before wire and stops on persistence failure", async () => {
  let calls = 0, entered = false;
  const { promise, resolve } = Promise.withResolvers<void>();
  const pending = infer(async () => { calls++; return Response.json(responseBody()); }, new AbortController().signal, async () => { entered = true; await promise; });
  await Bun.sleep(10); expect(entered).toBe(true); expect(calls).toBe(0);
  resolve(); expect((await pending).inferenceRequests).toBe(1); expect(calls).toBe(1);
  await expect(infer(async () => { calls++; return Response.json(responseBody()); }, new AbortController().signal,
    async () => { throw new Error("Private persistence fixture."); })).rejects.toThrow("Dispatch evidence");
  expect(calls).toBe(1);
});

it("isolates ambient SDK credentials, custom headers, organization/project, endpoints and logging", async () => {
  const result = await isolated(`let wire;const result=await executeDeepAttempt(task,"gpt-6-astra",metadata,credential,new AbortController().signal,async()=>{},async(url,options)=>{
    wire={url,headers:options.headers};return Response.json(responseBody);});process.stdout.write(JSON.stringify({wire,failure:result.failure}));`,
  { OPENAI_API_KEY: "ambient-fixture-key", OPENAI_ADMIN_KEY: "ambient-fixture-admin", OPENAI_ORG_ID: "ambient-org", OPENAI_PROJECT_ID: "ambient-project",
    OPENAI_BASE_URL: "https://untrusted.invalid/v1", OPENAI_CUSTOM_HEADERS: "Invalid Header: ambient-private", OPENAI_LOG: "debug" });
  expect(result).toEqual({ wire: { url: "https://api.openai.com/v1/responses", headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" } }, failure: null });
  expect(JSON.stringify(result)).not.toContain("ambient-");
  const missing = await isolated(`let calls=0;try{await executeDeepAttempt(task,"gpt-6-astra",metadata,"",new AbortController().signal,async()=>{},async()=>{calls++;return Response.json(responseBody);});}
    catch(error){process.stdout.write(JSON.stringify({calls,code:error.code}));}`, { OPENAI_API_KEY: "ambient-fixture-key" });
  expect(missing).toEqual({ calls: 0, code: "missing-credential" });
});

it("guards the exact SDK request body and destination and forbids duplicate SDK sends", async () => {
  for (const [path, mutation] of [["path", "options.body={...options.body,max_output_tokens:16384}"], ["'/chat/completions'", ""], ["path", "options.body={...options.body,tools:[{type:'web_search'}]}"]]) {
    const result = await isolated(`const original=OpenAI.prototype.post;OpenAI.prototype.post=function(path,options){return original.call(this,${path},Promise.resolve(options).then(options=>{${mutation};return options;}));};
      let calls=0;const result=await executeDeepAttempt(task,"gpt-6-astra",metadata,credential,new AbortController().signal,async()=>{},async()=>{calls++;return Response.json(responseBody);});
      process.stdout.write(JSON.stringify({calls,failure:result.failure,inferenceRequests:result.inferenceRequests}));`);
    expect(result).toEqual({ calls: 0, failure: { code: "invalid-provider-response", remoteOutcome: "not-sent" }, inferenceRequests: 0 });
  }
  const duplicate = await isolated(`const original=OpenAI.prototype.fetchWithTimeout;let dispatches=0,calls=0;
    OpenAI.prototype.fetchWithTimeout=async function(url,init,ms,controller){const first=await original.call(this,url,init,ms,controller);await original.call(this,url,init,ms,controller);return first;};
    const result=await executeDeepAttempt(task,"gpt-6-astra",metadata,credential,new AbortController().signal,async()=>{dispatches++;},async()=>{calls++;return Response.json(responseBody);});
    process.stdout.write(JSON.stringify({calls,dispatches,failure:result.failure,inferenceRequests:result.inferenceRequests}));`);
  expect(duplicate).toEqual({ calls: 1, dispatches: 1, failure: { code: "invalid-provider-response", remoteOutcome: "response-received" }, inferenceRequests: 1 });
});

it("uses explicit 600000ms SDK/abort deadlines and classifies a stalled read as unknown timeout", async () => {
  const result = await isolated(`const timeout=AbortSignal.timeout;const deadlines=[];AbortSignal.timeout=ms=>{deadlines.push(ms);return timeout(10);};
    const original=OpenAI.prototype.fetchWithTimeout;let sdkDeadline;OpenAI.prototype.fetchWithTimeout=function(url,init,ms,controller){sdkDeadline=ms;return original.call(this,url,init,ms,controller);};
    const result=await executeDeepAttempt(task,"gpt-6-astra",metadata,credential,new AbortController().signal,async()=>{},async()=>new Response(new ReadableStream({start(){},cancel(){}})));
    process.stdout.write(JSON.stringify({deadlines,sdkDeadline,failure:result.failure,inferenceRequests:result.inferenceRequests}));`);
  expect(result).toEqual({ deadlines: [600000], sdkDeadline: 600000, failure: { code: "timeout", remoteOutcome: "unknown" }, inferenceRequests: 1 });
});

it("never retries HTTP, network, timeout, cancellation or redirect failures", async () => {
  for (const [status, code] of [[401, "authentication-rejected"], [429, "rate-limited"], [503, "service-unavailable"], [302, "redirect-blocked"]] as const) {
    let calls = 0;
    const result = await infer(async () => { calls++; return Response.json({ error: { message: "Private fixture." } }, { status, headers: { Location: "https://untrusted.invalid/" } }); });
    expect(calls).toBe(1); expect(result.failure).toEqual({ code, remoteOutcome: "response-received" }); expect(result.outcome.kind).toBe("provider-error");
  }
  for (const [error, code] of [[new Error(credential), "network-error"], [new OpenAI.APIConnectionTimeoutError(), "timeout"]] as const) {
    let calls = 0;
    const result = await infer(async () => { calls++; throw error; });
    expect(calls).toBe(1); expect(result.failure).toEqual({ code, remoteOutcome: "unknown" }); expect(JSON.stringify(result)).not.toContain(credential);
  }
  const stopped = new AbortController(); stopped.abort(); let calls = 0, dispatches = 0;
  const before = await infer(async () => { calls++; return Response.json(responseBody()); }, stopped.signal, async () => { dispatches++; });
  expect(before.failure).toEqual({ code: "cancelled", remoteOutcome: "not-sent" }); expect(before.inferenceRequests).toBe(0); expect(calls).toBe(0); expect(dispatches).toBe(0);
  const controller = new AbortController();
  const after = await infer(async () => { calls++; controller.abort(); throw new Error(credential); }, controller.signal);
  expect(calls).toBe(1); expect(after.failure).toEqual({ code: "cancelled", remoteOutcome: "unknown" }); expect(after.outcome.kind).toBe("cancelled");
  const during = new AbortController();
  const authorized = await infer(async () => { calls++; return Response.json(responseBody()); }, during.signal, async () => { during.abort(); });
  expect(calls).toBe(1); expect(authorized.inferenceRequests).toBe(1); expect(authorized.failure).toEqual({ code: "cancelled", remoteOutcome: "unknown" });
});

it("normalizes actual output usage above 16k up to the 32k ceiling and rejects mismatched caps/effort", async () => {
  for (const count of [16385, 32768]) {
    const result = await infer(async () => Response.json({ ...responseBody(), usage: { input_tokens: 5, output_tokens: count, total_tokens: count + 5, output_tokens_details: { reasoning_tokens: count - 100 } } }));
    expect(result.failure).toBeNull(); expect(result.normalized?.usage.output?.count).toBe(count); expect(result.outcome.kind).toBe("answer");
  }
  for (const changed of [{ max_output_tokens: 16384 }, { max_output_tokens: null }, { reasoning: { effort: "high" } }, { reasoning: {} }, { truncation: "auto" }, { usage: { output_tokens: 32769 } }]) {
    const result = await infer(async () => Response.json({ ...responseBody(), ...changed }));
    expect(result.failure).toEqual({ code: "invalid-provider-response", remoteOutcome: "response-received" }); expect(result.outcome.kind).toBe("provider-error");
  }
  const miniMismatch = await executeDeepAttempt(task, "gpt-5.4-mini", metadata("gpt-5.4-mini"), credential, new AbortController().signal, async () => {},
    async () => Response.json({ ...responseBody("gpt-5.4-mini"), reasoning: { effort: "max" } }));
  expect(miniMismatch.failure?.code).toBe("invalid-provider-response");
});

it("preserves extractor completion policy and excludes hidden reasoning from visible normalized text", async () => {
  for (const [changes, kind] of [[{ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }, "truncated"],
    [{ output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "Fixture refusal." }] }] }, "refused"]] as const) {
    const result = await infer(async () => Response.json({ ...responseBody(), ...changes }));
    expect(result.failure).toBeNull(); expect(result.outcome.kind).toBe(kind);
  }
  for (const text of ['{"label":"convex","label":"concave","explanation":"fixture"}', '{"label":"convex","explanation":""}', "not-json"]) {
    const result = await infer(async () => Response.json(responseBody("gpt-6-astra", text)));
    expect(result.failure).toBeNull(); expect(result.outcome.kind).toBe("invalid");
  }
  const result = await infer(async () => Response.json({ ...responseBody(), output: [{ type: "reasoning", summary: "Private hidden fixture." }, ...responseBody().output] }));
  expect(result.normalized?.reply.text).toBe(answer); expect(result.outcome.rawText).toBe(answer);
});

it("bounds full bodies/visible replies, rejects malformed UTF-8, aborts stalled reads and discards reflected credentials", async () => {
  let cancelled = 0;
  const oversized = await infer(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1048577)); }, cancel() { cancelled++; } })));
  expect(oversized.failure?.code).toBe("response-too-large"); expect(oversized.rawResponse).toBeNull(); expect(cancelled).toBe(1);
  const visible = await infer(async () => Response.json(responseBody("gpt-6-astra", "a".repeat(131073))));
  expect(visible.failure?.code).toBe("response-too-large");
  const malformed = await infer(async () => new Response(new Uint8Array([0xc3, 0x28])));
  expect(malformed.failure?.code).toBe("invalid-provider-response");
  for (const text of [credential, encodeURIComponent(credential), Buffer.from(credential).toString("base64")]) {
    const reflected = await infer(async () => Response.json(responseBody("gpt-6-astra", text)));
    expect(reflected.failure?.code).toBe("credential-reflection"); expect(reflected.rawResponse).toBeNull(); expect(reflected.normalized).toBeNull(); expect(JSON.stringify(reflected)).not.toContain(credential);
  }
  const escaped = await infer(async () => new Response(JSON.stringify(responseBody("gpt-6-astra", credential)).replaceAll("sk-", "\\u0073k-"), { status: 302 }));
  expect(escaped.failure?.code).toBe("credential-reflection"); expect(escaped.rawResponse).toBeNull();
  await expect(readDeepBody(new Response(new ReadableStream({ start() {}, cancel() {} })), credential, AbortSignal.timeout(10))).rejects.toThrow();
});

it("requires exact matching OpenAI route metadata, explicit credentials and bounded neutral prompts before dispatch", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return Response.json(responseBody()); };
  for (const changed of [{ modelId: "gpt-6-luna" }, { exactRoute: false }, { servingProvider: "openai" }]) {
    await expect(executeDeepAttempt(task, "gpt-6-astra", metadata("gpt-6-astra", changed), credential, new AbortController().signal, async () => {}, fetcher)).rejects.toThrow("exact metadata");
  }
  await expect(executeDeepAttempt(task, "gpt-6-astra", metadata(), "", new AbortController().signal, async () => {}, fetcher)).rejects.toThrow("own provider credential");
  await expect(executeDeepAttempt({ ...task, expression: credential }, "gpt-6-astra", metadata(), credential, new AbortController().signal, async () => {}, fetcher)).rejects.toThrow("Responses request");
  await expect(executeDeepAttempt({ ...task, expression: "x".repeat(262144) }, "gpt-6-astra", metadata(), credential, new AbortController().signal, async () => {}, fetcher)).rejects.toThrow("transport bound");
  expect(calls).toBe(0);
});
