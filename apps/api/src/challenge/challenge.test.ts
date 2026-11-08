// Independent analytic identities, native admission, held-out separation and strict replay cover challenge integrity.
import { beforeAll, describe, expect, it, spyOn } from "bun:test";
import * as backend from "../numerics/backend";
import { buildNumericalPrompts } from "../numerics/prompt";
import { provedDistinct } from "../numerics/suite";
import { assertAnalyticSigns, cmp, evaluatePolynomial, expBounds, measure, mul, polynomialFromExpression, q, samePolynomial, secondDerivative, text } from "./algebra";
import { createChallengeCandidate, createChallengeCandidates } from "./candidates";
import { generateChallengeSuite, getChallengeRequest, parseChallengeRequest, validateChallengeSuite } from "./suite";
import { CHALLENGE_FAMILIES, type ChallengeSuite } from "./types";

let confirmation: ChallengeSuite, screening: ChallengeSuite;
beforeAll(async () => {
  const a = await generateChallengeSuite(), b = await generateChallengeSuite(getChallengeRequest("screening"));
  if (a.status !== "complete" || b.status !== "complete") throw new Error("Challenge fixtures did not certify completely.");
  confirmation = a.suite; screening = b.suite;
});

describe("independent challenge references", () => {
  it("proves every fixed family/label/parameter regime with strict analytic signs", () => {
    for (const family of CHALLENGE_FAMILIES) for (let cluster = 0; cluster <= 3; cluster++) {
      for (const label of ["convex", "concave", "neither"] as const) {
        const candidate = createChallengeCandidate(family, label, cluster);
        assertAnalyticSigns(candidate.analyticCertificate);
        expect(candidate.analyticCertificate.label).toBe(label);
        for (const point of candidate.analyticCertificate.witnesses) {
          expect(cmp(q(point.x), q(candidate.reference.domain.min))).toBeGreaterThan(0);
          expect(cmp(q(point.x), q(candidate.reference.domain.max))).toBeLessThan(0);
        }
      }
    }
  });

  it("checks the expanded polynomial against independently written coefficients", () => {
    const candidate = createChallengeCandidate("integrated-curvature", "convex", 0);
    const expected = ["0", "0", "1105/131072", "0", "-15/4096", "0", "59/3840", "0", "-5/224", "0", "1/90"].map(q);
    const actual = polynomialFromExpression(candidate.reference.expression);
    expect(samePolynomial(actual, expected)).toBe(true);
    expect(candidate.analyticCertificate.polynomial?.source).toEqual(["9/256", "0", "-5/8", "0", "1"]);
    for (const label of ["convex", "concave", "neither"] as const) {
      const source = createChallengeCandidate("integrated-curvature", label, 0), proof = source.analyticCertificate.polynomial!;
      expect(samePolynomial(secondDerivative(polynomialFromExpression(source.reference.expression)), proof.second.map(q))).toBe(true);
      for (const root of ["-3/4", "-1/4", "1/4", "3/4"]) expect(text(evaluatePolynomial(proof.source.map(q), q(root)))).toBe("0");
    }
  });

  it("bounds the exponential independently with a positive series and reciprocal identities", () => {
    expect(expBounds(q(0))).toEqual({ min: q(1), max: q(1) });
    const positive = expBounds(q(1)), negative = expBounds(q(-1));
    expect(cmp(positive.min, q("2718281828/1000000000"))).toBeGreaterThan(0);
    expect(cmp(positive.max, q("2718281829/1000000000"))).toBeLessThan(0);
    expect(text(mul(positive.max, negative.min))).toBe("1");
    expect(text(mul(positive.min, negative.max))).toBe("1");
    expect(() => expBounds(q(5))).toThrow("fixed bound");
  });

  it("rejects corrupted analytic signs and unsupported candidate coordinates", () => {
    const valid = createChallengeCandidate("local-logarithm", "convex", 0).analyticCertificate;
    expect(() => assertAnalyticSigns({ ...valid, globalSecond: { min: "-1", max: "1" } })).toThrow("exclusive label");
    expect(() => assertAnalyticSigns({ ...valid, label: "neither", globalSecond: null, witnesses: [] })).toThrow("exclusive label");
    for (const cluster of [-1, 4, 0.5, NaN]) expect(() => createChallengeCandidate("local-logarithm", "convex", cluster)).toThrow("coordinates");
  });
});

