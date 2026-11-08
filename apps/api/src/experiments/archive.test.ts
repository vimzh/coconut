import { expect, it } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { qualityDataHash } from "../quality";
import { fixtureRun } from "../quality/fixtures";
import { archivePublishedExperiment } from "./archive";
import type { FrozenExperiment } from "./manifest";

async function fixture() {
  const record = await fixtureRun();
  const base = await Bun.file(new URL("../../data/experiments/openai-matrix-v2.json", import.meta.url)).json() as FrozenExperiment;
  const cell = { ...base.cells[0], id: "archive-fixture", provider: record.request.provider, modelId: record.request.modelId,
    servingProvider: record.request.servingProvider, profileId: record.request.profileId, suiteId: record.suite.id,
    suiteSha256: qualityDataHash(record.suite), promptsSha256: qualityDataHash(record.prompts), settingsId: record.evidence.model.settingsId, concurrency: record.request.concurrency };
  const manifest = { ...base, cells: [cell] };
  const ledger = { version: "1" as const, manifestSha256: qualityDataHash(manifest), capabilitiesInferenceRequests: 0, state: "settled",
    cells: [{ id: cell.id, state: "completed", runId: record.id, published: true, progress: { planned: 9, finished: 9, inferenceRequests: 9 } }] };
  return { record, manifest, ledger, view: { record, publishedAt: "2026-11-08T00:00:01.000Z" } };
}

it("archives only explicitly published evidence through anonymous fixed destinations and refuses overwrite", async () => {
  const f = await fixture(), root = await mkdtemp(join(tmpdir(), "coconut-archive-")), directory = join(root, "results");
  let calls = 0;
  const fetcher: NonNullable<Parameters<typeof archivePublishedExperiment>[3]> = async (url, options) => {
    calls++;
    expect(String(url)).toBe(`http://localhost:3201/runs/${f.record.id}/public`);
    expect(options).toMatchObject({ cache: "no-store", credentials: "omit", redirect: "error" });
    expect(options?.headers).toBeUndefined();
    return Response.json(f.view);
  };
  try {
    const index = await archivePublishedExperiment(f.manifest, f.ledger, directory, fetcher);
    expect(index.records).toHaveLength(1);
    expect(index.records[0].sha256).toBe(qualityDataHash(f.view));
    expect(JSON.parse(await readFile(join(directory, `${f.record.id}.json`), "utf8"))).toEqual(f.view);
    await expect(archivePublishedExperiment(f.manifest, f.ledger, directory, fetcher)).rejects.toThrow();
    expect(calls).toBe(1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("does not export private, failed, running or changed evidence", async () => {
  const f = await fixture(), root = await mkdtemp(join(tmpdir(), "coconut-archive-"));
  try {
    let calls = 0;
    const fetcher = async () => { calls++; return Response.json(f.view); };
    const privateLedger = { ...f.ledger, cells: [{ ...f.ledger.cells[0], published: false, state: "failed" }] };
    const index = await archivePublishedExperiment(f.manifest, privateLedger, join(root, "private"), fetcher);
    expect(index.records).toHaveLength(0);
    expect(index.omitted).toHaveLength(1);
    expect(calls).toBe(0);
    await expect(archivePublishedExperiment(f.manifest, { ...f.ledger, state: "running" }, join(root, "active"), fetcher)).rejects.toThrow();
    const changed = structuredClone(f.view);
    changed.record.report!.overall.classification.macroF1 = 0.5;
    await expect(archivePublishedExperiment(f.manifest, f.ledger, join(root, "changed"), async () => Response.json(changed))).rejects.toThrow();
    expect(await readdir(join(root, "changed"))).toHaveLength(0);
    await expect(archivePublishedExperiment(f.manifest, f.ledger, join(root, "extra"), async () => Response.json({ ...f.view, accessCode: "fixture-private-code" }))).rejects.toThrow();
    expect(await readdir(join(root, "extra"))).toHaveLength(0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
