// Retained execution evidence and normalized scoring inputs, independent of providers.
import type { Label } from "../math";
import type { AnswerOutcome, ProfileId } from "../protocol";

export interface TokenField {
  readonly count: number;
  readonly semantics: string;
}

export interface AttemptUsage {
  readonly input: TokenField | null;
  readonly output: TokenField | null;
  readonly reasoning: TokenField | null;
}

export type CostEvidence =
  | { readonly kind: "billed"; readonly currency: string; readonly amount: string }
  | {
      readonly kind: "estimated";
      readonly currency: string;
      readonly source: string;
      readonly date: string;
      readonly inputPerMillion: string;
      readonly outputPerMillion: string;
      readonly inputSemantics: string;
      readonly outputSemantics: string;
    };

export interface AttemptEvidence {
  readonly sequence: number;
  readonly outcome: AnswerOutcome;
  readonly errorKind: "authentication" | "unavailable" | "transport" | "timeout" | "other" | null;
  readonly elapsedMs: number | null;
  readonly usage: AttemptUsage;
  readonly cost: CostEvidence | null;
}

export interface TrialEvidence {
  readonly caseId: string;
  readonly trialIndex: number;
  readonly finalAttempt: number | null;
  readonly elapsedMs: number | null;
  readonly attempts: readonly AttemptEvidence[];
}

export interface TokenizerIdentity {
  readonly id: string;
  readonly version: string;
  readonly modelId: string;
}

export interface ExpressionTokenEvidence {
  readonly caseId: string;
  readonly expressionSha256: string;
  readonly tokenizer: TokenizerIdentity;
  readonly count: number;
}

export interface RunEvidence {
  readonly runId: string;
  readonly suiteId: string;
  readonly protocolVersion: "1";
  readonly profileId: ProfileId;
  readonly model: {
    readonly provider: string;
    readonly modelId: string;
    readonly endpointId: string;
    readonly settingsId: string;
  };
  readonly run: { readonly elapsedMs: number | null; readonly concurrency: number | null };
  readonly trials: readonly TrialEvidence[];
  readonly expressionTokens: readonly ExpressionTokenEvidence[];
}

export interface Observation {
  readonly caseId: string;
  readonly depth: number;
  readonly referenceLabel: Label;
  readonly trialIndex: number;
  readonly outcome: AnswerOutcome | null;
}

export interface ExpressionLength {
  readonly caseId: string;
  readonly depth: number;
  readonly expressionSha256: string;
  readonly expressionCharacters: number;
  readonly nodeCount: number;
  readonly promptCharacters: number;
}

export interface Rate {
  readonly numerator: number;
  readonly denominator: number;
  readonly value: number | null;
}
