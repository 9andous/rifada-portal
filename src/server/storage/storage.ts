import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

// File storage behind one interface (ROADMAP architecture answer: local disk now, replaceable later).
// Keys are opaque: an area and 32 random hex characters, never a user-supplied name, so a stored file
// cannot be guessed or addressed by its original name (D-063). Every path goes through resolveKey().

/** `images`: profile pictures and association logos. */
export type StorageArea = "staging" | "templates" | "attachments" | "images";
const KEY_PATTERN = /^(staging|templates|attachments|images)\/[a-f0-9]{32}$/;

export class StorageError extends Error {
  constructor(
    readonly code: "too_large" | "invalid_key" | "not_found" | "already_consumed",
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export type WrittenFile = { key: string; size: number; sha256: string };

export interface StorageService {
  /** Streams bytes into a new staging file, stopping (and deleting it) past `maxBytes`. */
  writeStaging(body: ReadableStream<Uint8Array> | Readable, maxBytes: number): Promise<WrittenFile>;
  /** Moves a staging file to its permanent area under a new random key. Fails if it was already moved. */
  commit(stagingKey: string, area: Exclude<StorageArea, "staging">): Promise<string>;
  openRead(key: string): Readable;
  size(key: string): Promise<number>;
  /** Absolute path of a key, for content sniffing; never exposed outside the server. */
  localPath(key: string): string;
  remove(key: string): Promise<void>;
  writeSidecar(key: string, data: unknown): Promise<void>;
  readSidecar<T>(key: string): Promise<T | null>;
  /** Removes staging files (and sidecars) older than `maxAgeMs`. */
  cleanupStaging(maxAgeMs: number, now?: number): Promise<number>;
}

export function isStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function newKey(area: StorageArea): string {
  return `${area}/${randomBytes(16).toString("hex")}`;
}

export class LocalDiskStorage implements StorageService {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    const publicDir = path.resolve(process.cwd(), "public");
    if (this.root === publicDir || this.root.startsWith(publicDir + path.sep)) {
      throw new Error("STORAGE_DIR must not be inside the public folder.");
    }
  }

  /** The absolute path of a key, refusing anything that is not a well-formed key inside the root. */
  resolveKey(key: string): string {
    if (!isStorageKey(key)) throw new StorageError("invalid_key", "Invalid storage key");
    const full = path.resolve(this.root, ...key.split("/"));
    if (!full.startsWith(this.root + path.sep)) throw new StorageError("invalid_key", "Invalid storage key");
    return full;
  }

  localPath(key: string): string {
    return this.resolveKey(key);
  }

  async writeStaging(body: ReadableStream<Uint8Array> | Readable, maxBytes: number): Promise<WrittenFile> {
    const key = newKey("staging");
    const target = this.resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    const hash = createHash("sha256");
    let size = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, done) {
        size += chunk.length;
        if (size > maxBytes) return done(new StorageError("too_large", "File too large"));
        hash.update(chunk);
        done(null, chunk);
      },
    });
    const source = body instanceof Readable ? body : Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>);
    try {
      await pipeline(source, counter, createWriteStream(target, { flags: "wx" }));
    } catch (error) {
      await rm(target, { force: true });
      throw error;
    }
    return { key, size, sha256: hash.digest("hex") };
  }

  async commit(stagingKey: string, area: Exclude<StorageArea, "staging">): Promise<string> {
    if (!stagingKey.startsWith("staging/")) throw new StorageError("invalid_key", "Not a staging key");
    const from = this.resolveKey(stagingKey);
    const key = newKey(area);
    const to = this.resolveKey(key);
    await mkdir(path.dirname(to), { recursive: true });
    try {
      // rename is atomic on one volume: a second commit of the same upload finds nothing to move.
      await rename(from, to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError("already_consumed", "Upload already used");
      throw error;
    }
    await rm(`${from}.json`, { force: true });
    return key;
  }

  openRead(key: string): Readable {
    return createReadStream(this.resolveKey(key));
  }

  async size(key: string): Promise<number> {
    try {
      return (await stat(this.resolveKey(key))).size;
    } catch {
      throw new StorageError("not_found", "File not found");
    }
  }

  async remove(key: string): Promise<void> {
    const full = this.resolveKey(key);
    await rm(full, { force: true });
    await rm(`${full}.json`, { force: true });
  }

  async writeSidecar(key: string, data: unknown): Promise<void> {
    await writeFile(`${this.resolveKey(key)}.json`, JSON.stringify(data), { flag: "w" });
  }

  async readSidecar<T>(key: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(`${this.resolveKey(key)}.json`, "utf8")) as T;
    } catch {
      return null;
    }
  }

  async cleanupStaging(maxAgeMs: number, now = Date.now()): Promise<number> {
    const dir = path.join(this.root, "staging");
    let removed = 0;
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return 0;
    }
    for (const name of names) {
      if (!/^[a-f0-9]{32}$/.test(name)) continue;
      const full = path.join(dir, name);
      try {
        if (now - (await stat(full)).mtimeMs > maxAgeMs) {
          await rm(full, { force: true });
          await rm(`${full}.json`, { force: true });
          removed += 1;
        }
      } catch {
        // Already gone (consumed meanwhile).
      }
    }
    return removed;
  }
}

let cached: { root: string; storage: LocalDiskStorage } | null = null;

/** The configured storage (`STORAGE_DIR`, default `./storage`, git-ignored). */
export function getStorage(): StorageService {
  // The storage folder is runtime data, not code: the comment keeps Turbopack's file tracing from
  // pulling the whole project (public/ included) into the server output.
  const root = path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_DIR || "./storage");
  if (!cached || cached.root !== root) cached = { root, storage: new LocalDiskStorage(root) };
  return cached.storage;
}
