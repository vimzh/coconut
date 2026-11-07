// Distinguish endpoint authentication from inference and discard upstream private data.
import { describe, expect, it } from "bun:test";
import { parseAccessRequest } from "./policy";
import { parseAccessResponse } from "./responses";

const credential = "VISITOR_CREDENTIAL_ALPHA_0123456789";
const probe = (provider = "openai") => parseAccessRequest({ provider, operation: "probe", modelId: "fixture-model", servingProvider: provider === "openai" ? null : "explicit-provider", acceptCharges: true });
const output = {
  model: "fixture-model-2026-11-07", status: "completed", output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "OK" }] }], usage: { input_tokens: 9, output_tokens: 1 },
};
const chat = { model: "fixture-model", provider: "reported-provider", choices: [{ finish_reason: "stop", message: { role: "assistant", content: "OK" } }], usage: { prompt_tokens: 7, completion_tokens: 1 } };

describe("safe provider response evidence", () => {
  it("authenticates each documented shape without preserving account/catalog material", () => {
    for (const [provider, body] of [
      ["openai", { object: "list", data: [{ id: "private-catalog-entry" }] }],
      ["openrouter", { data: { label: "masked-private-key", limit: 2, usage: 1 } }],
      ["hugging-face", { type: "user", name: "private-account-name", auth: { accessToken: { displayName: "private-token-name" } } }],
    ] as const) {
      const result = parseAccessResponse(parseAccessRequest({ provider, operation: "authenticate" }), 200, body, credential);
      expect(result.status).toBe("authenticated");
      expect(result.reportedModelId).toBeNull();
      expect(JSON.stringify(result)).not.toMatch(/private|masked/);
      expect(result.usage).toEqual({ inputTokens: null, outputTokens: null });
    }
  });

  it("retains declared model/route and only numeric usage after completed inference", () => {
    expect(parseAccessResponse(probe(), 200, output, credential)).toEqual({ status: "inference-verified", reportedModelId: "fixture-model-2026-11-07", reportedServingProvider: "openai", usage: { inputTokens: 9, outputTokens: 1 }, failure: null });
    for (const provider of ["openrouter", "hugging-face"]) {
      const result = parseAccessResponse(probe(provider), 200, chat, credential);
      expect(result.status).toBe("inference-verified");
      expect(result.reportedServingProvider).toBe("reported-provider");
      expect(result.usage).toEqual({ inputTokens: 7, outputTokens: 1 });
      expect(JSON.stringify(result)).not.toContain("OK");
      const missing = parseAccessResponse(probe(provider), 200, { ...chat, provider: undefined, usage: {} }, credential);
      expect(missing.reportedServingProvider).toBeNull();
      expect(missing.usage).toEqual({ inputTokens: null, outputTokens: null });
    }
  });

  it("classifies exposed failures without echoing arbitrary error text", () => {
    for (const [status, body, expected] of [
      [401, { error: { message: "private-upstream-diagnostic" } }, "authentication-rejected"],
      [403, {}, "permission-denied"], [402, {}, "credit-or-quota-exhausted"],
      [429, {}, "rate-limited"], [429, { error: { code: "insufficient_quota" } }, "credit-or-quota-exhausted"],
      [403, { error: { metadata: { type: "openrouter_key_limit" } } }, "credit-or-quota-exhausted"],
      [404, {}, "model-unavailable"], [503, {}, "service-unavailable"],
      [200, { error: { code: "provider_unavailable" } }, "service-unavailable"],
      [200, { error: { code: "private-custom-code" } }, "invalid-provider-response"],
    ] as const) {
      const result = parseAccessResponse(probe("openrouter"), status, body, credential);
      expect(result.status).toBe("not-verified");
      expect(result.failure).toBe(expected);
      expect(JSON.stringify(result)).not.toContain("private");
    }
  });

  it("rejects incomplete, empty, error-bearing, or malformed successful bodies", () => {
    for (const [body, expected] of [
      [{ ...output, status: "incomplete" }, "output-incomplete"],
      [{ ...output, output: [] }, "no-output"],
      [{ ...output, model: "" }, "invalid-provider-response"],
      [{ ...output, output: "OK" }, "invalid-provider-response"],
      [null, "invalid-provider-response"],
    ] as const) expect(parseAccessResponse(probe(), 200, body, credential).failure).toBe(expected);
    for (const [body, expected] of [
      [{ ...chat, choices: [] }, "invalid-provider-response"],
      [{ ...chat, choices: [{ finish_reason: "length", message: { role: "assistant", content: "OK" } }] }, "output-incomplete"],
      [{ ...chat, choices: [{ finish_reason: "stop", error: { message: "private" }, message: { role: "assistant", content: "OK" } }] }, "invalid-provider-response"],
      [{ ...chat, choices: [{ finish_reason: "stop", message: { role: "assistant", content: "" } }] }, "no-output"],
    ] as const) expect(parseAccessResponse(probe("hugging-face"), 200, body, credential).failure).toBe(expected);
  });

  it("discards direct and encoded credential reflection in any provider body field", () => {
    for (const secret of [credential, encodeURIComponent(credential), Buffer.from(credential).toString("base64")]) {
      for (const body of [{ ...output, model: secret }, { ...output, metadata: { diagnostic: secret } }, { error: { message: secret } }]) {
        const result = parseAccessResponse(probe(), 200, body, credential);
        expect(result.failure).toBe("credential-reflection");
        expect(JSON.stringify(result)).not.toContain(secret);
      }
    }
  });

  it("does not turn malformed or absent usage into a reported zero", () => {
    const result = parseAccessResponse(probe(), 200, { ...output, usage: { input_tokens: -1, output_tokens: "1" } }, credential);
    expect(result.status).toBe("inference-verified");
    expect(result.usage).toEqual({ inputTokens: null, outputTokens: null });
  });

  it("accepts documented Hugging Face end-of-sequence completion without loosening other providers", () => {
    const body = { ...chat, choices: [{ finish_reason: "eos_token", message: { role: "assistant", content: "OK" } }] };
    expect(parseAccessResponse(probe("hugging-face"), 200, body, credential).status).toBe("inference-verified");
    expect(parseAccessResponse(probe("openrouter"), 200, body, credential).failure).toBe("output-incomplete");
    for (const finish_reason of ["length", "tool_calls", "unknown"]) {
      expect(parseAccessResponse(probe("hugging-face"), 200, { ...body, choices: [{ ...body.choices[0], finish_reason }] }, credential).failure).toBe("output-incomplete");
    }
  });
});
