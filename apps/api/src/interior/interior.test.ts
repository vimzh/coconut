// Independent identities, native admission and adversarial replay protect the exploratory population.
import { beforeAll, describe, expect, it, spyOn } from "bun:test";
import * as backend from "../numerics/backend";
import { buildNumericalPrompts } from "../numerics/prompt";
import { provedDistinct } from "../numerics/suite";
import { cmp, measure, mul, polynomialFromExpression, q, samePolynomial, text } from "../challenge/algebra";
import { createInteriorCandidate, createInteriorCandidates } from "./candidates";
import { bernsteinBounds, curvatureAt, exponentialBounds, polynomialBounds, signPolynomial, sourcePolynomial } from "./reference";
import { generateInteriorSuite, getInteriorRequest, parseInteriorRequest, validateInteriorSuite } from "./suite";
import { INTERIOR_FAMILIES, type InteriorSuite } from "./types";

let suite: InteriorSuite;
beforeAll(async () => {
  const result = await generateInteriorSuite();
  if (result.status !== "complete") throw new Error("Interior fixtures did not certify.");
  suite = result.suite;
}, 30000);

describe("independent interior mathematics", () => {
  it("checks the coefficient rendering and elementary curvature identities", () => {
    expect(sourcePolynomial(0).map(text)).toEqual(["1/4", "1", "1/8", "-5", "1/64", "4"]);
    expect(samePolynomial(signPolynomial("quintic-logarithm", [q(0), q(1)]), [q(2), q(0), q(-2)])).toBe(true);
    expect(samePolynomial(signPolynomial("quintic-reciprocal", [q(0), q(1)]), [q(-2), q(0), q(6)])).toBe(true);
    const candidate = createInteriorCandidate("quintic-logarithm", "convex", 0), expression = candidate.reference.expression;
    if (expression.op !== "log" || expression.arg.op !== "add" || expression.arg.right.op !== "square") throw new Error("Unexpected logarithm structure.");
    expect(samePolynomial(polynomialFromExpression(expression.arg.right.arg), sourcePolynomial(0))).toBe(true);
  });

  it("checks Bernstein bounds across a zero and an independent exponential bracket", () => {
    expect(bernsteinBounds([q(0), q(0), q(1)], q(-1), q(1))).toEqual({ min: q(-1), max: q(1) });
    expect(polynomialBounds([q(0), q(0), q(1)], q(-1), q(1))).toEqual({ min: q(0), max: q(1) });
    expect(exponentialBounds(q(0))).toEqual({ min: q(1), max: q(1) });
    const positive = exponentialBounds(q(1)), negative = exponentialBounds(q(-1));
    expect(cmp(positive.min, q("2718281828/1000000000"))).toBeGreaterThan(0);
    expect(cmp(positive.max, q("2718281829/1000000000"))).toBeLessThan(0);
    expect(text(mul(positive.max, negative.min))).toBe("1");
    expect(text(mul(positive.min, negative.max))).toBe("1");
    expect(() => exponentialBounds(q(5))).toThrow("exceeds four");
    expect(() => bernsteinBounds(Array.from({ length: 20 }, () => q(1)), q(0), q(1))).toThrow("fixed-degree");
  });

  it("proves both global regimes and an interior sign change missed by endpoints and midpoint", () => {
    for (const entry of suite.cases) {
      const proof = entry.analyticCertificate;
      if (entry.label !== "neither") {
        expect(proof.witnesses).toHaveLength(0);
        expect(proof.globalSecond).not.toBeNull();
        expect(entry.label === "convex" ? cmp(q(proof.globalSecond!.min), q(0)) : -cmp(q(proof.globalSecond!.max), q(0))).toBeGreaterThan(0);
      } else {
        expect(proof.globalSecond).toBeNull();
        expect(proof.witnesses.map((point) => point.x)).toEqual(["0", "1/3"]);
        for (const point of proof.witnesses) {
          expect(cmp(q(point.x), q(entry.reference.domain.min))).toBeGreaterThan(0);
          expect(cmp(q(point.x), q(entry.reference.domain.max))).toBeLessThan(0);
        }
        const positive = entry.family !== "quintic-reciprocal", p = sourcePolynomial(entry.ordinal);
        for (const x of ["-3/5", "0", "3/5"]) {
          const actual = curvatureAt(entry.family, p, q(x));
          expect(positive ? cmp(actual.min, q(0)) : -cmp(actual.max, q(0))).toBeGreaterThan(0);
        }
        const interior = curvatureAt(entry.family, p, q("1/3"));
        expect(positive ? cmp(interior.max, q(0)) : -cmp(interior.min, q(0))).toBeLessThan(0);
      }
    }
    for (const index of [-1, 8, 0.5, NaN]) expect(() => sourcePolynomial(index)).toThrow("parameter index");
  });

  it("retains all eight wrong historical domains and independently verifies their actual neither label", async () => {
    expect(suite.designRevisions).toHaveLength(8);
    const actual = await backend.certifyReferences(suite.designRevisions.map((entry) => ({ ...entry.reference, claimedLabel: "neither" })));
    for (const [index, entry] of suite.designRevisions.entries()) {
      expect(entry.outcome).toEqual({ status: "rejected", reason: "label-mismatch" });
      expect(entry.reference.domain).toEqual({ min: "1/2", max: "5/8" });
      expect(entry.replacementDomain).toEqual({ min: "17/32", max: "5/8" });
      expect(entry.actualLabel).toBe("neither");
      expect(actual[index].status).toBe("verified");
      for (const point of entry.independentWitnesses) {
        expect(cmp(q(point.x), q(entry.reference.domain.min))).toBeGreaterThan(0);
        expect(cmp(q(point.x), q(entry.reference.domain.max))).toBeLessThan(0);
        const value = curvatureAt("quintic-reciprocal", sourcePolynomial(index), q(point.x));
        expect(cmp(q(point.min), value.min)).toBeLessThanOrEqual(0);
        expect(cmp(value.max, q(point.max))).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe("interior artifacts", () => {
  it("certifies 72 balanced tasks with eight shared source clusters and honest measured structure", () => {
    const fixed = createInteriorCandidates();
    expect(createInteriorCandidates()).toBe(fixed);
    expect(Object.isFrozen(fixed)).toBe(true);
    expect(Object.isFrozen(fixed[0].reference.expression)).toBe(true);
    expect(Object.isFrozen(fixed[0].analyticCertificate.parameters)).toBe(true);
    expect(() => Object.assign(fixed[0].analyticCertificate.parameters, { sourceCoefficients: "0" })).toThrow();
    expect(suite.cases).toHaveLength(72);
    expect(suite.attempts).toHaveLength(72);
    expect(suite.request.population).toBe("exploratory");
    expect(suite.request.depths).toEqual([13]);
    expect(suite.summary).toMatchObject({ accepted: 72, attempts: 72, rejections: {} });
    expect(suite.familyCoverage).toHaveLength(9);
    expect(new Set(suite.cases.map((entry) => entry.clusterId)).size).toBe(8);
    for (const target of suite.familyCoverage) expect([target.requested, target.accepted]).toEqual([8, 8]);
    for (const family of INTERIOR_FAMILIES) for (const label of ["convex", "concave", "neither"]) expect(suite.cases.filter((entry) => entry.family === family && entry.label === label)).toHaveLength(8);
    for (const cluster of new Set(suite.cases.map((entry) => entry.clusterId))) {
      const entries = suite.cases.filter((entry) => entry.clusterId === cluster);
      expect(entries).toHaveLength(9);
      expect(new Set(entries.map((entry) => entry.family)).size).toBe(3);
    }
    for (const entry of suite.cases) {
      expect(entry.reference).toEqual(entry.certificate.input);
      expect(measure(entry.reference.expression)).toEqual({ depth: 13, nodes: entry.family === "quintic-reciprocal" ? 26 : 25 });
      expect(entry.certificate.cover.length).toBeLessThanOrEqual(10);
      expect(Object.isFrozen(entry.analyticCertificate.parameters)).toBe(true);
    }
    for (let i = 0; i < suite.cases.length; i++) for (let j = i + 1; j < suite.cases.length; j++) {
      const a = suite.cases[i], b = suite.cases[j];
      expect(a.id).not.toBe(b.id);
      if (a.reference.domain.min === b.reference.domain.min && a.reference.domain.max === b.reference.domain.max) expect(provedDistinct(a.certificate, b.certificate)).toBe(true);
    }
  });

  it("replays the retained artifact exactly and keeps profile identities separate", async () => {
    const bytes = await Bun.file(new URL("../../data/suites/interior-v1.json", import.meta.url)).text();
    expect(`${JSON.stringify(suite)}\n`).toBe(bytes);
    expect(await validateInteriorSuite(JSON.parse(bytes))).toEqual(suite);
    const other = await generateInteriorSuite(getInteriorRequest("one-shot-json-v2-max"));
    if (other.status !== "complete") throw new Error("Profile fixture did not certify.");
    expect(other.suite.id).not.toBe(suite.id);
    expect(other.suite.cases).toEqual(suite.cases);
    expect(other.suite.designRevisions).toEqual(suite.designRevisions);
  }, 30000);

  it("replays all native admissions and historical rejections even when fixed proofs are cached", async () => {
    const original = backend.certifyReferences, observed = spyOn(backend, "certifyReferences").mockImplementation(original);
    try {
      for (let i = 0; i < 2; i++) expect((await generateInteriorSuite()).status).toBe("complete");
      expect(observed.mock.calls.map(([references]) => references.length)).toEqual([64, 8, 8, 64, 8, 8]);
    } finally { observed.mockRestore(); }
  });

  it("rejects changed membership, evidence, history, order and accessors without invoking caller code", async () => {
    for (const mutate of [
      (data: InteriorSuite) => Object.assign(data, { generatorVersion: "changed" }),
      (data: InteriorSuite) => Object.assign(data.cases[0], { clusterId: "changed" }),
      (data: InteriorSuite) => Object.assign(data.cases[0].analyticCertificate.parameters, { sourceCoefficients: "0" }),
      (data: InteriorSuite) => Object.assign(data.cases[0].certificate.cover[0].second, { min: "999" }),
      (data: InteriorSuite) => Object.assign(data.summary, { accepted: 71 }),
      (data: InteriorSuite) => Object.assign(data.familyCoverage[0], { accepted: 0 }),
      (data: InteriorSuite) => Object.assign(data.attempts[0], { reason: "changed" }),
      (data: InteriorSuite) => Object.assign(data.designRevisions[0], { actualLabel: "concave" }),
      (data: InteriorSuite) => Object.assign(data, { cases: [...data.cases].reverse() }),
      (data: InteriorSuite) => Object.assign(data, { extra: true }),
    ]) {
      const altered = structuredClone(suite); mutate(altered);
      await expect(validateInteriorSuite(altered)).rejects.toThrow("reproduction");
    }
    let reads = 0;
    await expect(validateInteriorSuite(Object.defineProperty({}, "request", { get() { reads++; return suite.request; } }))).rejects.toThrow("as data");
    const nested = structuredClone(suite);
    Object.defineProperty(nested.cases[0], "clusterId", { enumerable: true, get() { reads++; return "changed"; } });
    await expect(validateInteriorSuite(nested)).rejects.toThrow("reproduction");
    expect(reads).toBe(0);
    expect(parseInteriorRequest(suite.request)).toEqual(suite.request);
    for (const changed of [{ seed: "changed" }, { population: "confirmation" }, { casesPerClass: 25 }, { depths: [12] }, { purpose: "illustration" }, { extra: true }]) expect(() => parseInteriorRequest({ ...suite.request, ...changed })).toThrow();
    const getter = Object.defineProperty({ ...suite.request }, "profileId", { enumerable: true, get() { reads++; return suite.request.profileId; } });
    expect(() => parseInteriorRequest(getter)).toThrow();
    expect(reads).toBe(0);
  }, 60000);

  it("retains unresolved current admissions without replacing cases or creating an identity", async () => {
    const mocked = spyOn(backend, "certifyReferences").mockImplementation(async (references) => references.map(() => ({ status: "unverified" as const, reason: "resource-limit" })));
    try {
      const result = await generateInteriorSuite();
      expect(mocked).toHaveBeenCalledTimes(2);
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") throw new Error("Unverified work cannot become a suite.");
      expect(result.summary.rejections).toEqual({ "unverified:resource-limit": 72 });
      expect(result.attempts).toHaveLength(72);
      expect(result.attempts[0].reference).toEqual(createInteriorCandidates()[0].reference);
      expect(result).not.toHaveProperty("suite");
      expect(result).not.toHaveProperty("id");
    } finally { mocked.mockRestore(); }
    const cancelled = await generateInteriorSuite(suite.request, AbortSignal.abort());
    expect(cancelled).toMatchObject({ status: "incomplete", reason: "cancelled", summary: { accepted: 0, attempts: 0 } });
    expect(cancelled).not.toHaveProperty("suite");
  }, 30000);

  it("sends only expressions, domains and neutral instructions to prompt building", async () => {
    const prompts = await buildNumericalPrompts(suite.cases.map((entry) => entry.reference), suite.request.profileId, suite.promptVersion);
    expect(prompts).toHaveLength(72);
    for (const [i, prompt] of prompts.entries()) {
      const entry = suite.cases[i];
      expect(prompt.promptVersion).toBe("smooth-v2");
      expect(prompt.messages[1].content).toBe(`f(x) = ${entry.certificate.renderedExpression}\nDomain: x in [${entry.reference.domain.min}, ${entry.reference.domain.max}].`);
      for (const forbidden of [entry.family, entry.clusterId, entry.id, "analyticCertificate", "claimedLabel", "interior-bernstein-taylor-v1"]) expect(JSON.stringify(prompt)).not.toContain(forbidden);
    }
  });
});
