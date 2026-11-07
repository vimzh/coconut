// Wire fixtures separate visible model outcomes from provider execution evidence.
import { describe, expect, it } from "bun:test";
import type { ModelMetadata } from "../discovery";
import { ANSWER_SCHEMA, buildPrompt, extractAnswer, type ProfileId } from "../protocol";
import { TransportFailure } from "../providers/transport";
import type { ProviderId } from "../providers/types";
import { buildInferencePlan, parseInferenceResponse } from "./adapters";
import type { InferenceRequest } from "./types";

const providers = ["openai", "openrouter", "hugging-face"] as const;
const profiles = ["one-shot-json-v1", "one-shot-schema-v1"] as const;
const answer = '{"label":"convex","explanation":"The second derivative is positive."}';
function request(provider: ProviderId = "openai", profileId: ProfileId = "one-shot-json-v1"): InferenceRequest {
  return {
    selection: { provider, modelId: provider === "openai" ? "fixture-model" : "fixture/model", servingProvider: provider === "openai" ? null : "fixture-route", profileId, verification: "metadata" },
    prompt: buildPrompt({ expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex" }, profileId),
    acceptCharges: true,
  };
}
function metadata(selected: InferenceRequest, overrides: Partial<ModelMetadata> = {}): ModelMetadata {
  return {
    modelId: selected.selection.modelId, canonicalId: null, displayName: "Fixture model", providerModelId: null,
    servingProvider: selected.selection.servingProvider, providerDisplayName: null, routeStatus: null, hosted: "available", exactRoute: true,
    capabilities: { textInput: "supported", textOutput: "supported", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    structuredOutput: "advertised", contextWindow: null, maxOutputTokens: null,
    tokenParameter: selected.selection.provider === "openai" ? "max_output_tokens" : "max_tokens", supportedParameters: null, pricing: null,
    ...overrides,
  };
}
function response(selected: InferenceRequest, text = answer): Record<string, unknown> {
  if (selected.selection.provider !== "openai") return {
    model: "reported/model", provider: "Reported provider",
    usage: { prompt_tokens: 11, completion_tokens: 13, total_tokens: 24, completion_tokens_details: { reasoning_tokens: 5 } },
    choices: [{ finish_reason: "stop", message: { role: "assistant", content: text } }],
  };
  const format = selected.prompt.responseFormat;
  return {
    model: "reported-model", status: "completed", max_output_tokens: 4096, truncation: "disabled",
    output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }],
    usage: { input_tokens: 11, output_tokens: 13, total_tokens: 24, output_tokens_details: { reasoning_tokens: 5 } },
    ...(format.kind === "json-schema" ? { text: { format: { type: "json_schema", name: format.name, strict: true, schema: format.schema } } } : {}),
  };
}
function parse(body: unknown, selected = request(), overrides: Partial<ModelMetadata> = {}) {
  return parseInferenceResponse(body, selected, metadata(selected, overrides));
}
function message(parts: unknown[], status = "completed") {
  return { type: "message", role: "assistant", status, content: parts };
}
function choice(content: unknown = answer, finish_reason: unknown = "stop", extra: Record<string, unknown> = {}) {
  return { finish_reason, message: { role: "assistant", content, ...extra } };
}

describe("individual inference request plans", () => {
  for (const provider of providers) for (const profileId of profiles) {
    it(`preserves exact ${provider} prompts and ${profileId} settings`, () => {
      const selected = request(provider, profileId);
      const plan = buildInferencePlan(selected, metadata(selected));
      const body = JSON.parse(plan.body!);
      expect(plan.method).toBe("POST");
      expect(body.model).toBe(provider === "hugging-face" ? "fixture/model:fixture-route" : selected.selection.modelId);
      expect(body[provider === "openai" ? "input" : "messages"]).toEqual(selected.prompt.messages);
      expect(body[provider === "openai" ? "max_output_tokens" : "max_tokens"]).toBe(4096);
      for (const field of ["tools", "tool_choice", "temperature", "top_p", "reasoning", "reasoning_effort"]) expect(body).not.toHaveProperty(field);
      if (provider === "openai") {
        expect(plan.url).toBe("https://api.openai.com/v1/responses");
        expect(body).toMatchObject({ store: false, truncation: "disabled" });
      } else expect(body.stream).toBe(false);
      if (provider === "openrouter") {
        expect(plan.url).toBe("https://openrouter.ai/api/v1/chat/completions");
        expect(body.provider).toEqual({ only: ["fixture-route"], allow_fallbacks: false, require_parameters: true });
        expect(body.plugins).toEqual([{ id: "web", enabled: false }]);
      }
      if (provider === "hugging-face") expect(plan.url).toBe("https://router.huggingface.co/v1/chat/completions");
      if (profileId === "one-shot-schema-v1") {
        expect(provider === "openai" ? body.text.format : body.response_format.json_schema).toEqual({
          ...(provider === "openai" ? { type: "json_schema" } : {}), name: "classification_answer_v1", strict: true, schema: ANSWER_SCHEMA,
        });
      } else {
        expect(body).not.toHaveProperty("text");
        expect(body).not.toHaveProperty("response_format");
      }
    });
  }

  it("uses only the router's advertised token-parameter spelling", () => {
    for (const provider of ["openrouter", "hugging-face"] as const) for (const tokenParameter of ["max_tokens", "max_completion_tokens"] as const) {
      const selected = request(provider);
      const body = JSON.parse(buildInferencePlan(selected, metadata(selected, { tokenParameter })).body!);
      expect(body[tokenParameter]).toBe(4096);
      expect(body).not.toHaveProperty(tokenParameter === "max_tokens" ? "max_completion_tokens" : "max_tokens");
    }
  });

  it("requires matching exact metadata and advertised routed settings", () => {
    const selected = request("openrouter", "one-shot-schema-v1");
    for (const overrides of [{ modelId: "other/model" }, { servingProvider: "other-route" }, { exactRoute: false }, { tokenParameter: null }, { tokenParameter: "max_output_tokens" as const }, { structuredOutput: "unknown" as const }, { structuredOutput: "unsupported" as const }]) {
      expect(() => buildInferencePlan(selected, metadata(selected, overrides))).toThrow(TransportFailure);
    }
    expect(() => buildInferencePlan({ ...selected, acceptCharges: false } as unknown as InferenceRequest, metadata(selected))).toThrow(TransportFailure);
    expect(() => buildInferencePlan({ ...selected, selection: { ...selected.selection, profileId: "one-shot-json-v1" } }, metadata(selected))).toThrow(TransportFailure);
  });
});

describe("provider completion normalization", () => {
  for (const provider of providers) for (const profileId of profiles) {
    it(`retains ${provider} completed output independently of ${profileId} answer validity`, () => {
      const selected = request(provider, profileId);
      for (const text of [answer, "not JSON", "", '{"label":"other","explanation":"x"}']) {
        const result = parse(response(selected, text), selected);
        expect(result.failure).toBeNull();
        expect(result.reply).toEqual({ status: "completed", text });
        expect(extractAnswer(result.reply, profileId).kind).toBe(text === answer ? "answer" : "invalid");
      }
    });
  }

  it("ignores OpenAI reasoning bookkeeping without retaining hidden traces", () => {
    const selected = request();
    const original = response(selected);
    const result = parse({ ...original, output: [{ type: "reasoning", content: [{ text: "private reasoning trace" }], summary: [{ text: "private summary" }], encrypted_content: "private encrypted content" }, ...original.output as unknown[]] });
    expect(result.reply).toEqual({ status: "completed", text: answer });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("encrypted_content");
  });

  it("preserves OpenAI visible partial text on truncation, refusal, cancellation, and interruption", () => {
    const original = response(request());
    const output = [message([{ type: "output_text", text: "partial text" }], "incomplete")];
    for (const [patch, status] of [
      [{ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }, "truncated"],
      [{ status: "incomplete", incomplete_details: { reason: "content_filter" } }, "refused"],
      [{ status: "incomplete", incomplete_details: { reason: "private unknown reason" } }, "interrupted"],
      [{ status: "in_progress" }, "interrupted"], [{ status: "cancelled" }, "cancelled"],
    ] as const) {
      const result = parse({ ...original, ...patch, output });
      expect(result.reply).toEqual({ status, text: "partial text" });
      expect(result.failure).toBeNull();
      expect(JSON.stringify(result)).not.toContain("private unknown reason");
    }
    expect(parse({ ...original, output: [message([{ type: "refusal", refusal: "Visible refusal." }])] }).reply).toEqual({ status: "refused", text: "Visible refusal." });
    expect(parse({ ...original, status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] }).reply).toEqual({ status: "truncated", text: "" });
  });

  it("rejects tools, nontext, multiple answers, and contradictory OpenAI termination", () => {
    const original = response(request());
    const assistant = (original.output as unknown[])[0];
    for (const patch of [
      { output: [assistant, assistant] }, { output: [assistant, { type: "function_call", arguments: "private arguments" }] },
      { output: [message([{ type: "audio", data: "private audio" }])] },
      { output: [message([{ type: "output_text", text: 7 }])] },
      { output: [{ ...assistant as object, role: "user" }] },
      { output: [message([{ type: "output_text", text: answer }], "incomplete")] },
      { incomplete_details: { reason: "max_output_tokens" } }, { status: "private status" },
    ]) {
      const result = parse({ ...original, ...patch });
      expect(result.failure).toBe("invalid-provider-response");
      expect(result.reply.status).toBe("provider-error");
      expect(JSON.stringify(result)).not.toContain("private");
    }
    expect(parse({ ...original, output: [] }).failure).toBe("no-output");
  });

  for (const provider of ["openrouter", "hugging-face"] as const) {
    it(`preserves ${provider} partial text and distinct terminal states`, () => {
      const selected = request(provider);
      const original = response(selected);
      for (const [finish, status] of [["length", "truncated"], ["content_filter", "refused"], [null, "interrupted"], ["private finish reason", "interrupted"], ["cancelled", "cancelled"]] as const) {
        const result = parse({ ...original, choices: [choice("partial text", finish)] }, selected);
        expect(result.reply).toEqual({ status, text: "partial text" });
        expect(result.failure).toBeNull();
        expect(JSON.stringify(result)).not.toContain("private finish reason");
      }
      expect(parse({ ...original, choices: [choice("partial text", "stop", { refusal: "Visible refusal." })] }, selected).reply).toEqual({ status: "refused", text: "partial text" });
      expect(parse({ ...original, choices: [choice(null, "stop", { refusal: "Visible refusal." })] }, selected).reply).toEqual({ status: "refused", text: "Visible refusal." });
    });

    it(`rejects ${provider} tools, nontext, multiple answers, and missing assistant output`, () => {
      const selected = request(provider);
      const original = response(selected);
      for (const choices of [
        [], [choice(), choice()], [choice([{ type: "text", text: answer }])], [choice(answer, "stop", { tool_calls: [{ name: "private tool" }] })],
        [choice(answer, "stop", { function_call: { arguments: "private arguments" } })], [choice(answer, "tool_calls")],
        [choice(answer, "stop", { audio: { data: "private audio" } })], [choice(answer, "stop", { role: "user" })],
      ]) {
        const result = parse({ ...original, choices }, selected);
        expect(result.failure).toBe("invalid-provider-response");
        expect(JSON.stringify(result)).not.toContain("private");
      }
      expect(parse({ ...original, choices: [choice(null)] }, selected).failure).toBe("no-output");
      expect(parse({ ...original, choices: [choice(answer, "stop", { tool_calls: [], reasoning: "private reasoning", reasoning_details: [{ text: "private trace" }] })] }, selected).reply.text).toBe(answer);
      expect(JSON.stringify(parse({ ...original, choices: [choice(answer, "stop", { reasoning: "private reasoning" })] }, selected))).not.toContain("private reasoning");
    });
  }

  it("recognizes HF end-of-sequence termination without extending OpenRouter semantics", () => {
    for (const provider of ["openrouter", "hugging-face"] as const) {
      const selected = request(provider);
      expect(parse({ ...response(selected), choices: [choice(answer, "eos_token")] }, selected).reply.status).toBe(provider === "hugging-face" ? "completed" : "interrupted");
    }
  });

  it("retains safe categorical provider errors without upstream messages or bodies", () => {
    for (const provider of providers) {
      const selected = request(provider);
      const result = parse({ ...response(selected), error: { code: "insufficient_quota", message: "private upstream error", metadata: { headers: "private headers" } } }, selected);
      expect(result.failure).toBe("credit-or-quota-exhausted");
      expect(result.reply.status).toBe("provider-error");
      expect(JSON.stringify(result)).not.toContain("private");
    }
    const selected = request("openrouter");
    const result = parse({ ...response(selected), choices: [{ ...choice("partial text", "error"), error: { code: 429, message: "private" } }] }, selected);
    expect(result.failure).toBe("rate-limited");
    expect(result.reply.text).toBe("partial text");
    expect(parse({ ...response(selected), choices: [{ finish_reason: "error", error: { code: 503, message: "private" } }] }, selected).failure).toBe("service-unavailable");
    expect(parse({ ...response(selected), choices: [choice("partial text", "error")] }, selected)).toMatchObject({ failure: "service-unavailable", reply: { status: "provider-error", text: "partial text" } });
    expect(parse({ ...response(request()), status: "failed" }).failure).toBe("service-unavailable");
  });
});

