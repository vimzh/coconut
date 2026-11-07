import { describe, expect, it, spyOn } from "bun:test";
import * as math from "../math";
import type { VerificationResult } from "../math";
import * as candidates from "./candidates";
import {
  DEFAULT_SUITE_REQUEST,
  generateSuite,
  MAX_CANDIDATES_PER_CASE,
  SuiteInputError,
} from "./index";
import type { FrozenSuite, SuiteRequest } from "./index";

const labels = ["convex", "concave", "neither"] as const;
const smallRequest: SuiteRequest = {
  seed: "suite-tests-v1", depths: [5], casesPerClass: 1,
  profileId: "one-shot-json-v1", purpose: "evaluation",
};

async function complete(request: SuiteRequest): Promise<FrozenSuite> {
  const result = await generateSuite(request);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error(JSON.stringify(result.summary));
  return result.suite;
}

describe("deterministic suite generation", () => {
  it("fills the default 75 cases with independently verified actual class and depth coverage", async () => {
    const suite = await complete(DEFAULT_SUITE_REQUEST);
    expect(suite.request.depths).toEqual([5, 10, 20, 40, 80]);
    expect(suite.cases).toHaveLength(75);
    expect(suite.summary.accepted).toBe(75);
    expect(suite.summary.attempts).toBeGreaterThanOrEqual(75);
    expect(new Set(suite.cases.map((entry) => entry.id)).size).toBe(75);
    expect(new Set(suite.cases.map((entry) => entry.semanticKey)).size).toBe(75);
    for (const depth of suite.request.depths) {
      for (const label of labels) {
        const cases = suite.cases.filter((entry) => entry.depth === depth && entry.label === label);
        expect(cases).toHaveLength(5);
        expect(cases.map((entry) => entry.ordinal)).toEqual([0, 1, 2, 3, 4]);
        expect(suite.summary.coverage.find((entry) => entry.depth === depth && entry.label === label))
          .toEqual({ depth, label, requested: 5, accepted: 5 });
        for (const entry of cases) {
          const verified = math.verifyReference(entry.reference);
          expect(verified.status).toBe("verified");
          if (verified.status !== "verified") throw new Error(JSON.stringify(verified));
          expect(verified.label).toBe(label);
          expect(verified.certificate.depth).toBe(depth);
          expect(verified.certificate).toEqual(entry.certificate);
          expect(entry.reference.domain).toEqual({ min: "-1", max: "1" });
        }
      }
    }
    expect(suite.summary.coverage).toHaveLength(15);
    expect(suite.id).toMatch(/^suite-v1-[a-f0-9]{64}$/);
    expect(Object.isFrozen(suite)).toBe(true);
    expect(Object.isFrozen(suite.cases)).toBe(true);
    expect(Object.isFrozen(suite.cases[0].certificate.input.expression)).toBe(true);
  });

  it("honors requested intermediate depths and the schema profile without substitutions", async () => {
    const request: SuiteRequest = { ...smallRequest, depths: [6, 17, 79], profileId: "one-shot-schema-v1" };
    const suite = await complete(request);
    expect(suite.request).toEqual(request);
    expect(suite.cases.map(({ depth, label }) => ({ depth, label })))
      .toEqual(request.depths.flatMap((depth) => labels.map((label) => ({ depth, label }))));
    expect(suite.cases.every((entry) => entry.certificate.depth === entry.depth)).toBe(true);
    expect(suite.summary.coverage.every((entry) => entry.accepted === entry.requested)).toBe(true);
  });

  it("applies the candidate limit per requested case while allowing larger class/depth groups", async () => {
    const suite = await complete({ ...smallRequest, casesPerClass: 13 });
    expect(suite.cases).toHaveLength(39);
    expect(suite.summary.coverage.every((entry) => entry.requested === 13 && entry.accepted === 13)).toBe(true);
    expect(suite.summary.attempts).toBeGreaterThanOrEqual(39);
    expect(suite.summary.attempts).toBeLessThanOrEqual(39 * MAX_CANDIDATES_PER_CASE);
  });

  it("reproduces identical bytes for one seed and changes retained cases for another seed", async () => {
    const first = await complete(smallRequest);
    const repeated = await complete(structuredClone(smallRequest));
    const changed = await complete({ ...smallRequest, seed: "another-suite-seed" });
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(first));
    expect(changed.id).not.toBe(first.id);
    expect(changed.cases.map((entry) => entry.reference)).not.toEqual(first.cases.map((entry) => entry.reference));
  });

  it("binds purpose to suite identity while retaining the same seeded cases", async () => {
    const evaluation = await complete(smallRequest);
    const illustration = await complete({ ...smallRequest, purpose: "illustration" });
    expect(illustration.cases).toEqual(evaluation.cases);
    expect(illustration.id).not.toBe(evaluation.id);
    expect(illustration.request.purpose).toBe("illustration");
  });
});

