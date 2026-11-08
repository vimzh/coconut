// Exact identities, retained references and adversarial replay protect the fixed reserve population.
import { beforeAll, describe, expect, it, spyOn } from "bun:test";
import { createHash } from "node:crypto";
import { add, cmp, div, evaluatePolynomial, measure, mul, neg, polynomialFromExpression, polynomialProduct, q, samePolynomial, square, sub, text } from "../challenge/algebra";
import * as backend from "../numerics/backend";
import { buildNumericalPrompts } from "../numerics/prompt";
import { provedDistinct } from "../numerics/suite";
import type { NumericalCertificate, NumericalReference } from "../numerics/types";
import { createReserveCandidate, createReserveCandidates } from "./candidates";
import { DEFAULT_RESERVE_REQUEST, generateReserveSuite, getReserveRequest, parseReserveRequest, RESERVE_FAMILIES, validateReserveSuite, type ReserveSuite } from "./index";
import { curvatureBoundsAt, numeratorPolynomial, sourcePolynomial } from "./reference";

const labels = ["convex", "concave", "neither"] as const;
const proposalPath = new URL("../../data/research/conditional-reserve-v1.json", import.meta.url);
const proposalHash = "766261f379ea91fc748b0e612068b9717a33ccc612be14747f16e306e4457b85";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Proposal = {
  cases: { sourceGroup: number; family: string; reference: NumericalReference; nativeCertificate: NumericalCertificate }[];
  independentProof: { exactNumeratorBernsteinProofs: { group: number; outer: string; sourceCoefficients: string[]; numeratorCoefficients: string[] }[] };
};
let suite: ReserveSuite, proposal: Proposal;
beforeAll(async () => {
  const bytes = await Bun.file(proposalPath).bytes();
  expect(digest(bytes)).toBe(proposalHash);
  proposal = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Proposal;
  const result = await generateReserveSuite();
  if (result.status !== "complete") throw new Error("Reserve fixtures did not certify.");
  suite = result.suite;
}, 30000);

