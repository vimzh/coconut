// Exercise the real isolated native worker and untrusted data boundary.
import { describe, expect, it } from "bun:test";
import { certifyReference, certifyReferences, checkNumericalCertificate, NumericalBackendError, NUMERICAL_BATCH_LIMIT } from "./backend";
import type { NumericalReference, SmoothExpression } from "./types";

const x: SmoothExpression = { op: "variable" };
const constant = (value: string): SmoothExpression => ({ op: "constant", value });
const square = (arg: SmoothExpression): SmoothExpression => ({ op: "square", arg });
const add = (left: SmoothExpression, right: SmoothExpression): SmoothExpression => ({ op: "add", left, right });
const sqrt: NumericalReference = {
  expression: { op: "sqrt", arg: add(constant("1"), square(x)) },
  domain: { min: "-1", max: "1" }, claimedLabel: "convex",
};

describe("native numerical bridge", () => {
  it("certifies smooth functions in one ordered batch and retains exact reproducible evidence", async () => {
    const logarithm: NumericalReference = {
      expression: { op: "log", arg: add(constant("2"), x) },
      domain: { min: "-1", max: "1" }, claimedLabel: "concave",
    };
    const reversal: NumericalReference = {
      expression: { op: "log", arg: add(constant("1"), { op: "multiply", left: constant("4"), right: square(x) }) },
      domain: { min: "-1", max: "1" }, claimedLabel: "neither",
    };
    const results = await certifyReferences([sqrt, logarithm, reversal]);
    expect(results.map((entry) => entry.status === "verified" ? entry.label : entry)).toEqual(["convex", "concave", "neither"]);
    for (const result of results) {
      if (result.status !== "verified") throw new Error("Expected independent numerical certification.");
      expect(result.certificate.backend).toEqual({ id: "arb-jet-v1", pythonFlint: "0.9.0", flint: "3.6.0", policyVersion: "1" });
      expect(result.certificate.precision).toBe(192);
      expect(result.certificate.probes).toHaveLength(9);
      expect(result.certificate.cover.length).toBeGreaterThan(0);
      expect(Object.isFrozen(result.certificate.input)).toBe(true);
      expect(Object.isFrozen(result.certificate.cover)).toBe(true);
    }
  });

  it("replays every certificate field and rejects altered evidence or unsafe retained objects", async () => {
    const result = await certifyReference(sqrt);
    if (result.status !== "verified") throw new Error("Expected a certificate.");
    const certificate = JSON.parse(JSON.stringify(result.certificate));
    expect(await checkNumericalCertificate(sqrt, certificate)).toBe(true);
    const reordered = Object.fromEntries(Object.entries(certificate).reverse());
    expect(await checkNumericalCertificate(sqrt, reordered)).toBe(true);
    certificate.cover[0].second.min = "123456";
    expect(await checkNumericalCertificate(sqrt, certificate)).toBe(false);
    expect(await checkNumericalCertificate(sqrt, { get version() { throw new Error("must not read"); } })).toBe(false);
  });

  it("snapshots caller-owned input synchronously before asynchronous process startup", async () => {
    const input = JSON.parse(JSON.stringify(sqrt));
    const references = [input];
    const pending = certifyReferences(references);
    input.claimedLabel = "concave";
    input.expression = { op: "constant", value: "0" };
    references.length = 0;
    const results = await pending;
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("verified");
    if (results[0].status === "verified") expect(results[0].certificate.input.claimedLabel).toBe("convex");
  });

  it("preserves explicit label mismatches and unsupported proof boundaries", async () => {
    expect(await certifyReference({ ...sqrt, claimedLabel: "concave" })).toEqual({ status: "rejected", reason: "label-mismatch" });
    const boundary = await certifyReference({ expression: { op: "sqrt", arg: x }, domain: { min: "0", max: "1" }, claimedLabel: "concave" });
    expect(boundary.status).toBe("unverified");
    const kink = await certifyReference({ ...sqrt, expression: { op: "abs", arg: x } });
    expect(kink.status).toBe("rejected");
  });

  it("rejects oversized batches, cycles, sparse arrays, accessors, custom objects, and serialization hooks", async () => {
    let reads = 0;
    const getter = { get expression() { reads++; return sqrt.expression; } };
    const hook = { toJSON() { reads++; return sqrt; } };
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    const sparse = new Array(1);
    const withExtra: unknown[] & { extra?: string } = [sqrt]; withExtra.extra = "hidden";
    const hidden = Object.defineProperty({}, "expression", { value: sqrt.expression });
    const symbol = { [Symbol("extra")]: true };
    for (const invalid of [[], [getter], [hook], [cycle], sparse, withExtra, [hidden], [symbol], [new Date()], [NaN], [1n], [undefined], new Array(NUMERICAL_BATCH_LIMIT + 1).fill(sqrt)]) {
      await expect(certifyReferences(invalid)).rejects.toBeInstanceOf(NumericalBackendError);
    }
    expect(reads).toBe(0);
  });

  it("honors pre-cancellation and cancellation during native work", async () => {
    const already = new AbortController(); already.abort();
    await expect(certifyReference(sqrt, already.signal)).rejects.toMatchObject({ code: "cancelled" });
    const active = new AbortController();
    const pending = certifyReferences(new Array(NUMERICAL_BATCH_LIMIT).fill(sqrt), active.signal);
    const timer = setTimeout(() => active.abort(), 10);
    try { await expect(pending).rejects.toMatchObject({ code: "cancelled" }); }
    finally { clearTimeout(timer); }
    expect((await certifyReference(sqrt)).status).toBe("verified");
  });
});
