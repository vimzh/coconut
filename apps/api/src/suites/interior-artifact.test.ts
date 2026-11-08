// Exploratory inputs use the unchanged scorer while retaining their narrower scientific boundary.
import { expect, it } from "bun:test";
import artifact from "../../data/suites/interior-v1.json";
import { auditRun, auditSuite } from "../quality";
import { fixtureRun } from "../quality/fixtures";
import { summarizePublishedRun } from "../runs/public";
import { createRunStore } from "../runs/store";
import { validateSuiteArtifact } from "./artifact";

it("retains all exploratory trials and proofs without granting confirmation or uncertainty claims", async () => {
  const suite = await validateSuiteArtifact(artifact);
  const record = await fixtureRun(suite);
  record.revision = 0;
  expect(record.request.suiteKey).toBe("interior-v1");
  expect(record.report?.overall.classification).toMatchObject({ macroF1: 1, population: { plannedTrials: 216, includedTrials: 216, status: "complete" } });
  const quality = await auditSuite(suite);
  expect(quality.population).toMatchObject({ cases: 72, families: 3, clusters: 8 });
  expect(quality.gate.verdict).toBe("no-go");
  expect(quality.findings.some(entry => entry.id === "exploratory-interior-coverage")).toBe(true);
  expect(quality.findings.find(entry => entry.id === "independent-interior-review")?.status).toBe("passed");
  expect(quality.reviewRecords.some(entry => entry.reference === "docs/research/independent-interior-review-v1.md" && entry.status === "matched")).toBe(true);
  const runQuality = await auditRun(record);
  expect(runQuality.uncertainty.status).toBe("unavailable");
  expect(runQuality.signal.verdict).toBe("no-go");
  const store = createRunStore({ path: ":memory:" });
  try {
    const created = store.create(record);
    const published = store.publish(record.id, created.accessCode, true)!;
    expect(summarizePublishedRun(published).suite.population).toBe("exploratory");
    expect(store.readPublic(record.id)?.record.report?.id).toBe(record.report?.id);
    expect(JSON.stringify(published)).not.toContain(created.accessCode);
  } finally { store.close(); }
}, 60000);
