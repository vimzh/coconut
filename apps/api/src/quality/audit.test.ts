import { beforeAll, describe, expect, it } from "bun:test";
import { generateChallengeSuite, getChallengeRequest } from "../challenge";
import type { RunSuite } from "../runs/types";
import { auditRun, auditSuite, referenceReviewHash, transcriptReviewHash, type SignalReviewEvidence } from "./index";
import { fixtureExperiment, fixtureRun, replaceReply, type Mutable } from "./fixtures";
import { analyzeValidatedSuite } from "./suite";
import type { RunRecord } from "../runs/types";

let base: Mutable<RunRecord>;
beforeAll(async () => { base = await fixtureRun(); });

describe("bounded offline quality audits", () => {
  it("reuses the shared score, permits its neutral label enum and exports no raw replies", async () => {
    const report = await auditRun(base);
    expect(report.headline).toEqual(base.report!.overall.classification);
    expect(report.denominators).toMatchObject({ plannedTrials: 9, validCorrect: 9, includedModelOutcomes: 9, retainedAttempts: 9 });
    expect(report.findings.find((item) => item.id === "prompt-leakage")?.status).toBe("passed");
    expect(report.signal.verdict).toBe("no-go");
    expect(report.uncertainty.status).toBe("unavailable");
    expect(JSON.stringify(report)).not.toContain("Controlled fixture.");
    expect(JSON.stringify(report)).not.toContain("rawText");
  });

  it("rejects removed trial records and a forged retained report", async () => {
    const missing = structuredClone(base); missing.evidence.trials.pop();
    await expect(auditRun(missing)).rejects.toThrow("Missing planned trial");
    const forged = structuredClone(base); forged.report!.overall.classification.macroF1 = 0;
    await expect(auditRun(forged)).rejects.toThrow("shared-scorer replay");
  });

  it("retains explicit unattempted work and separates infrastructure from a wrong label", async () => {
    const record = structuredClone(base), trial = record.evidence.trials[0];
    trial.attempts = []; trial.finalAttempt = null; trial.elapsedMs = null;
    record.results.shift(); record.report = null;
    record.progress.modelOutcomes--; record.progress.inferenceRequests--;
    const report = await auditRun(record);
    expect(report.denominators).toMatchObject({ plannedTrials: 9, includedModelOutcomes: 8, unattempted: 1, validWrong: 0 });
    expect(report.gate.verdict).toBe("no-go");
    expect(report.uncertainty.reasons.join(" ")).toContain("Every planned trial");
    const provider = structuredClone(base);
    replaceReply(provider, 0, 0, { status: "provider-error", text: "", message: "private-provider-diagnostic" });
    const failed = await auditRun(provider);
    expect(failed.denominators).toMatchObject({ includedModelOutcomes: 8, providerErrors: 1, validWrong: 0 });
    expect(JSON.stringify(failed)).not.toContain("private-provider-diagnostic");
  });

  it("detects extra metadata and altered token ceilings without echoing the sentinel", async () => {
    const leaked = structuredClone(base);
    Object.assign(leaked.results[0].result.prompt, { certificate: "private-certificate-sentinel", family: "private-family-sentinel" });
    const report = await auditRun(leaked);
    expect(report.findings.find((item) => item.id === "prompt-leakage")).toMatchObject({ severity: "critical", status: "unresolved" });
    expect(report.gate.verdict).toBe("no-go");
    expect(JSON.stringify(report)).not.toContain("private-certificate-sentinel");
    const changed = structuredClone(base); changed.results[0].result.budget.maxOutputTokens = 16384;
    const changedReport = await auditRun(changed);
    expect(changedReport.findings.find((item) => item.id === "budget-and-settings")?.status).toBe("unresolved");
    expect(changedReport.signal.verdict).toBe("no-go");
  });

  it("never treats malformed or truncated replies as wrong valid mathematical labels", async () => {
    const record = structuredClone(base);
    replaceReply(record, 0, 0, { status: "completed", text: "malformed" });
    replaceReply(record, 0, 1, { status: "truncated", text: '{"label":"neither","explanation":"Fixture."}' });
    const report = await auditRun(record);
    expect(report.denominators).toMatchObject({ malformed: 1, truncated: 1, includedModelOutcomes: 9, validWrong: 0 });
    expect(report.signal.candidateCaseIds).toEqual([]);
    expect(report.outcomeReviews.map((item) => item.category)).toEqual(["format-only-failure", "budget-exhaustion"]);
  });

  it("records actual wrong labels for review without inferring frontier or expert approval", async () => {
    const record = structuredClone(base), reference = record.suite.cases[0].label;
    for (const trial of [0, 1]) replaceReply(record, 0, trial, { status: "completed", text: JSON.stringify({ label: reference === "convex" ? "concave" : "convex", explanation: "Wrong fixture." }) });
    const report = await auditRun(record);
    expect(report.denominators.validWrong).toBe(2);
    expect(report.signal.candidateCaseIds).toEqual([record.suite.cases[0].id]);
    expect(report.signal.verdict).toBe("no-go");
    expect(report.outcomeReviews.every((item) => item.status === "needs-review")).toBe(true);
  });

  it("flags duplicate identities internally and rejects tampered suite membership at the public boundary", async () => {
    const duplicate = structuredClone(base.suite);
    if (duplicate.formatVersion !== "1") throw new Error("Expected the exact fixture suite.");
    duplicate.cases.push({ ...structuredClone(duplicate.cases[0]), id: "duplicate-fixture" });
    const report = analyzeValidatedSuite(duplicate);
    expect(report.duplicates).toHaveLength(1);
    expect(report.findings.find((item) => item.id === "duplicate-tasks")?.severity).toBe("critical");
    await expect(auditSuite(duplicate)).rejects.toThrow();
    await expect(auditSuite({ ...base.suite, cases: Array(257).fill(base.suite.cases[0]) })).rejects.toThrow("256");
  });

  it("discloses historical family/label confounds instead of approving broad coverage", async () => {
    const suite = await Bun.file(new URL("../../data/suites/smooth-v2.json", import.meta.url)).json() as RunSuite;
    const report = await auditSuite(suite);
    expect(report.population.cases).toBe(27);
    expect(report.findings.find((item) => item.id === "family-label-confound")).toMatchObject({ status: "accepted-scoped-limitation" });
    expect(report.coverage.families.find((item) => item.family === "exponential-quadratic")?.labels).toEqual({ convex: 3, concave: 0, neither: 0 });
  }, 30000);
});

