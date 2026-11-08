// Publish only independently audited complete cell metrics, never private replies or credentials.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const load = async (path: string) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const hash = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const summaryPath = "apps/api/data/quality/fast-table-fill-v1.json";
const auditPath = "apps/api/data/quality/fast-table-fill-audit-v1.json";
const summary = await load(summaryPath), audit = await load(auditPath);
const privateBytes = await readFile(new URL("apps/api/data/private/fast-table-fill-v1/result.json", root));
if (audit.verdict !== "pass" || audit.sourceFileSha256 !== hash(privateBytes) || audit.inferenceRequests !== summary.inferenceRequests ||
  audit.cumulativeConservativeRequests !== summary.cumulativeConservativeRequests || summary.methodId !== "fast-table-fill-v1")
  throw new Error("The fast-model projection requires matching independent arithmetic and dispatch evidence.");
const cells = summary.reports.map((report: {
  cell: string; modelId: string; classification: { macroF1: number | null; population: { status: string; plannedTrials: number; includedTrials: number } };
  byDepth: { depth: number; classification: { macroF1: number | null; population: { plannedTrials: number; includedTrials: number } } }[];
}) => {
  const checked = audit.cells.find((cell: { cell: string; modelId: string }) => cell.cell === report.cell && cell.modelId === report.modelId);
  if (!checked || checked.macroF1 !== report.classification.macroF1 || checked.planned !== report.classification.population.plannedTrials || checked.included !== report.classification.population.includedTrials)
    throw new Error("A cell does not match its independent audit.");
  const complete = report.classification.population.status === "complete" && (report.cell !== "screening-standard" || summary.nativeReportSha256 !== null);
  return { key: report.cell, modelId: report.modelId, complete, macroF1: complete ? report.classification.macroF1 : null,
    plannedTrials: checked.planned, includedTrials: checked.included,
    byDepth: report.byDepth.map(slice => ({ depth: slice.depth, macroF1: complete ? slice.classification.macroF1 : null,
      plannedTrials: slice.classification.population.plannedTrials, includedTrials: slice.classification.population.includedTrials })) };
});
const output = { version: "1", methodId: summary.methodId, auditVerdict: "pass", profileId: "one-shot-json-v1", maxOutputTokens: 4096,
  finishedAt: summary.finishedAt, inferenceRequests: summary.inferenceRequests, cumulativeConservativeRequests: summary.cumulativeConservativeRequests,
  sourceSummarySha256: hash(await readFile(new URL(summaryPath, root))), sourceAuditSha256: hash(await readFile(new URL(auditPath, root))), cells };
await writeFile(new URL("apps/web/public/fast-model-scores.json", root), `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({ cells: cells.length, complete: cells.filter((cell: { complete: boolean }) => cell.complete).length }));
