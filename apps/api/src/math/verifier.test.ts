import { describe, expect, it } from "bun:test";
import { MAX_DEPTH, MAX_NODES, MAX_WITNESS_PAIRS } from "./expression";
import { MAX_LITERAL_LENGTH } from "./rational";
import type { Expression, Label, VerificationCertificate } from "./types";
import { checkCertificate, VERIFIER_VERSION, verifyReference } from "./verifier";

const variable: Expression = { op: "variable" };
const quadratic: Expression = { op: "square", arg: variable };
const cubic: Expression = { op: "multiply", left: variable, right: quadratic };

function reference(
  expression: Expression = quadratic,
  claimedLabel: Label = "convex",
  min = "-1",
  max = "1",
  witnessPairs = [{ x: "-1", y: "1" }],
) {
  return { expression, domain: { min, max }, claimedLabel, witnessPairs };
}

function verified(input: unknown) {
  const result = verifyReference(input);
  expect(result.status).toBe("verified");
  if (result.status !== "verified") throw new Error(JSON.stringify(result));
  return result;
}

function nested(expression: Expression, count: number, op: "abs" | "square" = "abs"): Expression {
  for (let index = 0; index < count; index++) expression = { op, arg: expression };
  return expression;
}

describe("reference labels", () => {
  it("certifies a quadratic with an exact witness against concavity", () => {
    const result = verified(reference());
    expect(result.label).toBe("convex");
    expect(result.certificate.version).toBe(VERIFIER_VERSION);
    expect(result.certificate.depth).toBe(1);
    expect(result.certificate.nodeCount).toBe(2);
    expect(result.certificate.witnesses).toEqual({
      againstConcavity: {
        x: "-1", y: "1", midpoint: "0", fX: "1", fY: "1", fMidpoint: "0", gap: "-1",
      },
    });
    expect(result.certificate.trace.at(-1)).toMatchObject({ convex: true, concave: false });
  });

  it("certifies the negative quadratic with the opposite strict witness", () => {
    const result = verified(reference({ op: "negate", arg: quadratic }, "concave"));
    expect(result.label).toBe("concave");
    expect(result.certificate.witnesses).toEqual({
      againstConvexity: {
        x: "-1", y: "1", midpoint: "0", fX: "-1", fY: "-1", fMidpoint: "0", gap: "1",
      },
    });
  });

  it("certifies a cubic using independently evaluated witnesses in each half", () => {
    const result = verified(reference(cubic, "neither", "-1", "1", [
      { x: "-1", y: "0" }, { x: "0", y: "1" },
    ]));
    expect(result.label).toBe("neither");
    expect(result.certificate.witnesses).toEqual({
      againstConvexity: {
        x: "-1", y: "0", midpoint: "-1/2", fX: "-1", fY: "0", fMidpoint: "-1/8", gap: "3/8",
      },
      againstConcavity: {
        x: "0", y: "1", midpoint: "1/2", fX: "0", fY: "1", fMidpoint: "1/8", gap: "-3/8",
      },
    });
    expect(result.certificate.trace.at(-1)).toMatchObject({ convex: false, concave: false });
  });

  it("finds both cubic signs on the default grid when the endpoint gap is zero", () => {
    const result = verified(reference(cubic, "neither", "-1", "1", []));
    expect(result.certificate.witnesses.againstConvexity?.gap).toBe("21/512");
    expect(result.certificate.witnesses.againstConcavity?.gap).toBe("-147/512");
  });

  it("canonicalizes exact input values and defaults omitted candidate pairs", () => {
    const input = {
      expression: { op: "multiply", left: { op: "constant", value: "2/4" }, right: quadratic },
      domain: { min: "-1.00", max: "+01" },
      claimedLabel: "convex",
    };
    const result = verified(input);
    expect(result.certificate.input).toEqual({
      expression: { op: "multiply", left: { op: "constant", value: "1/2" }, right: quadratic },
      domain: { min: "-1", max: "1" },
      claimedLabel: "convex",
      witnessPairs: [],
    });
    expect(result.certificate.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(verified(result.certificate.input).certificate).toEqual(result.certificate);
  });

  it("normalizes reversed candidate coordinates before recording a witness", () => {
    const result = verified(reference(quadratic, "convex", "-1", "1", [{ x: "1.0", y: "-2/2" }]));
    expect(result.certificate.witnesses.againstConcavity).toMatchObject({ x: "-1", y: "1", gap: "-1" });
  });

  it("excludes affine and constant cases whose labels overlap", () => {
    const expressions: Expression[] = [
      variable,
      { op: "constant", value: "7/3" },
      { op: "add", left: variable, right: { op: "constant", value: "2" } },
      { op: "multiply", left: { op: "constant", value: "-3" }, right: variable },
      { op: "multiply", left: { op: "constant", value: "0" }, right: cubic },
    ];
    for (const expression of expressions) {
      expect(verifyReference(reference(expression, "neither"))).toMatchObject({
        status: "excluded", reason: "overlapping-labels",
      });
    }
  });

  it("does not infer convexity from midpoint samples for a general product", () => {
    expect(verifyReference(reference({ op: "multiply", left: variable, right: variable }))).toMatchObject({
      status: "unverified", reason: "inconclusive-curvature",
    });
  });

  it("does not falsely classify hidden cancellation without a strict witness", () => {
    const expression: Expression = { op: "add", left: quadratic, right: { op: "negate", arg: quadratic } };
    for (const label of ["convex", "concave", "neither"] as const) {
      expect(verifyReference(reference(expression, label))).toMatchObject({
        status: "unverified", reason: "inconclusive-curvature",
      });
    }
  });

  it("requires a strict witness even when one curvature direction is proved", () => {
    const expression: Expression = {
      op: "max", left: variable, right: { op: "constant", value: "-2" },
    };
    expect(verifyReference(reference(expression))).toMatchObject({
      status: "unverified", reason: "no-strict-witness",
    });
  });

  it("rejects claimed labels that disagree with the independently derived label", () => {
    for (const input of [
      reference(quadratic, "concave"),
      reference(quadratic, "neither"),
      reference({ op: "negate", arg: quadratic }, "convex"),
      reference(cubic, "convex"),
    ]) {
      expect(verifyReference(input)).toMatchObject({ status: "rejected", reason: "label-mismatch" });
    }
  });

  it("retains a strict exact sign for a coefficient of one over ten to the seventieth", () => {
    const denominator = `1${"0".repeat(70)}`;
    const expression: Expression = {
      op: "multiply", left: { op: "constant", value: `1/${denominator}` }, right: quadratic,
    };
    const result = verified(reference(expression));
    expect(result.certificate.witnesses.againstConcavity?.gap).toBe(`-1/${denominator}`);
  });
});

describe("reference input and resource boundaries", () => {
  it("rejects unsupported operations even on domains where those operations would be undefined", () => {
    for (const op of ["log", "sqrt"]) {
      expect(verifyReference({ ...reference(), expression: { op, arg: variable }, domain: { min: "-4", max: "-1" } }))
        .toMatchObject({ status: "rejected", reason: "unsupported-operation" });
    }
  });

  it("rejects singleton, reversed, malformed, and non-string domains", () => {
    for (const domain of [
      { min: "0", max: "0" }, { min: "1", max: "-1" },
    ]) {
      expect(verifyReference({ ...reference(), domain })).toMatchObject({
        status: "rejected", reason: "invalid-domain",
      });
    }
    for (const domain of [
      { min: "1/0", max: "2" }, { min: "NaN", max: "2" },
      { min: -1, max: "1" }, { min: "-1", max: 1 },
    ]) {
      expect(verifyReference({ ...reference(), domain })).toMatchObject({
        status: "rejected", reason: "invalid-input",
      });
    }
  });

  it("rejects malformed roots, invalid labels, invalid constants, and extra fields", () => {
    for (const input of [
      null, undefined, [], "x", {},
      { ...reference(), claimedLabel: "affine" },
      { ...reference(), extra: true },
      { ...reference(), expression: { op: "constant", value: 1 } },
      { ...reference(), expression: { op: "constant", value: "1/0" } },
      { ...reference(), expression: { op: "constant", value: "1e3" } },
      { ...reference(), expression: { op: "variable", extra: true } },
      { ...reference(), expression: { op: "square" } },
    ]) {
      expect(verifyReference(input)).toMatchObject({ status: "rejected", reason: "invalid-input" });
    }
  });

  it("rejects cyclic expression trees", () => {
    const expression: { op: "negate"; arg?: unknown } = { op: "negate" };
    expression.arg = expression;
    expect(verifyReference({ ...reference(), expression })).toMatchObject({
      status: "rejected", reason: "invalid-input",
    });
  });

  it("rejects candidate pairs outside the domain, equal points, and malformed coordinates", () => {
    for (const witnessPairs of [
      [{ x: "-2", y: "1" }], [{ x: "-1", y: "2" }], [{ x: "0", y: "0" }],
    ]) {
      expect(verifyReference({ ...reference(), witnessPairs })).toMatchObject({
        status: "rejected", reason: "invalid-domain",
      });
    }
    for (const witnessPairs of [
      [{ x: "-1", y: 1 }], [{ x: "-1", y: "1", gap: "-1" }], null,
    ]) {
      expect(verifyReference({ ...reference(), witnessPairs })).toMatchObject({
        status: "rejected", reason: "invalid-input",
      });
    }
  });

  it("accepts a depth-100 structural case and records its actual depth", () => {
    const result = verified(reference(nested(variable, 100)));
    expect(result.certificate.depth).toBe(100);
    expect(result.certificate.nodeCount).toBe(101);
    expect(checkCertificate(result.certificate.input, result.certificate)).toBe(true);
  });

  it("enforces the depth boundary without converting it to a rejected label", () => {
    expect(verified(reference(nested(variable, MAX_DEPTH))).certificate.depth).toBe(MAX_DEPTH);
    expect(verifyReference(reference(nested(variable, MAX_DEPTH + 1)))).toMatchObject({
      status: "unverified", reason: "resource-limit",
    });
  });

  it("counts repeated branch occurrences and enforces the node boundary", () => {
    let sum: Expression = variable;
    for (let level = 0; level < 8; level++) sum = { op: "add", left: sum, right: sum };
    const atLimit: Expression = { op: "square", arg: sum };
    expect(verified(reference(atLimit)).certificate.nodeCount).toBe(MAX_NODES);
    expect(verifyReference(reference({ op: "negate", arg: atLimit }, "concave"))).toMatchObject({
      status: "unverified", reason: "resource-limit",
    });
  });

  it("reports oversized literals and too many candidates as resource limits", () => {
    expect(verifyReference(reference({ op: "constant", value: "0".repeat(MAX_LITERAL_LENGTH + 1) })))
      .toMatchObject({ status: "unverified", reason: "resource-limit" });
    expect(verifyReference(reference(quadratic, "convex", "-1", "1", Array.from(
      { length: MAX_WITNESS_PAIRS + 1 }, () => ({ x: "-1", y: "1" }),
    )))).toMatchObject({ status: "unverified", reason: "resource-limit" });
  });

  it("reports exact rational growth as a resource limit", () => {
    expect(verifyReference(reference(nested({ op: "constant", value: "2" }, 12, "square"))))
      .toMatchObject({ status: "unverified", reason: "resource-limit" });
  });
});

describe("certificate replay", () => {
  it("accepts fresh evidence and a JSON round trip", () => {
    const input = reference();
    const { certificate } = verified(input);
    expect(checkCertificate(input, certificate)).toBe(true);
    expect(checkCertificate(certificate.input, JSON.parse(JSON.stringify(certificate)))).toBe(true);
  });

  it("rejects a changed claimed label, expression, domain, or candidate input", () => {
    const input = reference();
    const { certificate } = verified(input);
    for (const changedInput of [
      { ...input, claimedLabel: "concave" },
      { ...input, expression: { op: "multiply", left: { op: "constant", value: "2" }, right: quadratic } },
      { ...input, domain: { min: "-2", max: "1" } },
      { ...input, witnessPairs: [] },
    ]) {
      expect(checkCertificate(changedInput, certificate)).toBe(false);
    }
  });

  it("rejects altered certificate fields even when the fingerprint is preserved", () => {
    const input = reference();
    const { certificate } = verified(input);
    const mutations: ((value: VerificationCertificate) => void)[] = [
      (value) => { value.version = "2"; },
      (value) => { value.fingerprint = "0".repeat(64); },
      (value) => { value.renderedExpression = "x"; },
      (value) => { value.depth++; },
      (value) => { value.nodeCount++; },
      (value) => { value.input.claimedLabel = "concave"; },
      (value) => { value.input.expression = variable; },
      (value) => { value.input.domain.min = "-2"; },
      (value) => { value.trace[0].convex = false; },
      (value) => { value.trace[0].range.min = "-2"; },
      (value) => { value.trace[0].rule = "untrusted-rule"; },
      (value) => { value.trace.reverse(); },
      (value) => {
        const witness = value.witnesses.againstConcavity;
        if (!witness) throw new Error("Expected the quadratic witness");
        witness.gap = "0";
      },
      (value) => { delete value.witnesses.againstConcavity; },
    ];
    for (const mutate of mutations) {
      const altered = structuredClone(certificate);
      mutate(altered);
      expect(checkCertificate(input, altered)).toBe(false);
    }
  });

  it("rejects extra fields including functions, hidden properties, and symbols", () => {
    const input = reference();
    const { certificate } = verified(input);
    const withHiddenField = structuredClone(certificate);
    Object.defineProperty(withHiddenField, "hidden", { value: true });
    const withArrayField = structuredClone(certificate);
    Object.defineProperty(withArrayField.trace, "extra", { value: true });
    const withNestedField = structuredClone(certificate);
    Object.assign(withNestedField.input.domain, { extra: "untrusted" });
    for (const altered of [
      { ...certificate, extra: true }, { ...certificate, extra: () => true },
      { ...certificate, [Symbol("extra")]: true }, withHiddenField, withArrayField, withNestedField,
    ]) {
      expect(checkCertificate(input, altered)).toBe(false);
    }
  });

  it("rejects accessors without invoking them", () => {
    const input = reference();
    const { certificate } = verified(input);
    let calls = 0;
    const getter = () => { calls++; throw new Error("A certificate getter must not run"); };
    const alteredRoot = structuredClone(certificate);
    Object.defineProperty(alteredRoot, "version", { get: getter });
    const alteredNested = structuredClone(certificate);
    Object.defineProperty(alteredNested.input.domain, "min", { get: getter });
    const alteredArray = structuredClone(certificate);
    Object.defineProperty(alteredArray.trace, "0", { get: getter });
    for (const altered of [alteredRoot, alteredNested, alteredArray]) {
      expect(checkCertificate(input, altered)).toBe(false);
    }
    expect(calls).toBe(0);
  });

  it("rejects invalid prototypes, functions, cycles, missing fields, and malformed evidence", () => {
    const input = reference();
    const { certificate } = verified(input);
    const alteredPrototype = structuredClone(certificate);
    Object.setPrototypeOf(alteredPrototype, null);
    const alteredArrayPrototype = structuredClone(certificate);
    Object.setPrototypeOf(alteredArrayPrototype.trace, {});
    const cyclic = structuredClone(certificate) as unknown as Record<string, unknown>;
    cyclic.input = cyclic;
    const missingField = structuredClone(certificate) as Partial<VerificationCertificate>;
    delete missingField.version;
    for (const altered of [
      null, undefined, true, "certificate", [], {}, () => certificate,
      alteredPrototype, alteredArrayPrototype, cyclic, missingField,
    ]) {
      expect(checkCertificate(input, altered)).toBe(false);
    }
  });

  it("rejects evidence for excluded, unverified, and rejected inputs", () => {
    const { certificate } = verified(reference());
    for (const input of [
      reference(variable),
      reference({ op: "multiply", left: variable, right: variable }),
      reference(quadratic, "concave"),
      null,
    ]) {
      expect(checkCertificate(input, certificate)).toBe(false);
    }
  });
});
