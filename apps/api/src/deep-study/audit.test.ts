// Mocked transport records test replay integrity without provider traffic or private artifacts.
import { expect, it } from "bun:test";
import type { ModelMetadata } from "../discovery";
import { extractAnswer } from "../protocol";
import type { AccessFailureCode } from "../providers/types";
import type { ImportedCase } from "../randomized/types";
import { assertAttemptReplay } from "./audit";
import { DEEP_MODELS, executeDeepAttempt, type DeepAttempt, type DeepModelId } from "./transport";

const credential = "sk-audit-fixture-123456789";
const task: ImportedCase = { id: "audit-fixture", label: "convex", expression: "x^2", domain: { min: "-1", max: "1" },
  referenceSha256: "a".repeat(64), coreHashes: ["b".repeat(64)], requestedDepth: 5, actualDepth: 5, astDepth: 1, nonlinearPath: 1, nodeCount: 2 };
function metadata(modelId: DeepModelId = "gpt-6-astra"): ModelMetadata {
  return { modelId, canonicalId: null, displayName: "Audit fixture", providerModelId: null, servingProvider: null, providerDisplayName: null, routeStatus: null,
    hosted: "available", exactRoute: true, capabilities: { textInput: "supported", textOutput: "supported", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    structuredOutput: "unknown", contextWindow: null, maxOutputTokens: null, tokenParameter: "max_output_tokens", supportedParameters: null, pricing: null };
}
function raw(modelId: DeepModelId = "gpt-6-astra") {
  return { model: modelId, status: "completed", max_output_tokens: 32768, truncation: "disabled",
    reasoning: { effort: DEEP_MODELS.find(model => model.modelId === modelId)!.reasoningEffort },
    usage: { input_tokens: 5, output_tokens: 20000, total_tokens: 20005 },
    output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: '{"label":"convex","explanation":"Synthetic audit fixture."}' }] }] };
}
const capture = (fetcher: Parameters<typeof executeDeepAttempt>[6], modelId: DeepModelId = "gpt-6-astra", signal = new AbortController().signal) =>
  executeDeepAttempt(task, modelId, metadata(modelId), credential, signal, async () => {}, fetcher);
const replay = (result: DeepAttempt, modelId: DeepModelId = "gpt-6-astra") => assertAttemptReplay(result, modelId, metadata(modelId));
function failed(result: DeepAttempt, code: AccessFailureCode, remoteOutcome: NonNullable<DeepAttempt["failure"]>["remoteOutcome"]): DeepAttempt {
  const effort = result.outcome.profileId.endsWith("xhigh") ? "xhigh" : "max";
  return { ...result, failure: { code, remoteOutcome }, outcome: extractAnswer(code === "cancelled" ? { status: "cancelled", text: "" }
    : { status: "provider-error", text: "", message: code }, `one-shot-json-v2-${effort}`) };
}

it("replays actual 32k normalized responses and canonical max/xhigh extraction for every roster cell", async () => {
  for (const model of DEEP_MODELS) {
    const result = await capture(async () => Response.json(raw(model.modelId)), model.modelId);
    expect(result.normalized?.usage.output?.count).toBe(20000);
    expect(() => replay(result, model.modelId)).not.toThrow();
  }
  for (const changes of [{ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } },
    { output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "Synthetic refusal." }] }] },
    { output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "invalid-json" }] }] }]) {
    const result = await capture(async () => Response.json({ ...raw(), ...changes }));
    expect(() => replay(result)).not.toThrow();
  }
});

it("rejects changed normalized/output evidence, corrupt failure types, nonfinite timestamps and inconsistent operation identity", async () => {
  const original = await capture(async () => Response.json(raw()));
  const changes: Partial<DeepAttempt>[] = [{ startedAt: "invalid" }, { finishedAt: "invalid" },
    { startedAt: "2026-11-09T00:00:01.000Z", finishedAt: "2026-11-09T00:00:00.000Z" }, { methodId: "other" as DeepAttempt["methodId"] },
    { inferenceTimeoutMs: 180000 as 600000 }, { inferenceRequests: 0 }, { httpStatus: null }, { httpStatus: 401 }, { httpStatus: NaN },
    { rawResponse: null }, { rawResponse: undefined }, { normalized: null },
    { normalized: { ...original.normalized!, reportedModelId: "changed" } },
    { normalized: { ...original.normalized!, usage: { ...original.normalized!.usage, output: { count: 5, semantics: "changed" } } } },
    { outcome: { ...original.outcome, kind: "answer", label: "neither", explanation: "Changed fixture." } },
    { outcome: { ...original.outcome, profileId: "one-shot-json-v2-xhigh" } },
    { failure: undefined }, { failure: "timeout" as unknown as DeepAttempt["failure"] },
    { failure: { code: "unrecognized", remoteOutcome: "unknown" } as unknown as DeepAttempt["failure"] },
    { failure: { code: "timeout", remoteOutcome: "invented" } as unknown as DeepAttempt["failure"] }];
  for (const change of changes) expect(() => replay({ ...original, ...change })).toThrow();
  expect(() => assertAttemptReplay(original, "gpt-6-astra", { ...metadata(), exactRoute: false })).toThrow();
  expect(() => assertAttemptReplay(original, "gpt-6-luna", metadata())).toThrow();
});

it("cannot erase a completed valid response by changing its failure or dropping only normalization", async () => {
  const original = await capture(async () => Response.json(raw()));
  for (const code of ["invalid-provider-response", "network-error", "timeout", "authentication-rejected", "response-too-large", "credential-reflection"] as const) {
    const remote = ["network-error", "timeout"].includes(code) ? "unknown" : "response-received";
    const changed = failed(original, code, remote);
    expect(() => replay(changed)).toThrow();
    expect(() => replay({ ...changed, normalized: null })).toThrow();
  }
});

