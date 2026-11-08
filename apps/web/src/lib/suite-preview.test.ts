// Frozen suite previews must stay a narrow, exact projection of verified task sources.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import snapshot from "../../public/suite-previews.json";
import { getSuitePreview } from "./suite-preview";
import type { RunSuiteDescription, RunSuiteKey } from "./run-api";

type SourceCase = {
  readonly id: string;
  readonly certificate: { readonly renderedExpression: string };
  readonly reference: { readonly domain: { readonly min: string; readonly max: string } };
  readonly label: string;
  readonly depth: number;
  readonly family: string;
};
type SourceSuite = {
  readonly id: string;
  readonly cases: readonly SourceCase[];
};

const sources = {
  "reference-v1": "../../../api/data/suites/reference-v1.json",
  "smooth-v2": "../../../api/data/suites/smooth-v2.json",
  "challenge-v1": "../../../api/data/suites/challenge-v1.json",
  "interior-v1": "../../../api/data/suites/interior-v1.json",
  "reserve-v1": "../../../api/data/suites/reserve-v1.json",
} as const;
const screeningArchive = "../../../api/data/experiments/openai-progress-v2-published/053eca9e-0881-4a29-bd62-55e2a4cbee2f.json";

function sourceProjection(suite: SourceSuite) {
  return suite.cases.map((entry) => ({
    id: entry.id,
    expression: entry.certificate.renderedExpression,
    domain: entry.reference.domain,
    depth: entry.depth,
    family: entry.family,
  }));
}

function labelCounts(suite: SourceSuite) {
  return suite.cases.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.label] = (counts[entry.label] ?? 0) + 1;
    return counts;
  }, {});
}

async function readJson(url: URL): Promise<unknown> {
  return JSON.parse(await readFile(fileURLToPath(url), "utf8"));
}

function description(key: RunSuiteKey): RunSuiteDescription {
  const suite = snapshot.suites.find((entry) => entry.key === key);
  assert.ok(suite);
  return {
    key: suite.key as RunSuiteKey,
    name: "Fixture suite",
    description: "Fixture suite description",
    suiteId: suite.suiteId,
    caseCount: suite.cases.length,
    depths: [...new Set(suite.cases.map((entry) => entry.depth))].sort((a, b) => a - b),
    generatorVersion: "fixture",
    promptVersion: "fixture",
    recommended: false,
  };
}

describe("frozen suite previews", () => {
  it("only accepts a live catalog description with the same identity, count, and depths", () => {
    const live = description("challenge-v1");
    assert.equal(getSuitePreview(live)?.suiteId, live.suiteId);
    assert.equal(getSuitePreview({ ...live, suiteId: "suite-other" }), null);
    assert.equal(getSuitePreview({ ...live, caseCount: live.caseCount - 1 }), null);
    assert.equal(getSuitePreview({ ...live, depths: live.depths.slice(0, -1) }), null);
    assert.equal(getSuitePreview({ ...live, depths: [...live.depths, 999] }), null);
  });

  it("projects every frozen source task exactly, including the archived screening population", async () => {
    assert.equal(snapshot.version, "1");
    assert.equal(snapshot.profileId, "one-shot-json-v1");
    assert.equal(snapshot.suites.length, 6);
    assert.equal(snapshot.suites.reduce((total, suite) => total + suite.cases.length, 0), 273);

    for (const [key, path] of Object.entries(sources)) {
      const source = await readJson(new URL(path, import.meta.url)) as SourceSuite;
      const preview = snapshot.suites.find((entry) => entry.key === key);
      assert.ok(preview, `missing ${key} preview`);
      assert.equal(preview.suiteId, source.id);
      assert.deepEqual(preview.cases, sourceProjection(source));
      assert.deepEqual(preview.labelCounts, labelCounts(source));
    }

    const archived = await readJson(new URL(screeningArchive, import.meta.url)) as { readonly record: { readonly suite: SourceSuite } };
    const screening = snapshot.suites.find((entry) => entry.key === "screening-v1");
    assert.ok(screening);
    assert.equal(screening.suiteId, archived.record.suite.id);
    assert.deepEqual(screening.cases, sourceProjection(archived.record.suite));
    assert.deepEqual(screening.labelCounts, labelCounts(archived.record.suite));

    const confirmation = snapshot.suites.find((entry) => entry.key === "challenge-v1")!;
    const confirmationIds = new Set(confirmation.cases.map((entry) => entry.id));
    assert.equal(screening.cases.some((entry) => confirmationIds.has(entry.id)), false);
  });

  it("contains only the declared public task fields, not certificates or provider/run data", () => {
    assert.deepEqual(Object.keys(snapshot).sort(), ["profileId", "suites", "version"]);
    for (const suite of snapshot.suites) {
      assert.deepEqual(Object.keys(suite).sort(), ["cases", "key", "labelCounts", "suiteId"]);
      for (const task of suite.cases) {
        assert.deepEqual(Object.keys(task).sort(), ["depth", "domain", "expression", "family", "id"]);
        assert.deepEqual(Object.keys(task.domain).sort(), ["max", "min"]);
        assert.equal(Object.hasOwn(task, "label"), false);
      }
    }
    const serialized = JSON.stringify(snapshot);
    for (const privateField of ["label", "certificate", "provider", "prompts", "accessCode", "analyticCertificate", "witnesses"])
      assert.equal(serialized.includes(`\"${privateField}\"`), false);
  });
});
