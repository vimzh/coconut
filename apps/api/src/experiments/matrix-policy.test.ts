// Matrix failures stop shared outages without treating slow inference as a mathematical error.
import { expect, it } from "bun:test";
import { createInferenceClient } from "../inference/client";
import { buildPrompt } from "../protocol";
import { matrixFailureRequiresStop } from "./matrix-policy";

const reference = { expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex" };
const request = { selection: { provider: "openai", modelId: "model-a", servingProvider: null, profileId: "one-shot-json-v1", verification: "metadata" }, prompt: buildPrompt(reference, "one-shot-json-v1"), acceptCharges: true };
const credential = "sk-matrix-fixture-123456789";

it("stops on a real metadata transport failure even when aggregate failure only says incomplete evidence", async () => {
  let sends = 0;
  const result = await createInferenceClient(async () => { sends++; throw new Error("offline fixture"); })(request, credential);
  expect(result.inferenceRequests).toBe(0);
  expect(matrixFailureRequiresStop({ failure: { code: "incomplete-evidence" }, results: [{ result }] })).toBe(true);
  expect(sends).toBe(1);
});

it("does not turn HTTP rate limiting into a shared connection outage or retry the request", async () => {
  let sends = 0;
  const result = await createInferenceClient(async () => { sends++; return Response.json({ error: {} }, { status: 429 }); })(request, credential);
  expect(result.failure?.code).toBe("rate-limited");
  expect(matrixFailureRequiresStop({ failure: null, results: [{ result }] })).toBe(false);
  expect(sends).toBe(1);
});

it("distinguishes a metadata timeout from a slow dispatched inference", () => {
  expect(matrixFailureRequiresStop({ failure: null, results: [{ result: { inferenceRequests: 0, failure: { code: "timeout" } } }] })).toBe(true);
  expect(matrixFailureRequiresStop({ failure: null, results: [{ result: { inferenceRequests: 1, failure: { code: "timeout" } } }] })).toBe(false);
  expect(matrixFailureRequiresStop({ failure: null, results: [{ result: { inferenceRequests: 1, failure: null } }] })).toBe(false);
  expect(matrixFailureRequiresStop({ failure: { code: "authentication-rejected" }, results: [] })).toBe(true);
});
