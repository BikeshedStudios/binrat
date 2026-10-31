#!/usr/bin/env node
/**
 * Reproducible screenshot + journey receipt for BINRAT: THE DEN.
 *
 * Spawns its own local server on :4179 with a throwaway SQLite file, drives the real UI with
 * Playwright (system Chrome), captures desktop 1440x900 and phone 390x844, then writes
 * docs/receipts/den-01/summary.json with console errors, overflow and journey outcomes.
 *
 * Nothing here touches the network: the server only serves local files and the packaged evidence.
 */
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const denRoot = resolve(here, "..");
const outDir = join(denRoot, "docs", "receipts", "den-01");
const dbPath = join(denRoot, "var", "shots.sqlite");
const PORT = 4179;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.PW_CHROME || "/usr/bin/google-chrome";

await mkdir(outDir, { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) await rm(`${dbPath}${suffix}`, { force: true });

const server = spawn("npx", ["tsx", "server/index.ts"], {
  cwd: denRoot,
  env: { ...process.env, PORT: String(PORT), DEN_DB: dbPath, HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`SERVER_NOT_READY\n${serverLog}`);
}

const results = { startedAt: new Date().toISOString(), base: BASE, routes: [], flows: [], consoleErrors: [] };

try {
  await waitForServer();
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await desktop.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") results.consoleErrors.push(`desktop: ${message.text()}`);
  });
  page.on("pageerror", (error) => results.consoleErrors.push(`desktop: ${String(error)}`));

  const lead = await (await fetch(`${BASE}/api/den`)).json();
  const leadId = lead.lead.caseId;

  async function shoot(target, name, options = {}) {
    await target.waitForTimeout(options.settle ?? 260);
    const jpeg = options.jpeg ?? false;
    await target.screenshot({
      path: join(outDir, `${name}.${jpeg ? "jpg" : "png"}`),
      fullPage: options.fullPage ?? false,
      ...(jpeg ? { type: "jpeg", quality: 78 } : {}),
    });
    const metrics = await target.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
      horizontalScrollbar: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    results.routes.push({ name, ...metrics });
    return metrics;
  }

  const ROUTES = [
    ["home", "/"],
    ["pile", "/pile"],
    ["canonical-case", "/canonical-case"],
    ["case", `/case/${leadId}`],
    ["tripwire-empty", "/tripwire"],
    ["front-desk", "/front-desk"],
    ["manual", "/manual"],
  ];

  for (const [name, path] of ROUTES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await shoot(page, `${name}-1440x900`);
  }
  // Long-page receipts are JPEG on purpose: five 1440px full pages as PNG cost ~40 MB.
  for (const [name, path] of [["home", "/"], ["case", `/case/${leadId}`], ["pile", "/pile"]]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await shoot(page, `${name}-1440x900-full`, { fullPage: true, settle: 140, jpeg: true });
  }

  // ---- journey: employ the rat -------------------------------------------------
  await page.goto(`${BASE}/case/${leadId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /EMPLOY THE RAT/i }).click();
  await page.waitForSelector(".terminal-line", { timeout: 10_000 });
  await page.waitForFunction(
    () => {
      const progress = document.querySelector('[role="progressbar"]');
      if (!progress) return false;
      return Number(progress.getAttribute("aria-valuenow")) >= Number(progress.getAttribute("aria-valuemax"));
    },
    { timeout: 15_000 },
  );
  await page.waitForSelector("text=FILE WRITTEN", { timeout: 10_000 });
  await shoot(page, "flow-employ-complete-1440x900", { settle: 200 });
  // verify the receipt inside the browser
  const verifyButtons = page.getByRole("button", { name: /VERIFY IN THIS BROWSER/i });
  await verifyButtons.first().click();
  await page.waitForSelector("text=DIGEST MATCH · RECOMPUTED HERE", { timeout: 10_000 });
  results.flows.push({ id: "employ", status: "PASS", receiptVerifiedInBrowser: true });
  await shoot(page, "flow-employ-verified-1440x900", { settle: 150 });
  await page.getByRole("button", { name: /CLOSE/i }).first().click();

  // ---- journey: leave a tripwire ----------------------------------------------
  await page.getByRole("button", { name: /LEAVE A TRIPWIRE/i }).first().click();
  await page.waitForSelector('input[placeholder*="565 prior"]', { timeout: 5000 });
  await page.fill('input[placeholder*="565 prior"]', "the reported prior-launch count changed by 1,042");
  await page.getByRole("button", { name: /PIN THE FILE/i }).click();
  await page.waitForSelector("text=PINNED", { timeout: 8000 }).catch(() => {});
  await page.goto(`${BASE}/tripwire`, { waitUntil: "networkidle" });
  await shoot(page, "flow-tripwire-pinned-1440x900");
  await shoot(page, "flow-tripwire-pinned-1440x900-full", { fullPage: true, settle: 120, jpeg: true });

  // ---- journey: replay recorded windows ---------------------------------------
  await page.getByRole("button", { name: /REPLAY RECORDED WINDOWS/i }).click();
  await page.waitForSelector(".replay-axis", { timeout: 8000 });
  await page.waitForSelector("text=REPLAY RECEIPT", { timeout: 8000 });
  const replayVerdict = await page.locator(".chip").first().innerText();
  results.flows.push({ id: "replay", status: "PASS", verdict: replayVerdict });
  await shoot(page, "flow-replay-1440x900", { settle: 180 });
  await page.getByRole("button", { name: /CLOSE/i }).first().click();

  // ---- journey: front desk ticket ---------------------------------------------
  await page.goto(`${BASE}/front-desk`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /FILE DEEP DIVE/i }).check();
  await page.fill("#order-note", "Is the count still moving in the capture I pinned?");
  await page.getByRole("button", { name: /RECORD INTEREST/i }).click();
  await page.waitForSelector("text=WORK ORDER", { timeout: 8000 });
  results.flows.push({ id: "work-order", status: "PASS" });
  await shoot(page, "flow-work-order-1440x900", { settle: 180 });

  // ---- return state on the den -------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shoot(page, "flow-den-return-1440x900", { settle: 300 });
  await shoot(page, "flow-den-return-1440x900-full", { fullPage: true, settle: 120, jpeg: true });

  // ---- phone ---------------------------------------------------------------
  const phonePage = await phone.newPage();
  phonePage.on("console", (message) => {
    if (message.type() === "error") results.consoleErrors.push(`phone: ${message.text()}`);
  });
  phonePage.on("pageerror", (error) => results.consoleErrors.push(`phone: ${String(error)}`));

  for (const [name, path] of [
    ["home", "/"],
    ["pile", "/pile"],
    ["canonical-case", "/canonical-case"],
    ["case", `/case/${leadId}`],
    ["tripwire", "/tripwire"],
    ["front-desk", "/front-desk"],
    ["manual", "/manual"],
  ]) {
    await phonePage.goto(BASE + path, { waitUntil: "networkidle" });
    await shoot(phonePage, `${name}-390x844`);
  }
  for (const [name, path] of [["home", "/"], ["case", `/case/${leadId}`]]) {
    await phonePage.goto(BASE + path, { waitUntil: "networkidle" });
    await shoot(phonePage, `${name}-390x844-full`, { fullPage: true, settle: 140, jpeg: true });
  }

  // phone employ journey
  await phonePage.goto(`${BASE}/case/${leadId}`, { waitUntil: "networkidle" });
  await phonePage.getByRole("button", { name: /EMPLOY THE RAT/i }).first().click();
  await phonePage.waitForSelector("text=FILE WRITTEN", { timeout: 15000 });
  await shoot(phonePage, "flow-employ-complete-390x844", { settle: 200 });

  // gate widths
  for (const [width, height] of [
    [1024, 768],
    [430, 932],
    [320, 800],
    [768, 1024],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const gate = await context.newPage();
    await gate.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await shoot(gate, `home-${width}x${height}`, { settle: 200 });
    await context.close();
  }

  // axe-free accessibility smoke: focus order + labels
  const a11y = await page.evaluate(() => {
    const issues = [];
    if (!document.querySelector("main#main")) issues.push("no main landmark");
    if (!document.querySelector("h1")) issues.push("no h1");
    const buttons = [...document.querySelectorAll("button")];
    const unlabelled = buttons.filter((button) => !button.textContent?.trim() && !button.getAttribute("aria-label"));
    if (unlabelled.length) issues.push(`${unlabelled.length} unlabelled buttons`);
    const images = [...document.querySelectorAll("img")];
    const noAlt = images.filter((image) => image.getAttribute("alt") === null);
    if (noAlt.length) issues.push(`${noAlt.length} images without alt`);
    const tapTargets = [...document.querySelectorAll("a, button")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.height < 24;
    });
    if (tapTargets.length) issues.push(`${tapTargets.length} targets under 24px high`);
    return issues;
  });
  results.a11y = { issues: a11y, pass: a11y.length === 0 };

  results.finishedAt = new Date().toISOString();
  results.server = serverLog.trim().split("\n").slice(0, 6);
  await writeFile(join(outDir, "summary.json"), `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();

  console.log(`captured ${results.routes.length} screenshots into docs/receipts/den-01`);
  console.log(`flows: ${results.flows.map((flow) => `${flow.id}:${flow.status}`).join(", ")}`);
  console.log(`console errors: ${results.consoleErrors.length}`);
  console.log(`a11y issues: ${results.a11y.issues.length}`);
  const overflow = results.routes.filter((route) => route.overflow > 0);
  if (overflow.length) {
    console.log(`OVERFLOW: ${overflow.map((route) => `${route.name}+${route.overflow}`).join(", ")}`);
    process.exitCode = 1;
  }
  if (results.consoleErrors.length) process.exitCode = 1;
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  // The spawned npx wrapper can keep pipes open; do not let the receipt run hang.
  setTimeout(() => process.exit(process.exitCode ?? 0), 400).unref();
}
