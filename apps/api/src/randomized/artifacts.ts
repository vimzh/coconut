// Private research artifacts use exclusive writes, retained source copies and owner-bound locks.
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ImportBundle } from "./admission";
import { readBoundedFile } from "./source";

export async function writeArtifact(path: string, value: unknown) {
  const file = await open(path, "wx", 0o600);
  try { await file.writeFile(JSON.stringify(value, null, 2) + "\n"); await file.sync(); }
  finally { await file.close(); }
}

export async function acquireStudyLock(root: string): Promise<() => Promise<void>> {
  const path = join(root, "active.lock"), owner = { version: "1", pid: process.pid, host: hostname(), nonce: randomUUID(), startedAt: new Date().toISOString() };
  const temporary = join(root, `.lock-owner-${owner.nonce}`);
  await writeArtifact(temporary, owner);
  try { await link(temporary, path); } finally { await unlink(temporary); }
  return async () => {
    const retained = JSON.parse(await readFile(path, "utf8"));
    if (retained.nonce !== owner.nonce) throw new Error("Research lock ownership changed; inspect before further paid work.");
    await unlink(path);
  };
}

export async function releaseDeadStudyLock(root: string) {
  const path = join(root, "active.lock"), text = await readFile(path, "utf8"), owner = JSON.parse(text);
  if (owner.version !== "1" || owner.host !== hostname() || !Number.isSafeInteger(owner.pid) || owner.pid < 1 || typeof owner.nonce !== "string")
    throw new Error("Lock ownership cannot be established safely; inspect the private evidence manually.");
  try { process.kill(owner.pid, 0); throw new Error("The recorded research process is still alive; its lock cannot be removed."); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error; }
  if (await readFile(path, "utf8") !== text) throw new Error("Research lock changed during recovery.");
  await unlink(path);
  return { state: "stale-lock-removed", priorPid: owner.pid, resumption: "unsupported-inspect-pending-receipts" };
}

export async function retainImportBundle(path: string, target: string, bundle: ImportBundle) {
  await mkdir(target, { mode: 0o700 });
  const files = ["schedule.json", "admission.json"];
  for (let batch = 0; batch < bundle.sourceBindings.length; batch++) {
    files.push(`batch-${batch}/receipt.json`, `batch-${batch}/batch.json`, `batch-${batch}/synthesized_depth${bundle.requestedDepth}_n1.csv`);
    for (let ordinal = 0; ordinal < 6; ordinal++) files.push(`candidate-${batch}-${ordinal}.json`);
  }
  for (const name of files) {
    const text = await readBoundedFile(join(dirname(resolve(path)), name)), destination = join(target, name);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    const file = await open(destination, "wx", 0o600);
    try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
  }
}
