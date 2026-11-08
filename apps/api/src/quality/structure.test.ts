import { describe, expect, it } from "bun:test";
import type { SmoothExpression } from "../numerics/types";
import { analyzeExpression } from "./structure";
import { snapshot } from "./data";

const x = { op: "variable" } as const;
const square = { op: "square", arg: x } as const;
const domain = { min: "-1", max: "1" };
const c = (value: string): SmoothExpression => ({ op: "constant", value });

describe("bounded expression diagnostics", () => {
  it("identifies exact exp/log padding while preserving raw depth and caller input", () => {
    const padded = { op: "log", arg: { op: "exp", arg: square } } as const;
    const before = JSON.stringify(padded), result = analyzeExpression(padded, domain);
    expect(result.rawDepth).toBe(3);
    expect(result.diagnosticDepth).toBe(1);
    expect(result.exactSignature).toBe(analyzeExpression(square, domain).exactSignature);
    expect(result.identityFlags).toContain("log-exp-identity-on-certified-domain");
    expect(JSON.stringify(padded)).toBe(before);
  });

  it("groups output scale, affine addition, negative scale and input reflection without equating functions", () => {
    const padded: SmoothExpression = { op: "add", left: { op: "multiply", left: c("-3"), right: square },
      right: { op: "add", left: { op: "multiply", left: c("2"), right: x }, right: c("17") } };
    const base = analyzeExpression(square, domain), related = analyzeExpression(padded, domain);
    expect(related.exactSignature).not.toBe(base.exactSignature);
    expect(related.coreSignature).toBe(base.coreSignature);
    expect(related.identityFlags).toContain("negative-output-scale-for-core-only");
    const reflected = { op: "exp", arg: { op: "negate", arg: x } } as const;
    expect(analyzeExpression(reflected, domain).coreSignature).toBe(analyzeExpression({ op: "exp", arg: x }, domain).coreSignature);
  });

  it("normalizes the exact supplied interval and does not cancel unsupported identities", () => {
    const shifted: SmoothExpression = { op: "square", arg: { op: "add", left: x, right: c("1") } };
    expect(analyzeExpression(square, { min: "0", max: "2" }).coreSignature).toBe(analyzeExpression(shifted, domain).coreSignature);
    expect(analyzeExpression({ op: "sqrt", arg: square }, domain).exactSignature).not.toBe(analyzeExpression(x, domain).exactSignature);
    expect(analyzeExpression({ op: "exp", arg: x }, domain).coreSignature).not.toBe(analyzeExpression(square, domain).coreSignature);
  });

  it("rejects accessors without invoking them before an audit can yield", () => {
    let calls = 0;
    const value = Object.defineProperty({}, "secret", { get() { calls++; throw new Error("Must not execute"); }, enumerable: true });
    expect(() => snapshot(value)).toThrow("accessors");
    expect(calls).toBe(0);
    expect(() => snapshot([, "sparse"])).toThrow("dense");
  });
});
