"use client";

// A test-first workflow keeps configuration, foreground execution, and retained analysis in one page.
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChartNoAxesCombined, FlaskConical, LockKeyhole, Plus } from "lucide-react";
import { ProviderSetup } from "./provider-setup";
import { ResultsDashboard } from "@/components/results/results-dashboard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEvaluationWorkspace, type EvaluationWorkspaceController } from "./workspace-controller";
import { WorkspaceConfiguration } from "./workspace-configuration";
import { WorkspacePrivateAccess, WorkspaceSavedRun } from "./workspace-private-access";
import { WorkspaceProgress } from "./workspace-progress";
import { WorkspaceSuite } from "./workspace-suite";
import styles from "./evaluation-workspace.module.css";

type Step = "suite" | "model" | "review";
const steps = [{ id: "suite", label: "Test suite", description: "Choose what to measure" }, { id: "model", label: "Model", description: "Connect your provider" }, { id: "review", label: "Review & run", description: "Confirm the workload" }] as const;

function EvaluationSummary({ workspace: w, step, onContinue }: { workspace: EvaluationWorkspaceController; step: Step; onContinue: () => void }) {
  const trials = w.suite && w.configuration ? w.suite.caseCount * w.configuration.policy.trialsPerInstance : null;
  return <aside className={styles.summary} aria-label="Evaluation summary">
    <div className={styles.summaryTitle}><FlaskConical size={18} strokeWidth={1.5} aria-hidden="true" /><h2>Your evaluation</h2></div>
    <dl>
      <div><dt>Test suite</dt><dd>{w.suite?.name ?? "Choose a suite"}</dd></div>
      <div><dt>Model</dt><dd className={w.provider.modelId ? styles.mono : styles.unset}>{w.provider.modelId || "Not selected"}</dd></div>
      <div><dt>Test population</dt><dd>{w.suite ? `${w.suite.caseCount} tests × ${w.configuration?.policy.trialsPerInstance} trials` : "Awaiting suite selection"}</dd></div>
    </dl>
    <div className={styles.summaryTotal}><span>Maximum inference requests</span><strong>{trials !== null && w.configuration ? trials * w.configuration.policy.attemptsPerTrial : "—"}</strong><p>Your provider bills usage. The final review includes output limits and charge approval.</p></div>
    <div className={styles.summaryPrivacy}><LockKeyhole size={16} strokeWidth={1.5} aria-hidden="true" /><p>Results start private. Save your access code after launch to reopen them later.</p></div>
    <div className={styles.summaryOutcome}><h3>What you’ll learn</h3><p>Accuracy and macro-F1 across depths, class-level mistakes, and the model’s answer to every test.</p></div>
    <span className={styles.summaryStep}>Step {steps.findIndex((entry) => entry.id === step) + 1} of 3</span>
    {step !== "review" && <Button className={styles.summaryContinue} disabled={w.busy || (step === "suite" ? !w.suite || w.configurationLoading : !w.runnable)} onClick={onContinue}>{step === "suite" ? "Choose model" : "Review evaluation"}<ArrowRight size={16} aria-hidden="true" /></Button>}
  </aside>;
}

