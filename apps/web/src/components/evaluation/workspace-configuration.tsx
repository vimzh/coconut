"use client";

// The final review binds explicit charge consent to the displayed workload and model settings.
import { useId } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { EvaluationWorkspaceController } from "./workspace-controller";
import styles from "./evaluation-workspace.module.css";

export function WorkspaceConfiguration({ workspace: w, onLaunch }: {
  workspace: EvaluationWorkspaceController;
  onLaunch: () => void;
}) {
  const id = useId(), policy = w.configuration?.policy;
  const trials = w.suite && policy ? w.suite.caseCount * policy.trialsPerInstance : null;
  const requests = trials !== null && policy ? trials * policy.attemptsPerTrial : null;
  const outputCeiling = requests !== null && w.profile ? requests * w.profile.maxOutputTokens : null;
  return <section className={styles.review} aria-labelledby={`${id}-title`}>
    <div className={styles.sectionHeading}><div><h2 id={`${id}-title`}>Review your evaluation</h2><p>Confirm the test population, model settings, and request limits.</p></div></div>
    <div className={styles.reviewModel}>
      <span className={styles.kicker}>Model under test</span>
      <h3>{w.provider.modelId || "Choose a model"}</h3>
      <p>{w.provider.provider} · {w.provider.servingProvider ?? "Direct connection"}</p>
    </div>
    <dl className={styles.reviewNumbers}>
      <div><dt>Verified tests</dt><dd>{w.suite?.caseCount ?? "—"}</dd></div>
      <div><dt>Trials per test</dt><dd>{policy?.trialsPerInstance ?? "—"}</dd></div>
      <div><dt>Maximum requests</dt><dd>{requests ?? "—"}</dd></div>
    </dl>
    <dl className={styles.reviewDetails}>
      <div><dt>Test suite</dt><dd>{w.suite?.name ?? "Choose a suite"}</dd></div>
      <div><dt>Measured depths</dt><dd className={styles.mono}>{w.suite?.depths.join(", ") ?? "—"}</dd></div>
      <div><dt>Answer profile</dt><dd>{w.provider.profileId}</dd></div>
      <div><dt>Reasoning</dt><dd>{w.profile?.reasoning ?? "Choose a profile"} · fresh, one-shot trials</dd></div>
      <div><dt>Output cap per request</dt><dd className={styles.mono}>{w.profile ? `${w.profile.maxOutputTokens.toLocaleString()} tokens` : "—"}</dd></div>
      <div><dt>Maximum requested output</dt><dd className={styles.mono}>{outputCeiling === null ? "—" : `${outputCeiling.toLocaleString()} tokens`}</dd></div>
      <div><dt>Attempts / automatic retries</dt><dd>{policy?.attemptsPerTrial ?? "—"} / {policy?.retries ?? "—"}</dd></div>
      <div><dt>Results</dt><dd>Private until you publish · retained for {policy?.retentionDays ?? 7} days</dd></div>
    </dl>
    <div className={styles.concurrency}>
      <div><Label htmlFor={`${id}-concurrency`}>Concurrent trials</Label><p>Simultaneous trials. Your provider’s rate limits may be lower.</p></div>
      <NativeSelect id={`${id}-concurrency`} value={w.concurrency} disabled={w.busy || !policy} onChange={(event) => w.changeConcurrency(Number(event.target.value))}>
        {Array.from({ length: policy?.maxConcurrency ?? 0 }, (_, index) => index + 1).map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}
      </NativeSelect>
    </div>
    <details className={styles.technicalDetails}>
      <summary>Suite version and execution details</summary>
      <p className="break-all font-mono">{w.suite?.suiteId}</p>
      <p>Generator {w.suite?.generatorVersion} · instructions {w.suite?.promptVersion}. This is the catalog identity for the version-1 prompted-JSON profile. Other answer profiles receive a separately verified identity during preparation.</p>
      <p>Compatibility checks are optional. Each trial refreshes model metadata and permission checks. Unsupported or unknown settings remain visible as failures. No model substitution or automatic retry occurs.</p>
    </details>
    <div className={styles.launchArea}>
      <div className={styles.consent}>
        <input id={`${id}-charges`} type="checkbox" checked={w.acceptCharges} disabled={!w.runnable || w.busy || w.privateAction !== null} onChange={(event) => w.setAcceptCharges(event.target.checked)} />
        <Label htmlFor={`${id}-charges`}>I approve up to {requests ?? "the displayed number of"} inference requests using my provider credential and accept the associated provider charges. Token caps are not currency limits.</Label>
      </div>
      <Button size="lg" disabled={!w.canLaunch} onClick={onLaunch} className={styles.launchButton}>
        {w.streaming ? "Evaluation in progress" : "Start evaluation"}<ArrowRight size={16} aria-hidden="true" />
      </Button>
      {!w.runnable && <p role="status">Choose a verified suite, enter your provider credential and exact model, and resolve any blocked model settings before starting.</p>}
      <p>Keep this page open during the run. Refresh or navigation interrupts execution; completed evidence is retained, but interrupted work cannot resume.</p>
    </div>
  </section>;
}
