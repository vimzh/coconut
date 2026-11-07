// Verify retained smooth evidence, reproducibility, and connection to the existing scoring contract.
import { describe, expect, it, spyOn } from "bun:test";
import { extractAnswer } from "../protocol";
import { scoreEvaluation } from "../scoring";
import type { RunEvidence } from "../scoring/types";
import { validateSuiteArtifact } from "../suites/artifact";
import type { SuiteRequest } from "../suites/types";
import { validateNumericalSuite } from "./manifest";
import { buildNumericalPrompt, buildNumericalPrompts } from "./prompt";
import { DEFAULT_NUMERICAL_REQUEST, generateNumericalSuite, parseNumericalRequest, provedDistinct } from "./suite";
import type { NumericalSuite } from "./types";
import * as backend from "./backend";

async function smallSuite(): Promise<NumericalSuite> {
  const result = await generateNumericalSuite({ ...DEFAULT_NUMERICAL_REQUEST, depths: [7], casesPerClass: 1 });
  if (result.status !== "complete") throw new Error(`Fixture incomplete: ${JSON.stringify(result.summary)}`);
  return result.suite;
}

function legacyRequest(request: NumericalSuite["request"]): SuiteRequest {
  const { seed, depths, casesPerClass, profileId, purpose } = request;
  return { seed, depths, casesPerClass, profileId, purpose };
}

function evidence(suite: NumericalSuite): RunEvidence {
  return {
    runId: "controlled-smooth-scoring", suiteId: suite.id, protocolVersion: "1", profileId: suite.request.profileId,
    model: { provider: "fixture", modelId: "fixture", endpointId: "fixture", settingsId: "fixture" },
    run: { elapsedMs: null, concurrency: null }, expressionTokens: [],
    trials: suite.cases.flatMap((entry) => [0, 1, 2].map((trialIndex) => ({
      caseId: entry.id, trialIndex, finalAttempt: 1, elapsedMs: null,
      attempts: [{ sequence: 1, outcome: extractAnswer({ status: "completed", text: JSON.stringify({ label: entry.label, explanation: "Controlled response." }) }, suite.request.profileId),
        errorKind: null, elapsedMs: null, usage: { input: null, output: null, reasoning: null }, cost: null }],
    }))),
  };
}

