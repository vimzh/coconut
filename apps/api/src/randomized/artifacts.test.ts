// Filesystem regressions guard against duplicate writes and deleting a live research lock.
import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import { acquireStudyLock, releaseDeadStudyLock, writeArtifact } from "./artifacts";

test("exclusive durable artifacts and lock ownership prevent duplicate concurrent work", async () => {
  const directory = await mkdtemp(join(tmpdir(), "coconut-import-lock-"));
  try {
    await writeArtifact(join(directory, "receipt.json"), { ordinal: 1 });
    await expect(writeArtifact(join(directory, "receipt.json"), { ordinal: 2 })).rejects.toThrow();
    expect(JSON.parse(await readFile(join(directory, "receipt.json"), "utf8"))).toEqual({ ordinal: 1 });
    const release = await acquireStudyLock(directory);
    await expect(acquireStudyLock(directory)).rejects.toThrow();
    await expect(releaseDeadStudyLock(directory)).rejects.toThrow("still alive");
    await release();
    const releaseAgain = await acquireStudyLock(directory); await releaseAgain();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("stale lock recovery verifies a dead local owner and never resumes a paid request", async () => {
  const directory = await mkdtemp(join(tmpdir(), "coconut-import-recover-"));
  try {
    const child = Bun.spawn(["true"]); await child.exited;
    await writeArtifact(join(directory, "active.lock"), { version: "1", pid: child.pid, host: hostname(), nonce: "dead-owner" });
    expect((await releaseDeadStudyLock(directory)).resumption).toContain("unsupported");
    await writeFile(join(directory, "active.lock"), "{}");
    await expect(releaseDeadStudyLock(directory)).rejects.toThrow("cannot be established");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
