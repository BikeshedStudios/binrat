#!/usr/bin/env node
/**
 * Development runner: API on :4178 (auto-restart) and Vite on :5178 with /api proxied.
 * The production-style single-port preview is `pnpm build && pnpm start`.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const denRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [];

function run(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: denRoot,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  children.push(child);
  return child;
}

console.log("BINRAT: THE DEN — dev mode");
console.log("  api   http://127.0.0.1:4178");
console.log("  web   http://127.0.0.1:5178");
console.log("  mode  RECORDED REPLAY · no collector · 0 network calls");

run("npx", ["tsx", "watch", "server/index.ts"], { PORT: process.env.PORT ?? "4178" });
run("npx", ["vite"]);

const stop = (code = 0) => {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
};
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
