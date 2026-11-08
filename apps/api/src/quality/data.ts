// Bound detached data before asynchronous replay and keep report identities deterministic.
import { createHash } from "node:crypto";
import { freezeData } from "../suites/generator";
import type { QualityFinding, QualityGate } from "./types";

export const MAX_QUALITY_CASES = 256;
export const MAX_QUALITY_REPORT_BYTES = 16 * 1024 * 1024;
export const QUALITY_CRITERIA_SHA256 = "956573cb02d264d770219061ff805aa03f942a823138a87fa0266e5bf91d0f95";

export function snapshot<T>(input: T): T {
  let values = 0, characters = 0;
  function visit(value: unknown, depth: number): unknown {
    if (++values > 2_000_000 || depth > 512) throw new Error("Quality input exceeds its bounded data budget.");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      characters += value.length;
      if (characters > 32 * 1024 * 1024) throw new Error("Quality input exceeds 32 MiB of text.");
      return value;
    }
    if (typeof value !== "object" || !(Array.isArray(value) ? Object.getPrototypeOf(value) === Array.prototype
      : [Object.prototype, null].includes(Object.getPrototypeOf(value)))) {
      throw new Error("Quality input must contain ordinary data only.");
    }
    const array = Array.isArray(value);
    const keys = Reflect.ownKeys(value);
    if (array && (value.length > 200_000 || keys.length !== value.length + 1)) throw new Error("Quality arrays must be bounded and dense.");
    const result: Record<string, unknown> | unknown[] = array ? [] : Object.create(null);
    for (const key of keys) {
      if (array && key === "length") continue;
      const field = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || !field || !("value" in field) || (array && !/^(0|[1-9]\d*)$/.test(key))) {
        throw new Error("Quality input must contain string-keyed data fields without accessors.");
      }
      Object.defineProperty(result, key, { value: visit(field.value, depth + 1), enumerable: true, configurable: true, writable: true });
    }
    return result;
  }
  return visit(input, 0) as T;
}

export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(Reflect.get(value, key))}`).join(",")}}`;
}

export const sha256 = (value: unknown): string => createHash("sha256").update(canonical(value)).digest("hex");
export const sameData = (left: unknown, right: unknown): boolean => canonical(left) === canonical(right);

export function finish<T extends object>(content: T, prefix: string): T & { readonly id: string } {
  const result = { ...content, id: `${prefix}-${sha256(content)}` };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_QUALITY_REPORT_BYTES) throw new Error("Quality report exceeds 16 MiB.");
  return freezeData(result);
}

export function qualityGate(findings: readonly QualityFinding[]): QualityGate {
  const blockers = findings.filter((entry) => entry.status === "unresolved").map((entry) => entry.id);
  return { verdict: blockers.length ? "no-go" : "go", blockers };
}

export function finding(id: string, category: QualityFinding["category"], severity: QualityFinding["severity"],
  status: QualityFinding["status"], evidence: string, caseIds: readonly string[] = [], claimRestriction: string | null = null): QualityFinding {
  const responsibleModule = ["coverage", "identity", "depth", "selection", "reference"].includes(category) ? "03"
    : ["leakage", "comparison"].includes(category) ? "07" : category === "execution" ? "08" : "14";
  return { id, category, severity, status, caseIds, evidence, responsibleModule, repairVersion: null,
    verification: "offline retained-data audit", claimRestriction };
}
