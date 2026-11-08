"use client";

// Browse certified test populations and inspect their exact expressions before a paid run.
import { useId, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSuitePreview, type SuitePreview } from "@/lib/suite-preview";
import type { RunSuiteDescription } from "@/lib/run-api";
import type { EvaluationWorkspaceController } from "./workspace-controller";
import { CurvatureGuide } from "./curvature-guide";
import styles from "./evaluation-workspace.module.css";

function SuiteTests({ preview }: { preview: SuitePreview }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState("all");
  const [chosen, setChosen] = useState("");
  const [page, setPage] = useState(0);
  const filtered = preview.cases.filter((entry) => (depth === "all" || String(entry.depth) === depth) &&
    `${entry.expression} ${entry.family} ${entry.family.replaceAll("-", " ")} ${entry.depth}`.toLowerCase().includes(query.trim().toLowerCase()));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 6) - 1));
  const rows = filtered.slice(currentPage * 6, currentPage * 6 + 6);
  const selected = rows.find((entry) => entry.id === chosen) ?? rows[0];
  return (
    <section className={styles.testBrowser} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionHeading}>
        <div><h3 id={`${id}-title`}>Inside this suite</h3><p>Explore the expressions and domains your model will receive</p></div>
        <span className={styles.mono}>{preview.cases.length} tests</span>
      </div>
      <div className={styles.testFilters}>
        <div className={styles.searchField}>
          <Search size={16} strokeWidth={1.5} aria-hidden="true" />
          <Input aria-label="Search suite tests" placeholder="Search expression, family or depth" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
        </div>
        <select className={styles.select} aria-label="Filter test depth" value={depth} onChange={(event) => { setDepth(event.target.value); setPage(0); }}>
          <option value="all">All depths</option>{[...new Set(preview.cases.map((entry) => entry.depth))].sort((a, b) => a - b).map((value) => <option key={value} value={value}>Depth {value}</option>)}
        </select>
      </div>
      <div className={styles.testList}>
        <div className={styles.testListHeader}><span>Test / function family</span><span>Depth</span><span>Domain</span></div>
        {rows.map((entry) => (
          <button className={styles.testRow} type="button" key={entry.id} aria-pressed={selected?.id === entry.id} onClick={() => setChosen(entry.id)}>
            <span className={styles.testName}><span>{entry.family.replaceAll("-", " ")}</span><code>f(x) = {entry.expression}</code></span>
            <span className={styles.mono}>{entry.depth}</span><span className={styles.labelTag}>[{entry.domain.min}, {entry.domain.max}]</span>
          </button>
        ))}
        {!filtered.length && <p className={styles.noMatches}>No tests match. Change the search or depth filter.</p>}
      </div>
      <div className={styles.pagination}>
        <span>{filtered.length ? `${currentPage * 6 + 1}–${Math.min(currentPage * 6 + 6, filtered.length)} of ${filtered.length} tests` : "0 tests"}</span>
        <div><Button variant="ghost" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="ghost" size="sm" disabled={(currentPage + 1) * 6 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div>
      </div>
      {selected && <div className={styles.expressionPreview}>
        <div><span>Selected test</span><span className={styles.mono}>x ∈ [{selected.domain.min}, {selected.domain.max}]</span></div>
        <pre tabIndex={0}>f(x) = {selected.expression}</pre>
        <p>Reference answers appear with your results. The model receives the expression, domain, and task instructions; reference answers stay out of its prompt.</p>
      </div>}
    </section>
  );
}

function SuiteCoverage({ suite, preview }: { suite: RunSuiteDescription; preview: SuitePreview }) {
  const maximum = Math.max(...suite.depths.map((depth) => preview.cases.filter((entry) => entry.depth === depth).length));
  return <div className={styles.coverage}>
    <div><h3>Depth coverage</h3><p>Nesting depth changes with structure and length; it is not a difficulty score.</p></div>
    <div className={styles.depthBars} aria-label="Number of tests at each measured depth">
      {suite.depths.map((depth) => {
        const count = preview.cases.filter((entry) => entry.depth === depth).length;
        return <div key={depth} className={styles.depthColumn}><span>{count}</span><div><i style={{ height: `${count / maximum * 100}%` }} /></div><span className={styles.mono}>{depth}</span></div>;
      })}
    </div>
    <span className={styles.axisCaption}>Measured depth · {Object.entries(preview.labelCounts).map(([label, count]) => `${count} ${label}`).join(" / ")}</span>
  </div>;
}

export function WorkspaceSuite({ workspace: w }: { workspace: EvaluationWorkspaceController }) {
  const id = useId();
  const preview = w.suite ? getSuitePreview(w.suite) : null;
  const order = ["challenge-v1", "screening-v1", "smooth-v2", "reference-v1", "interior-v1", "reserve-v1"];
  return <div className={styles.suiteStep}>
    <CurvatureGuide />
    <div className={styles.sectionHeading}>
      <div><h2 id={`${id}-title`}>Choose a test suite</h2><p>Each suite has fixed, verified tests. Every test runs three fresh trials.</p></div>
    </div>
    {w.configurationLoading && <p role="status" className={styles.loading}>Loading verified test suites…</p>}
    {w.configurationError && <div role="alert" className={styles.error}><p>{w.configurationError}</p><Button variant="outline" onClick={w.retryConfiguration}>Retry test suites</Button></div>}
    <fieldset aria-labelledby={`${id}-title`} disabled={w.busy || w.configuration === null} className={styles.suiteChoices}>
      {[...(w.configuration?.suites ?? [])].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((suite) => (
        <label className={styles.suiteChoice} key={suite.key} data-selected={w.suiteKey === suite.key}>
          <input type="radio" name={`${id}-suite`} value={suite.key} checked={w.suiteKey === suite.key} onChange={() => w.changeSuite(suite.key)} />
          <span className={styles.suiteChoiceBody}>
            <span className={styles.suiteChoiceTitle}>{suite.name}{suite.recommended && <span className={styles.recommended}>Recommended</span>}</span>
            <span className={styles.suiteDescription}>{suite.description}</span>
            <span className={styles.suiteMeta}>{suite.caseCount} tests <span>·</span> {suite.caseCount * (w.configuration?.policy.trialsPerInstance ?? 3)} trials</span>
          </span>
          {w.suiteKey === suite.key && <Check className={styles.choiceCheck} size={16} aria-hidden="true" />}
        </label>
      ))}
    </fieldset>
    {w.suite && preview && <>
      <SuiteCoverage suite={w.suite} preview={preview} />
      <SuiteTests key={w.suite.suiteId} preview={preview} />
    </>}
    {w.suite && !preview && <p role="alert" className={styles.error}>The test preview does not match the service’s suite version. Preview unavailable; ask the operator to regenerate suite-previews.json.</p>}
  </div>;
}
