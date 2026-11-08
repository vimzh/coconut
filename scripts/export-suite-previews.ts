// Export only task descriptions for the suite browser; certification stays in the evaluation service.
import { writeFile } from "node:fs/promises";
import { loadRunSuite } from "../apps/api/src/runs/registry";

const keys = ["challenge-v1", "screening-v1", "smooth-v2", "reference-v1", "interior-v1", "reserve-v1"] as const;
const suites = [];
for (const key of keys) {
  const suite = await loadRunSuite(key, "one-shot-json-v1");
  suites.push({
    key,
    suiteId: suite.id,
    labelCounts: Object.fromEntries(["convex", "concave", "neither"].map((label) => [label, suite.cases.filter((entry) => entry.label === label).length])),
    cases: suite.cases.map((entry) => ({
      id: entry.id,
      expression: entry.certificate.renderedExpression,
      domain: entry.reference.domain,
      depth: entry.depth,
      family: entry.family,
    })),
  });
}
const output = new URL("../apps/web/public/suite-previews.json", import.meta.url);
await writeFile(output, `${JSON.stringify({ version: "1", profileId: "one-shot-json-v1", suites })}\n`);
console.log(`Exported task previews for ${suites.length} verified suites.`);