describe("reviewed mathematical-failure evidence", () => {
  it("requires exact reviews, recorded highest effort and two independently checked family clusters", async () => {
    const generated = await generateChallengeSuite(getChallengeRequest("confirmation", "one-shot-json-v2-high"));
    if (generated.status !== "complete") throw new Error("Challenge fixture failed certification.");
    const record = await fixtureRun(generated.suite);
    const targets = [0, 9];
    for (const i of targets) for (const trial of [0, 1]) replaceReply(record, i, trial, { status: "completed", text: '{"label":"concave","explanation":"Wrong fixture."}' });
    const reviews: SignalReviewEvidence = {
      experiment: fixtureExperiment(record),
      trials: targets.flatMap((i) => [0, 1, 2].map((trialIndex) => {
        const entry = record.suite.cases[i], result = record.results.find((row) => row.caseId === entry.id && row.trialIndex === trialIndex)!.result;
        return { caseId: entry.id, trialIndex, attemptId: result.attemptId, transcriptSha256: transcriptReviewHash(result),
          referenceSha256: referenceReviewHash(entry), referenceIndependentlyChecked: true, reviewerRole: "AI-assisted",
          diagnosis: trialIndex < 2 ? "mathematical-error" : "correct-label" };
      })),
    };
    const report = await auditRun(record, reviews);
    expect(report.suite.reviewRecords.find((item) => item.role === "AI-assisted independent mathematical review")?.status).toBe("matched");
    expect(report.uncertainty.status).toBe("available");
    expect(report.signal.verdict).toBe("go");
    expect(report.signal.qualifiedCaseIds).toHaveLength(2);
    const mixedRecord = structuredClone(record), mixedReview = structuredClone(reviews) as Mutable<SignalReviewEvidence>;
    replaceReply(mixedRecord, targets[0], 2, { status: "completed", text: "malformed third completed reply" });
    const third = mixedReview.trials.find((item) => item.caseId === mixedRecord.suite.cases[targets[0]].id && item.trialIndex === 2)!;
    third.diagnosis = "format-only-failure";
    third.transcriptSha256 = transcriptReviewHash(mixedRecord.results.find((item) => item.caseId === third.caseId && item.trialIndex === 2)!.result);
    // Two independently reviewed wrong valid labels qualify; a reviewed completed format failure is not itself a mathematical error.
    expect((await auditRun(mixedRecord, mixedReview)).signal.verdict).toBe("go");
    const stale = structuredClone(reviews) as Mutable<SignalReviewEvidence>; stale.trials[0].transcriptSha256 = "3".repeat(64);
    await expect(auditRun(record, stale)).rejects.toThrow("stale");
    const unsupported = structuredClone(reviews) as Mutable<SignalReviewEvidence>; unsupported.experiment.manifest.cells[0].reasoningEffort = "xhigh";
    expect((await auditRun(record, unsupported)).signal.verdict).toBe("no-go");
  }, 60000);
});