it("reclassifies original non-2xx bodies and rejects changed failure or remote-outcome categories", async () => {
  for (const status of [401, 403, 404, 429, 503, 302]) {
    const result = await capture(async () => Response.json({ error: { code: "fixture", message: "Private synthetic provider error." } }, { status }));
    expect(() => replay(result)).not.toThrow();
    expect(() => replay(failed(result, result.failure!.code === "rate-limited" ? "service-unavailable" : "rate-limited", "response-received"))).toThrow();
    expect(() => replay({ ...result, failure: { ...result.failure!, remoteOutcome: "unknown" } })).toThrow();
    expect(() => replay({ ...result, httpStatus: 200 })).toThrow();
  }
});

it("requires null response evidence for network failures and consistent pre-wire cancellation counts", async () => {
  const network = await capture(async () => { throw new Error("Synthetic network failure."); });
  expect(network.failure).toEqual({ code: "network-error", remoteOutcome: "unknown" }); expect(() => replay(network)).not.toThrow();
  expect(() => replay({ ...network, httpStatus: 200 })).toThrow();
  expect(() => replay({ ...network, rawResponse: raw() })).toThrow();
  expect(() => replay({ ...network, failure: { code: "network-error", remoteOutcome: "not-sent" } })).toThrow();
  const stopped = new AbortController(); stopped.abort();
  const before = await capture(async () => { throw new Error("No wire should start."); }, "gpt-6-astra", stopped.signal);
  expect(before.inferenceRequests).toBe(0); expect(() => replay(before)).not.toThrow();
  expect(() => replay({ ...before, httpStatus: 200 })).toThrow();
  expect(() => replay({ ...before, outcome: { ...before.outcome, kind: "cancelled", rawText: "Injected text." } })).toThrow();
  const controller = new AbortController();
  const after = await capture(async () => { controller.abort(); throw new Error("Synthetic cancellation."); }, "gpt-6-astra", controller.signal);
  expect(after.failure).toEqual({ code: "cancelled", remoteOutcome: "unknown" }); expect(() => replay(after)).not.toThrow();
});

it("requires actual deadline-length elapsed evidence for timeout and permits late response/cancellation only as unscored outcomes", async () => {
  const original = await capture(async () => Response.json(raw()));
  const startedAt = "2026-11-08T00:00:00.000Z", finishedAt = "2026-11-08T00:10:00.000Z";
  const timeout = failed({ ...original, startedAt, finishedAt }, "timeout", "unknown");
  expect(() => replay(timeout)).not.toThrow(); expect(() => replay({ ...timeout, normalized: null })).not.toThrow();
  expect(() => replay({ ...timeout, rawResponse: null, normalized: null, httpStatus: null })).not.toThrow();
  expect(() => replay({ ...timeout, finishedAt: "2026-11-08T00:09:59.000Z" })).not.toThrow();
  expect(() => replay({ ...timeout, finishedAt: "2026-11-08T00:09:58.999Z" })).toThrow();
  expect(() => replay({ ...timeout, outcome: original.outcome })).toThrow();
  const cancelled = failed(original, "cancelled", "unknown");
  expect(() => replay(cancelled)).not.toThrow(); expect(() => replay({ ...cancelled, normalized: null })).not.toThrow();
  expect(cancelled.outcome.kind).toBe("cancelled"); expect(cancelled.outcome.rawText).toBe("");
});

it("requires replayable parser or effective-setting evidence for response failures", async () => {
  for (const changes of [{ max_output_tokens: 16384 }, { max_output_tokens: null }, { reasoning: { effort: "high" } },
    { truncation: "auto" }, { usage: { input_tokens: 5, output_tokens: 32769, total_tokens: 32774 } },
    { output: [] }, { error: { code: "permission_denied" } }]) {
    const result = await capture(async () => Response.json({ ...raw(), ...changes }));
    expect(result.failure).not.toBeNull(); expect(() => replay(result)).not.toThrow();
    expect(() => replay({ ...result, normalized: null })).toThrow();
  }
  for (const body of ["malformed-json", "null", JSON.stringify("parsed JSON scalar")]) {
    const result = await capture(async () => new Response(body));
    expect(result.failure?.code).toBe("invalid-provider-response"); expect(() => replay(result)).not.toThrow();
  }
});

it("allows bounded read/reflection discards only with empty failure outcomes and no retained discarded evidence", async () => {
  const oversized = await capture(async () => new Response("x".repeat(1048577)));
  expect(oversized.failure?.code).toBe("response-too-large"); expect(() => replay(oversized)).not.toThrow();
  const reflected = await capture(async () => Response.json({ ...raw(), private: credential }));
  expect(reflected.failure?.code).toBe("credential-reflection"); expect(() => replay(reflected)).not.toThrow();
  expect(reflected.rawResponse).toBeNull(); expect(reflected.normalized).toBeNull();
  for (const result of [oversized, reflected]) {
    expect(() => replay({ ...result, rawResponse: raw() })).toThrow();
    expect(() => replay({ ...result, failure: { ...result.failure!, remoteOutcome: "unknown" } })).toThrow();
    expect(() => replay({ ...result, outcome: extractAnswer({ status: "provider-error", text: "", message: "changed" }, "one-shot-json-v2-max") })).toThrow();
  }
  const visible = await capture(async () => Response.json({ ...raw(), output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "x".repeat(131073) }] }] }));
  expect(visible.failure?.code).toBe("response-too-large"); expect(visible.normalized).not.toBeNull(); expect(() => replay(visible)).not.toThrow();
});
