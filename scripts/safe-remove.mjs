#!/usr/bin/env node
// Safe recursive delete for scratch copies of the project (D-091).
//
//   node scripts/safe-remove.mjs --root <scratch folder> <path> [<path> ...]
//
// Every target must lie inside --root, must not be the root itself, and must not be or contain
// this project's own folder. Before anything is deleted, every link inside the target (symbolic
// links and Windows junctions, which Node reports as symbolic links) is unlinked without following
// it, so the delete can never reach what a link points to (for example the real node_modules
// behind `.next/node_modules/*` or a junctioned node_modules in a worktree). Only then is the
// target removed. A folder named node_modules that is not a link is refused.

import { lstatSync, readdirSync, realpathSync, rmSync, unlinkSync, rmdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function unlinkLink(p) {
  // A junction is a directory reparse point: rmdir removes the link itself, not its target.
  try {
    unlinkSync(p);
  } catch {
    rmdirSync(p);
  }
}

/** Unlinks every link under `dir` (depth first) without following any of them; returns their paths. */
export function unlinkLinks(dir, removed = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) {
      unlinkLink(p);
      removed.push(p);
    } else if (st.isDirectory()) {
      unlinkLinks(p, removed);
      // `.next/node_modules` holds only links; an installed node_modules still has files after them.
      if (name === "node_modules" && hasFiles(p)) throw new Error(`Refusing: a real node_modules folder inside the target: ${p}`);
    }
  }
  return removed;
}

function hasFiles(dir) {
  return readdirSync(dir).some((name) => {
    const st = lstatSync(path.join(dir, name));
    return st.isDirectory() ? hasFiles(path.join(dir, name)) : true;
  });
}

export function safeRemove(root, target) {
  const rootAbs = realpathSync(path.resolve(root));
  const abs = path.resolve(target);
  if (!isInside(abs, rootAbs)) throw new Error(`Refusing: ${abs} is not inside ${rootAbs}`);
  if (abs === PROJECT || isInside(PROJECT, abs) || isInside(abs, PROJECT)) throw new Error(`Refusing: ${abs} overlaps the project folder`);
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    return { removedLinks: [], removed: false };
  }
  if (st.isSymbolicLink()) {
    unlinkLink(abs);
    return { removedLinks: [abs], removed: true };
  }
  const removedLinks = st.isDirectory() ? unlinkLinks(abs) : [];
  rmSync(abs, { recursive: true, force: false });
  return { removedLinks, removed: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--root");
  if (i === -1 || !args[i + 1]) {
    console.error("Usage: node scripts/safe-remove.mjs --root <scratch folder> <path> [<path> ...]");
    process.exit(2);
  }
  const root = args[i + 1];
  const targets = args.filter((_, j) => j !== i && j !== i + 1);
  for (const t of targets) {
    const { removedLinks, removed } = safeRemove(root, t);
    for (const l of removedLinks) console.log(`unlinked ${l}`);
    console.log(removed ? `removed ${path.resolve(t)}` : `not found ${path.resolve(t)}`);
  }
}
