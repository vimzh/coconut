import { beforeAll, describe, expect, it } from "bun:test";
import { checkCertificate } from "../math";
import { buildPrompt } from "../protocol";
import { generateSuite, SuiteInputError, validateFrozenSuite } from "./index";
import type { FrozenSuite } from "./index";

type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[]
  : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;

let suite: FrozenSuite;

beforeAll(async () => {
  const result = await generateSuite({
    seed: "manifest-tests-v1", depths: [5], casesPerClass: 1,
    profileId: "one-shot-json-v1", purpose: "evaluation",
  });
  if (result.status !== "complete") throw new Error("Manifest fixture generation did not complete");
  suite = result.suite;
});

function copy(): Mutable<FrozenSuite> {
  return structuredClone(suite) as Mutable<FrozenSuite>;
}

function reorderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reorderKeys(child)]));
  }
  return value;
}

describe("frozen suite replay", () => {
  it("replays the frozen default artifact and independently checks all retained certificates", async () => {
    const uploaded: unknown = await Bun.file(new URL("../../data/suites/reference-v1.json", import.meta.url)).json();
    const validated = await validateFrozenSuite(uploaded);
    expect(validated.id).toBe("suite-v1-0149a94ef54c099effeaeca05959e310c7fddb8f56d6897e0cb37a759d055b41");
    expect(validated.cases).toHaveLength(75);
    expect(validated.summary.accepted).toBe(75);
    for (const entry of validated.cases) {
      expect(checkCertificate(entry.reference, entry.certificate)).toBe(true);
    }
  });

  it("validates a JSON round trip and returns a detached immutable reproduction", async () => {
    const uploaded: unknown = JSON.parse(JSON.stringify(suite));
    const validated = await validateFrozenSuite(uploaded);
    expect(validated).toEqual(suite);
    expect(validated).not.toBe(uploaded);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.request.depths)).toBe(true);
    expect(Object.isFrozen(validated.cases[0].certificate.trace[0])).toBe(true);
  });

  it("accepts reordered object keys while preserving ordered arrays", async () => {
    expect(await validateFrozenSuite(reorderKeys(suite))).toEqual(suite);
  });

  const mutations: [string, (value: Mutable<FrozenSuite>) => void][] = [
    ["reference expression", (value) => { value.cases[0].reference.expression = { op: "variable" }; }],
    ["reference domain", (value) => { value.cases[0].reference.domain.min = "-2"; }],
    ["reference label", (value) => { value.cases[0].reference.claimedLabel = "concave"; }],
    ["reference witness choices", (value) => { value.cases[0].reference.witnessPairs = []; }],
    ["case label", (value) => { value.cases[0].label = "neither"; }],
    ["case depth", (value) => { value.cases[0].depth++; }],
    ["case identity", (value) => { value.cases[0].id = `case-v1-${"0".repeat(64)}`; }],
    ["family", (value) => { value.cases[0].family = "weighted-envelope"; }],
    ["function signature", (value) => { value.cases[0].semanticKey = "0".repeat(64); }],
    ["ordinal", (value) => { value.cases[0].ordinal++; }],
    ["attempt", (value) => { value.cases[0].attempt++; }],
    ["missing member", (value) => { value.cases.pop(); }],
    ["extra member", (value) => { value.cases.push(structuredClone(value.cases[0])); }],
    ["replaced member", (value) => { value.cases[1] = structuredClone(value.cases[0]); }],
    ["case order", (value) => { value.cases.reverse(); }],
    ["suite identity", (value) => { value.id = `suite-v1-${"0".repeat(64)}`; }],
    ["format version", (value) => { Object.assign(value, { formatVersion: "2" }); }],
    ["generator version", (value) => { Object.assign(value, { generatorVersion: "2" }); }],
    ["depth policy version", (value) => { Object.assign(value, { depthPolicyVersion: "2" }); }],
    ["verifier version", (value) => { value.verifierVersion = "unsupported"; }],
    ["protocol version", (value) => { Object.assign(value, { protocolVersion: "2" }); }],
    ["seed", (value) => { value.request.seed = "changed-manifest-seed"; }],
    ["requested depth", (value) => { value.request.depths = [6]; }],
    ["requested case count", (value) => { value.request.casesPerClass = 2; }],
    ["requested profile", (value) => { value.request.profileId = "one-shot-schema-v1"; }],
    ["purpose", (value) => { value.request.purpose = "illustration"; }],
    ["attempt count", (value) => { value.summary.attempts++; }],
    ["accepted count", (value) => { value.summary.accepted--; }],
    ["rejection counts", (value) => { Object.assign(value.summary.rejections, { "depth-mismatch": 1 }); }],
    ["coverage requested count", (value) => { value.summary.coverage[0].requested++; }],
    ["coverage accepted count", (value) => { value.summary.coverage[0].accepted--; }],
    ["coverage depth", (value) => { value.summary.coverage[0].depth++; }],
    ["coverage label", (value) => { value.summary.coverage[0].label = "concave"; }],
    ["coverage order", (value) => { value.summary.coverage.reverse(); }],
    ["certificate version", (value) => { value.cases[0].certificate.version = "unsupported"; }],
    ["certificate fingerprint", (value) => { value.cases[0].certificate.fingerprint = "0".repeat(64); }],
    ["certificate rendered expression", (value) => { value.cases[0].certificate.renderedExpression = "x"; }],
    ["certificate depth", (value) => { value.cases[0].certificate.depth++; }],
    ["certificate node count", (value) => { value.cases[0].certificate.nodeCount++; }],
    ["certificate input", (value) => { value.cases[0].certificate.input.domain.max = "2"; }],
    ["certificate trace", (value) => { value.cases[0].certificate.trace[0].rule = "altered-rule"; }],
    ["certificate trace order", (value) => { value.cases[0].certificate.trace.reverse(); }],
    ["certificate witness", (value) => {
      const witness = value.cases[0].certificate.witnesses.againstConcavity;
      if (!witness) throw new Error("Expected the convex case witness");
      witness.gap = "0";
    }],
    ["missing certificate witness", (value) => { delete value.cases[0].certificate.witnesses.againstConcavity; }],
  ];

  for (const [name, mutate] of mutations) {
    it(`rejects altered ${name}`, async () => {
      const altered = copy();
      mutate(altered);
      await expect(validateFrozenSuite(altered)).rejects.toBeInstanceOf(SuiteInputError);
    });
  }

  it("rejects malformed roots, missing fields, extra fields, invalid prototypes, and cyclic descendants", async () => {
    const missing = copy();
    Reflect.deleteProperty(missing, "formatVersion");
    const hidden = copy();
    Object.defineProperty(hidden, "hidden", { value: true });
    const extraArrayField = copy();
    Object.assign(extraArrayField.cases, { extra: true });
    const sparse = copy();
    Reflect.deleteProperty(sparse.cases, "0");
    const invalidPrototype = Object.setPrototypeOf(copy(), {});
    const invalidArrayPrototype = copy();
    Object.setPrototypeOf(invalidArrayPrototype.cases, {});
    const cyclic = copy();
    Object.assign(cyclic.cases[0].reference, { expression: cyclic });
    for (const input of [
      null, undefined, true, "suite", [], {}, () => suite,
      missing, hidden, extraArrayField, sparse, invalidPrototype, invalidArrayPrototype, cyclic,
      { ...suite, extra: true }, { ...suite, [Symbol("extra")]: true },
    ]) {
      await expect(validateFrozenSuite(input)).rejects.toBeInstanceOf(SuiteInputError);
    }
  });

  it("rejects accessors at each trust boundary without invoking them", async () => {
    let calls = 0;
    const getter = () => { calls++; throw new Error("An uploaded getter must not run"); };
    const root = copy();
    Object.defineProperty(root, "request", { get: getter });
    const request = copy();
    Object.defineProperty(request.request, "seed", { get: getter });
    const caseArray = copy();
    Object.defineProperty(caseArray.cases, "0", { get: getter });
    const domain = copy();
    Object.defineProperty(domain.cases[0].reference.domain, "min", { get: getter });
    const certificate = copy();
    Object.defineProperty(certificate.cases[0].certificate, "fingerprint", { get: getter });
    const trace = copy();
    Object.defineProperty(trace.cases[0].certificate.trace, "0", { get: getter });
    for (const input of [root, request, caseArray, domain, certificate, trace]) {
      await expect(validateFrozenSuite(input)).rejects.toBeInstanceOf(SuiteInputError);
    }
    expect(calls).toBe(0);
  });
});

describe("retained references at the prompt boundary", () => {
  it("passes raw references through both public profiles without exposing private suite evidence", () => {
    for (const entry of suite.cases) {
      for (const profileId of ["one-shot-json-v1", "one-shot-schema-v1"] as const) {
        const prompt = buildPrompt(entry.reference, profileId);
        expect(prompt.messages[1]).toEqual({
          role: "user",
          content: `f(x) = ${entry.certificate.renderedExpression}\nDomain: x in [-1, 1].`,
        });
        expect(buildPrompt({ ...entry.reference, witnessPairs: [] }, profileId)).toEqual(prompt);
        const visible = JSON.stringify(prompt);
        for (const privateValue of [
          "claimedLabel", "witnessPairs", "certificate", "fingerprint", "trace", "nodeCount", "depth",
          "againstConvexity", "againstConcavity", "semanticKey", "ordinal", "attempt",
          suite.id, suite.request.seed, entry.id, entry.semanticKey, entry.certificate.fingerprint,
        ]) {
          expect(visible.includes(privateValue)).toBe(false);
        }
        expect(() => buildPrompt(entry, profileId)).toThrow();
        expect(() => buildPrompt({ ...entry.reference, certificate: entry.certificate }, profileId)).toThrow();
      }
    }
  });
});
