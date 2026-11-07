// Profile fixtures distinguish valid answers from observed parameter and native-schema acceptance.
import { describe, expect, it } from "bun:test";
import { ANSWER_SCHEMA, getProfile, type ProfileId } from "../protocol";
import { TransportFailure } from "../providers/transport";
import type { ProviderId } from "../providers/types";
import { buildProfileProbe, parseProfileProbe } from "./probe";
import type { ModelMetadata, SelectionRequest } from "./types";

const answer = '{"label":"convex","explanation":"Compatibility check."}';
function request(provider: ProviderId = "openai", profileId: ProfileId = "one-shot-json-v1"): SelectionRequest {
  return { provider, modelId: provider === "openai" ? "fixture-model" : "fixture/model", servingProvider: provider === "openai" ? null : "fixture-route", profileId, verification: "probe", acceptCharges: true };
}
function metadata(selected: SelectionRequest, overrides: Partial<ModelMetadata> = {}): ModelMetadata {
  return {
    modelId: selected.modelId, canonicalId: null, displayName: "Fixture model", providerModelId: null,
    servingProvider: selected.servingProvider, providerDisplayName: null, routeStatus: null,
    hosted: "available", exactRoute: true,
    capabilities: { textInput: "supported", textOutput: "supported", outputTokenLimit: "unknown", jsonSchema: "unknown" },
    structuredOutput: "advertised", contextWindow: null, maxOutputTokens: null,
    tokenParameter: selected.provider === "openai" ? "max_output_tokens" : "max_tokens", supportedParameters: null, pricing: null,
    ...overrides,
  };
}
function response(selected: SelectionRequest, text = answer): Record<string, unknown> {
  if (selected.provider !== "openai") return {
    model: "reported/model", provider: "Reported provider", usage: { prompt_tokens: 6, completion_tokens: 8 },
    choices: [{ finish_reason: "stop", message: { role: "assistant", content: text } }],
  };
  const profile = getProfile(selected.profileId);
  return {
    model: "reported-model", status: "completed", max_output_tokens: profile.maxOutputTokens,
    output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }],
    usage: { input_tokens: 6, output_tokens: 8 },
    ...(profile.reasoning !== "provider-default" ? { reasoning: { effort: profile.reasoning } } : {}),
    ...(profile.responseFormat.kind === "json-schema" ? { text: { format: { type: "json_schema", name: profile.responseFormat.name, strict: true, schema: ANSWER_SCHEMA } } } : {}),
  };
}

