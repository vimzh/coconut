import { beforeAll, describe, expect, it } from "bun:test";
import { buildPrompt, extractAnswer } from "../protocol";
import type { RunRecord } from "../runs/types";
import { generateSuite } from "../suites";
import { sha256 } from "./data";
import { validateSignalExperiment } from "./experiment";
import { fixtureExperiment, fixtureRun, type Mutable } from "./fixtures";
import type { SignalReviewEvidence } from "./types";

let record: Mutable<RunRecord>;
type Experiment = Mutable<SignalReviewEvidence["experiment"]>;
beforeAll(async () => {
  const original = await fixtureRun();
  if (original.suite.formatVersion !== "1") throw new Error("Expected exact fixture.");
  const generated = await generateSuite({ ...original.suite.request, profileId: "one-shot-json-v2-high" });
  if (generated.status !== "complete") throw new Error("Could not generate explicit-effort fixture.");
  record = await fixtureRun(generated.suite);
});

function refreshed(value: Experiment): Experiment {
  value.manifestSha256 = sha256(value.manifest);
  value.capabilities.manifestSha256 = value.manifestSha256;
  value.capabilityEvidenceSha256 = sha256(value.capabilities);
  return value;
}

describe("retained experiment contents", () => {
  it("validates the frozen exact cell and completed inference permission, without treating catalog membership as permission", () => {
    const experiment = fixtureExperiment(record);
    expect(validateSignalExperiment(record, experiment)).toMatchObject({ valid: true, highestVerifiedEffort: "high" });
    const listing = structuredClone(experiment) as Experiment;
    listing.capabilities.probes[0].result.inferenceRequests = 0;
    expect(validateSignalExperiment(record, refreshed(listing)).valid).toBe(false);
  });

  it("rejects opaque hashes and content tampering", () => {
    const opaque = { manifestSha256: "1".repeat(64), capabilityEvidenceSha256: "2".repeat(64) } as SignalReviewEvidence["experiment"];
    expect(validateSignalExperiment(record, opaque).valid).toBe(false);
    const altered = structuredClone(fixtureExperiment(record)) as Experiment;
    altered.manifest.cells[0].concurrency++;
    expect(validateSignalExperiment(record, altered).reason).toContain("content hashes");
  });

  it("rejects a late freeze, wrong suite/settings/prompt identity, an unplanned frontier or a missing effort attempt", () => {
    const changes: ((value: Experiment) => void)[] = [
      (value) => { value.manifest.frozenAt = "2026-11-08T00:00:01.000Z"; },
      (value) => { value.manifest.cells[0].suiteSha256 = "0".repeat(64); },
      (value) => { value.manifest.cells[0].promptsSha256 = "0".repeat(64); },
      (value) => { value.manifest.cells[0].settingsId = "different-settings"; },
      (value) => { value.manifest.frontier.modelIds = []; },
      (value) => { value.manifest.modelEfforts[0].plannedEfforts.push("max"); },
    ];
    for (const change of changes) {
      const value = structuredClone(fixtureExperiment(record)) as Experiment;
      change(value);
      expect(validateSignalExperiment(record, refreshed(value)).valid).toBe(false);
    }
  });

  it("derives highest effort from returned successful probes and binds reported serving identity", () => {
    const value = structuredClone(fixtureExperiment(record)) as Experiment;
    value.manifest.modelEfforts[0].plannedEfforts.push("max");
    value.manifest.modelEfforts[0].documentedEfforts.push("max");
    const previous = value.capabilities.probes[0].result;
    const result = { ...structuredClone(previous), attemptId: "fixture-highest-effort-probe",
      requested: { ...previous.requested, profileId: "one-shot-json-v2-max" as const },
      prompt: buildPrompt({ expression: { op: "square", arg: { op: "variable" } }, domain: { min: "-1", max: "1" }, claimedLabel: "convex", witnessPairs: [] }, "one-shot-json-v2-max"),
      effective: { ...previous.effective, reasoningEffort: "max" },
      evidence: { ...previous.evidence, outcome: extractAnswer({ status: "completed", text: previous.evidence.outcome.rawText }, "one-shot-json-v2-max") },
    };
    value.capabilities.probes.push({ modelId: record.request.modelId, effort: "max", result: structuredClone(result) as Mutable<typeof result> });
    expect(validateSignalExperiment(record, refreshed(value)).reason).toContain("highest verified supported effort");
    const changed = structuredClone(record); changed.results[0].result.reportedModelId = "different-serving-model";
    expect(validateSignalExperiment(changed, fixtureExperiment(record)).reason).toContain("Reported model/serving identities changed");
  });
});
