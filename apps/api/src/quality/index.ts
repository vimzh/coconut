export { auditSuite } from "./suite";
export { auditRun } from "./run";
export { clusterBootstrapInterval } from "./bootstrap";
export { referenceReviewHash, transcriptReviewHash } from "./signal";
export { sha256 as qualityDataHash } from "./data";
export type * from "./types";

import type { RunRecord } from "../runs/types";
import { auditRun } from "./run";
import type { SignalReviewEvidence } from "./types";

export async function assessSignal(record: RunRecord, reviewEvidence: SignalReviewEvidence) {
  return (await auditRun(record, reviewEvidence)).signal;
}
