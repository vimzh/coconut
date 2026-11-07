// Parses a detached execution snapshot before asynchronous suite verification.
import { getProfile, PROTOCOL_VERSION, type ProfileId } from "../protocol";
import type { FrozenSuite } from "../suites";
import { freezeData } from "../suites/generator";
import { validateCostEvidence } from "./cost";
import type { AttemptEvidence, CostEvidence, ExpressionTokenEvidence, RunEvidence, TokenField, TrialEvidence } from "./types";
import { array, duration, integer, MAX_RETAINED_TEXT_CODE_UNITS, outcome, record, ScoringInputError, text } from "./validation";

function token(input: unknown, name: string): TokenField | null {
  if (input === null) return null;
  const data = record(input, name, ["count", "semantics"]);
  return { count: integer(data.count, `${name} count`), semantics: text(data.semantics, `${name} semantics`) };
}

function cost(input: unknown): CostEvidence | null {
  if (input === null) return null;
  const data = record(input, "Attempt cost");
  const currency = text(data.currency, "Cost currency", 3);
  if (!/^[A-Z]{3}$/.test(currency)) throw new ScoringInputError("Cost currency must be a three-letter uppercase code.");
  if (data.kind === "billed") {
    record(data, "Billed cost", ["kind", "currency", "amount"]);
    return { kind: "billed", currency, amount: text(data.amount, "Cost amount", 64) };
  }
  if (data.kind !== "estimated") throw new ScoringInputError("Cost kind must be billed or estimated.");
  record(data, "Estimated cost", ["kind", "currency", "source", "date", "inputPerMillion", "outputPerMillion", "inputSemantics", "outputSemantics"]);
  return {
    kind: "estimated", currency,
    source: text(data.source, "Pricing source", 1024), date: text(data.date, "Pricing date", 10),
    inputPerMillion: text(data.inputPerMillion, "Input rate", 64),
    outputPerMillion: text(data.outputPerMillion, "Output rate", 64),
    inputSemantics: text(data.inputSemantics, "Input pricing semantics"), outputSemantics: text(data.outputSemantics, "Output pricing semantics"),
  };
}

function attempt(input: unknown, profileId: ProfileId, sequence: number): AttemptEvidence {
  const data = record(input, "Attempt", ["sequence", "outcome", "errorKind", "elapsedMs", "usage", "cost"]);
  if (data.sequence !== sequence) throw new ScoringInputError("Attempt sequences must be contiguous and start at 1.");
  const answer = outcome(data.outcome, profileId);
  const errorKinds = ["authentication", "unavailable", "transport", "timeout", "other"];
  if (answer.kind === "provider-error" ? !errorKinds.includes(data.errorKind as string) : data.errorKind !== null) {
    throw new ScoringInputError("Only provider-error attempts require an explicit provider-error category; other attempts require null.");
  }
  const usage = record(data.usage, "Attempt usage", ["input", "output", "reasoning"]);
  const parsed: AttemptEvidence = {
    sequence, outcome: answer, errorKind: data.errorKind as AttemptEvidence["errorKind"],
    elapsedMs: duration(data.elapsedMs, "Attempt elapsed time"),
    usage: { input: token(usage.input, "Input usage"), output: token(usage.output, "Output usage"), reasoning: token(usage.reasoning, "Reasoning usage") },
    cost: cost(data.cost),
  };
  validateCostEvidence(parsed);
  return parsed;
}

function trial(input: unknown, profileId: ProfileId): TrialEvidence {
  const data = record(input, "Trial", ["caseId", "trialIndex", "finalAttempt", "elapsedMs", "attempts"]);
  const profile = getProfile(profileId);
  const trialIndex = integer(data.trialIndex, "Trial index");
  if (trialIndex >= profile.trialsPerInstance) throw new ScoringInputError("Trial index exceeds the selected profile.");
  const attempts = array(data.attempts, "Trial attempts", profile.maxAttemptsPerTrial).map((value, index) => attempt(value, profileId, index + 1));
  const elapsedMs = duration(data.elapsedMs, "Logical-trial elapsed time");
  if (attempts.length === 0) {
    if (data.finalAttempt !== null || elapsedMs !== null) throw new ScoringInputError("Unattempted trials require no attempts, null finalAttempt, and null elapsed time.");
  } else {
    if (data.finalAttempt !== attempts.length) throw new ScoringInputError("Final attempt must explicitly identify the last retained attempt.");
    for (const earlier of attempts.slice(0, -1)) {
      if (earlier.outcome.kind !== "provider-error" && earlier.outcome.kind !== "interrupted") {
        throw new ScoringInputError("A returned model answer or cancellation cannot become an earlier retry attempt.");
      }
    }
  }
  return { caseId: text(data.caseId, "Trial case ID", 128), trialIndex, finalAttempt: attempts.length === 0 ? null : attempts.length, elapsedMs, attempts };
}

