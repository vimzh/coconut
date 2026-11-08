// Research operators construct, freeze, execute and audit a separate private one-response study.
import { resolve } from "node:path";
import { releaseDeadStudyLock } from "../randomized/artifacts";
import { preparePopulation, replayPopulation } from "./population";
import { DEEP_ROOT, exportStudy, freezeFinalStudy, reconcileStudy, runControls, runFinalStudy } from "./execution";

export function parseDeepArguments(args: readonly string[]) {
  const command = args[0];
  if (!["prepare", "replay", "controls", "freeze", "run", "report", "export", "unlock"].includes(command)) throw new Error("Use prepare, replay, controls, freeze, run, report, export or unlock.");
  const allowed: Record<string, readonly string[]> = { prepare: ["--source", "--python", "--output", "--deadline"], replay: ["--population"], controls: ["--accept-charges"],
    freeze: ["--population", "--review"], run: ["--accept-charges"], report: [], export: ["--audit", "--output"], unlock: [] };
  const values = new Map<string, string>(); let acceptCharges = false;
  for (let index = 1; index < args.length; index++) {
    const arg = args[index];
    if (!allowed[command].includes(arg) || values.has(arg) || arg === "--accept-charges" && acceptCharges) throw new Error("Unexpected or repeated research argument.");
    if (arg === "--accept-charges") { acceptCharges = true; continue; }
    const value = args[++index]; if (!value || value.startsWith("--")) throw new Error("Research arguments need explicit values.");
    values.set(arg, value);
  }
  if (allowed[command].some(flag => flag === "--accept-charges" ? !acceptCharges : !values.has(flag))) throw new Error("Required research arguments are missing.");
  if (command === "prepare") {
    const output = resolve(values.get("--output")!);
    if (!output.startsWith(resolve(DEEP_ROOT, "..") + "/")) throw new Error("Generated source artifacts must remain inside private research storage.");
    if (!Number.isFinite(Date.parse(values.get("--deadline")!))) throw new Error("An absolute feasibility deadline is required.");
  }
  return { command, values, acceptCharges };
}

if (import.meta.main) {
  try {
    const { command, values } = parseDeepArguments(Bun.argv.slice(2)), privateRoot = resolve(DEEP_ROOT, "..");
    let result: unknown;
    if (command === "prepare") result = await preparePopulation({ checkout: values.get("--source")!, python: values.get("--python")!, output: values.get("--output")!, deadlineAt: values.get("--deadline")!,
      priorExposurePaths: [resolve(privateRoot, "randomized-v1/panel-1/admission/admission.json"), resolve(privateRoot, "known-source-smokes-v1/exposure.json")] });
    else if (command === "replay") result = await replayPopulation(values.get("--population")!);
    else if (command === "controls") result = await runControls(process.env.OPENAI_API_KEY ?? "");
    else if (command === "freeze") result = await freezeFinalStudy(values.get("--population")!, values.get("--review")!);
    else if (command === "run") result = await runFinalStudy(process.env.OPENAI_API_KEY ?? "");
    else if (command === "report") { const evidence = await reconcileStudy(); result = evidence.report; }
    else if (command === "export") result = await exportStudy(values.get("--audit")!, values.get("--output")!);
    else result = await releaseDeadStudyLock(DEEP_ROOT);
    // Output aggregate progress only; generated expressions and provider transcripts stay private.
    const summary = result as { id?: string; state?: string; admitted?: number; received?: number; dispatched?: number; cumulativeSends?: number };
    console.log(JSON.stringify({ command, studyId: summary.id ?? null, state: summary.state ?? "retained", admitted: summary.admitted ?? null, received: summary.received ?? null,
      dispatched: summary.dispatched ?? null, cumulativeSends: summary.cumulativeSends ?? null }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Deep research operation failed; inspect retained private evidence before further paid work."); process.exitCode = 1;
  }
}
