// Project explicitly published archives into reproducible scores without exporting transcripts.
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildLeaderboard } from "../apps/web/src/lib/leaderboard";
import { directoryModels } from "../apps/web/src/lib/model-directory-data";

type Data = Record<string, unknown>;
const root = fileURLToPath(new URL("../", import.meta.url));
const archivePaths = [
  "apps/api/data/experiments/openai-progress-v2-published",
  "apps/api/data/experiments/remaining-models-progress-v1-published",
  "apps/api/data/experiments/interior-progress-v1-published",
  "apps/api/data/experiments/conditional-reserve-progress-v1-published",
];

function data(value: unknown): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a published archive object.");
  return Object.fromEntries(Object.entries(value));
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 5000)
    throw new Error("Expected a bounded archive array.");
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.length || value.length > 2048)
    throw new Error("Expected an archive identity.");
  return value;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(data(value)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const sha256 = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

async function readJson(path: string): Promise<unknown> {
  const maximum = 8 * 1024 * 1024;
  if ((await stat(path)).size > maximum)
    throw new Error(`Published archive exceeds 8 MiB: ${path}`);
  const bytes = await readFile(path);
  if (bytes.length > maximum)
    throw new Error(`Published archive exceeds 8 MiB: ${path}`);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function comparison(suiteId: string, suiteKey: string, profileId: string, settingsId: string, maxOutputTokens: number) {
  const confirmation = suiteKey === "challenge-v1", caseCount = confirmation ? 72 : 9;
  return {
    suiteId, suiteKey, population: confirmation ? "confirmation" : "screening", profileId,
    versions: ["challenge-v1", "measured-operation-v1", "arb-jet-v1", "1", "smooth-v2"],
    depths: confirmation ? [3, 4, 5, 6, 14] : [3, 5, 14], caseCount, settingsId,
    concurrency: 4, method: "one-shot",
    workload: {
      protocolVersion: "1", profileId, instanceCount: caseCount, trialsPerInstance: 3,
      logicalCalls: caseCount * 3, maxAttempts: caseCount * 6, maxOutputTokens,
      maxOutputTokensTotal: caseCount * 6 * maxOutputTokens,
    },
    certification: {
      backend: { id: "arb-jet-v1", pythonFlint: "0.9.0", flint: "3.6.0", policyVersion: "1" },
      promptVersion: "smooth-v2",
    },
  };
}

// Freeze the full workload for every displayed cell; a matching profile alone is insufficient.
const columns = [
  { key: "screening-standard", label: "Standard", group: "Screening", profileId: "one-shot-json-v1",
    comparison: comparison("suite-challenge-v1-4fb04cf2d06dbe93dab11f31aabd26cc56ebfa4358a78b1f41125b5bfa896ec6", "screening-v1", "one-shot-json-v1", "settings-v1-4e2a8fdf1cfcdf5ad8e1de1b7c8c3dcbe8c8ae57a21553e3eb4292393e1540a1", 4096) },
  { key: "screening-medium", label: "Medium", group: "Screening", profileId: "one-shot-json-v2-medium",
    comparison: comparison("suite-challenge-v1-54b5a926462cf8abfba8c7e1a82e3c7e60f2b8236568360ceff9e96a15b4dd69", "screening-v1", "one-shot-json-v2-medium", "settings-v1-72f45a21f356714855ebe4ce6530966c3c592a330b0e7d3133a2c2e74e6e90c0", 16384) },
  { key: "screening-high", label: "High", group: "Screening", profileId: "one-shot-json-v2-high",
    comparison: comparison("suite-challenge-v1-d481b0c9b6fe9f665c6c540d25bea40ba4d5f753d54857d1e4b2da164eb0872b", "screening-v1", "one-shot-json-v2-high", "settings-v1-3952323ec10973a9ba491f971aef4161ddaaa684b1c9f72a5e0f1fc14b12942a", 16384) },
  { key: "confirmation-high", label: "High", group: "Confirmation", profileId: "one-shot-json-v2-high",
    comparison: comparison("suite-challenge-v1-5340684f1a2a045ac508cbf2eed1a32c8034740435c12d72cdabe412b30c1c9f", "challenge-v1", "one-shot-json-v2-high", "settings-v1-3952323ec10973a9ba491f971aef4161ddaaa684b1c9f72a5e0f1fc14b12942a", 16384) },
  { key: "confirmation-max", label: "Max", group: "Confirmation", profileId: "one-shot-json-v2-max",
    comparison: comparison("suite-challenge-v1-ad8d54145c9cce0b20a25ce00b10ed6c9ec5cf32b54f868b967ca8ebe595b1bf", "challenge-v1", "one-shot-json-v2-max", "settings-v1-6785e4f1a5b910b91e34560f8d59b874fb696ea3f5657797cfd6db6a1304749f", 16384) },
].map((column) => ({ ...column, comparisonId: sha256(column.comparison) }));

// Match the existing public summary boundary, retaining no prompts, replies, or private access data.
function publicSummary(view: Data) {
  const record = data(view.record), suite = data(record.suite), request = data(record.request);
  const returned = list(record.results).map((item) => data(data(item).result)).filter((result) =>
    ["answer", "invalid", "refused", "truncated"].includes(text(data(data(result.evidence).outcome).kind)));
  const reported = (key: string) => [...new Set(returned.flatMap((result) => result[key] === null ? [] : [text(result[key])]))].sort();
  const suiteRequest = data(suite.request), workload = data(record.workload);
  if (suite.formatVersion !== "2" || !["screening", "confirmation", "exploratory"].includes(text(suiteRequest.population)))
    throw new Error("The archive suite has an unsupported population.");
  return {
    version: record.version, id: record.id, state: record.state, createdAt: record.createdAt,
    expiresAt: record.expiresAt, publishedAt: view.publishedAt, request, progress: record.progress,
    suite: {
      id: suite.id, generatorVersion: suite.generatorVersion, depthPolicyVersion: suite.depthPolicyVersion,
      verifierVersion: suite.verifierVersion, protocolVersion: suite.protocolVersion, promptVersion: suite.promptVersion,
      caseCount: list(suite.cases).length, depths: suiteRequest.depths, population: suiteRequest.population,
    },
    observation: {
      reportedModelIds: reported("reportedModelId"), reportedServingProviders: reported("reportedServingProvider"),
      modelIdentityMissing: returned.filter((result) => result.reportedModelId === null).length,
      contextFitUnverified: returned.filter((result) => result.contextFit !== "provider-enforced").length,
      outputLimitUnverified: returned.filter((result) => data(result.effective).maxOutputTokens !== workload.maxOutputTokens).length,
      schemaUnverified: text(request.profileId).includes("schema") ? returned.filter((result) => data(result.effective).nativeSchemaAccepted !== true).length : 0,
    },
    report: record.report,
  };
}

export interface LandingMeasurement {
  readonly runId: string;
  readonly modelId: string;
  readonly provider: string;
  readonly servingProvider: string | null;
  readonly comparisonId: string;
  readonly createdAt: string;
  readonly complete: boolean;
  readonly macroF1: number | null;
}

export function selectLandingMeasurement<T extends LandingMeasurement>(measurements: readonly T[], comparisonId: string): T | null {
  return measurements.filter((measurement) => measurement.comparisonId === comparisonId && measurement.complete && measurement.macroF1 !== null)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.runId.localeCompare(b.runId))[0] ?? null;
}

export async function createLandingScoreSnapshot(repositoryRoot = root) {
  const sources = [], archived = [];
  for (const path of archivePaths) {
    const indexPath = `${path}/index.json`, index = data(await readJson(resolve(repositoryRoot, indexPath)));
    if (index.version !== "1" || !Number.isFinite(Date.parse(text(index.createdAt))))
      throw new Error(`Invalid published archive index: ${indexPath}`);
    const records = list(index.records);
    sources.push({ path: indexPath, sha256: sha256(index), createdAt: text(index.createdAt), records: records.length, omitted: list(index.omitted).length });
    for (const item of records) {
      const reference = data(item), runId = text(reference.runId);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(runId) || reference.file !== `${runId}.json`)
        throw new Error(`Invalid published archive filename in ${indexPath}`);
      const sourcePath = `${path}/${runId}.json`, view = data(await readJson(resolve(repositoryRoot, sourcePath)));
      const record = data(view.record), report = data(record.report), digest = sha256(view);
      if (Object.keys(view).sort().join(",") !== "publishedAt,record" || view.publishedAt === null || record.id !== runId || report.id !== reference.reportId || digest !== reference.sha256)
        throw new Error(`Published archive identity or hash mismatch: ${sourcePath}`);
      archived.push({ sourcePath, sourceSha256: digest, report, summary: publicSummary(view) });
    }
  }
  const evidenceThrough = sources.map((source) => source.createdAt).sort().at(-1)!;
  const groups = buildLeaderboard({ version: "1", runs: archived.map((item) => item.summary) }, Date.parse(evidenceThrough));
  const entries = new Map(groups.flatMap((group) => group.entries.map((entry) => [entry.id, entry] as const)));
  const measurements = archived.map(({ sourcePath, sourceSha256, report, summary }) => {
    const entry = entries.get(text(summary.id))!, progress = data(summary.progress);
    const classification = data(data(report.overall).classification), population = data(classification.population);
    const spread = data(data(classification.spread).macroF1);
    return {
      runId: entry.id, modelId: entry.requestedModel, provider: entry.provider, servingProvider: entry.requestedServingProvider,
      comparisonId: sha256(JSON.parse(entry.groupKey)), sourcePath, sourceSha256, reportId: text(report.id),
      evidenceSha256: text(data(report.identity).evidenceSha256), createdAt: entry.createdAt,
      publishedAt: entry.publishedAt, expiresAt: entry.expiresAt,
      complete: summary.state === "completed" && progress.startedTrials === entry.planned && progress.finishedTrials === entry.planned &&
        progress.activeTrials === 0 && progress.remainingTrials === 0 && entry.included === entry.planned && progress.infrastructureFailures === 0 &&
        population.status === "complete" && spread.count === 3 && entry.macroF1 !== null && entry.accuracy !== null,
      state: text(summary.state), scoredPopulation: text(population.status), infrastructureFailures: progress.infrastructureFailures,
      plannedTrials: entry.planned, includedTrials: entry.included, macroF1: entry.macroF1, accuracy: entry.accuracy,
      unusable: entry.unusable, trialMin: entry.trialMin, trialMax: entry.trialMax,
      reportedModels: entry.reportedModels, reportedProviders: entry.reportedProviders,
      byDepth: list(report.byDepth).map((value) => {
        const slice = data(value), metrics = data(slice.classification), population = data(metrics.population);
        const depth = slice.depth, score = metrics.macroF1;
        if (typeof depth !== "number" || !Number.isInteger(depth) || depth < 0 ||
          (score !== null && (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1)) ||
          typeof population.plannedTrials !== "number" || typeof population.includedTrials !== "number")
          throw new Error(`Invalid archived depth score: ${entry.id}`);
        return { depth, macroF1: score, plannedTrials: population.plannedTrials, includedTrials: population.includedTrials };
      }),
    };
  }).sort((a, b) => a.runId.localeCompare(b.runId));
  const models = directoryModels.map((model) => {
    const available = measurements.filter((measurement) => measurement.modelId === model.id && measurement.provider === (model.openai ? "openai" : "openrouter") && measurement.servingProvider === null);
    const selected = columns.map((column) => selectLandingMeasurement(available, column.comparisonId));
    return { modelId: model.id, scores: selected.map((measurement) => measurement?.macroF1 ?? null), selectedRunIds: selected.map((measurement) => measurement?.runId ?? null) };
  });
  return {
    version: "1", metric: "pooled-macro-f1-v1", scale: [0, 1], evidenceThrough,
    selectionPolicy: "Earliest created completed published run per exact comparison and requested model; run ID breaks timestamp ties. No best-score selection or alias merging.",
    interpretation: "Historical published evidence, not a live ranking. Compare models within a column. Screening and exploratory populations remain unranked. Missing cells mean no complete retained result for that exact setting. Trial min/max describes three trials, not a confidence interval. Omitted private or failed runs supply no scores.",
    hashAlgorithm: "SHA-256 of recursively key-sorted compact JSON; array order is preserved.",
    sources, columns, comparisons: groups.map((group) => ({ id: sha256(JSON.parse(group.key)), contract: JSON.parse(group.key) })),
    models, measurements,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const snapshot = await createLandingScoreSnapshot();
    const output = resolve(root, "apps/web/public/landing-scores.json");
    await writeFile(output, `${JSON.stringify(snapshot)}\n`);
    console.log(`Exported ${snapshot.models.length} model rows and ${snapshot.measurements.length} published measurements to ${output}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "The landing score export failed.");
    process.exitCode = 1;
  }
}
