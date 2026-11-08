// Bind every retained population byte without loading the source corpus into memory.
import { createHash } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { sha256 } from "../quality/data";
import { IMPORT_LIMITS } from "../randomized/source";

const MAX_FILES = 100000;
interface Entry { readonly path: string; readonly kind: "file" | "directory"; readonly identity: string }
const identity = (info: BigIntStats) => [info.dev, info.ino, info.mode, info.nlink, info.size, info.mtimeNs, info.ctimeNs].join(":");
function changed(): never { throw new Error("The population directory changed while its snapshot was being retained."); }

async function inventory(root: string): Promise<Entry[]> {
  const pending = [root], entries: Entry[] = []; let files = 0;
  while (pending.length) {
    const directory = pending.pop()!, info = await lstat(directory, { bigint: true });
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Population snapshots require real directories without symlinks.");
    entries.push({ path: relative(root, directory).split(sep).join("/"), kind: "directory", identity: identity(info) });
    for (const name of await readdir(directory)) {
      const path = join(directory, name), child = await lstat(path, { bigint: true });
      if (child.isSymbolicLink() || !child.isFile() && !child.isDirectory()) throw new Error("Population snapshots reject symlinks and nonregular entries.");
      if (child.isDirectory()) { pending.push(path); continue; }
      if (++files > MAX_FILES) throw new Error("The population snapshot exceeds its 100000-file bound.");
      if (child.size > BigInt(IMPORT_LIMITS.fileBytes)) throw new Error("A population snapshot file exceeds the 64 MiB source bound.");
      entries.push({ path: relative(root, path).split(sep).join("/"), kind: "file", identity: identity(child) });
    }
  }
  return entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

async function fileHash(root: string, entry: Entry, buffer: Buffer): Promise<string> {
  const path = join(root, entry.path), handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || identity(before) !== entry.identity) changed();
    const hash = createHash("sha256"); let bytes = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      bytes += bytesRead;
      if (bytes > IMPORT_LIMITS.fileBytes) throw new Error("A population snapshot file exceeded 64 MiB while reading.");
      hash.update(buffer.subarray(0, bytesRead));
    }
    if (identity(await handle.stat({ bigint: true })) !== entry.identity || identity(await lstat(path, { bigint: true })) !== entry.identity) changed();
    return hash.digest("hex");
  } finally { await handle.close(); }
}

export async function populationSnapshotSha256(populationPath: string): Promise<string> {
  const selected = resolve(populationPath), directory = dirname(selected), info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("The population root must be a real directory without a symlink.");
  const root = await realpath(directory), bundle = await lstat(join(root, basename(selected)));
  if (!bundle.isFile() || bundle.isSymbolicLink()) throw new Error("The selected population bundle must be a regular file.");
  const before = await inventory(root), bindings: { path: string; sha256: string }[] = [], buffer = Buffer.allocUnsafe(1024 * 1024);
  for (const entry of before) if (entry.kind === "file") bindings.push({ path: entry.path, sha256: await fileHash(root, entry, buffer) });
  const after = await inventory(root);
  if (JSON.stringify(before) !== JSON.stringify(after)) changed();
  return sha256(bindings);
}
