// Preserve explicitly published experiment evidence without private access codes or new inference.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { qualityDataHash } from "../quality";
import { auditRetainedMetrics } from "../quality/reporting-audit";
import type { RunView } from "../runs/types";
import type { FrozenExperiment } from "./manifest";
import type { ExperimentLedger } from "./reconcile";
import { LOCAL_API, readApplicationJson } from "./http";

type ArchiveLedger = Omit<ExperimentLedger, "cells"> & { readonly cells: readonly (ExperimentLedger["cells"][number] & { readonly published: boolean })[] };

export async function archivePublishedExperiment(manifest: FrozenExperiment, ledger: ArchiveLedger, directory: string, fetcher: (url: string, options: RequestInit) => Promise<Response> = fetch) {
  if (ledger.manifestSha256 !== qualityDataHash(manifest) || !["settled", "interrupted"].includes(ledger.state) || ledger.cells.length > 500 || ledger.cells.some(cell => cell.state === "active")) throw new Error("Archive requires settled scheduling and its matching frozen manifest.");
  const members = new Map(manifest.cells.map(cell => [cell.id, cell]));
  const selected = ledger.cells.filter(cell => cell.published);
  if (new Set(ledger.cells.map(cell => cell.id)).size !== ledger.cells.length || new Set(selected.map(cell => cell.runId)).size !== selected.length || selected.some(cell => cell.state !== "completed" || !cell.runId || !/^[A-Za-z0-9_-]{1,128}$/.test(cell.runId) || !members.has(cell.id))) throw new Error("Archive contains invalid or duplicate publication identities.");
  await mkdir(directory, { mode: 0o700 });
  const records: { cellId: string; runId: string; file: string; sha256: string; reportId: string }[] = [];
  for (const status of selected) {
    const cell = members.get(status.id)!;
    const response = await fetcher(`${LOCAL_API}/runs/${status.runId}/public`, { cache: "no-store", credentials: "omit", redirect: "error", signal: AbortSignal.timeout(20000) });
    const view = await readApplicationJson(response) as RunView;
    if (Object.keys(view).sort().join(",") !== "publishedAt,record") throw new Error("Public evidence contains unexpected fields.");
    const record = view.record;
    if (!view.publishedAt || record?.id !== status.runId || record.state !== "completed" || !record.report || record.report.overall.classification.population.status !== "complete" || record.request.modelId !== cell.modelId || record.request.provider !== cell.provider || record.request.servingProvider !== cell.servingProvider || record.request.profileId !== cell.profileId || record.request.concurrency !== cell.concurrency || record.suite.id !== cell.suiteId || qualityDataHash(record.suite) !== cell.suiteSha256 || qualityDataHash(record.prompts) !== cell.promptsSha256 || record.evidence.model.settingsId !== cell.settingsId || record.progress.finishedTrials !== status.progress.finished || record.progress.inferenceRequests !== status.progress.inferenceRequests) throw new Error("Published evidence differs from its frozen experiment cell.");
    auditRetainedMetrics(record);
    const file = `${record.id}.json`;
    await writeFile(join(directory, file), `${JSON.stringify(view)}\n`, { flag: "wx", mode: 0o600 });
    records.push({ cellId: cell.id, runId: record.id, file, sha256: qualityDataHash(view), reportId: record.report.id });
  }
  const index = { version: "1", kind: "published-experiment-archive", createdAt: new Date().toISOString(), manifestSha256: qualityDataHash(manifest), ledgerSha256: qualityDataHash(ledger), records,
    omitted: ledger.cells.filter(cell => !cell.published).map(cell => ({ cellId: cell.id, state: cell.state, reason: "No explicit retained publication; no private evidence was exported." })),
    interpretation: "Exact published RunViews and independently reconciled report arithmetic. Private, failed and unpublished evidence stays private. Original and repeated experiments remain separate; this archive makes no model-superiority or mathematical-failure claim." };
  await writeFile(join(directory, "index.json"), `${JSON.stringify(index, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return index;
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2);
    if (args.length !== 6 || args[0] !== "--manifest" || args[2] !== "--ledger" || args[4] !== "--output-dir") throw new Error("Use --manifest <file> --ledger <file> --output-dir <new-directory>.");
    for (const path of [args[1], args[3]]) if (Bun.file(path).size > 32 * 1024 * 1024) throw new Error("Experiment metadata exceeds its input budget.");
    const index = await archivePublishedExperiment(await Bun.file(args[1]).json(), await Bun.file(args[3]).json(), args[5]);
    console.log(JSON.stringify({ publishedRecords: index.records.length, omittedCells: index.omitted.length, indexSha256: qualityDataHash(index) }));
  } catch { console.error("Published evidence could not be archived. No private access or inference was attempted; inspect any partial new directory before retrying to another path."); process.exitCode = 1; }
}
