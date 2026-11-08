// The fixed reserve uses shared run/scoring paths while retaining its two-cluster exploratory boundary.
import { beforeAll, expect, it } from "bun:test";
import artifact from "../../data/suites/reserve-v1.json";
import { auditRun, auditSuite } from "../quality";
import { fixtureRun } from "../quality/fixtures";
import { analyzeValidatedSuite } from "../quality/suite";
import { createRunService } from "../runs/engine";
import { parseRunRequest, runPopulation } from "../runs/policy";
import { summarizePublishedRun } from "../runs/public";
import { createRunStore } from "../runs/store";
import type { RunSuite } from "../runs/types";
import { scoreEvaluation } from "../scoring";
import { validateSuiteArtifact } from "./artifact";

let suite: RunSuite, record: Awaited<ReturnType<typeof fixtureRun>>;
beforeAll(async () => {
  suite = await validateSuiteArtifact(artifact);
  record = await fixtureRun(suite);
  record.revision = 0;
}, 60000);

it("retains 18 current candidates and all 54 controlled trials without confirmation or uncertainty claims", async () => {
  expect(record.request.suiteKey).toBe("reserve-v1");
  expect(record.report?.identity.generatorVersion).toBe("reserve-v1");
  expect(record.report?.overall.classification).toMatchObject({ macroF1: 1, population: { plannedTrials: 54, includedTrials: 54, correctTrials: 54, status: "complete" } });
  expect(record.report?.byDepth.map(row => row.depth)).toEqual([17, 23]);
  const quality = await auditSuite(suite);
  expect(quality.population).toMatchObject({ cases: 18, families: 3, clusters: 2, attemptedCandidates: 18, acceptedCandidates: 18, rejectedCandidates: 0, unverifiedCandidates: 0 });
  expect(quality.coverage.labels).toEqual({ convex: 6, concave: 6, neither: 6 });
  expect(quality.clusters.every(cluster => cluster.caseIds.length === 9)).toBe(true);
  expect(quality.candidateAccounting.groups.reduce((sum, group) => sum + group.accepted, 0)).toBe(18);
  expect(quality.findings.find(entry => entry.id === "exploratory-reserve-coverage")?.status).toBe("unresolved");
  expect(quality.gate.verdict).toBe("no-go");
  const runQuality = await auditRun(record);
  expect(runQuality.denominators).toMatchObject({ plannedTrials: 54, includedModelOutcomes: 54, validCorrect: 54, distinctInstances: 18, clusters: 2, families: 3 });
  expect(runQuality.uncertainty).toMatchObject({ status: "unavailable", clusters: 2, intervals: null });
  expect(runQuality.uncertainty.reasons.some(reason => reason.includes("20 effective task clusters"))).toBe(true);
  expect(runQuality.signal.verdict).toBe("no-go");
  const store = createRunStore({ path: ":memory:" });
  try {
    const created = store.create(record), published = store.publish(record.id, created.accessCode, true)!;
    expect(summarizePublishedRun(published).suite).toMatchObject({ generatorVersion: "reserve-v1", population: "exploratory", caseCount: 18 });
    expect(store.readPublic(record.id)?.record.report?.id).toBe(record.report?.id);
    expect(JSON.stringify(published)).not.toContain(created.accessCode);
  } finally { store.close(); }
}, 60000);

it("matches the recorded reserve review and keeps altered memberships unresolved", () => {
  const matching = analyzeValidatedSuite(suite);
  expect(matching.findings.find(entry => entry.id === "independent-reserve-review")).toMatchObject({ status: "passed", severity: "warning" });
  expect(matching.findings.find(entry => entry.id === "independent-reserve-review")?.evidence).toContain("matches the recorded AI-assisted independent review");
  expect(matching.reviewRecords.find(entry => entry.reference === "docs/research/independent-reserve-review-v1.md")?.status).toBe("matched");
  expect(matching.gate.verdict).toBe("no-go");
  const altered = structuredClone(artifact);
  Object.assign(altered.cases[0].analyticCertificate.parameters, { quadraticCoefficient: "changed" });
  const mismatched = analyzeValidatedSuite(altered as unknown as RunSuite);
  expect(mismatched.findings.find(entry => entry.id === "independent-reserve-review")).toMatchObject({ status: "unresolved", severity: "missing-evidence" });
  expect(mismatched.findings.find(entry => entry.id === "independent-reserve-review")?.evidence).toContain("differs from expected fingerprint");
  expect(mismatched.reviewRecords.find(entry => entry.reference === "docs/research/independent-reserve-review-v1.md")?.status).toBe("missing");
  expect(mismatched.gate.verdict).toBe("no-go");
});

it("binds the reserve workload key, generator and exploratory population before any inference or public projection", async () => {
  const request = parseRunRequest(record.request);
  expect(request.suiteKey).toBe("reserve-v1");
  expect(runPopulation(request.suiteKey, suite)).toBe("exploratory");
  const forged = structuredClone(record);
  Object.assign(forged.suite.request, { population: "confirmation" });
  expect(() => runPopulation("reserve-v1", forged.suite)).toThrow("identity and population");
  expect(() => summarizePublishedRun({ record: forged, publishedAt: null })).toThrow("identity and population");
  const store = createRunStore({ path: ":memory:" });
  let calls = 0;
  const service = createRunService({ store, loadSuite: async () => suite, inferenceClient: async () => { calls++; throw new Error("No inference should be dispatched."); } });
  try {
    for (const suiteKey of ["reference-v1", "smooth-v2", "challenge-v1", "screening-v1", "interior-v1"] as const) {
      expect(() => store.create({ ...record, request: { ...request, suiteKey } })).toThrow();
      await expect(service.execute({ ...request, suiteKey }, "controlled-unused-credential")).rejects.toThrow("identity and population");
    }
    expect(() => store.create(forged)).toThrow();
    expect(calls).toBe(0);
    expect(store.listPublic()).toEqual([]);
  } finally { store.close(); }
}, 60000);

it("rejects altered generation, population, exact separation, profile binding and report arithmetic", async () => {
  for (const generatorVersion of ["smooth-v1", "interior-v1", "challenge-v1"]) await expect(validateSuiteArtifact({ ...artifact, generatorVersion })).rejects.toThrow();
  for (const change of [
    (value: typeof artifact) => Object.assign(value.request, { population: "confirmation" }),
    (value: typeof artifact) => Object.assign(value.request, { profileId: "one-shot-json-v2-max" }),
    (value: typeof artifact) => Object.assign(value.exactSourceSeparation, { ratio: "1" }),
    (value: typeof artifact) => Object.assign(value.cases[0].analyticCertificate, { label: "neither" }),
  ]) {
    const changed = structuredClone(artifact); change(changed);
    await expect(validateSuiteArtifact(changed)).rejects.toThrow();
  }
  await expect(scoreEvaluation({ suite, evidence: { ...record.evidence, profileId: "one-shot-schema-v1" } })).rejects.toThrow();
  const changedReport = structuredClone(record);
  changedReport.report!.overall.classification.macroF1 = 0;
  await expect(auditRun(changedReport)).rejects.toThrow("shared-scorer replay");
}, 60000);