function expressionTokens(input: unknown): ExpressionTokenEvidence {
  const data = record(input, "Expression tokens", ["caseId", "expressionSha256", "tokenizer", "count"]);
  const tokenizer = record(data.tokenizer, "Tokenizer", ["id", "version", "modelId"]);
  if (typeof data.expressionSha256 !== "string" || !/^[a-f0-9]{64}$/.test(data.expressionSha256)) {
    throw new ScoringInputError("Expression token evidence requires an exact lowercase SHA-256.");
  }
  return {
    caseId: text(data.caseId, "Token case ID", 128), expressionSha256: data.expressionSha256,
    tokenizer: { id: text(tokenizer.id, "Tokenizer ID"), version: text(tokenizer.version, "Tokenizer version"), modelId: text(tokenizer.modelId, "Tokenizer model ID") },
    count: integer(data.count, "Expression token count"),
  };
}

export function parseEvidence(input: unknown): RunEvidence {
  const data = record(input, "Run evidence", ["runId", "suiteId", "protocolVersion", "profileId", "model", "run", "trials", "expressionTokens"]);
  if (data.protocolVersion !== PROTOCOL_VERSION) throw new ScoringInputError("Unsupported evidence protocol version.");
  const profile = getProfile(data.profileId);
  const model = record(data.model, "Model identity", ["provider", "modelId", "endpointId", "settingsId"]);
  const run = record(data.run, "Run timing", ["elapsedMs", "concurrency"]);
  let retainedText = 0;
  const trials = array(data.trials, "Logical trials", profile.maxInstances * profile.trialsPerInstance).map((value) => {
    const parsed = trial(value, profile.id);
    for (const attempt of parsed.attempts) {
      retainedText += attempt.outcome.rawText.length;
      if (attempt.outcome.kind === "provider-error") retainedText += attempt.outcome.message.length;
    }
    if (retainedText > MAX_RETAINED_TEXT_CODE_UNITS) {
      throw new ScoringInputError(`Retained reply/error text exceeds the ${MAX_RETAINED_TEXT_CODE_UNITS} UTF-16 code-unit evidence budget.`);
    }
    return parsed;
  });
  return freezeData({
    runId: text(data.runId, "Run ID", 128), suiteId: text(data.suiteId, "Suite ID", 128), protocolVersion: PROTOCOL_VERSION,
    profileId: profile.id,
    model: { provider: text(model.provider, "Provider"), modelId: text(model.modelId, "Model ID"), endpointId: text(model.endpointId, "Endpoint ID"), settingsId: text(model.settingsId, "Settings ID") },
    run: { elapsedMs: duration(run.elapsedMs, "Run wall time"), concurrency: run.concurrency === null ? null : integer(run.concurrency, "Run concurrency", 1) },
    trials,
    expressionTokens: array(data.expressionTokens, "Expression token records", profile.maxInstances).map(expressionTokens),
  });
}

export function bindEvidence(evidence: RunEvidence, suite: FrozenSuite): RunEvidence {
  if (evidence.suiteId !== suite.id || evidence.protocolVersion !== suite.protocolVersion || evidence.profileId !== suite.request.profileId) {
    throw new ScoringInputError("Run evidence must match the exact frozen suite, protocol, and profile.");
  }
  const profile = getProfile(evidence.profileId);
  const order = new Map(suite.cases.map((entry, index) => [entry.id, index]));
  const seen = new Set<string>();
  for (const trial of evidence.trials) {
    const key = `${trial.caseId}:${trial.trialIndex}`;
    if (!order.has(trial.caseId)) throw new ScoringInputError("Trial refers to a case outside the frozen suite.");
    if (seen.has(key)) throw new ScoringInputError("Duplicate logical trial record.");
    seen.add(key);
  }
  if (seen.size !== suite.cases.length * profile.trialsPerInstance) {
    throw new ScoringInputError("Missing planned trial records; retain explicit unattempted records instead of omitting work.");
  }
  const tokens = new Set<string>();
  for (const value of evidence.expressionTokens) {
    if (!order.has(value.caseId) || tokens.has(value.caseId)) throw new ScoringInputError("Expression token evidence has an unknown or duplicate case ID.");
    tokens.add(value.caseId);
  }
  const caseOrder = (left: { caseId: string }, right: { caseId: string }) => order.get(left.caseId)! - order.get(right.caseId)!;
  return freezeData({
    ...evidence,
    trials: [...evidence.trials].sort((left, right) => caseOrder(left, right) || left.trialIndex - right.trialIndex),
    expressionTokens: [...evidence.expressionTokens].sort(caseOrder),
  });
}