describe("challenge artifacts", () => {
  it("certifies 72 tasks with every label in every family, 24 clusters and measured depths", () => {
    expect(confirmation.cases).toHaveLength(72);
    expect(confirmation.attempts).toHaveLength(72);
    expect(confirmation.summary.rejections).toEqual({});
    expect(confirmation.request.depths).toEqual([3, 4, 5, 6, 14]);
    expect(confirmation.familyCoverage).toHaveLength(24);
    expect(new Set(confirmation.cases.map((entry) => entry.clusterId)).size).toBe(24);
    for (const target of confirmation.familyCoverage) expect([target.requested, target.accepted]).toEqual([3, 3]);
    for (const target of confirmation.summary.coverage) expect(target.accepted).toBe(target.requested);
    for (const entry of confirmation.cases) {
      expect(measure(entry.reference.expression)).toEqual({ depth: entry.depth, nodes: entry.certificate.nodeCount });
      expect(entry.reference).toEqual(entry.certificate.input);
      expect(entry.label).toBe(entry.analyticCertificate.label);
      expect(entry.certificate.cover.length).toBeGreaterThan(0);
      expect(entry.certificate.nodeCount).toBeLessThanOrEqual(256);
      expect(Object.isFrozen(entry.analyticCertificate)).toBe(true);
    }
    for (const family of CHALLENGE_FAMILIES) {
      const group = confirmation.cases.filter((entry) => entry.family === family);
      for (const label of ["convex", "concave", "neither"]) expect(group.filter((entry) => entry.label === label)).toHaveLength(3);
      for (const cluster of new Set(group.map((entry) => entry.clusterId))) expect(new Set(group.filter((entry) => entry.clusterId === cluster).map((entry) => entry.label)).size).toBe(3);
    }
  });

  it("admits differing domains explicitly and certifies same-domain pairwise function differences", () => {
    for (let i = 0; i < confirmation.cases.length; i++) for (let j = i + 1; j < confirmation.cases.length; j++) {
      const a = confirmation.cases[i], b = confirmation.cases[j];
      expect(a.id).not.toBe(b.id);
      if (a.reference.domain.min === b.reference.domain.min && a.reference.domain.max === b.reference.domain.max) {
        expect(provedDistinct(a.certificate, b.certificate)).toBe(true);
      }
    }
    const logarithm = confirmation.cases.filter((entry) => entry.family === "local-logarithm" && entry.ordinal === 0);
    expect(new Set(logarithm.map((entry) => JSON.stringify(entry.reference.expression))).size).toBe(1);
    expect(new Set(logarithm.map((entry) => JSON.stringify(entry.reference.domain))).size).toBe(3);
    expect(new Set(logarithm.map((entry) => entry.clusterId)).size).toBe(1);
  });

  it("keeps screening parameter clusters and exact mathematical tasks out of confirmation", () => {
    expect(screening.cases).toHaveLength(9);
    expect(new Set(screening.cases.map((entry) => entry.clusterId)).size).toBe(3);
    const clusters = new Set(confirmation.cases.map((entry) => entry.clusterId)), tasks = new Set(confirmation.cases.map((entry) => entry.id));
    for (const entry of screening.cases) {
      expect(clusters.has(entry.clusterId)).toBe(false);
      expect(tasks.has(entry.id)).toBe(false);
      expect(entry.ordinal).toBe(3);
    }
  });

  it("changes profile-bound artifact identity while retaining exactly the same mathematical cases", async () => {
    for (const profile of ["one-shot-schema-v1", "one-shot-json-v2-high"] as const) {
      const result = await generateChallengeSuite(getChallengeRequest("screening", profile));
      if (result.status !== "complete") throw new Error("Profile fixture did not certify.");
      expect(result.suite.id).not.toBe(screening.id);
      expect(result.suite.cases).toEqual(screening.cases);
      expect(result.suite.attempts).toEqual(screening.attempts);
      expect(result.suite.summary).toEqual(screening.summary);
      expect(await validateChallengeSuite(JSON.parse(JSON.stringify(result.suite)))).toEqual(result.suite);
    }
  });

  it("reproduces the retained artifact bytes through full native and analytic replay", async () => {
    const bytes = await Bun.file(new URL("../../data/suites/challenge-v1.json", import.meta.url)).text();
    expect(`${JSON.stringify(confirmation)}\n`).toBe(bytes);
    expect(await validateChallengeSuite(JSON.parse(bytes))).toEqual(confirmation);
  });

  it("replays complete evidence and rejects altered references, clusters, independent proofs and summaries", async () => {
    expect(await validateChallengeSuite(JSON.parse(JSON.stringify(screening)))).toEqual(screening);
    for (const mutate of [
      (data: ChallengeSuite) => Object.assign(data, { generatorVersion: "changed" }),
      (data: ChallengeSuite) => Object.assign(data.cases[0], { clusterId: "changed" }),
      (data: ChallengeSuite) => Object.assign(data.cases[0].analyticCertificate.parameters, { c: "99" }),
      (data: ChallengeSuite) => Object.assign(data.cases[0].certificate.cover[0].second, { min: "999" }),
      (data: ChallengeSuite) => Object.assign(data.summary, { accepted: 8 }),
      (data: ChallengeSuite) => Object.assign(data.familyCoverage[0], { accepted: 0 }),
      (data: ChallengeSuite) => Object.assign(data.attempts[0], { reason: "changed" }),
      (data: ChallengeSuite) => Object.assign(data, { extra: true }),
    ]) {
      const changed = structuredClone(screening);
      mutate(changed);
      await expect(validateChallengeSuite(changed)).rejects.toThrow("reproduction");
    }
    let reads = 0;
    const getter = Object.defineProperty({}, "request", { get() { reads++; return screening.request; } });
    await expect(validateChallengeSuite(getter)).rejects.toThrow("as data");
    const nested = structuredClone(screening);
    Object.defineProperty(nested.cases[0], "clusterId", { enumerable: true, get() { reads++; return "x"; } });
    await expect(validateChallengeSuite(nested)).rejects.toThrow("reproduction");
    expect(reads).toBe(0);
  });

  it("rejects request drift and getters without executing caller code", () => {
    expect(parseChallengeRequest(screening.request)).toEqual(screening.request);
    for (const change of [{ seed: "changed" }, { depths: [14] }, { casesPerClass: 4 }, { population: "other" }, { purpose: "illustration" }, { extra: true }]) {
      expect(() => parseChallengeRequest({ ...screening.request, ...change })).toThrow();
    }
    let reads = 0;
    const getter = Object.defineProperty({ ...screening.request }, "profileId", { enumerable: true, get() { reads++; return "one-shot-json-v1"; } });
    expect(() => parseChallengeRequest(getter)).toThrow();
    expect(reads).toBe(0);
    expect(() => getChallengeRequest("other" as "confirmation")).toThrow("population");
  });

  it("retains every rejected candidate and never replaces or freezes unresolved work", async () => {
    const mocked = spyOn(backend, "certifyReferences").mockImplementation(async (references) => references.map(() => ({ status: "unverified" as const, reason: "resource-limit" })));
    try {
      const result = await generateChallengeSuite(screening.request);
      expect(mocked).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") throw new Error("Unresolved candidates must remain incomplete.");
      expect(result.reason).toBe("candidate-rejected");
      expect(result.summary.rejections).toEqual({ "unverified:resource-limit": 9 });
      expect(result.attempts).toHaveLength(9);
      expect(result.attempts[0].reference).toEqual(createChallengeCandidates("screening")[0].reference);
      expect(result).not.toHaveProperty("suite");
      expect(result).not.toHaveProperty("id");
    } finally { mocked.mockRestore(); }
  });

  it("returns explicit cancellation without a successful suite identity", async () => {
    const result = await generateChallengeSuite(screening.request, AbortSignal.abort());
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.reason).toBe("cancelled");
      expect(result.summary.attempts).toBe(0);
      expect(result.summary.accepted).toBe(0);
      expect(result).not.toHaveProperty("suite");
    }
  });

  it("builds smooth-v2 prompts for all tasks without private reference, family or cluster metadata", async () => {
    for (const suite of [confirmation, screening]) {
      const prompts = await buildNumericalPrompts(suite.cases.map((entry) => entry.reference), suite.request.profileId, suite.promptVersion);
      expect(prompts).toHaveLength(suite.cases.length);
      prompts.forEach((prompt, index) => {
        const entry = suite.cases[index];
        expect(prompt.promptVersion).toBe("smooth-v2");
        expect(prompt.messages[1].content).toBe(`f(x) = ${entry.certificate.renderedExpression}\nDomain: x in [${entry.reference.domain.min}, ${entry.reference.domain.max}].`);
        for (const forbidden of [entry.id, entry.clusterId, entry.family, "analyticCertificate", "claimedLabel", "certificate", "arb-jet-v1"]) expect(JSON.stringify(prompt)).not.toContain(forbidden);
      });
    }
  });
});