describe("independent reserve mathematics", () => {
  it("recovers the exact sources and checks all six derivative numerator identities", () => {
    const expected = ["0", "9/256", "0", "-205/256", "0", "273/64", "0", "-15/2", "0", "4"].map(q);
    expect(sourcePolynomial(0).map(text)).toEqual(expected.map(text));
    expect(samePolynomial(sourcePolynomial(1), polynomialProduct([q("-1/8"), q(1)], expected))).toBe(true);
    expect(numeratorPolynomial("reserve-logarithm", [q(0), q(1)]).map(text)).toEqual(["2", "0", "-2"]);
    expect(numeratorPolynomial("reserve-reciprocal", [q(0), q(1)]).map(text)).toEqual(["-2", "0", "6"]);
    expect(samePolynomial(numeratorPolynomial("reserve-square-root", [q(0), q(1)]), [q(1)])).toBe(true);
    const outer = { "reserve-logarithm": "log", "reserve-reciprocal": "reciprocal", "reserve-square-root": "sqrt" } as const;
    for (const family of RESERVE_FAMILIES) for (const group of [0, 1] as const) {
      const p = sourcePolynomial(group), retained = proposal.independentProof.exactNumeratorBernsteinProofs.find((entry) => entry.outer === outer[family] && entry.group === group)!;
      expect(p.map(text)).toEqual(retained.sourceCoefficients);
      expect(numeratorPolynomial(family, p).map(text)).toEqual(retained.numeratorCoefficients);
      expect(numeratorPolynomial(family, p)).toHaveLength(group === 0 ? 35 : 39);
      const expression = createReserveCandidate(family, "neither", group).reference.expression;
      if (expression.op !== "add") throw new Error("Expected a quadratic shift.");
      const base = expression.left;
      const inner = base.op === "divide" ? base.right : base.op === "log" || base.op === "sqrt" ? base.arg : null;
      if (inner?.op !== "add" || inner.right.op !== "square") throw new Error("Expected a squared source polynomial.");
      expect(samePolynomial(polynomialFromExpression(inner.right.arg), p)).toBe(true);
    }
    for (const group of [-1, 2, 0.5, NaN]) expect(() => sourcePolynomial(group)).toThrow();
  });

  it("proves strict global signs and only two strict interior witnesses for neither", () => {
    for (const entry of suite.cases) {
      const proof = entry.analyticCertificate;
      expect(proof).toMatchObject({ policy: "reserve-bernstein-v1", family: entry.family, label: entry.label, polynomial: null });
      if (entry.label !== "neither") {
        expect(proof.witnesses).toHaveLength(0);
        expect(proof.globalSecond).not.toBeNull();
        expect(entry.label === "convex" ? cmp(q(proof.globalSecond!.min), q(0)) : -cmp(q(proof.globalSecond!.max), q(0))).toBeGreaterThan(0);
      } else {
        expect(proof.globalSecond).toBeNull();
        expect(proof.witnesses.map((point) => point.x)).toEqual(["0", "-15/16"]);
        expect(proof.witnesses.some((point) => cmp(q(point.min), q(0)) > 0)).toBe(true);
        expect(proof.witnesses.some((point) => cmp(q(point.max), q(0)) < 0)).toBe(true);
        const a = q(entry.family === "reserve-reciprocal" ? "-1/64" : "1/64");
        for (const point of proof.witnesses) {
          expect(cmp(q(point.x), q(entry.reference.domain.min))).toBeGreaterThan(0);
          expect(cmp(q(point.x), q(entry.reference.domain.max))).toBeLessThan(0);
          const actual = curvatureBoundsAt(entry.family, sourcePolynomial(entry.ordinal), a, q(point.x));
          expect(cmp(q(point.min), actual.min)).toBeLessThanOrEqual(0);
          expect(cmp(actual.max, q(point.max))).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  it("checks all nine misleading curvature probes and all 16 grid-closed Jensen pairs", () => {
    const grid = Array.from({ length: 9 }, (_, i) => q(`${i - 4}/4`));
    const pairs = grid.flatMap((x, i) => grid.slice(i + 1).filter((y) => grid.some((point) => cmp(point, div(add(x, y), q(2))) === 0)).map((y) => [x, y] as const));
    expect(pairs).toHaveLength(16);
    for (const entry of suite.cases.filter((candidate) => candidate.label === "neither")) {
      const p = sourcePolynomial(entry.ordinal), dp = p.slice(1).map((coefficient, i) => mul(coefficient, q(i + 1)));
      const a = q(entry.family === "reserve-reciprocal" ? "-1/64" : "1/64");
      const multiplier = q(entry.family === "reserve-logarithm" ? 2 : entry.family === "reserve-reciprocal" ? -2 : 1);
      for (const x of grid) {
        expect(text(evaluatePolynomial(p, x))).toBe("0");
        expect(cmp(square(evaluatePolynomial(dp, x)), q(0))).toBeGreaterThan(0);
        const expected = add(mul(multiplier, square(evaluatePolynomial(dp, x))), mul(q(2), a));
        const actual = curvatureBoundsAt(entry.family, p, a, x);
        expect(actual).toEqual({ min: expected, max: expected });
        expect(entry.family === "reserve-reciprocal" ? cmp(expected, q("-1/32")) : -cmp(expected, q("1/32"))).toBeLessThan(0);
      }
      const valueOnGrid = (x: ReturnType<typeof q>) => add(q(entry.family === "reserve-logarithm" ? 0 : 1), mul(a, square(x)));
      for (const [x, y] of pairs) {
        const gap = sub(valueOnGrid(div(add(x, y), q(2))), div(add(valueOnGrid(x), valueOnGrid(y)), q(2)));
        expect(gap).toEqual(neg(div(mul(a, square(sub(x, y))), q(4))));
        expect(entry.family === "reserve-reciprocal" ? cmp(gap, q(0)) : -cmp(gap, q(0))).toBeGreaterThan(0);
      }
      expect(text(sub(valueOnGrid(q(0)), div(add(valueOnGrid(q(-1)), valueOnGrid(q(1))), q(2))))).toBe(entry.family === "reserve-reciprocal" ? "1/64" : "-1/64");
    }
  });
});

describe("reserve artifacts", () => {
  it("certifies the canonical balanced population within unchanged native limits", () => {
    const fixed = createReserveCandidates();
    expect(createReserveCandidates()).toBe(fixed);
    expect(fixed.map((entry) => [entry.family, entry.clusterIndex, entry.reference.claimedLabel])).toEqual(RESERVE_FAMILIES.flatMap((family) => [0, 1].flatMap((group) => labels.map((label) => [family, group, label]))));
    expect(suite.request).toEqual(DEFAULT_RESERVE_REQUEST);
    expect(suite.request).toMatchObject({ seed: "coconut-reserve-exploratory-v1", population: "exploratory", depths: [17, 23], casesPerClass: 6, purpose: "evaluation" });
    expect(suite.cases).toHaveLength(18);
    expect(suite.attempts).toHaveLength(18);
    expect(suite.summary).toMatchObject({ attempts: 18, accepted: 18, rejections: {} });
    expect(suite).not.toHaveProperty("designRevisions");
    expect(suite.familyCoverage).toHaveLength(9);
    for (const coverage of suite.familyCoverage) expect([coverage.requested, coverage.accepted]).toEqual([2, 2]);
    expect(new Set(suite.cases.map((entry) => entry.clusterId)).size).toBe(2);
    for (const cluster of new Set(suite.cases.map((entry) => entry.clusterId))) expect(suite.cases.filter((entry) => entry.clusterId === cluster)).toHaveLength(9);
    for (const [i, entry] of suite.cases.entries()) {
      expect(entry.reference).toEqual(proposal.cases[i].reference);
      expect(entry.certificate).toEqual(proposal.cases[i].nativeCertificate);
      expect(entry.reference).toEqual(entry.certificate.input);
      const nodes = (entry.ordinal === 0 ? 36 : 48) + Number(entry.family === "reserve-reciprocal");
      expect(measure(entry.reference.expression)).toEqual({ depth: entry.ordinal === 0 ? 17 : 23, nodes });
      expect(entry.certificate.nodeCount).toBe(nodes);
      expect(entry.certificate.precision).toBe(192);
      expect(entry.certificate.cover.length).toBeLessThanOrEqual(132);
      expect(Object.isFrozen(entry.analyticCertificate.parameters)).toBe(true);
    }
    expect(Object.isFrozen(fixed)).toBe(true);
    expect(Object.isFrozen(fixed[0].reference.expression)).toBe(true);
    expect(() => Object.assign(fixed[0].analyticCertificate.parameters, { sourceCoefficients: "0" })).toThrow();
    expect(() => Object.assign(suite.cases[0].analyticCertificate.witnesses, { extra: true })).toThrow();
  });

  it("uses exact source separation when all nine native value probes coincide", () => {
    expect(suite.distinctness).toBe("native-probes-or-exact-source-value-v1");
    expect(suite.exactSourceSeparation).toMatchObject({ policy: "strict-monotone-outer-v1", x: "-15/16", ratio: "289/256" });
    expect(suite.exactSourceSeparation.familyDirections).toEqual(RESERVE_FAMILIES.map((family) => ({ family, direction: family === "reserve-reciprocal" ? "decreasing" : "increasing" })));
    for (const family of RESERVE_FAMILIES) for (const label of labels) {
      const [a, b] = suite.cases.filter((entry) => entry.family === family && entry.label === label);
      expect(provedDistinct(a.certificate, b.certificate)).toBe(false);
      const x = q("-15/16"), p0 = square(evaluatePolynomial(sourcePolynomial(0), x)), p1 = square(evaluatePolynomial(sourcePolynomial(1), x));
      expect(cmp(p0, q(0))).toBeGreaterThan(0);
      expect(p1).toEqual(mul(q("289/256"), p0));
      expect(cmp(p1, p0)).toBeGreaterThan(0);
      expect(suite.exactSourceSeparation.sourceSquares).toEqual([text(p0), text(p1)]);
    }
  });

  it("replays retained bytes and changes only profile-bound suite identity", async () => {
    const bytes = await Bun.file(new URL("../../data/suites/reserve-v1.json", import.meta.url)).text();
    expect(`${JSON.stringify(suite)}\n`).toBe(bytes);
    expect(await validateReserveSuite(JSON.parse(bytes))).toEqual(suite);
    const other = await generateReserveSuite(getReserveRequest("one-shot-json-v2-max"));
    if (other.status !== "complete") throw new Error("Profile fixture did not certify.");
    expect(other.suite.id).not.toBe(suite.id);
    expect(other.suite.cases).toEqual(suite.cases);
    expect(other.suite.attempts).toEqual(suite.attempts);
    expect(digest(await Bun.file(proposalPath).bytes())).toBe(proposalHash);
  }, 30000);

  it("replays every current native admission on warm generations", async () => {
    const original = backend.certifyReferences;
    const observed = spyOn(backend, "certifyReferences").mockImplementation(original);
    try {
      for (let i = 0; i < 2; i++) expect((await generateReserveSuite()).status).toBe("complete");
      expect(observed.mock.calls.map(([references]) => references.length)).toEqual([18, 18]);
    } finally { observed.mockRestore(); }
  }, 30000);

  it("rejects altered membership, proofs, admission evidence, accounting and ordering", async () => {
    for (const mutate of [
      (data: ReserveSuite) => Object.assign(data, { generatorVersion: "changed" }),
      (data: ReserveSuite) => Object.assign(data.cases[0], { clusterId: "changed" }),
      (data: ReserveSuite) => Object.assign(data.cases[0].analyticCertificate.parameters, { sourceCoefficients: "0" }),
      (data: ReserveSuite) => Object.assign(data.cases[0].certificate.cover[0].second, { min: "999" }),
      (data: ReserveSuite) => Object.assign(data.summary, { accepted: 17 }),
      (data: ReserveSuite) => Object.assign(data.familyCoverage[0], { accepted: 0 }),
      (data: ReserveSuite) => Object.assign(data.exactSourceSeparation, { ratio: "1" }),
      (data: ReserveSuite) => Object.assign(data.cases[0].reference.domain, { min: "0" }),
      (data: ReserveSuite) => Object.assign(data.attempts[0], { reason: "changed" }),
      (data: ReserveSuite) => Object.assign(data, { cases: [...data.cases].reverse() }),
      (data: ReserveSuite) => Object.assign(data, { attempts: [...data.attempts].reverse() }),
      (data: ReserveSuite) => Object.assign(data, { extra: true }),
    ]) {
      const altered = structuredClone(suite); mutate(altered);
      await expect(validateReserveSuite(altered)).rejects.toThrow("reproduction");
    }
  }, 60000);

  it("rejects request drift and accessors without running caller code", async () => {
    expect(parseReserveRequest(suite.request)).toEqual(suite.request);
    for (const change of [{ seed: "changed" }, { population: "confirmation" }, { depths: [23, 17] }, { casesPerClass: 7 }, { purpose: "illustration" }, { extra: true }]) expect(() => parseReserveRequest({ ...suite.request, ...change })).toThrow();
    let reads = 0;
    const getter = Object.defineProperty({ ...suite.request }, "profileId", { enumerable: true, get() { reads++; return suite.request.profileId; } });
    expect(() => parseReserveRequest(getter)).toThrow();
    await expect(validateReserveSuite(Object.defineProperty({}, "request", { get() { reads++; return suite.request; } }))).rejects.toThrow("as data");
    const nested = structuredClone(suite);
    Object.defineProperty(nested.cases[0], "clusterId", { enumerable: true, get() { reads++; return "changed"; } });
    await expect(validateReserveSuite(nested)).rejects.toThrow("reproduction");
    expect(reads).toBe(0);
  }, 30000);

  it("retains incomplete attempts and cancellation without creating a suite identity", async () => {
    const mocked = spyOn(backend, "certifyReferences").mockImplementation(async (references) => references.map(() => ({ status: "unverified" as const, reason: "resource-limit" })));
    try {
      const result = await generateReserveSuite();
      expect(mocked).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ status: "incomplete", reason: "candidate-rejected", summary: { attempts: 18, accepted: 0, rejections: { "unverified:resource-limit": 18 } } });
      if (result.status !== "incomplete") throw new Error("Unverified references cannot create a suite.");
      expect(result.attempts).toHaveLength(18);
      expect(result.attempts.map((entry) => entry.reference)).toEqual(createReserveCandidates().map((entry) => entry.reference));
      expect(result).not.toHaveProperty("suite");
      expect(result).not.toHaveProperty("id");
    } finally { mocked.mockRestore(); }
    const cancelled = await generateReserveSuite(suite.request, AbortSignal.abort());
    expect(cancelled).toMatchObject({ status: "incomplete", reason: "cancelled", summary: { attempts: 0, accepted: 0 } });
    expect(cancelled).not.toHaveProperty("suite");
    expect(cancelled).not.toHaveProperty("id");
  });

  it("keeps labels and private reference metadata out of every prompt", async () => {
    const prompts = await buildNumericalPrompts(suite.cases.map((entry) => entry.reference), suite.request.profileId, suite.promptVersion);
    expect(prompts).toHaveLength(18);
    for (const [i, prompt] of prompts.entries()) {
      const entry = suite.cases[i];
      expect(prompt.promptVersion).toBe("smooth-v2");
      expect(prompt.messages[1].content).toBe(`f(x) = ${entry.certificate.renderedExpression}\nDomain: x in [${entry.reference.domain.min}, ${entry.reference.domain.max}].`);
      for (const forbidden of [entry.id, entry.clusterId, entry.family, "analyticCertificate", "claimedLabel", "reserve-bernstein-v1", "exactSourceSeparation"]) expect(JSON.stringify(prompt)).not.toContain(forbidden);
    }
  });
});
