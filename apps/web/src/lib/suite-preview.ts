// Match frozen task previews to the live catalog before displaying a suite's contents.
import snapshot from "../../public/suite-previews.json";
import type { RunSuiteDescription } from "./run-api";

export function getSuitePreview(suite: RunSuiteDescription) {
  const preview = snapshot.suites.find((entry) => entry.key === suite.key);
  if (snapshot.version !== "1" || snapshot.profileId !== "one-shot-json-v1" || !preview || preview.suiteId !== suite.suiteId ||
    preview.cases.length !== suite.caseCount ||
    preview.cases.some((entry) => !suite.depths.includes(entry.depth)) ||
    suite.depths.some((depth) => !preview.cases.some((entry) => entry.depth === depth))) return null;
  return preview;
}
export type SuitePreview = NonNullable<ReturnType<typeof getSuitePreview>>;
