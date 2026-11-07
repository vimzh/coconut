// End-to-end attempt fixtures verify prompt fidelity, failure populations, and one-call budgets.
import { describe, expect, it, mock, spyOn, afterEach } from "bun:test";
import { buildPrompt } from "../protocol";
import type { ProviderFetch } from "../providers/transport";
import { createInferenceClient } from "./client";
import { parseInferenceRequest } from "./policy";
import type { InferenceRequest } from "./types";

const credential = "sk-inference-visitor-123456789";
const reference = { expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex" };
function request(provider: InferenceRequest["selection"]["provider"] = "openai", strict = false): InferenceRequest {
  const profileId = strict ? "one-shot-schema-v1" : "one-shot-json-v1";
  return { selection: { provider, modelId: provider === "openai" ? "model-a" : "owner/model-a", servingProvider: provider === "openai" ? null : "host-a", profileId, verification: "metadata" }, prompt: buildPrompt(reference, profileId), acceptCharges: true };
}
const text = '{"label":"convex","explanation":"The second derivative is positive."}';
const metadata = { id: "model-a", object: "model" };
const output = { model: "model-a-snapshot", status: "completed", max_output_tokens: 4096, truncation: "disabled", output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }], usage: { input_tokens: 100, output_tokens: 40, output_tokens_details: { reasoning_tokens: 20 } } };
function wire(bodies: unknown[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher: ProviderFetch = async (url, init) => {
    calls.push({ url, init });
    if (calls.length > bodies.length) throw new Error("Unexpected extra inference.");
    const body = bodies[calls.length - 1];
    return body instanceof Response ? body : Response.json(body);
  };
  return { calls, fetcher };
}
afterEach(() => mock.restore());

describe("inference request boundary", () => {
  it("preserves canonical prompt content and excludes reference or generation overrides", () => {
    const original = request();
    expect(parseInferenceRequest(original)).toEqual(original);
    for (const invalid of [
      { ...original, reference }, { ...original, acceptCharges: false },
      { ...original, prompt: { ...original.prompt, reference } },
      { ...original, prompt: { ...original.prompt, profileId: "one-shot-schema-v1" } },
      { ...original, prompt: { ...original.prompt, generation: { ...original.prompt.generation, maxOutputTokens: 128 } } },
      { ...original, prompt: { ...original.prompt, generation: { ...original.prompt.generation, reasoning: "high" } } },
      { ...original, prompt: { ...original.prompt, messages: [...original.prompt.messages].reverse() } },
      { ...original, selection: { ...original.selection, verification: "probe", acceptCharges: true } },
    ]) expect(() => parseInferenceRequest(invalid)).toThrow();
  });

  it("rejects nested getters without executing them or exposing their messages", () => {
    let reads = 0;
    const original = request();
    const generation = { ...original.prompt.generation };
    Object.defineProperty(generation, "maxOutputTokens", { enumerable: true, get() { reads++; throw new Error("private credential diagnostic"); } });
    expect(() => parseInferenceRequest({ ...original, prompt: { ...original.prompt, generation } })).toThrow("matching protocol-built prompt");
    expect(reads).toBe(0);
  });
});

describe("single inference execution", () => {
  it("refreshes metadata and sends the exact protocol messages through the official SDK", async () => {
    const { calls, fetcher } = wire([metadata, output]);
    const original = request();
    const result = await createInferenceClient(fetcher)(original, credential);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe("https://api.openai.com/v1/models/model-a");
    const body = JSON.parse(calls[1]!.init.body as string);
    expect(body).toMatchObject({ model: "model-a", input: original.prompt.messages, max_output_tokens: 4096, store: false, truncation: "disabled" });
    expect(body).not.toHaveProperty("reasoning");
    expect(JSON.stringify(body)).not.toContain("claimedLabel");
    expect(result).toMatchObject({ requested: { modelId: "model-a" }, reportedModelId: "model-a-snapshot", reportedServingProvider: null, contextFit: "provider-enforced", inferenceRequests: 1, httpAttempts: 2, failure: null, evidence: { sequence: 1, outcome: { kind: "answer", label: "convex", rawText: text }, errorKind: null, cost: null } });
    expect(result.evidence.usage.reasoning).toMatchObject({ count: 20 });
    expect(result.evidence.usage.output).toMatchObject({ count: 40 });
    expect(result.evidence.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(result)).not.toContain(credential);
  });

  it("retains completed unusable model content as invalid rather than infrastructure failure", async () => {
    const bad = { ...output, output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "I think convex." }] }] };
    const { fetcher } = wire([metadata, bad]);
    const result = await createInferenceClient(fetcher)(request(), credential);
    expect(result.evidence.outcome).toMatchObject({ kind: "invalid", reason: "malformed-json", rawText: "I think convex." });
    expect(result.failure).toBeNull();
    expect(result.evidence.errorKind).toBeNull();
  });

  it("requires the selected explicit reasoning effort to be independently acknowledged", async () => {
    const profileId = "one-shot-json-v2-high";
    const original = request();
    const explicit = { ...original, selection: { ...original.selection, profileId }, prompt: buildPrompt(reference, profileId) };
    for (const effort of [undefined, "low", "high"]) {
      const { calls, fetcher } = wire([metadata, { ...output, max_output_tokens: 16384, reasoning: { effort } }]);
      const result = await createInferenceClient(fetcher)(explicit, credential);
      expect(JSON.parse(calls[1]!.init.body as string).reasoning).toEqual({ effort: "high" });
      expect(result.evidence.outcome.kind).toBe(effort === "high" ? "answer" : "provider-error");
      expect(result.effective.reasoningEffort).toBe(effort ?? null);
    }
  });

  it("does not infer a router context guarantee from an OpenAI-shaped extra field", async () => {
    const route = { data: { id: "owner/model-a", endpoints: [{ model_id: "owner/model-a", tag: "host-a", status: 0, max_completion_tokens: 8192, supported_parameters: ["max_tokens"] }] } };
    const reply = { model: "native/model-a", truncation: "disabled", choices: [{ finish_reason: "stop", message: { role: "assistant", content: text } }] };
    const { fetcher } = wire([route, reply]);
    const result = await createInferenceClient(fetcher)(request("openrouter"), credential);
    expect(result.evidence.outcome.kind).toBe("answer");
    expect(result.contextFit).toBe("unverified");
  });

  it("preserves truncation and partial text without retrying or treating valid-looking JSON as complete", async () => {
    const truncated = { ...output, status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [{ type: "message", role: "assistant", status: "incomplete", content: [{ type: "output_text", text }] }] };
    const { calls, fetcher } = wire([metadata, truncated]);
    const result = await createInferenceClient(fetcher)(request(), credential);
    expect(result.evidence.outcome).toMatchObject({ kind: "truncated", rawText: text });
    expect(result.inferenceRequests).toBe(1);
    expect(calls).toHaveLength(2);
  });

  it("preserves permission changes and rejected calls without automatic retries", async () => {
    for (const [status, code, kind] of [[403, "permission-denied", "authentication"], [429, "rate-limited", "unavailable"], [503, "service-unavailable", "unavailable"]] as const) {
      const { calls, fetcher } = wire([metadata, Response.json({ error: { message: "private diagnostic" } }, { status })]);
      const result = await createInferenceClient(fetcher)(request(), credential);
      expect(result).toMatchObject({ inferenceRequests: 1, failure: { code, remoteOutcome: "response-received" }, evidence: { outcome: { kind: "provider-error" }, errorKind: kind } });
      expect(calls).toHaveLength(2);
      expect(JSON.stringify(result)).not.toContain("private diagnostic");
    }
  });

  it("records metadata failure with no inference send and no mathematical verdict", async () => {
    const { calls, fetcher } = wire([Response.json({ error: {} }, { status: 401 })]);
    const result = await createInferenceClient(fetcher)(request(), credential);
    expect(result).toMatchObject({ inferenceRequests: 0, httpAttempts: 1, failure: { code: "authentication-rejected", remoteOutcome: "not-sent" }, evidence: { outcome: { kind: "provider-error" } } });
    expect(calls).toHaveLength(1);
  });

  it("classifies rejected HTTP status even when the provider body is text or empty", async () => {
    for (const [status, code] of [[401, "authentication-rejected"], [429, "rate-limited"], [503, "service-unavailable"]] as const) {
      for (const body of ["", "<html>Private upstream error</html>"]) {
        const { calls, fetcher } = wire([metadata, new Response(body, { status })]);
        const result = await createInferenceClient(fetcher)(request(), credential);
        expect(result.failure?.code).toBe(code);
        expect(result.inferenceRequests).toBe(1);
        expect(calls).toHaveLength(2);
        expect(JSON.stringify(result)).not.toContain("Private upstream error");
      }
    }
  });

  it("never sends inference to an unavailable or unverified HF route", async () => {
    const { calls, fetcher } = wire([{ id: "owner/model-a", inferenceProviderMapping: {} }, { data: { id: "owner/model-a", providers: [] } }]);
    const result = await createInferenceClient(fetcher)(request("hugging-face"), credential);
    expect(result).toMatchObject({ inferenceRequests: 0, httpAttempts: 2, failure: { code: "model-unavailable" } });
    expect(calls).toHaveLength(2);
  });

  it("rejects missing credentials, charge consent and reflected inputs before network activity", async () => {
    const { calls, fetcher } = wire([]);
    const client = createInferenceClient(fetcher);
    await expect(client(request(), undefined)).rejects.toThrow("Supply your own");
    await expect(client({ ...request(), acceptCharges: false }, credential)).rejects.toThrow("acknowledgement");
    const original = request();
    await expect(client({ ...original, prompt: { ...original.prompt, messages: [original.prompt.messages[0], { role: "user", content: credential }] } }, credential)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("discards reflected response credentials and cannot misreport their text as a model failure", async () => {
    const { fetcher } = wire([metadata, { ...output, private: credential }]);
    const result = await createInferenceClient(fetcher)(request(), credential);
    expect(result.failure?.code).toBe("credential-reflection");
    expect(result.evidence.outcome.kind).toBe("provider-error");
    expect(JSON.stringify(result)).not.toContain(credential);
  });

  it("settles caller cancellation after dispatch even when the upstream ignores abort", async () => {
    const controller = new AbortController();
    let sends = 0;
    const client = createInferenceClient(async () => {
      if (++sends === 1) return Response.json(metadata);
      controller.abort();
      return new Promise<Response>(() => {});
    });
    const result = await client(request(), credential, controller.signal);
    expect(result).toMatchObject({ inferenceRequests: 1, failure: { code: "cancelled", remoteOutcome: "unknown" }, evidence: { outcome: { kind: "cancelled" }, usage: { input: null, output: null, reasoning: null } } });
    expect(sends).toBe(2);
  });

  it("uses a separate bounded inference deadline while preserving the metadata deadline", async () => {
    let expire: (() => void) | undefined;
    const timer = globalThis.setTimeout;
    const observed: number[] = [];
    spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, delay: number) => {
      observed.push(delay);
      if (delay === 180000 && expire === undefined) expire = callback;
      return timer(callback, delay);
    }) as typeof setTimeout);
    let sends = 0;
    const pending = createInferenceClient(async () => {
      if (++sends === 1) return Response.json(metadata);
      expire!();
      return new Promise<Response>(() => {});
    })(request(), credential);
    const result = await pending;
    expect(observed).toContain(20000);
    expect(observed).toContain(180000);
    expect(result).toMatchObject({ inferenceRequests: 1, failure: { code: "timeout", remoteOutcome: "unknown" }, evidence: { errorKind: "timeout", outcome: { kind: "provider-error" } } });
  });
});
