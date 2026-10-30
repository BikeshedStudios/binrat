// One bounded adversarial product review; no production or provider requests.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../..");
const runner =
  process.env.PLAYWRIGHT_PATH ||
  path.resolve(__dirname, "../.local/browser-tools/node_modules/playwright");
const { chromium } = require(runner);
const out =
  process.env.BINRAT_SCREENSHOTS ||
  path.join(root, "docs/receipts/unleashed-01");
const report = {
  schema: "binrat.unleashed.hostile/1",
  at: new Date().toISOString(),
  attacks: [],
  errors: [],
};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "binrat-hostile-"));
let app, browser;
(async () => {
  const { startServer } = await import(
    pathToFileURL(path.join(root, "unleashed/server.mjs"))
  );
  const { sha256 } = await import(
    pathToFileURL(path.join(root, "unleashed/evidence.mjs"))
  );
  app = await startServer({
    port: 0,
    dbPath: path.join(dir, "hostile.sqlite"),
  });
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      (fs.existsSync("/usr/bin/google-chrome")
        ? "/usr/bin/google-chrome"
        : chromium.executablePath()),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== app.url)
      report.errors.push("EXTERNAL_REQUEST " + request.url());
  });
  await page.goto(app.url);
  await page.getByRole("link", { name: "Follow a real trail" }).click();
  await page.locator(".mobile-case-action button").click();
  await page.route("**/api/assignments", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"WRITE_FAILED"}',
    }),
  );
  await page.getByRole("button", { name: "Save Case & employ Moxie" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Could not save." })
    .waitFor();
  assert.equal(await page.locator("dialog").evaluate((e) => e.open), true);
  assert.equal(
    (await (await context.request.get(app.url + "/api/den")).json()).assignments
      .length,
    0,
  );
  report.attacks.push({
    attack: "Failed save must not confirm employment or create memory",
    result: "PASS",
  });
  await page.unroute("**/api/assignments");
  const malicious = '<img src=x onerror="alert(1)">';
  await page.getByRole("textbox", { name: "Your field note" }).fill(malicious);
  await page.getByRole("button", { name: "Save Case & employ Moxie" }).click();
  await page.getByRole("button", { name: "Run recorded trail" }).click();
  await page.waitForSelector(".replay-result");
  const assignmentUrl = page.url(),
    id = assignmentUrl.split("/den/")[1];
  await page.getByRole("link", { name: /My den/ }).click();
  assert.equal(await page.locator(".saved-note").textContent(), malicious);
  assert.equal(await page.locator('img[src="x"]').count(), 0);
  report.attacks.push({
    attack: "User field note rendered as HTML/script",
    result: "PASS — literal text",
  });
  await page.getByRole("link", { name: "Open memory" }).click();
  // Simulate delayed background read: take a real pre-cancel snapshot, then let
  // that older response arrive only after the mutation was confirmed.
  let release, seen;
  const captured = new Promise((resolve) => (seen = resolve));
  await page.route("**/api/den", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    seen();
    await new Promise((resolve) => (release = resolve));
    await route.fulfill({ response, body });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await captured;
  await page.getByRole("button", { name: "Cancel assignment" }).click();
  await page.waitForSelector(".assignment-card.canceled");
  release();
  await page.waitForTimeout(250);
  assert.equal(
    await page.locator(".assignment-card.canceled").count(),
    1,
    "An older background GET restored a canceled assignment in the UI",
  );
  report.attacks.push({
    attack: "Late background read reverses confirmed cancellation",
    result: "PASS",
  });
  await page.unroute("**/api/den");
  // A receipt with both changed match IDs and a recomputed self-hash still must
  // match the pinned evidence recipe, not merely its own hash.
  const row = app.store.db
      .prepare("SELECT payload FROM receipts WHERE assignment_id=?")
      .get(id),
    receipt = JSON.parse(row.payload);
  receipt.matchIds = ["f".repeat(64)];
  const { receiptId, ...material } = receipt;
  receipt.receiptId = "replay:" + sha256(material);
  app.store.db
    .prepare("UPDATE receipts SET payload=? WHERE assignment_id=?")
    .run(JSON.stringify(receipt), id);
  await page.reload();
  await page
    .getByRole("alert")
    .filter({ hasText: "Saved receipt failed its integrity check." })
    .waitFor();
  assert.equal(await page.locator(".match-link").count(), 0);
  assert.equal(
    await page.locator(".note-form textarea").inputValue(),
    malicious,
  );
  await page.screenshot({
    path: path.join(out, "mobile-invalid-receipt.png"),
    fullPage: true,
  });
  report.attacks.push({
    attack: "Tampered persisted receipt, including a recomputed hash",
    result: "PASS — no inferred match; note retained",
  });
  // Cancellation before the worker's due time must persist without a receipt.
  await page.getByRole("link", { name: "The alley", exact: true }).click();
  await page.getByRole("link", { name: "Follow a real trail" }).click();
  await page.locator(".mobile-case-action button").click();
  await page.getByRole("button", { name: "Save Case & employ Moxie" }).click();
  await page.getByRole("button", { name: "Run recorded trail" }).click();
  await page.waitForSelector(".working");
  await page.getByRole("button", { name: "Cancel assignment" }).click();
  await page.waitForSelector(".assignment-card.canceled");
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForSelector(".assignment-card.canceled");
  assert.equal(await page.locator(".replay-result").count(), 0);
  report.attacks.push({
    attack: "Cancel pending replay then wait past its due time",
    result: "PASS — canceled after reload; no receipt",
  });
  assert.deepEqual(report.errors, []);
  report.verdict = "PASS";
  await context.close();
})()
  .catch((error) => {
    report.verdict = "FAIL";
    report.failure = error.stack;
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (app) await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    const name = process.env.BINRAT_REVIEW_OUTPUT || "hostile-results.json";
    fs.writeFileSync(
      path.join(out, name),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        {
          verdict: report.verdict,
          attacks: report.attacks.length,
          errors: report.errors.length,
        },
        null,
        2,
      ),
    );
  });
