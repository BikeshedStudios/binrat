#!/usr/bin/env node
/**
 * Deletes the local SQLite state for this experiment only (pins, runs, receipts, work orders,
 * visit history). Evidence snapshots are never touched.
 */
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const denRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const varDir = resolve(denRoot, "var");
if (!varDir.startsWith(denRoot)) throw new Error("refusing to clean outside den/");

for (const name of [
  "den.sqlite",
  "den.sqlite-wal",
  "den.sqlite-shm",
  "shots.sqlite",
  "shots.sqlite-wal",
  "shots.sqlite-shm",
  "e2e.sqlite",
  "e2e.sqlite-wal",
  "e2e.sqlite-shm",
]) {
  await rm(resolve(varDir, name), { force: true });
}
console.log("Local den state cleared. Evidence in den/evidence/ is untouched.");
console.log("Stop the preview server before resetting, then start it again.");
