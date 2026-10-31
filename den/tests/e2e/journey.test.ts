import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";

const denRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 4181;
const BASE = `http://127.0.0.1:${PORT}`;
const DB = join(denRoot, "var", "e2e.sqlite");
const CHROME = process.env.PW_CHROME || "/usr/bin/google-chrome";

let server: ChildProcess | null = null;
let browser: Browser | null = null;
const consoleErrors: string[] = [];
const serverLog: string[] = [];

async function startServer() {
  server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: denRoot,
    env: { ...process.env, PORT: String(PORT), DEN_DB: DB, HOST: "127.0.0.1", DEN_DEBUG: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => serverLog.push(String(chunk)));
  server.stderr?.on("data", (chunk) => serverLog.push(String(chunk)));
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {
      /* wait */
    }
    await new Promise((done) => setTimeout(done, 150));
  }
  throw new Error("server did not start");
}

async function stopServer() {
  if (!server) return;
  const current = server;
  server = null;
  await new Promise<void>((done) => {
    const timer = setTimeout(() => {
      current.kill("SIGKILL");
      done();
    }, 4000);
    current.once("exit", () => {
      clearTimeout(timer);
      done();
    });
    current.kill("SIGTERM");
  });
}

function watch(page: Page, label: string) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${label}: ${String(error)}`));
}

async function noOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert.equal(metrics.overflow, 0, `${label} has ${metrics.overflow}px horizontal overflow`);
}

test("complete desktop + phone journey, durable across a server restart", { timeout: 240_000 }, async (t) => {
  await rm(`${DB}`, { force: true });
  await rm(`${DB}-wal`, { force: true });
  await rm(`${DB}-shm`, { force: true });
  await startServer();
  browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  t.after(async () => {
    await browser?.close();
    await stopServer();
  });

  const den = await (await fetch(`${BASE}/api/den`)).json();
  const leadId = den.lead.caseId as string;

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  watch(page, "desktop");

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  assert.match(await page.locator("h1").first().innerText(), /THE RAT/);
  assert.match(await page.getByText("91 scraps").first().innerText(), /91 scraps/);
  await noOverflow(page, "desktop home");
  await page.screenshot({ path: join(denRoot, "docs", "receipts", "den-01", "e2e-home-1440x900.png") });

  await page.getByRole("link", { name: /OPEN THE FILE/i }).first().click();
  await page.waitForURL(`**/case/${leadId}`);
  assert.match(await page.locator("h1").first().innerText(), /THE SAME ADDRESS CAME BACK/i);
  const movement = await page.locator(".dossier-movement").innerText();
  assert.match(movement, /565/);
  assert.match(movement, /1,607/);
  assert.match(movement, /1,042/);
  await noOverflow(page, "desktop case");

  // The canonical proof is source-backed, separate from replay, and accessible on desktop.
  await page.goto(BASE + "/canonical-case", { waitUntil: "networkidle" });
  await page.getByText("THE INDEX REMEMBERS AN OLDER LAUNCH.").waitFor();
  assert.match(await page.locator("main").innerText(), /19 earlier launches/i);
  await noOverflow(page, "desktop canonical case");
  await page.goto(BASE + `/case/${leadId}`, { waitUntil: "networkidle" });

  // EMPLOY → wait for the run, verify the receipt locally
  await page.getByRole("button", { name: /EMPLOY THE RAT/i }).first().click();
  await page.waitForSelector("text=FILE WRITTEN", { timeout: 20_000 });
  await page.getByRole("button", { name: /VERIFY IN THIS BROWSER/i }).first().click();
  await page.waitForSelector("text=DIGEST MATCH · RECOMPUTED HERE", { timeout: 10_000 });
  await page.screenshot({ path: join(denRoot, "docs", "receipts", "den-01", "e2e-employ-verified-1440x900.png") });
  await page.getByRole("button", { name: /CLOSE/i }).first().click();

  // LEAVE → pin
  await page.getByRole("button", { name: /LEAVE A TRIPWIRE/i }).first().click();
  await page.fill('input[placeholder*="565 prior"]', "the one that came back");
  await page.getByRole("button", { name: /PIN THE FILE/i }).click();
  await page.waitForTimeout(500);

  await page.goto(`${BASE}/tripwire`, { waitUntil: "networkidle" });
  await page.waitForSelector(".pin");
  assert.match(await page.locator(".pin-title").first().innerText(), /THE RETURNER/);
  await noOverflow(page, "desktop tripwire");

  // ---- restart the server: the pin must survive ----
  await stopServer();
  await startServer();
  await page.goto(`${BASE}/tripwire`, { waitUntil: "networkidle" });
  await page.waitForSelector(".pin");
  assert.match(await page.locator(".pin-title").first().innerText(), /THE RETURNER/);

  // RETURN → replay recorded windows + verify receipt
  await page.getByRole("button", { name: /REPLAY RECORDED WINDOWS/i }).click();
  await page.waitForSelector(".replay-axis", { timeout: 10_000 });
  await page.waitForSelector("text=REPLAY RECEIPT", { timeout: 10_000 });
  assert.match(await page.locator(".modal").innerText(), /Recorded prior-launch count/i);
  assert.match(await page.locator(".modal").innerText(), /1,607/);
  await page.getByRole("button", { name: /VERIFY IN THIS BROWSER/i }).first().click();
  await page.waitForSelector("text=DIGEST MATCH · RECOMPUTED HERE", { timeout: 10_000 });
  await page.screenshot({ path: join(denRoot, "docs", "receipts", "den-01", "e2e-replay-1440x900.png") });
  await page.getByRole("button", { name: /CLOSE/i }).first().click();

  // drop, then confirm the vacuum is honest
  await page.getByRole("button", { name: /^DROP$/ }).click();
  await page.waitForSelector("text=DROPPED PINS", { timeout: 8000 });
  assert.match(await page.locator("text=NOTHING IS PINNED.").first().innerText(), /NOTHING IS PINNED/);

  // FRONT DESK → interest only
  await page.goto(`${BASE}/front-desk`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /ADDRESS TRAIL/i }).check();
  await page.fill("#order-note", "does the count keep moving");
  await page.getByRole("button", { name: /RECORD INTEREST/i }).click();
  await page.waitForSelector("text=DEN-WO-0001", { timeout: 8000 });
  assert.match(await page.locator(".ticket").innerText(), /NO PAYMENT TAKEN/);
  await page.getByRole("button", { name: /VERIFY IN THIS BROWSER/i }).first().click();
  await page.waitForSelector("text=DIGEST MATCH · RECOMPUTED HERE", { timeout: 10_000 });
  await page.screenshot({ path: join(denRoot, "docs", "receipts", "den-01", "e2e-work-order-1440x900.png") });

  // ---- phone ----
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const phonePage = await phone.newPage();
  watch(phonePage, "phone");

  for (const [label, path] of [
    ["home", "/"],
    ["pile", "/pile"],
    ["canonical-case", "/canonical-case"],
    ["case", `/case/${leadId}`],
    ["tripwire", "/tripwire"],
    ["front-desk", "/front-desk"],
    ["manual", "/manual"],
  ] as const) {
    await phonePage.goto(BASE + path, { waitUntil: "networkidle" });
    await noOverflow(phonePage, `phone ${label}`);
  }

  // Front Desk's dark notice must use readable text, not paper-dark ink.
  await phonePage.goto(BASE + "/front-desk", { waitUntil: "networkidle" });
  const noticeColor = await phonePage.locator(".stamp-banner").evaluate((el) => getComputedStyle(el).color);
  assert.equal(noticeColor, "rgb(226, 207, 171)", "Front Desk notice lost its high-contrast bone text");

  await phonePage.goto(BASE + "/", { waitUntil: "networkidle" });
  await phonePage.screenshot({ path: join(denRoot, "docs", "receipts", "den-01", "e2e-home-390x844.png") });
  await phonePage.getByRole("link", { name: /PILE/i }).last().click();
  await phonePage.waitForURL("**/pile");
  await phonePage.waitForSelector(".scrap", { timeout: 10_000 });
  assert.equal(await phonePage.locator(".scrap").count(), 12);
  await phonePage.getByRole("button", { name: /SHOW 12 MORE/i }).click();
  assert.equal(await phonePage.locator(".scrap").count(), 24);
  await phonePage.screenshot({ path: join(denRoot, "docs", "receipts", "den-01", "e2e-pile-390x844.png") });

  // phone employ
  await phonePage.goto(`${BASE}/case/${leadId}`, { waitUntil: "networkidle" });
  await phonePage.getByRole("button", { name: /EMPLOY THE RAT/i }).first().click();
  await phonePage.waitForSelector("text=FILE WRITTEN", { timeout: 20_000 });
  await noOverflow(phonePage, "phone employ modal");
  await phonePage.screenshot({ path: join(denRoot, "docs", "receipts", "den-01", "e2e-employ-390x844.png") });

  // accessible structure
  const structure = await phonePage.evaluate(() => {
    const unlabelled = [...document.querySelectorAll("button")].filter(
      (button) => !button.textContent?.trim() && !button.getAttribute("aria-label"),
    ).length;
    const imagesWithoutAlt = [...document.querySelectorAll("img")].filter(
      (image) => image.getAttribute("alt") === null,
    ).length;
    return {
      h1: document.querySelectorAll("h1").length,
      main: document.querySelectorAll("main#main").length,
      unlabelled,
      imagesWithoutAlt,
    };
  });
  assert.equal(structure.main, 1);
  assert.equal(structure.unlabelled, 0);
  assert.equal(structure.imagesWithoutAlt, 0);

  assert.deepEqual(consoleErrors, []);
  assert.ok(serverLog.some((line) => line.includes("BINRAT: THE DEN")), "server banner missing");
});
