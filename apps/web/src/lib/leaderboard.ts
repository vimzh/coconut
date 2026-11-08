// Public summaries preserve scorer values while making comparison and repeat policies explicit.
type Data = Record<string, unknown>;
export class LeaderboardInputError extends Error {
  constructor() {
    super("The public comparison evidence is invalid or incomplete.");
    this.name = "LeaderboardInputError";
  }
}
function invalid(): never {
  throw new LeaderboardInputError();
}
function data(value: unknown): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((entry) => !("value" in entry)))
    invalid();
  return Object.fromEntries(
    Object.entries(descriptors).map(([key, entry]) => [key, entry.value]),
  );
}
function text(value: unknown): string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 2048 &&
    !/\p{Cc}/u.test(value)
    ? value
    : invalid();
}
function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : invalid();
}
function score(value: unknown): number | null {
  return value === null
    ? null
    : typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1
      ? value
      : invalid();
}
function array(value: unknown, maximum = 500): unknown[] {
  return Array.isArray(value) && value.length <= maximum ? value : invalid();
}
function date(value: unknown): string {
  const result = text(value);
  return Number.isFinite(Date.parse(result)) ? result : invalid();
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(data(value))
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(data(value)[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const identifier = (value: unknown) => {
  const result = text(value);
  return /^[A-Za-z0-9_-]{1,128}$/.test(result) ? result : invalid();
};
const nullableText = (value: unknown) => (value === null ? null : text(value));

export interface LeaderboardEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly expiresAt: string;
  readonly suiteKey: string;
  readonly suiteId: string;
  readonly population: string;
  readonly profileId: string;
  readonly provider: string;
  readonly requestedModel: string;
  readonly requestedServingProvider: string | null;
  readonly reportedModels: readonly string[];
  readonly reportedProviders: readonly string[];
  readonly groupKey: string;
  readonly repeatKey: string;
  readonly settingsId: string;
  readonly maxOutputTokens: number;
  readonly concurrency: number;
  readonly caseCount: number;
  readonly depths: readonly number[];
  readonly planned: number;
  readonly included: number;
  readonly macroF1: number | null;
  readonly accuracy: number | null;
  readonly trialMin: number | null;
  readonly trialMax: number | null;
  readonly unusable: number;
  readonly reasons: readonly string[];
  readonly eligible: boolean;
  readonly rank: number | null;
  readonly repeatedRunIds: readonly string[];
  readonly representativeId: string | null;
}
export interface LeaderboardGroup {
  readonly key: string;
  readonly entries: readonly LeaderboardEntry[];
}

function parseEntry(value: unknown, now: number): LeaderboardEntry {
  const x = data(value),
    request = data(x.request),
    suite = data(x.suite),
    progress = data(x.progress),
    observation = data(x.observation);
  if (x.version !== "1") invalid();
  const id = identifier(x.id),
    createdAt = date(x.createdAt),
    expiresAt = date(x.expiresAt),
    publishedAt = x.publishedAt === null ? null : date(x.publishedAt);
  const suiteId = text(suite.id),
    profileId = text(request.profileId),
    provider = text(request.provider),
    requestedModel = text(request.modelId),
    requestedServingProvider = nullableText(request.servingProvider);
  for (const field of [
    "generatorVersion",
    "depthPolicyVersion",
    "verifierVersion",
    "protocolVersion",
    "promptVersion",
  ])
    text(suite[field]);
  const population = text(suite.population),
    caseCount = count(suite.caseCount),
    concurrency = count(request.concurrency);
  const depths = array(suite.depths, 1000).map(count);
  if (
    caseCount < 1 ||
    concurrency < 1 ||
    concurrency > 12 ||
    depths.length === 0 ||
    new Set(depths).size !== depths.length
  )
    invalid();
  const reportedModels = array(observation.reportedModelIds).map(text),
    reportedProviders = array(observation.reportedServingProviders).map(text);
  const missingIdentity = count(observation.modelIdentityMissing),
    unverifiedContext = count(observation.contextFitUnverified),
    unverifiedCap = count(observation.outputLimitUnverified),
    unverifiedSchema = count(observation.schemaUnverified);
  const planned = count(progress.plannedTrials),
    started = count(progress.startedTrials),
    active = count(progress.activeTrials),
    finished = count(progress.finishedTrials),
    included = count(progress.modelOutcomes),
    failures = count(progress.infrastructureFailures),
    remaining = count(progress.remainingTrials);
  count(progress.inferenceRequests);
  if (
    planned !== caseCount * 3 ||
    started > planned ||
    active > started ||
    finished + active > started ||
    finished + remaining !== planned ||
    included + failures !== finished ||
    [missingIdentity, unverifiedContext, unverifiedCap, unverifiedSchema].some(
      (n) => n > included,
    )
  )
    invalid();
  const report = x.report === null ? null : data(x.report),
    reasons: string[] = [];
  let macroF1: number | null = null,
    accuracy: number | null = null,
    trialMin: number | null = null,
    trialMax: number | null = null,
    unusable = 0,
    settingsId = "unavailable",
    maxOutputTokens = 0;
  let identity: Data | null = null;
  if (report !== null) {
    identity = data(report.identity);
    const model = data(identity.model),
      workload = data(identity.workload),
      run = data(report.run),
      classification = data(data(report.overall).classification),
      scoredPopulation = data(classification.population),
      spread = data(data(classification.spread).macroF1);
    if (
      report.reportVersion !== "1" ||
      report.scorerVersion !== "1" ||
      report.policyId !== "pooled-macro-f1-v1" ||
      identity.runId !== id ||
      identity.suiteId !== suiteId ||
      identity.profileId !== profileId ||
      model.provider !== provider ||
      model.modelId !== requestedModel ||
      identity.method !== "one-shot" ||
      workload.trialsPerInstance !== 3 ||
      workload.logicalCalls !== planned ||
      workload.instanceCount !== caseCount ||
      run.concurrency !== concurrency ||
      workload.profileId !== profileId
    )
      invalid();
    for (const field of [
      "generatorVersion",
      "depthPolicyVersion",
      "verifierVersion",
      "protocolVersion",
    ])
      if (identity[field] !== suite[field]) invalid();
    const certification =
      identity.certification === undefined
        ? null
        : data(identity.certification);
    if (
      certification !== null &&
      certification.promptVersion !== suite.promptVersion
    )
      invalid();
    if (
      count(scoredPopulation.plannedTrials) !== planned ||
      count(scoredPopulation.includedTrials) !== included ||
      count(scoredPopulation.excludedTrials) !== planned - included
    )
      invalid();
    settingsId = text(model.settingsId);
    if (
      model.endpointId !== `${provider}/${requestedServingProvider ?? "direct"}`
    )
      invalid();
    text(identity.evidenceSha256);
    maxOutputTokens = count(workload.maxOutputTokens);
    if (![4096, 16384].includes(maxOutputTokens)) invalid();
    macroF1 = score(classification.macroF1);
    accuracy = score(data(classification.accuracy).value);
    trialMin = score(spread.min);
    trialMax = score(spread.max);
    if (
      macroF1 === null ||
      scoredPopulation.status !== "complete" ||
      count(spread.count) !== 3 ||
      trialMin === null ||
      trialMax === null
    )
      reasons.push("The scored population or three-trial spread is incomplete");
    const outcomes = data(classification.outcomes);
    for (const kind of [
      "invalid",
      "empty",
      "conflicting",
      "refused",
      "truncated",
    ])
      unusable += count(data(outcomes[kind]).numerator);
    if (unusable > included) invalid();
  } else reasons.push("The retained scoring report is unavailable");
  if (publishedAt === null) reasons.push("Publication has been withdrawn");
  if (Date.parse(expiresAt) <= now)
    reasons.push("The supporting evidence has expired");
  if (
    x.state !== "completed" ||
    started !== planned ||
    finished !== planned ||
    active !== 0 ||
    remaining !== 0 ||
    included !== planned ||
    failures !== 0
  )
    reasons.push(
      "Planned model work is incomplete or contains infrastructure failures",
    );
  if (missingIdentity !== 0 || reportedModels.length !== 1)
    reasons.push("A stable reported model identity is unavailable");
  if (provider !== "openai" && reportedProviders.length !== 1)
    reasons.push("A stable reported serving provider is unavailable");
  if (reportedProviders.length > 1)
    reasons.push("The serving provider changed during the run");
  if (unverifiedContext !== 0)
    reasons.push("Context handling was not verified for every model outcome");
  if (unverifiedCap !== 0)
    reasons.push("The output limit was not verified for every model outcome");
  if (unverifiedSchema !== 0)
    reasons.push(
      "Native schema acceptance was not verified for every model outcome",
    );
  if (population === "screening")
    reasons.push("Screening runs are exploratory and unranked");
  const groupKey = stable({
    suiteId,
    suiteKey: request.suiteKey,
    population,
    profileId,
    versions: [
      suite.generatorVersion,
      suite.depthPolicyVersion,
      suite.verifierVersion,
      suite.protocolVersion,
      suite.promptVersion,
    ],
    depths,
    caseCount,
    settingsId,
    concurrency,
    method: identity?.method ?? null,
    workload: identity?.workload ?? null,
    certification: identity?.certification ?? null,
  });
  const repeatKey = stable([
    provider,
    requestedModel,
    requestedServingProvider,
    reportedModels,
    reportedProviders,
  ]);
  return {
    id,
    createdAt,
    publishedAt,
    expiresAt,
    suiteKey: text(request.suiteKey),
    suiteId,
    population,
    profileId,
    provider,
    requestedModel,
    requestedServingProvider,
    reportedModels,
    reportedProviders,
    groupKey,
    repeatKey,
    settingsId,
    maxOutputTokens,
    concurrency,
    caseCount,
    depths,
    planned,
    included,
    macroF1,
    accuracy,
    trialMin,
    trialMax,
    unusable,
    reasons,
    eligible: reasons.length === 0,
    rank: null,
    repeatedRunIds: [],
    representativeId: null,
  };
}

export function buildLeaderboard(
  input: unknown,
  now = Date.now(),
): readonly LeaderboardGroup[] {
  if (!Number.isFinite(now)) invalid();
  const envelope = data(input);
  if (envelope.version !== "1") invalid();
  const entries = array(envelope.runs).map((value) => parseEntry(value, now));
  if (new Set(entries.map((e) => e.id)).size !== entries.length) invalid();
  const groups = new Map<string, LeaderboardEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.groupKey) ?? [];
    group.push(entry);
    groups.set(entry.groupKey, group);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => {
      const repeatGroups = new Map<string, LeaderboardEntry[]>();
      for (const entry of values) {
        const repeats = repeatGroups.get(entry.repeatKey) ?? [];
        repeats.push(entry);
        repeatGroups.set(entry.repeatKey, repeats);
      }
      const representatives = new Map<string, LeaderboardEntry>();
      for (const [repeatKey, repeated] of repeatGroups) {
        const first = repeated
          .filter((entry) => entry.eligible)
          .sort(
            (a, b) =>
              Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
              a.id.localeCompare(b.id),
          )[0];
        if (first) representatives.set(repeatKey, first);
      }
      const ranked = [...representatives.values()].sort(
        (a, b) => b.macroF1! - a.macroF1! || a.id.localeCompare(b.id),
      );
      const ranks = new Map<string, number>();
      let rank = 0;
      ranked.forEach((entry, index) => {
        if (index === 0 || entry.macroF1 !== ranked[index - 1].macroF1)
          rank = index + 1;
        ranks.set(entry.id, rank);
      });
      const rows = values.map((entry) => ({
        ...entry,
        rank: ranks.get(entry.id) ?? null,
        representativeId: representatives.get(entry.repeatKey)?.id ?? null,
        repeatedRunIds: repeatGroups
          .get(entry.repeatKey)!
          .map((run) => run.id)
          .sort(),
      }));
      rows.sort(
        (a, b) =>
          (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
          a.id.localeCompare(b.id),
      );
      return { key, entries: rows };
    });
}
