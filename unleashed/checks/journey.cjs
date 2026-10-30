/* Native pinned Playwright, local server + disposable SQLite; no remote service. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const runner =
  process.env.PLAYWRIGHT_PATH ||
  path.resolve(__dirname, "../.local/browser-tools/node_modules/playwright");
const { chromium } = require(runner);
const axePath =
  process.env.AXE_PATH ||
  path.resolve(
    __dirname,
    "../.local/browser-tools/node_modules/axe-core/axe.min.js",
  );
const root = path.resolve(__dirname, "../.."),
  out =
    process.env.BINRAT_SCREENSHOTS ||
    path.join(root, "docs/receipts/unleashed-01");
fs.mkdirSync(out, { recursive: true });
const report = {
  schema: "binrat.unleashed.browser/1",
  capturedAt: new Date().toISOString(),
  sourceHead: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  runner: require(path.join(runner, "package.json")).version,
  viewports: [],
  journeys: [],
  accessibility: [],
  adverse: [],
  errors: [],
  requests: [],
  walkthrough: [],
};
const viewports = [
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [320, 700],
];
let app, browser;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "binrat-browser-"));
const check = async (page, label) => {
  await settle(page);
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    brokenImages: [...document.images].filter(
      (i) => !i.complete || i.naturalWidth === 0,
    ).length,
  }));
  assert.ok(
    metrics.scrollWidth <= metrics.width && metrics.bodyWidth <= metrics.width,
    label + " overflow " + JSON.stringify(metrics),
  );
  assert.equal(metrics.brokenImages, 0, label + " broken image");
  return metrics;
};
const settle = async (page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) => i.decode().catch(() => {})),
    );
  });
async function shot(page, name, fullPage = false) {
  await settle(page);
  await page.screenshot({ path: path.join(out, name + ".png"), fullPage });
}
async function axe(page, label) {
  await page.evaluate(fs.readFileSync(axePath, "utf8"));
  const violations = await page.evaluate(async () => {
    const result = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
  });
  report.accessibility.push({ label, violations });
  assert.deepEqual(violations, [], label + " accessibility");
}
const watch = (page) => {
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== app.url)
      report.errors.push("EXTERNAL_REQUEST " + request.url());
    if (request.url().includes("/api/"))
      report.requests.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
      });
  });
};
async function go(page, hash) {
  await page.goto(app.url + hash);
  await settle(page);
}

(async () => {
  const { startServer } = await import(
    pathToFileURL(path.join(root, "unleashed/server.mjs"))
  );
  app = await startServer({
    port: 0,
    dbPath: path.join(temp, "journey.sqlite"),
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
  report.chrome = await browser.version();
  for (const [width, height] of viewports) {
    const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    watch(page);
    await go(page, "/");
    await page.getByRole("heading", { name: /Crypto has a/ }).waitFor();
    const metrics = await check(page, "home " + width);
    assert.equal(await page.locator(".case-row").count(), 20);
    if (width === 1440 || width === 390) {
      await shot(
        page,
        "desktop-home".replace("desktop", width === 390 ? "mobile" : "desktop"),
      );
      await axe(page, "home " + width);
    }
    if (width === 320 || width === 1024) await shot(page, "home-" + width);
    await page.getByRole("link", { name: "Follow a real trail" }).click();
    await page.locator(".case-paper").waitFor();
    await check(page, "case " + width);
    const caseId = page.url().split("/case/")[1];
    assert.ok(caseId);
    if (width === 1440 || width === 390) {
      await shot(page, width === 1440 ? "desktop-case" : "mobile-case");
      await axe(page, "case " + width);
    }
    const employ =
      width <= 600
        ? page.locator(".mobile-case-action button")
        : page.locator(".assignment-brief button");
    await employ.click();
    await page
      .getByRole("textbox", { name: "Your field note" })
      .fill("I want the recorded connection, without assuming identity.");
    if (width === 390) {
      await shot(page, "mobile-employ");
      await axe(page, "employ dialog 390");
    }
    await page
      .getByRole("button", { name: "Save Case & employ Moxie" })
      .click();
    await page.getByRole("button", { name: "Run recorded trail" }).waitFor();
    const assignmentUrl = page.url();
    await page.reload();
    await page.getByRole("button", { name: "Run recorded trail" }).waitFor();
    assert.match(
      await page.locator(".note-form textarea").inputValue(),
      /recorded connection/,
    );
    await page.getByRole("button", { name: "Run recorded trail" }).click();
    // A completion must not discard a note being edited while the result arrives.
    const edit = "Unsaved draft survives the completion update " + width;
    await page.locator(".note-form textarea").fill(edit);
    await page.waitForSelector(".replay-result");
    assert.equal(await page.locator(".note-form textarea").inputValue(), edit);
    await page.getByRole("button", { name: "Save note" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Field note saved on this machine." })
      .waitFor();
    // Leave the Case, then return through the real den navigation and reload.
    await page.getByRole("link", { name: "The alley", exact: true }).click();
    await page.getByRole("link", { name: /My den/ }).click();
    await page.getByRole("link", { name: "Open memory" }).click();
    await page.reload();
    await page.waitForSelector(".replay-result");
    assert.equal(await page.locator(".note-form textarea").inputValue(), edit);
    assert.match(
      await page.locator(".replay-result").innerText(),
      /1 recorded match/,
    );
    await check(page, "reopened " + width);
    if (width === 1440 || width === 390) {
      await page.locator(".replay-result").scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await shot(page, width === 1440 ? "desktop-memory" : "mobile-memory");
      await axe(page, "memory " + width);
      await page.locator(".receipt-details summary").click();
      await shot(
        page,
        width === 1440 ? "desktop-receipt" : "mobile-receipt",
        true,
      );
    }
    const assignmentId = assignmentUrl.split("/den/")[1];
    const saved = await context.request.get(app.url + "/api/den");
    const savedBody = await saved.json();
    const job = savedBody.assignments.find((j) => j.id === assignmentId);
    assert.equal(job.receipt.notificationState, "LOCAL_RECEIPT_ONLY");
    if (width === 1440) {
      fs.writeFileSync(
        path.join(out, "walkthrough-receipt.json"),
        JSON.stringify(job.receipt, null, 2) + "\n",
      );
      report.walkthrough.push(
        { step: 1, action: "Open recorded Case", caseId },
        { step: 2, action: "Employ Moxie and save a question", assignmentId },
        {
          step: 3,
          action: "Run local replay",
          examined: job.receipt.examinedIds.length,
          matches: job.receipt.matchIds.length,
        },
        {
          step: 4,
          action: "Leave, reopen through My den, and reload",
          persisted: true,
        },
        {
          step: 5,
          action: "Inspect/download receipt",
          receiptId: job.receipt.receiptId,
        },
      );
    }
    await page.getByRole("button", { name: "Cancel assignment" }).click();
    await page.waitForSelector(".assignment-card.canceled");
    assert.match(
      await page.locator(".assignment-card").innerText(),
      /Canceled/,
    );
    assert.equal(
      await page.getByRole("button", { name: /Run replay/ }).count(),
      0,
    );
    await page.reload();
    await page.waitForSelector(".assignment-card.canceled");
    await check(page, "canceled " + width);
    report.viewports.push({
      width,
      height,
      ...metrics,
      caseOverflow: false,
      memoryOverflow: false,
    });
    report.journeys.push({
      width,
      discoverCase: true,
      employ: true,
      replay: true,
      reopen: true,
      noteDraftRetained: true,
      cancelPersisted: true,
    });
    await context.close();
  }
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  watch(page);
  await go(page, "/#/den");
  await page.getByRole("heading", { name: /Nothing in the/ }).waitFor();
  await shot(page, "mobile-empty-den");
  await axe(page, "empty den");
  await go(page, "/");
  await page.getByRole("searchbox").fill("no-such-token");
  assert.equal(await page.locator(".case-row").count(), 0);
  await page.getByRole("heading", { name: "No scrap matches that." }).waitFor();
  await check(page, "empty search");
  await shot(page, "mobile-empty-search");
  await page.getByRole("button", { name: "Clear search" }).click();
  assert.equal(await page.locator(".case-row").count(), 20);
  await page.getByRole("button", { name: "Connected in this window" }).click();
  assert.equal(await page.locator(".case-row").count(), 4);
  await go(page, "/#/capacity");
  await page.getByRole("button", { name: "Draft my interest" }).click();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Keep my questions and receipts together.");
  await page.getByRole("button", { name: "Save interest locally" }).click();
  await page
    .getByText("Draft saved locally. Nothing sent.", { exact: true })
    .waitFor();
  await check(page, "capacity");
  await axe(page, "capacity");
  await page.reload();
  await page.getByRole("heading", { name: "Your saved drafts" }).waitFor();
  await shot(page, "mobile-capacity");
  await page.getByRole("button", { name: "Download request" }).click();
  await go(page, "/#/source");
  await check(page, "source");
  await axe(page, "source");
  await shot(page, "mobile-source", true);
  // Keyboard: skip link, native dialog focus containment and Escape return.
  await go(page, "/");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator(".skip").evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("main").evaluate((e) => e === document.activeElement),
    true,
  );
  await page.getByRole("link", { name: "Follow a real trail" }).click();
  await page.locator(".mobile-case-action button").click();
  assert.equal(
    await page
      .locator("dialog")
      .evaluate((e) => e.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").evaluate((e) => e.open), false);
  const animations = await page.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
  assert.equal(animations, 0);
  report.adverse.push({ keyboardAndReducedMotion: "PASS" });
  // HTTP/adverse controls only; never counted as real-source data.
  await page.route("**/api/evidence", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        state: "UNAVAILABLE",
        error: "EVIDENCE_UNAVAILABLE",
      }),
    }),
  );
  await go(page, "/");
  await page
    .getByRole("heading", { name: "The Rat won’t invent a trail." })
    .waitFor();
  assert.equal(await page.locator(".case-row").count(), 0);
  await check(page, "unavailable");
  await shot(page, "mobile-source-unavailable");
  await axe(page, "unavailable");
  report.adverse.push({ source503: "UNAVAILABLE; zero substituted rows" });
  await page.unroute("**/api/evidence");
  await page.route("**/api/den", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"LOCAL_STORE_FAILED"}',
    }),
  );
  await go(page, "/#/den");
  await page.reload();
  await page
    .getByRole("heading", { name: "Your den could not be read." })
    .waitFor();
  assert.equal(
    await page.getByRole("heading", { name: /Nothing in the/ }).count(),
    0,
  );
  await shot(page, "mobile-den-unavailable");
  report.adverse.push({
    den503: "Explicit unreadable state, not empty memory",
  });
  await context.close();
  assert.deepEqual(report.errors, []);
  report.verdict = "PASS";
})()
  .catch((error) => {
    report.verdict = "FAIL";
    report.failure = error.stack;
    process.exitCode = 1;
    console.error(error);
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (app) await app.close();
    fs.rmSync(temp, { recursive: true, force: true });
    report.runtimeSourceHashes = Object.fromEntries(
      [
        "unleashed/server.mjs",
        "unleashed/store.mjs",
        "unleashed/evidence.mjs",
        "unleashed/public/app.js",
        "unleashed/public/styles.css",
        "unleashed/public/index.html",
      ].map((file) => [
        file,
        createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      ]),
    );
    fs.writeFileSync(
      path.join(out, "browser-results.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        {
          verdict: report.verdict,
          viewports: report.viewports.length,
          journeys: report.journeys.length,
          axePages: report.accessibility.length,
          errors: report.errors.length,
          failure: report.failure?.split("\n")[0],
        },
        null,
        2,
      ),
    );
  });