describe("suite request boundaries", () => {
  it("rejects malformed records, missing fields, unknown fields, profiles, purposes, and domains", async () => {
    for (const input of [
      null, undefined, [], "request", {}, new Date(), Object.create(smallRequest),
      { ...smallRequest, seed: undefined },
      { ...smallRequest, extra: true },
      { ...smallRequest, [Symbol("extra")]: true },
      { ...smallRequest, profileId: "unknown-profile" },
      { ...smallRequest, purpose: "training" },
      { ...smallRequest, domain: { min: "-2", max: "2" } },
      { ...smallRequest, family: "other-family" },
    ]) {
      await expect(generateSuite(input)).rejects.toBeInstanceOf(SuiteInputError);
    }
  });

  it("enforces seed syntax and finite positive integer case counts within the workload limit", async () => {
    for (const seed of ["", "x".repeat(65), "contains space", "line\nbreak", "é", 1, null]) {
      await expect(generateSuite({ ...smallRequest, seed })).rejects.toBeInstanceOf(SuiteInputError);
    }
    for (const casesPerClass of [0, -1, 1.5, "1", null, NaN, Infinity, 334, Number.MAX_SAFE_INTEGER]) {
      await expect(generateSuite({ ...smallRequest, casesPerClass })).rejects.toBeInstanceOf(SuiteInputError);
    }
    await expect(generateSuite({ ...smallRequest, depths: [5, 10], casesPerClass: 167 }))
      .rejects.toBeInstanceOf(SuiteInputError);
  });

  it("requires a dense ordinary ascending depth array within the declared depth policy", async () => {
    const extraField = Object.assign([5], { extra: true });
    const invalidPrototype = Object.setPrototypeOf([5], {});
    for (const depths of [
      undefined, null, 5, [], [4], [81], [5.5], ["5"], [NaN], [Infinity],
      [10, 5], [5, 5], new Array(1), [5, , 10], Array.from({ length: 77 }, (_, index) => index + 5),
      extraField, invalidPrototype,
    ]) {
      await expect(generateSuite({ ...smallRequest, depths })).rejects.toBeInstanceOf(SuiteInputError);
    }
  });

  it("rejects request and depth accessors without invoking them", async () => {
    let calls = 0;
    const getter = () => { calls++; throw new Error("A request getter must not run"); };
    const requestGetter = { ...smallRequest };
    Object.defineProperty(requestGetter, "seed", { get: getter });
    const depths = [5];
    Object.defineProperty(depths, "0", { get: getter });
    await expect(generateSuite(requestGetter)).rejects.toBeInstanceOf(SuiteInputError);
    await expect(generateSuite({ ...smallRequest, depths })).rejects.toBeInstanceOf(SuiteInputError);
    expect(calls).toBe(0);
  });
});

