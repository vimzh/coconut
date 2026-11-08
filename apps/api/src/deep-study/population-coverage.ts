// Summarize effective structure and rigorous pointwise distinctions without independence claims.
import type { PopulationCase } from "./population";

function fraction(text: string) {
  const parts = text.split("/");
  if (parts.length > 2 || !/^-?\d+$/.test(parts[0]) || parts[1] !== undefined && !/^\d+$/.test(parts[1]))
    throw new Error("Diagnostic point enclosure is not an exact rational.");
  const numerator = BigInt(parts[0]), denominator = BigInt(parts[1] ?? "1");
  if (denominator <= 0n) throw new Error("Diagnostic point enclosure has an invalid denominator.");
  return { numerator, denominator };
}
function below(a: string, b: string) {
  const left = fraction(a), right = fraction(b);
  return left.numerator * right.denominator < right.numerator * left.denominator;
}

export function populationCoverage(cases: readonly PopulationCase[]) {
  const parents = cases.map((_, index) => index), signatureOwner = new Map<string, number>();
  function group(index: number): number {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; }
    return index;
  }
  for (const [index, task] of cases.entries()) {
    for (const signature of [...task.coreHashes, task.diagnostics.relatedShapeHash]) {
      const prior = signatureOwner.get(signature);
      if (prior === undefined) signatureOwner.set(signature, index);
      else parents[group(index)] = group(prior);
    }
  }
  const groups = new Map<number, string[]>();
  for (const [index, task] of cases.entries()) { const root = group(index); groups.set(root, [...(groups.get(root) ?? []), task.id]); }
  const groupSizes = [...groups.values()].map(rows => rows.length).sort((a, b) => b - a);
  const range = (values: number[]) => values.length ? { min: Math.min(...values), max: Math.max(...values), mean: values.reduce((sum, n) => sum + n, 0) / values.length } : null;
  const structures = Object.fromEntries((["raw", "simplified"] as const).map(kind => [kind, Object.fromEntries(
    (["astDepth", "nonlinearPath", "nodeCount", "uniqueSubtrees", "branchNodes"] as const).map(metric =>
      [metric, range(cases.map(row => row.diagnostics[kind][metric]))]))]));
  const atomCaseCounts: Record<string, number> = {};
  for (const task of cases) for (const [op, count] of Object.entries(task.diagnostics.simplified.operations))
    if (count > 0) atomCaseCounts[op] = (atomCaseCounts[op] ?? 0) + 1;
  let rigorouslySeparatedPairs = 0;
  for (let i = 0; i < cases.length; i++) for (let j = 0; j < i; j++) {
    const left = cases[i].diagnostics.pointValues, right = cases[j].diagnostics.pointValues;
    if (left.some(a => a.status === "enclosed" && a.value && right.some(b => b.x === a.x && b.status === "enclosed" && b.value &&
      (below(a.value!.max, b.value.min) || below(b.value.max, a.value!.min))))) rigorouslySeparatedPairs++;
  }
  const totalPairs = cases.length * (cases.length - 1) / 2;
  return { caseCount: cases.length, expressionCharacters: range(cases.map(task => task.expression.length)), structures, atomCaseCounts,
    mechanismClassification: "not-individually-established" as const, derivativeScales: "not-assessed" as const, rangeScales: "not-assessed" as const,
    relatedGroupCount: groups.size, relatedGroupSizes: groupSizes,
    groups: [...groups.values()], rigorousPointwiseInequivalence: { totalPairs, rigorouslySeparatedPairs, unknownPairs: totalPairs - rigorouslySeparatedPairs },
    limitation: "Shared significant cores and coefficient-blind simplified shapes define related groups; bounded simplification and point enclosures do not prove all pairwise semantic inequivalence or absence of public exposure." };
}