export function EvaluationWorkspace() {
  const w = useEvaluationWorkspace();
  const [step, setStep] = useState<Step>("suite");
  const section = w.showSetup ? "new" : "runs";
  const stepIndex = steps.findIndex((entry) => entry.id === step);
  const canContinue = step === "suite" ? Boolean(w.suite) && !w.configurationLoading : w.runnable;
  const hasResults = w.views.length > 0;
  function changeStep(next: Step) {
    setStep(next);
    requestAnimationFrame(() => document.getElementById(`evaluation-${next}`)?.focus());
  }
  return <div className={styles.workspace}>
    <div className={styles.pageHeading}>
      <div><p className={styles.breadcrumb}>Workspace <span>/</span> Evaluate</p><h1>Put your model to the test.</h1><p>Explore certified mathematical tests. Run your model. Understand every answer.</p></div>
      <a href="/methodology" className={styles.methodologyLink}>How scoring works <ArrowRight size={16} aria-hidden="true" /></a>
    </div>
    <Tabs value={section} onValueChange={(value) => w.setShowSetup(value === "new")} className={styles.workspaceTabs}>
      <TabsList variant="line" aria-label="Evaluation workspace" className={styles.mainTabs}>
        <TabsTrigger value="new"><Plus size={16} strokeWidth={1.5} aria-hidden="true" />New evaluation</TabsTrigger>
        <TabsTrigger value="runs"><ChartNoAxesCombined size={16} strokeWidth={1.5} aria-hidden="true" />Runs & analysis{hasResults && <span className={styles.count}>{w.views.length}</span>}{w.streaming && <span className={styles.runningDot} aria-label="Evaluation running" />}</TabsTrigger>
      </TabsList>
      {w.notice && <p role="status" className={styles.notice}>{w.notice}</p>}
      {w.recordError && <p role="alert" className={styles.error}>{w.recordError}</p>}
      <TabsContent value="new" forceMount hidden={section !== "new"}>
        <div className={styles.setupLayout}>
          <div className={styles.setupMain}>
            <nav className={styles.stepper} aria-label="Evaluation setup steps">
              {steps.map((entry, index) => <button key={entry.id} type="button" aria-current={step === entry.id ? "step" : undefined} disabled={entry.id === "review" && !w.runnable} onClick={() => changeStep(entry.id)}>
                <span className={styles.stepNumber}>{index < stepIndex ? <Check size={14} aria-hidden="true" /> : index + 1}</span><span><strong>{entry.label}</strong><small>{entry.description}</small></span>
              </button>)}
            </nav>
            <div id="evaluation-suite" tabIndex={-1} hidden={step !== "suite"} className={styles.stepPanel}><WorkspaceSuite workspace={w} /></div>
            <div id="evaluation-model" tabIndex={-1} hidden={step !== "model"} className={styles.stepPanel}><ProviderSetup state={w.provider} onChange={w.changeProvider} disabled={w.busy} onSelection={w.setSelection} onDisconnect={w.disconnect} /></div>
            <div id="evaluation-review" tabIndex={-1} hidden={step !== "review"} className={styles.stepPanel}><WorkspaceConfiguration workspace={w} onLaunch={() => { w.setShowSetup(false); void w.launch(); }} /></div>
            <div className={styles.stepFooter}>
              <span>{step === "suite" ? "Fixed suites keep evaluations reproducible" : step === "model" ? "Credentials stay in this page’s memory" : "Provider charges require your approval"}</span>
              <div>{stepIndex > 0 && <Button variant="ghost" onClick={() => changeStep(steps[stepIndex - 1].id)}><ArrowLeft size={16} aria-hidden="true" />Back</Button>}{step !== "review" && <Button disabled={!canContinue || w.busy} onClick={() => changeStep(steps[stepIndex + 1].id)}>{step === "suite" ? "Choose model" : "Review evaluation"}<ArrowRight size={16} aria-hidden="true" /></Button>}</div>
            </div>
          </div>
          <EvaluationSummary workspace={w} step={step} onContinue={() => changeStep(steps[stepIndex + 1].id)} />
        </div>
      </TabsContent>
      <TabsContent value="runs" forceMount hidden={section !== "runs"} className={styles.runsPanel}>
        <div className={styles.sectionHeading}><div><h2>Runs & analysis</h2><p>Inspect results from this session or reopen a saved private run.</p></div><Button variant="outline" onClick={() => { w.setShowSetup(true); changeStep("suite"); }} disabled={w.busy}><Plus size={16} aria-hidden="true" />New evaluation</Button></div>
        {w.streaming || w.busy || w.streamError || !hasResults ? <WorkspaceProgress workspace={w} /> : w.handle && <details className={styles.progressDetails}><summary>Execution: {w.runState} · {w.progress?.finishedTrials} / {w.progress?.plannedTrials} trials finished</summary><WorkspaceProgress workspace={w} /></details>}
        {w.handle && <div className={styles.accessReminder}><LockKeyhole size={18} strokeWidth={1.5} aria-hidden="true" /><div><strong>Keep access to this run</strong><p>Save its private access file before refreshing or starting another evaluation.</p></div><Button variant="outline" onClick={w.saveAccess}>Save access file</Button></div>}
        {hasResults ? <ResultsDashboard key={w.currentRun?.id ?? "session-results"} runs={w.views} /> : !w.streaming && !w.handle && <div className={styles.resultsEmpty}>
          <ChartNoAxesCombined size={36} strokeWidth={1} aria-hidden="true" /><h3>Every result starts with a test.</h3><p>Run an evaluation to see performance across depths, inspect mistakes, and read the reasoning behind each answer.</p><Button onClick={() => w.setShowSetup(true)}>Create an evaluation<ArrowRight size={16} aria-hidden="true" /></Button>
        </div>}
        <div className={styles.runAccess} id="run-access">
          {w.handle && <details className={styles.accessDetails}><summary>Private access, exports & publication</summary><WorkspacePrivateAccess key={w.handle.id} workspace={w} /></details>}
          <WorkspaceSavedRun workspace={w} />
        </div>
        {hasResults && <p className={styles.sessionNote}>This list lasts for the current page session. Private runs require their saved ID and access code after a refresh; they cannot resume.</p>}
      </TabsContent>
    </Tabs>
  </div>;
}