describe("reported inference evidence", () => {
  it("retains oversized invalid answers within the scorer bound and explicitly discards larger text", () => {
    for (const provider of providers) {
      const selected = request(provider);
      for (const size of [65537, 131072]) {
        const result = parse(response(selected, "x".repeat(size)), selected);
        expect(result.failure).toBeNull();
        expect(result.reply.status).toBe("completed");
        expect(result.reply.text.length).toBe(size);
        expect(extractAnswer(result.reply, selected.prompt.profileId)).toMatchObject({ kind: "invalid", reason: "response-too-large" });
      }
      const discarded = parse(response(selected, "x".repeat(131073)), selected);
      expect(discarded.failure).toBe("response-too-large");
      expect(discarded.reply).toMatchObject({ status: "provider-error", text: "" });
      expect(discarded.finishReason).toBe("response-discarded-size-limit");
      expect(discarded.usage.output?.count).toBe(13);
    }
  });

  it("keeps unknown identities and settings null instead of substituting requested values", () => {
    for (const provider of providers) {
      const selected = request(provider, "one-shot-schema-v1");
      const result = parse({ ...response(selected), model: "unsafe\nidentity", provider: "<unsafe>", max_output_tokens: undefined, text: undefined, truncation: undefined, reasoning: { effort: "private effort" } }, selected);
      expect(result.failure).toBeNull();
      expect(result.reportedModelId).toBeNull();
      expect(result.reportedServingProvider).toBeNull();
      expect(result.effective).toEqual({ maxOutputTokens: null, reasoningEffort: null, truncation: null, nativeSchemaAccepted: null });
    }
  });

  it("retains only actual settings acknowledgements and rejects conflicting ones", () => {
    const selected = request("openai", "one-shot-schema-v1");
    const original = response(selected);
    expect(parse({ ...original, reasoning: { effort: "high" } }, selected).effective).toEqual({ maxOutputTokens: 4096, reasoningEffort: "high", truncation: "disabled", nativeSchemaAccepted: true });
    for (const patch of [{ max_output_tokens: 2048 }, { max_output_tokens: 8192 }, { truncation: "auto" }, { text: { format: { type: "json_object" } } }, { text: { format: { type: "json_schema", name: "other", strict: true, schema: ANSWER_SCHEMA } } }]) {
      expect(parse({ ...original, ...patch }, selected).failure).toBe("invalid-provider-response");
    }
    for (const provider of ["openrouter", "hugging-face"] as const) {
      const routed = request(provider, "one-shot-schema-v1");
      const format = { type: "json_schema", json_schema: { name: "classification_answer_v1", strict: true, schema: ANSWER_SCHEMA } };
      expect(parse({ ...response(routed), max_tokens: 4096, response_format: format }, routed).effective).toMatchObject({ maxOutputTokens: 4096, nativeSchemaAccepted: true });
      expect(parse(response(routed), routed).effective).toMatchObject({ maxOutputTokens: null, nativeSchemaAccepted: null });
    }
  });

  for (const provider of providers) {
    it(`retains ${provider} token semantics and validates contradictory reported counts`, () => {
      const selected = request(provider);
      const original = response(selected);
      const result = parse(original, selected);
      expect(result.usage.input?.count).toBe(11);
      expect(result.usage.output?.count).toBe(13);
      expect(result.usage.reasoning?.count).toBe(5);
      expect(result.usage.input?.semantics).toContain(provider);
      expect(result.usage.reasoning?.semantics).toContain("subset of output");
      const inputName = provider === "openai" ? "input_tokens" : "prompt_tokens";
      const outputName = provider === "openai" ? "output_tokens" : "completion_tokens";
      const detailsName = provider === "openai" ? "output_tokens_details" : "completion_tokens_details";
      for (const usage of [
        { [inputName]: -1 }, { [outputName]: "13" }, { [outputName]: Number.MAX_SAFE_INTEGER + 1 },
        { [outputName]: 4097 }, { [outputName]: 3, [detailsName]: { reasoning_tokens: 4 } },
        { [inputName]: 2, [outputName]: 3, total_tokens: 4 }, { [inputName]: 3, total_tokens: 2 },
        { [detailsName]: "invalid" }, { [detailsName]: { reasoning_tokens: -1 } }, "invalid",
      ]) expect(parse({ ...original, usage }, selected).failure).toBe("invalid-provider-response");
      expect(parse({ ...original, usage: { [outputName]: 4096 } }, selected).failure).toBeNull();
      expect(parse({ ...original, usage: { [inputName]: 0, [outputName]: 0, total_tokens: 0, [detailsName]: { reasoning_tokens: 0 } } }, selected).usage.output?.count).toBe(0);
      expect(parse({ ...original, usage: undefined }, selected).usage).toEqual({ input: null, output: null, reasoning: null });
      expect(parse({ ...original, usage: { [outputName]: 13 } }, selected).usage.reasoning).toBeNull();
    });
  }

  it("uses only valid reported OpenRouter bills and never estimates from catalog prices", () => {
    const selected = request("openrouter");
    for (const [cost, amount] of [["0.001230", "0.001230"], [0.25, "0.25"], [1e-7, "0.0000001"], [0, "0"]] as const) {
      expect(parse({ ...response(selected), usage: { cost } }, selected).cost).toEqual({ kind: "billed", currency: "USD", amount });
    }
    for (const cost of [undefined, null, -1, Infinity, NaN, "1e-7", "-1", "USD 2", "0.0000000000000000001", { amount: "1" }]) {
      expect(parse({ ...response(selected), usage: { cost } }, selected).cost).toBeNull();
    }
    for (const provider of ["openai", "hugging-face"] as const) {
      const other = request(provider);
      expect(parse({ ...response(other), usage: { cost: "0.25" } }, other, { pricing: { currency: "USD", unit: "token", input: "1", output: "1", source: "https://example.test/prices", retrievedAt: null } }).cost).toBeNull();
    }
  });

  it("rejects malformed top-level data without invoking accessors", () => {
    let invoked = false;
    const body = Object.defineProperty({}, "model", { get() { invoked = true; return "private"; } });
    for (const input of [undefined, null, [], "invalid", body]) expect(parse(input).failure).toBe("invalid-provider-response");
    expect(invoked).toBe(false);
  });
});
