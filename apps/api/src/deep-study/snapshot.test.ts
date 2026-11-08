// Temporary source trees verify exact byte/path binding without generation or provider traffic.
import { expect, it } from "bun:test";
import { mkdir, mkdtemp, open, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 as dataHash } from "../quality/data";
import { IMPORT_LIMITS, sha256 as byteHash } from "../randomized/source";
import { populationSnapshotSha256 } from "./snapshot";

async function fixture(run: (root: string, population: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "population-snapshot-")), population = join(root, "population.json");
  try { await writeFile(population, "{}\n"); await run(root, population); }
  finally { await rm(root, { recursive: true, force: true }); }
}

it("hashes every regular source/reference/diagnostic file using sorted relative paths and exact bytes", async () => {
  await fixture(async (root, population) => {
    await mkdir(join(root, "depth-512")); await mkdir(join(root, "depth-512", "batch-0"));
    const files = [{ path: "population.json", bytes: Buffer.from("{}\n") }, { path: "depth-512/stratum.json", bytes: Buffer.from('{"fixture":true}') },
      { path: "depth-512/batch-0/source.csv", bytes: Buffer.from("a,b\r\n1,2\r\n") }, { path: "depth-512/candidate-0.json", bytes: Buffer.from("candidate") },
      { path: "depth-512/reference-0.json", bytes: Buffer.from("reference") }, { path: "depth-512/diagnostics-0.json", bytes: Buffer.from("diagnostic") },
      { path: ".retained-source", bytes: Buffer.from([0xef, 0xbb, 0xbf, 0, 255]) }];
    for (const file of files.slice(1).reverse()) await writeFile(join(root, file.path), file.bytes);
    const expected = dataHash(files.map(file => ({ path: file.path, sha256: byteHash(file.bytes) })).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
    expect(await populationSnapshotSha256(population)).toBe(expected);
    expect(await populationSnapshotSha256(population)).toBe(expected);
  });
});

it("detects changed bytes, additions, deletions and renamed paths while ignoring external files", async () => {
  await fixture(async (root, population) => {
    const path = join(root, "reference.json"); await writeFile(path, "original");
    const original = await populationSnapshotSha256(population);
    await writeFile(path, "modified"); expect(await populationSnapshotSha256(population)).not.toBe(original);
    await writeFile(path, "original"); expect(await populationSnapshotSha256(population)).toBe(original);
    const external = await mkdtemp(join(tmpdir(), "population-unrelated-"));
    try { await writeFile(join(external, "unrelated.json"), "outside"); expect(await populationSnapshotSha256(population)).toBe(original); }
    finally { await rm(external, { recursive: true, force: true }); }
    const extra = join(root, "unlisted-new-file.json"); await writeFile(extra, "new"); expect(await populationSnapshotSha256(population)).not.toBe(original);
    await rm(extra); expect(await populationSnapshotSha256(population)).toBe(original);
    await rename(path, join(root, "renamed-reference.json")); expect(await populationSnapshotSha256(population)).not.toBe(original);
    await rm(join(root, "renamed-reference.json")); expect(await populationSnapshotSha256(population)).not.toBe(original);
  });
});

it("produces the same content snapshot in a different actual directory and creation order", async () => {
  await fixture(async (root, population) => {
    await mkdir(join(root, "nested")); await writeFile(join(root, "nested", "b.json"), "b"); await writeFile(join(root, "a.json"), "a");
    await fixture(async (other, selected) => {
      await writeFile(join(other, "a.json"), "a"); await mkdir(join(other, "nested")); await writeFile(join(other, "nested", "b.json"), "b");
      expect(await populationSnapshotSha256(population)).toBe(await populationSnapshotSha256(selected));
    });
  });
});

it("rejects file, directory and selected-bundle symlinks instead of silently omitting linked evidence", async () => {
  await fixture(async (root, population) => {
    const fileLink = join(root, "linked.json"); await symlink(population, fileLink);
    await expect(populationSnapshotSha256(population)).rejects.toThrow("symlinks"); await rm(fileLink);
    const outside = await mkdtemp(join(tmpdir(), "population-external-"));
    try {
      await writeFile(join(outside, "private.json"), "outside"); await symlink(outside, join(root, "linked-directory"));
      await expect(populationSnapshotSha256(population)).rejects.toThrow("symlinks"); await rm(join(root, "linked-directory"));
      await symlink(root, join(outside, "root-alias"));
      await expect(populationSnapshotSha256(join(outside, "root-alias", "population.json"))).rejects.toThrow("real directory");
    } finally { await rm(outside, { recursive: true, force: true }); }
    await rename(population, join(root, "original.json")); await symlink(join(root, "original.json"), population);
    await expect(populationSnapshotSha256(population)).rejects.toThrow("regular file");
  });
});

it("rejects nonregular files before opening them and enforces the source file size bound with sparse fixtures", async () => {
  await fixture(async (root, population) => {
    const fifo = join(root, "not-a-regular-file"), child = Bun.spawnSync(["mkfifo", fifo]);
    expect(child.exitCode).toBe(0); await expect(populationSnapshotSha256(population)).rejects.toThrow("nonregular"); await rm(fifo);
    const handle = await open(join(root, "oversized-source.csv"), "wx");
    try { await handle.truncate(IMPORT_LIMITS.fileBytes + 1); } finally { await handle.close(); }
    await expect(populationSnapshotSha256(population)).rejects.toThrow("64 MiB");
  });
});

it("rejects continuously mutable evidence rather than returning a mixed snapshot", async () => {
  await fixture(async (root, population) => {
    for (let index = 0; index < 100; index++) await writeFile(join(root, `source-${String(index).padStart(3, "0")}.csv`), "fixture".repeat(1000));
    const mutable = join(root, "source-000.csv"); let changes = 0, writing = Promise.resolve();
    const timer = setInterval(() => { writing = writing.then(() => writeFile(mutable, `mutation-${++changes}`)); }, 1);
    try { await expect(populationSnapshotSha256(population)).rejects.toThrow("changed"); }
    finally { clearInterval(timer); await writing; }
    expect(changes).toBeGreaterThan(0);
  });
});
