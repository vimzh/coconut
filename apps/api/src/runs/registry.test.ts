// Registered choices preserve frozen mathematics across explicitly different profile identities.
import { expect, it } from "bun:test";
import { listRunSuites, loadRunSuite } from "./registry";
import type { RunSuiteKey } from "./types";

it("loads only fixed verified suites and returns immutable bounded public descriptions", async () => {
  const descriptions = await listRunSuites();
  expect(descriptions.map((entry) => [entry.key, entry.caseCount])).toEqual([["reference-v1", 75], ["smooth-v2", 27], ["challenge-v1", 72], ["screening-v1", 9], ["interior-v1", 72]]);
  expect(descriptions.filter((entry) => entry.recommended).map((entry) => entry.key)).toEqual(["challenge-v1"]);
  expect(Object.isFrozen(descriptions)).toBe(true);
  for (const entry of descriptions) {
    const suite = await loadRunSuite(entry.key, "one-shot-json-v1");
    expect(entry.suiteId).toBe(suite.id);
    expect(Object.isFrozen(suite.cases)).toBe(true);
    for (const hidden of ["claimedLabel", "certificate", "clusterId", '"cases"', '"label"']) expect(JSON.stringify(entry)).not.toContain(hidden);
    expect(await loadRunSuite(entry.key, "one-shot-json-v1")).toBe(suite);
  }
  for (const key of ["../data/suites/reference-v1.json", "/tmp/suite.json", "constructor", "unknown", "__proto__"]) {
    await expect(loadRunSuite(key as RunSuiteKey, "one-shot-json-v1")).rejects.toThrow("registered");
  }
  await expect(loadRunSuite("challenge-v1", "unknown" as "one-shot-json-v1")).rejects.toThrow();
}, 30000);

it("regenerates each profile-bound artifact while retaining identical case and cluster identities", async () => {
  for (const key of ["reference-v1", "smooth-v2", "challenge-v1", "screening-v1", "interior-v1"] as const) {
    const base = await loadRunSuite(key, "one-shot-json-v1"), explicit = await loadRunSuite(key, "one-shot-json-v2-high");
    expect(explicit.id).not.toBe(base.id);
    expect(explicit.request.profileId).toBe("one-shot-json-v2-high");
    expect(explicit.cases).toEqual(base.cases);
    expect(explicit.summary).toEqual(base.summary);
  }
  const confirmation = await loadRunSuite("challenge-v1", "one-shot-json-v1"), screening = await loadRunSuite("screening-v1", "one-shot-json-v1");
  const ids = new Set(confirmation.cases.map((entry) => entry.id));
  expect(screening.cases.every((entry) => !ids.has(entry.id))).toBe(true);
}, 30000);