describe("smooth suites", () => {
  it("fills balanced measured depths with certified pairwise distinct functions and retained attempts", async () => {
    const result = await generateNumericalSuite(DEFAULT_NUMERICAL_REQUEST);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") throw new Error(JSON.stringify(result.summary));
    const suite = result.suite;
    expect(suite.cases.length).toBe(27);
    expect(suite.summary.coverage).toHaveLength(9);
    for (const target of suite.summary.coverage) expect(target.accepted).toBe(target.requested);
    expect(suite.summary.attempts).toBe(suite.attempts.length);
    expect(suite.attempts.filter((attempt) => attempt.outcome === "accepted")).toHaveLength(27);
    expect(suite.summary.attempts).toBe(27 + Object.values(suite.summary.rejections).reduce((sum, count) => sum + count, 0));
    expect(new Set(suite.cases.map((entry) => entry.family)).size).toBeGreaterThanOrEqual(5);
    for (const entry of suite.cases) {
      expect(entry.certificate.depth).toBe(entry.depth);
      expect(entry.certificate.backend).toEqual(suite.backend);
      expect(entry.certificate.cover.length).toBeGreaterThan(0);
      expect(entry.reference).toEqual(entry.certificate.input);
      expect(entry.certificate.nodeCount).toBeLessThanOrEqual(256);
    }
    for (let i = 0; i < suite.cases.length; i++) for (let j = i + 1; j < suite.cases.length; j++) {
      expect(provedDistinct(suite.cases[i].certificate, suite.cases[j].certificate)).toBe(true);
    }
    expect(await validateNumericalSuite(JSON.parse(JSON.stringify(suite)))).toEqual(suite);
    expect(suite.promptVersion).toBe("smooth-v2");
    expect(suite.request).toHaveProperty("promptVersion", "smooth-v2");
    expect(await Bun.file(new URL("../../data/suites/smooth-v2.json", import.meta.url)).text()).toBe(`${JSON.stringify(suite)}\n`);
    expect(Object.isFrozen(suite.cases[0].certificate.cover)).toBe(true);
  }, 30000);

  it("replays the retained legacy artifact without changing its request or exact bytes", async () => {
    const bytes = await Bun.file(new URL("../../data/suites/smooth-v1.json", import.meta.url)).text();
    const retained = await validateNumericalSuite(JSON.parse(bytes));
    expect(`${JSON.stringify(retained)}\n`).toBe(bytes);
    expect(retained.promptVersion).toBe("smooth-v1");
    expect(retained.request).not.toHaveProperty("promptVersion");
    const generated = await generateNumericalSuite(retained.request);
    expect(generated.status).toBe("complete");
    if (generated.status === "complete") expect(generated.suite).toEqual(retained);
  });

  it("changes wording identity while preserving all mathematical cases and evidence", async () => {
    const current = await smallSuite();
    const previous = await generateNumericalSuite(legacyRequest(current.request));
    if (previous.status !== "complete") throw new Error("Legacy fixture incomplete.");
    const legacy = previous.suite;
    expect(legacy.promptVersion).toBe("smooth-v1");
    expect(current.promptVersion).toBe("smooth-v2");
    expect(legacy.cases).toEqual(current.cases);
    expect(legacy.attempts).toEqual(current.attempts);
    expect(legacy.summary).toEqual(current.summary);
    expect(legacy.backend).toEqual(current.backend);
    expect(legacy.generatorVersion).toBe(current.generatorVersion);
    expect(legacy.id).not.toBe(current.id);
    expect(legacy.request).toEqual(legacyRequest(current.request));
    for (const altered of [structuredClone(current), structuredClone(legacy)]) {
      if (altered.promptVersion === "smooth-v2") Reflect.deleteProperty(altered.request, "promptVersion");
      else Object.assign(altered.request, { promptVersion: "smooth-v2" });
      await expect(validateNumericalSuite(altered)).rejects.toThrow("reproduction");
    }
  });

  it("preserves deterministic identity and changes identity with the seed or purpose", async () => {
    const suite = await smallSuite();
    expect((await validateSuiteArtifact(suite)).id).toBe(suite.id);
    for (const change of [{ seed: "another-smooth-seed" }, { purpose: "illustration" }]) {
      const result = await generateNumericalSuite({ ...suite.request, ...change });
      expect(result.status).toBe("complete");
      if (result.status === "complete") expect(result.suite.id).not.toBe(suite.id);
    }
    expect(provedDistinct(suite.cases[0].certificate, suite.cases[0].certificate)).toBe(false);
  });

  it("rejects altered proof, membership, versions, hidden fields, and getter payloads", async () => {
    const suite = await smallSuite();
    for (const alter of [
      (data: Record<string, unknown>) => { data.promptVersion = "other"; },
      (data: Record<string, unknown>) => { data.backend = {}; },
      (data: Record<string, unknown>) => { data.attempts = []; },
      (data: Record<string, unknown>) => { data.cases = []; },
      (data: Record<string, unknown>) => { data.extra = true; },
    ]) {
      const changed = structuredClone(suite) as unknown as Record<string, unknown>;
      alter(changed);
      await expect(validateNumericalSuite(changed)).rejects.toThrow("reproduction");
    }
    const changed = structuredClone(suite);
    Object.assign(changed.cases[0].certificate.cover[0].second, { min: "999" });
    await expect(validateNumericalSuite(changed)).rejects.toThrow("reproduction");
    let calls = 0;
    const getter = Object.defineProperty({}, "request", { get() { calls++; return suite.request; } });
    await expect(validateNumericalSuite(getter)).rejects.toThrow("as data");
    await expect(validateSuiteArtifact({ formatVersion: "99" })).rejects.toThrow("Unsupported");
    expect(calls).toBe(0);
  });

  it("bounds requests and returns explicit incomplete coverage on cancellation", async () => {
    for (const change of [{ depths: [5] }, { depths: [9, 7] }, { casesPerClass: 11 }, { extra: true }]) {
      expect(() => parseNumericalRequest({ ...DEFAULT_NUMERICAL_REQUEST, ...change })).toThrow();
    }
    const result = await generateNumericalSuite(DEFAULT_NUMERICAL_REQUEST, AbortSignal.abort());
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.reason).toBe("cancelled"); expect(result.summary.accepted).toBe(0); expect(result).not.toHaveProperty("suite");
    }
  });

  it("accepts only the explicit new request version and never invokes version accessors", () => {
    const legacy = legacyRequest(DEFAULT_NUMERICAL_REQUEST);
    expect(parseNumericalRequest(legacy)).toEqual(legacy);
    expect(parseNumericalRequest(DEFAULT_NUMERICAL_REQUEST)).toEqual(DEFAULT_NUMERICAL_REQUEST);
    for (const promptVersion of [undefined, null, "smooth-v1", "smooth-v3", 2]) {
      expect(() => parseNumericalRequest({ ...legacy, promptVersion })).toThrow();
    }
    let reads = 0;
    const getter = Object.defineProperty({ ...legacy }, "promptVersion", {
      enumerable: true,
      get() { reads++; throw new Error("Version accessor must not run."); },
    });
    expect(() => parseNumericalRequest(getter)).toThrow();
    expect(reads).toBe(0);
  });

  it("fills requests crossing the native batch boundary without changing order", async () => {
    const result = await generateNumericalSuite({ ...DEFAULT_NUMERICAL_REQUEST, casesPerClass: 10 });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") throw new Error(JSON.stringify(result.summary));
    expect(result.suite.cases).toHaveLength(90);
    expect(new Set(result.suite.cases.map((entry) => entry.id)).size).toBe(90);
    expect(result.suite.cases.map((entry) => [entry.depth, entry.label, entry.ordinal])).toEqual(
      [7, 9, 11].flatMap((depth) => (["convex", "concave", "neither"] as const).flatMap((label) =>
        Array.from({ length: 10 }, (_, ordinal) => [depth, label, ordinal]))));
  });

  it("retains inconclusive attempts and never freezes an undersized evaluation", async () => {
    const certify = backend.certifyReferences;
    let calls = 0;
    const mock = spyOn(backend, "certifyReferences").mockImplementation(async (references, signal) => {
      if (calls++ === 0) return references.map(() => ({ status: "unverified" as const, reason: "resource-limit" }));
      return certify(references, signal);
    });
    try {
      const result = await generateNumericalSuite({ ...DEFAULT_NUMERICAL_REQUEST, depths: [7], casesPerClass: 1 });
      expect(result.status).toBe("complete");
      if (result.status !== "complete") throw new Error("Expected recovery after a retained inconclusive batch.");
      expect(result.suite.summary.attempts).toBe(6);
      expect(result.suite.summary.rejections).toEqual({ "unverified:resource-limit": 3 });
      expect(result.suite.cases.every((entry) => entry.attempt === 1)).toBe(true);
      mock.mockImplementation(async (references) => references.map(() => ({ status: "unverified" as const, reason: "resource-limit" })));
      const exhausted = await generateNumericalSuite({ ...DEFAULT_NUMERICAL_REQUEST, depths: [7], casesPerClass: 1 });
      expect(exhausted.status).toBe("incomplete");
      if (exhausted.status === "incomplete") {
        expect(exhausted.reason).toBe("attempt-limit");
        expect(exhausted.summary.attempts).toBe(36);
        expect(exhausted.summary.accepted).toBe(0);
        expect(exhausted.attempts).toHaveLength(36);
        expect(exhausted).not.toHaveProperty("suite");
      }
    } finally { mock.mockRestore(); }
  });

  it("builds versioned label-free prompts for both existing answer profiles", async () => {
    const suite = await smallSuite();
    for (const profile of ["one-shot-json-v1", "one-shot-schema-v1"]) {
      const prompts = await buildNumericalPrompts(suite.cases.map((entry) => entry.reference), profile);
      for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
        expect(prompt.promptVersion).toBe("smooth-v2");
        expect(prompt.messages[1].content).toBe(`f(x) = ${suite.cases[i].certificate.renderedExpression}\nDomain: x in [-1, 1].`);
        for (const forbidden of [suite.cases[i].id, suite.cases[i].family, "certificate", "claimedLabel", "witness", "arb-jet"]) {
          expect(JSON.stringify(prompt)).not.toContain(forbidden);
        }
        expect(prompt.messages[0].content).toContain("exp and log use base e");
      }
    }
    await expect(buildNumericalPrompt({ ...suite.cases[0].reference, claimedLabel: "neither" }, "one-shot-json-v1"))
      .rejects.toThrow("verified reference");
  });

  it("scores numerical suites with explicit backend/task identity using retained evidence", async () => {
    const suite = await smallSuite();
    const report = await scoreEvaluation({ suite, evidence: evidence(suite) });
    expect(report.overall.classification.macroF1).toBe(1);
    expect(report.overall.classification.population.plannedTrials).toBe(9);
    expect(report.identity.certification).toEqual({ backend: suite.backend, promptVersion: "smooth-v2" });
    expect(report.identity.verifierVersion).toBe("arb-jet-v1");
    expect(report.identity.workload.logicalCalls).toBe(9);
    const illustrative = await generateNumericalSuite({ ...suite.request, purpose: "illustration" });
    if (illustrative.status !== "complete") throw new Error("Illustration fixture incomplete.");
    await expect(scoreEvaluation({ suite: illustrative.suite, evidence: evidence(illustrative.suite) })).rejects.toThrow("Illustrative");
  });

  it("scores each recorded wording version with its actual prompt lengths", async () => {
    const current = await smallSuite();
    const previous = await generateNumericalSuite(legacyRequest(current.request));
    if (previous.status !== "complete") throw new Error("Legacy scoring fixture incomplete.");
    const reports = [];
    for (const suite of [previous.suite, current]) {
      const prompts = await buildNumericalPrompts(suite.cases.map((entry) => entry.reference), suite.request.profileId, suite.promptVersion);
      const report = await scoreEvaluation({ suite, evidence: evidence(suite) });
      expect(report.identity.certification).toEqual({ backend: suite.backend, promptVersion: suite.promptVersion });
      for (let index = 0; index < suite.cases.length; index++) {
        const measured = report.overall.diagnostics.lengths.perCase.find((entry) => entry.caseId === suite.cases[index].id);
        const expected = prompts[index].messages.reduce((total, message) => total + [...message.content].length, 0);
        expect(measured?.promptCharacters).toBe(expected);
      }
      reports.push(report);
    }
    expect(reports[0].id).not.toBe(reports[1].id);
    expect(reports[0].overall.classification).toEqual(reports[1].overall.classification);
    expect(reports[0].overall.diagnostics.lengths.promptCharacters).not.toEqual(reports[1].overall.diagnostics.lengths.promptCharacters);
  });
});