describe("bounded admission and cancellation", () => {
  const failures: Exclude<VerificationResult, { status: "verified" }>[] = [
    { status: "rejected", reason: "label-mismatch", message: "Fixture rejection." },
    { status: "unverified", reason: "inconclusive-curvature", message: "Fixture inconclusive evidence." },
    { status: "unverified", reason: "no-strict-witness", message: "Fixture absent witness." },
    { status: "unverified", reason: "resource-limit", message: "Fixture resource boundary." },
    { status: "excluded", reason: "overlapping-labels", message: "Fixture overlapping labels." },
  ];

  for (const failure of failures) {
    it(`counts ${failure.status}:${failure.reason} and stops at the candidate limit`, async () => {
      const verifier = spyOn(math, "verifyReference").mockReturnValue(failure);
      try {
        const result = await generateSuite(smallRequest);
        expect(result.status).toBe("incomplete");
        if (result.status !== "incomplete") throw new Error("A forced failure completed a suite");
        expect(result.reason).toBe("attempt-limit");
        expect(result.cases).toHaveLength(0);
        expect(result.summary).toMatchObject({
          attempts: MAX_CANDIDATES_PER_CASE, accepted: 0,
          rejections: { [`${failure.status}:${failure.reason}`]: MAX_CANDIDATES_PER_CASE },
        });
        expect(result.summary.coverage.every((entry) => entry.accepted === 0 && entry.requested === 1)).toBe(true);
        expect(Object.hasOwn(result, "suite")).toBe(false);
        expect(Object.hasOwn(result, "id")).toBe(false);
        expect(verifier).toHaveBeenCalledTimes(MAX_CANDIDATES_PER_CASE);
      } finally {
        verifier.mockRestore();
      }
    });
  }

  for (const reason of ["label-mismatch", "depth-mismatch"] as const) {
    it(`rejects a verified result with ${reason} instead of substituting an easier slot`, async () => {
      const candidate = candidates.createCandidate(smallRequest.seed, "convex", 5, 0, 0);
      const verified = math.verifyReference(candidate.reference);
      if (verified.status !== "verified") throw new Error("The fixture must verify");
      const forced: VerificationResult = reason === "label-mismatch"
        ? { ...verified, label: "concave" }
        : { ...verified, certificate: { ...verified.certificate, depth: 6 } };
      const verifier = spyOn(math, "verifyReference").mockReturnValue(forced);
      try {
        const result = await generateSuite(smallRequest);
        expect(result.status).toBe("incomplete");
        if (result.status !== "incomplete") throw new Error("A mismatched candidate completed a suite");
        expect(result.reason).toBe("attempt-limit");
        expect(result.cases).toHaveLength(0);
        expect(result.summary.rejections).toEqual({ [reason]: MAX_CANDIDATES_PER_CASE });
        expect(result.summary.attempts).toBe(MAX_CANDIDATES_PER_CASE);
      } finally {
        verifier.mockRestore();
      }
    });
  }

  for (const reorder of [false, true]) {
    it(`rejects ${reorder ? "equivalent reordered" : "identical"} functions without filling their slot`, async () => {
      const original = candidates.createCandidate(smallRequest.seed, "convex", 5, 0, 0);
      const expression = original.reference.expression;
      if (expression.op !== "add") throw new Error("The candidate must have its shared affine wrapper");
      const repeated = reorder
        ? { ...original, reference: { ...original.reference, expression: { ...expression, left: expression.right, right: expression.left } } }
        : original;
      expect(math.verifyReference(repeated.reference).status).toBe("verified");
      if (reorder) expect(repeated.reference.expression).not.toEqual(original.reference.expression);
      const factory = spyOn(candidates, "createCandidate").mockReturnValueOnce(original).mockReturnValue(repeated);
      try {
        const result = await generateSuite({ ...smallRequest, casesPerClass: 2 });
        expect(result.status).toBe("incomplete");
        if (result.status !== "incomplete") throw new Error("Repeated functions completed a suite");
        expect(result.reason).toBe("attempt-limit");
        expect(result.cases).toHaveLength(1);
        expect(result.summary.attempts).toBe(MAX_CANDIDATES_PER_CASE + 1);
        expect(result.summary.rejections).toEqual({ "duplicate-function": MAX_CANDIDATES_PER_CASE });
        expect(result.summary.coverage[0]).toEqual({ depth: 5, label: "convex", requested: 2, accepted: 1 });
        expect(Object.hasOwn(result, "id")).toBe(false);
      } finally {
        factory.mockRestore();
      }
    });
  }

  it("returns an explicit empty incomplete result when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await generateSuite(smallRequest, controller.signal);
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") throw new Error("A cancelled request completed");
    expect(result.reason).toBe("cancelled");
    expect(result.cases).toEqual([]);
    expect(result.summary.attempts).toBe(0);
    expect(result.summary.accepted).toBe(0);
    expect(result.summary.rejections).toEqual({});
    expect(result.summary.coverage).toHaveLength(3);
    expect(Object.hasOwn(result, "suite")).toBe(false);
    expect(Object.hasOwn(result, "id")).toBe(false);
  });

  it("observes setImmediate cancellation during work and retains only accepted partial cases", async () => {
    const controller = new AbortController();
    const createCandidate = candidates.createCandidate;
    const factory = spyOn(candidates, "createCandidate").mockImplementation((...args) => {
      const candidate = createCandidate(...args);
      setImmediate(() => controller.abort());
      return candidate;
    });
    try {
      const result = await generateSuite({ ...smallRequest, casesPerClass: 3 }, controller.signal);
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") throw new Error("Cancellation did not interrupt generation");
      expect(result.reason).toBe("cancelled");
      expect(result.cases).toHaveLength(1);
      expect(result.summary.attempts).toBe(1);
      expect(result.summary.accepted).toBe(1);
      expect(result.summary.coverage[0]).toEqual({ depth: 5, label: "convex", requested: 3, accepted: 1 });
      expect(result.summary.coverage.slice(1).every((entry) => entry.accepted === 0)).toBe(true);
      expect(Object.hasOwn(result, "suite")).toBe(false);
      expect(Object.hasOwn(result, "id")).toBe(false);
      expect(Object.isFrozen(result.cases[0].certificate)).toBe(true);
    } finally {
      factory.mockRestore();
    }
  });
});
