import { expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { assertCompositionDispatch, assertCompositionManifest } from "./composition";

it("bounds paid composition sends and rejects unexpected models, prompts and settings", () => {
  const input = [{ role: "user", content: "a fixed task" }];
  const allowed = new Set([createHash("sha256").update(JSON.stringify(input)).digest("hex")]);
  const body = { model: "gpt-6-luna", input, store: false, truncation: "disabled", max_output_tokens: 4096 };
  expect(assertCompositionDispatch(JSON.stringify(body), allowed, 161)).toBe("gpt-6-luna");
  expect(() => assertCompositionDispatch(JSON.stringify(body), allowed, 162)).toThrow();
  for (const change of [{ model: "unplanned" }, { input: [] }, { store: true }, { max_output_tokens: 8192 }, { reasoning: { effort: "high" } }])
    expect(() => assertCompositionDispatch(JSON.stringify({ ...body, ...change }), allowed, 0)).toThrow();
});

it("rejects changes to the frozen comparison contract before any inference", () => {
  const manifest = { version: "1", methodId: "composition-comparison-v1", frozenAt: "2026-11-08T00:00:00.000Z",
    models: ["gpt-5.4-mini", "gpt-6-luna"], profileId: "one-shot-json-v1", promptVersion: "smooth-v2", cases: 27,
    trialsPerCase: 3, maxInferenceRequests: 162, priorInferenceRequests: 8511, maximumCumulativeInferenceRequests: 8673,
    perModelConcurrency: 6, aggregateConcurrency: 12, retries: 0, maxOutputTokens: 4096, suiteId: "fixed" };
  expect(() => assertCompositionManifest(manifest, { suiteId: "fixed" })).not.toThrow();
  for (const key of Object.keys(manifest))
    expect(() => assertCompositionManifest({ ...manifest, [key]: null }, { suiteId: "fixed" })).toThrow();
  expect(() => assertCompositionManifest(manifest, { suiteId: "different" })).toThrow();
});