describe("fixed profile probe plans", () => {
  for (const provider of ["openai", "openrouter", "hugging-face"] as const) for (const profileId of ["one-shot-json-v1", "one-shot-schema-v1"] as const) {
    it(`preserves the ${provider} route and ${profileId} request format`, () => {
      const selected = request(provider, profileId);
      const plan = buildProfileProbe(selected, metadata(selected));
      const body = JSON.parse(plan.body!);
      expect(plan.method).toBe("POST");
      expect(body.model).toBe(provider === "hugging-face" ? "fixture/model:fixture-route" : selected.modelId);
      expect(body[provider === "openai" ? "max_output_tokens" : "max_tokens"]).toBe(4096);
      const prompt = provider === "openai" ? body.input : body.messages[0].content;
      expect(prompt).toContain(answer);
      expect(prompt).toContain("compatibility check");
      expect(body).not.toHaveProperty("temperature");
      expect(body).not.toHaveProperty("tools");
      if (provider === "openai") {
        expect(plan.url).toBe("https://api.openai.com/v1/responses");
        expect(body.store).toBe(false);
      } else expect(body.stream).toBe(false);
      if (provider === "openrouter") {
        expect(plan.url).toBe("https://openrouter.ai/api/v1/chat/completions");
        expect(body.provider).toEqual({ only: ["fixture-route"], allow_fallbacks: false, require_parameters: true });
        expect(body.plugins).toEqual([{ id: "web", enabled: false }]);
      }
      if (provider === "hugging-face") expect(plan.url).toBe("https://router.huggingface.co/v1/chat/completions");
      if (profileId === "one-shot-schema-v1") {
        expect(provider === "openai" ? body.text.format : body.response_format.json_schema).toMatchObject({ strict: true, schema: ANSWER_SCHEMA });
      } else {
        expect(body).not.toHaveProperty("text");
        expect(body).not.toHaveProperty("response_format");
      }
    });
  }

  it("uses the advertised completion-token spelling without adding a second limit", () => {
    const selected = request("openrouter");
    const body = JSON.parse(buildProfileProbe(selected, metadata(selected, { tokenParameter: "max_completion_tokens" })).body!);
    expect(body.max_completion_tokens).toBe(4096);
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("requires consent, matching exact metadata, a supported token parameter, and advertised routed schema", () => {
    const selected = request("openrouter", "one-shot-schema-v1");
    for (const overrides of [{ modelId: "other/model" }, { exactRoute: false }, { servingProvider: "other-route" }, { tokenParameter: null }, { structuredOutput: "unknown" as const }, { structuredOutput: "unsupported" as const }]) {
      expect(() => buildProfileProbe(selected, metadata(selected, overrides))).toThrow(TransportFailure);
    }
    expect(() => buildProfileProbe({ ...selected, verification: "metadata" }, metadata(selected))).toThrow(TransportFailure);
  });
});

describe("profile probe response evidence", () => {
  it("requires every explicit OpenAI effort echo independently of valid answer text", () => {
    for (const effort of ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const) for (const format of ["json", "schema"] as const) {
      const selected = request("openai", `one-shot-${format}-v2-${effort}`);
      const model = metadata(selected);
      const body = JSON.parse(buildProfileProbe(selected, model).body!);
      expect(body.reasoning).toEqual({ effort });
      expect(body.max_output_tokens).toBe(16384);
      expect(body).not.toHaveProperty("temperature");
      const original = response(selected);
      const result = parseProfileProbe(original, selected, model);
      expect(result.failure).toBeNull();
      expect(result.probe).toMatchObject({ status: "verified", outputLimitRequestAccepted: true,
        reportedReasoningEffort: effort, reasoningEffortRequestAccepted: true,
        nativeSchemaRequestAccepted: format === "schema" });
      for (const reasoning of [undefined, null, {}, { effort: null }, { effort: "unrecognized-private-value" }, { effort: effort === "high" ? "low" : "high" }]) {
        const rejected = parseProfileProbe({ ...original, reasoning }, selected, model);
        expect(rejected).toMatchObject({ failure: "invalid-provider-response", probe: {
          status: "not-verified", outcome: "reasoning-effort-unverified", reasoningEffortRequestAccepted: false,
        } });
        expect(JSON.stringify(rejected)).not.toContain("unrecognized-private-value");
      }
      expect(parseProfileProbe({ ...original, usage: { output_tokens: 16384 } }, selected, model).failure).toBeNull();
      expect(parseProfileProbe({ ...original, usage: { output_tokens: 16385 } }, selected, model)).toMatchObject({ failure: "invalid-provider-response", probe: { outcome: "output-limit-exceeded" } });
      expect(parseProfileProbe({ ...original, max_output_tokens: 4096 }, selected, model).probe.outputLimitRequestAccepted).toBe(false);
      if (format === "schema") expect(parseProfileProbe({ ...original, text: undefined }, selected, model).probe.nativeSchemaRequestAccepted).toBe(false);
    }
  });

  it("keeps version-1 request and probe shapes unchanged even if an effort is returned", () => {
    const selected = request();
    expect(JSON.parse(buildProfileProbe(selected, metadata(selected)).body!)).not.toHaveProperty("reasoning");
    const result = parseProfileProbe({ ...response(selected), reasoning: { effort: "high" } }, selected, metadata(selected));
    expect(result.probe).not.toHaveProperty("reportedReasoningEffort");
    expect(result.probe).not.toHaveProperty("reasoningEffortRequestAccepted");
  });

  it("rejects routed explicit-effort probes even when exact metadata advertises schema support", () => {
    for (const provider of ["openrouter", "hugging-face"] as const) {
      const selected = request(provider, "one-shot-schema-v2-high");
      expect(() => buildProfileProbe(selected, metadata(selected))).toThrow(TransportFailure);
      expect(parseProfileProbe({ ...response(selected), reasoning: { effort: "high" } }, selected, metadata(selected))).toMatchObject({ failure: "invalid-provider-response", probe: { outcome: "reasoning-effort-unverified" } });
    }
  });

  it("accepts reported usage at the exact requested ceiling", () => {
    for (const provider of ["openai", "openrouter", "hugging-face"] as const) {
      const selected = request(provider);
      const usage = provider === "openai" ? { output_tokens: 4096 } : { completion_tokens: 4096 };
      const result = parseProfileProbe({ ...response(selected), usage }, selected, metadata(selected));
      expect(result.failure).toBeNull();
      expect(result.probe.outputLimitRequestAccepted).toBe(true);
    }
  });
  for (const provider of ["openai", "openrouter", "hugging-face"] as const) for (const profileId of ["one-shot-json-v1", "one-shot-schema-v1"] as const) {
    it(`retains narrow ${provider} evidence for ${profileId} without reply text`, () => {
      const selected = request(provider, profileId);
      const result = parseProfileProbe(response(selected), selected, metadata(selected));
      expect(result.failure).toBeNull();
      expect(result.probe).toEqual({
        status: "verified", outcome: "answer", reportedModelId: provider === "openai" ? "reported-model" : "reported/model",
        reportedServingProvider: provider === "openai" ? null : "Reported provider", usage: { inputTokens: 6, outputTokens: 8 },
        outputLimitRequestAccepted: true, nativeSchemaRequestAccepted: profileId === "one-shot-schema-v1",
      });
      expect(JSON.stringify(result)).not.toContain("Compatibility check.");
      expect(JSON.stringify(result)).not.toContain("convex");
    });
  }

  it("requires the exact output-limit echo and full strict schema before OpenAI feature acceptance", () => {
    const selected = request("openai", "one-shot-schema-v1");
    const original = response(selected);
    for (const max_output_tokens of [null, 128, undefined, "4096"]) {
      expect(parseProfileProbe({ ...original, max_output_tokens }, selected, metadata(selected)).probe.outputLimitRequestAccepted).toBe(false);
    }
    for (const format of [null, { type: "json_object" }, { type: "json_schema", strict: false, name: "classification_answer_v1", schema: ANSWER_SCHEMA }, { type: "json_schema", strict: true, name: "classification_answer_v1", schema: { type: "object" } }]) {
      expect(parseProfileProbe({ ...original, text: { format } }, selected, metadata(selected)).probe.nativeSchemaRequestAccepted).toBe(false);
    }
    const reordered = { additionalProperties: false, required: ["label", "explanation"], properties: { explanation: { type: "string" }, label: { enum: ["convex", "concave", "neither"], type: "string" } }, type: "object" };
    expect(parseProfileProbe({ ...original, text: { format: { type: "json_schema", strict: true, name: "classification_answer_v1", schema: reordered } } }, selected, metadata(selected)).probe.nativeSchemaRequestAccepted).toBe(true);
  });

  it("does not turn plain valid JSON or unknown routed metadata into native-schema proof", () => {
    for (const provider of ["openrouter", "hugging-face"] as const) {
      const selected = request(provider, "one-shot-schema-v1");
      const result = parseProfileProbe(response(selected), selected, metadata(selected, { structuredOutput: "unknown", tokenParameter: null }));
      expect(result.probe.nativeSchemaRequestAccepted).toBe(false);
      expect(result.probe.outputLimitRequestAccepted).toBe(false);
    }
  });

  it("accepts another valid declared class because the probe measures compatibility", () => {
    const selected = request();
    expect(parseProfileProbe(response(selected, '{"label":"neither","explanation":"Valid format."}'), selected, metadata(selected)).failure).toBeNull();
  });

  it("preserves identities and usage on malformed, duplicate, empty, or invalid answers", () => {
    const selected = request();
    for (const text of ["not JSON", "", '{"label":"convex","label":"concave","explanation":"x"}', '{"label":"other","explanation":"x"}', '{"label":"convex","explanation":""}', '{"label":"convex","explanation":"x","extra":1}']) {
      const result = parseProfileProbe(response(selected, text), selected, metadata(selected));
      expect(result.failure).not.toBeNull();
      expect(result.probe.status).toBe("not-verified");
      expect(result.probe.reportedModelId).toBe("reported-model");
      expect(result.probe.usage).toEqual({ inputTokens: 6, outputTokens: 8 });
      expect(result.probe.outputLimitRequestAccepted).toBe(false);
      expect(result.probe.nativeSchemaRequestAccepted).toBe(false);
    }
  });

  it("rejects incomplete, refused, tool, nontext, and multiple OpenAI assistant outputs", () => {
    const selected = request();
    const original = response(selected);
    const message = (original.output as unknown[])[0];
    const content = (parts: unknown[]) => [{ type: "message", role: "assistant", status: "completed", content: parts }];
    for (const body of [
      { ...original, status: "incomplete" }, { ...original, incomplete_details: { reason: "max_output_tokens" } },
      { ...original, output: content([{ type: "refusal", refusal: "private text" }]) },
      { ...original, output: [...original.output as unknown[], { type: "function_call", arguments: "private" }] },
      { ...original, output: content([{ type: "audio", data: "private" }]) },
      { ...original, output: [message, message] },
    ]) expect(parseProfileProbe(body, selected, metadata(selected)).failure).not.toBeNull();
    expect(parseProfileProbe({ ...original, output: [{ type: "reasoning", summary: [] }, message] }, selected, metadata(selected)).failure).toBeNull();
  });

  it("rejects routed refusals, truncation, tools, nontext, and multiple choices", () => {
    const selected = request("openrouter");
    const original = response(selected);
    const choice = { finish_reason: "stop", message: { role: "assistant", content: answer } };
    for (const choices of [[], [choice, choice], [{ ...choice, finish_reason: "length" }], [{ ...choice, message: { ...choice.message, refusal: "private text" } }], [{ ...choice, message: { ...choice.message, tool_calls: [{ name: "private" }] } }], [{ ...choice, message: { ...choice.message, content: [{ type: "text", text: answer }] } }]]) {
      expect(parseProfileProbe({ ...original, choices }, selected, metadata(selected)).failure).not.toBeNull();
    }
  });

  it("accepts documented Hugging Face end-of-sequence termination only for that service", () => {
    for (const provider of ["openrouter", "hugging-face"] as const) {
      const selected = request(provider);
      const body = { ...response(selected), choices: [{ finish_reason: "eos_token", message: { role: "assistant", content: answer } }] };
      expect(parseProfileProbe(body, selected, metadata(selected)).failure === null).toBe(provider === "hugging-face");
    }
  });

  it("retains unknown identity and usage fields rather than inventing requested values or zeros", () => {
    const selected = request("openrouter");
    const body = { ...response(selected), provider: undefined, usage: { prompt_tokens: -1, completion_tokens: "8" } };
    expect(parseProfileProbe(body, selected, metadata(selected)).probe).toMatchObject({ reportedServingProvider: null, usage: { inputTokens: null, outputTokens: null } });
    expect(parseProfileProbe({ ...body, model: undefined }, selected, metadata(selected)).failure).toBe("invalid-provider-response");
    expect(parseProfileProbe({ ...body, error: { code: "insufficient_quota", message: "private" } }, selected, metadata(selected)).failure).toBe("credit-or-quota-exhausted");
  });
});
