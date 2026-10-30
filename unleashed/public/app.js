const $ = (selector) => document.querySelector(selector);
const main = $("#main"),
  dialog = $("#employ-dialog");
let evidence = null,
  den = { assignments: [], capacity: 5, interests: [] },
  denFailed = false,
  query = "",
  filter = "all",
  toastTimer,
  busy = false;
const noteDrafts = new Map();
let denRevision = 0,
  denReadSequence = 0;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const short = (value) =>
  value ? `${value.slice(0, 8)}…${value.slice(-4)}` : "—";
const title = (item) => item.name || `TOKEN ${short(item.token)}`;
const byId = (id) => evidence?.cases.find((item) => item.id === id);
const active = () =>
  den.assignments.filter((item) => item.status !== "CANCELLED");
const route = () => location.hash.slice(1) || "/";
const fmt = (value) => Number(value).toLocaleString("en-US");
const trail = (item) =>
  evidence.cases
    .filter((other) => other.creator === item.creator)
    .sort((a, b) => Number(BigInt(a.block) - BigInt(b.block)));
const linkCase = (item) => `#/case/${item.id}`;
const badge = (text, kind = "") => `<span class="badge ${kind}">${text}</span>`;
const sourceStrip = () =>
  `<div class="source-strip"><span><i class="status-dot"></i> HISTORICAL CAPTURE</span><span>09 OCT 2026 · PONS / CHAIN 4663</span><a href="#/source">Stale verified · partial coverage ↗</a></div>`;

async function api(path, body) {
  const mutation = body !== undefined;
  if (mutation) denRevision++;
  try {
    const response = await fetch("/api/" + path, {
      cache: "no-store",
      ...(body !== undefined
        ? {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const value = await response.json();
    if (!response.ok) throw Error(value.error || "LOCAL_REQUEST_FAILED");
    return value;
  } finally {
    // A GET that began before or during this mutation cannot overwrite its
    // confirmed result, even if network responses arrive in reverse order.
    if (mutation) denRevision++;
  }
}
async function readDenInBackground() {
  const revision = denRevision,
    sequence = ++denReadSequence;
  const next = await api("den");
  return revision === denRevision && sequence === denReadSequence ? next : null;
}
const messages = {
  CAPACITY_REACHED:
    "All five memory slots are occupied. Cancel one in your den to free a slot.",
  ASSIGNMENT_CANCELLED:
    "That assignment is canceled. Open its Case to employ Moxie again.",
  EVIDENCE_UNAVAILABLE:
    "The recorded source is unavailable. Your saved memory is still in your den.",
  NOTE_INVALID: "Keep your note to 500 characters.",
  DRAFT_LIMIT:
    "Ten local drafts are already saved. Download an existing draft below.",
};
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 5500);
}
function download(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function updateNav() {
  const page = route().split("/")[1] || "home";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const selected = a.dataset.nav === page;
    a.classList.toggle("selected", selected);
    selected
      ? a.setAttribute("aria-current", "page")
      : a.removeAttribute("aria-current");
  });
  $("#den-count").textContent = active().length;
}

function home() {
  if (!evidence) return unavailable();
  const featured = byId(evidence.featuredId),
    pair = trail(featured),
    other = pair.find((item) => item.id !== featured.id);
  main.innerHTML = `<div class="home-wrap">
    <section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><span class="eyebrow"><span class="tiny-cross">✳</span> A LITTLE SUSPICION. A LONG MEMORY.</span><h1 id="hero-title">Crypto has a<br>short memory.<br><em>Your Rat doesn’t.</em></h1><p>Find an onchain trail. Check what’s behind it.<br>Give your Rat something worth remembering.</p><div class="hero-actions"><a class="button primary" href="${linkCase(featured)}">Follow a real trail <span>↗</span></a><a class="text-link" href="#/den">Meet your Rat →</a></div><span class="hero-footnote">A real recorded Case. No wallet needed.</span></div>
    <div class="hero-world"><div class="world-top"><span>THE ALLEY / AFTER HOURS</span><span>01 — 20</span></div><picture><source media="(max-width:600px)" srcset="/assets/rat-hero-mobile.webp"><img class="hero-rat" src="/assets/rat-hero.webp" width="780" height="780" alt="Moxie, a red-eyed Rat in a dumpster, holding a slice of pizza and a pile of receipts." fetchpriority="high"></picture><div class="rat-label"><span class="rat-dot"></span><div><strong>MOXIE</strong><small>YOUR MEMORY RAT</small></div><span class="rat-quote">“I keep the receipts.”</span></div></div></section>
    ${sourceStrip()}
    <section class="featured-section" aria-labelledby="featured-title"><div class="section-kicker"><span>PINNED TO THE DESK</span><span>A QUESTION WORTH FOLLOWING ↓</span></div><article class="field-note"><div class="note-main"><div class="note-meta"><span>FIELD NOTE / 001</span>${badge("ADDRESS RECURRENCE", "dark")}</div><h2 id="featured-title">One address.<br><span>Two launches.</span></h2><p>Two launches in this recording report the same creator address. A connection you can inspect — without guessing who’s behind it.</p><a class="ink-link" href="${linkCase(featured)}">Open the evidence file <span>↗</span></a></div><div class="note-trail"><div class="trail-label">THE RECORDED TRAIL</div><a href="${linkCase(featured)}" class="token-slip"><span class="slip-icon">01</span><div><strong>${esc(title(featured))}</strong><small>BLOCK ${fmt(featured.block)}</small></div><span>↗</span></a><div class="trail-connector"><span></span><small>SAME REPORTED CREATOR</small><span></span></div><a href="${linkCase(other || featured)}" class="token-slip"><span class="slip-icon">02</span><div><strong>${esc(title(other || featured))}</strong><small>BLOCK ${fmt((other || featured).block)}</small></div><span>↗</span></a><p class="trail-caveat">Address match ≠ shared person or intent.<br>Names weren’t recorded. Addresses are the fallback.</p></div><span class="paper-corner" aria-hidden="true"></span></article></section>
    <section class="scraps" aria-labelledby="scraps-title"><div class="section-heading"><div><span class="eyebrow">LESS NOISE. MORE QUESTIONS.</span><h2 id="scraps-title">Dig through the recording.</h2></div><span class="mono dim">20 LAUNCHES / ONE PARTIAL WINDOW</span></div><div class="search-tools"><label class="search"><span aria-hidden="true">⌕</span><input type="search" id="case-search" placeholder="Search token, creator or Case ID" aria-label="Search recorded Cases" value="${esc(query)}"></label><div class="filters" aria-label="Filter Cases"><button data-filter="all" aria-pressed="${filter === "all"}">All scraps</button><button data-filter="connected" aria-pressed="${filter === "connected"}">Connected in this window</button></div></div><div id="case-results"></div></section>
    <details class="how-it-works"><summary>What does a Rat actually do here? <span>+</span></summary><div class="steps"><div><b>01 / FIND</b><p>Read a recorded launch and its exact receipts.</p></div><div><b>02 / EMPLOY</b><p>Save a Case and a question to Moxie’s local memory.</p></div><div><b>03 / RETURN</b><p>Run the historical trail. Reopen the result in your den.</p></div></div><p class="dim">This build has no live watcher or external notifications. The local server must run to finish a replay; paused work resumes after restart.</p></details>
  </div>`;
  renderRows();
  $("#case-search").addEventListener("input", (e) => {
    query = e.target.value;
    renderRows();
  });
  main.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      main
        .querySelectorAll("[data-filter]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      renderRows();
    }),
  );
}
function renderRows() {
  const rows = evidence.cases.filter(
    (item) =>
      (filter !== "connected" || trail(item).length > 1) &&
      [item.token, item.creator, item.id, item.name, item.symbol].some(
        (value) => value.toLowerCase().includes(query.toLowerCase().trim()),
      ),
  );
  $("#case-results").innerHTML =
    `<p class="result-count" role="status">${rows.length} of 20 recorded Cases${query ? " match your search" : ""}</p>` +
    (rows.length
      ? rows
          .map(
            (item, i) =>
              `<a class="case-row" href="${linkCase(item)}"><span class="case-index">${String(i + 1).padStart(2, "0")}</span><div class="case-name"><strong>${esc(title(item))}</strong><small>NAME NOT RECORDED · BLOCK ${fmt(item.block)}</small></div><span class="row-finding">${trail(item).length > 1 ? "↳ Connected in this window" : "Launch receipt available"}</span><span class="row-arrow">↗<span class="sr-only"> Open Case</span></span></a>`,
          )
          .join("")
      : `<div class="empty-inline"><h3>No scrap matches that.</h3><p>Search covers this 20-launch recording, not the whole chain.</p><button class="button secondary" data-action="clear-search">Clear search</button></div>`);
}

function evidenceFile(id) {
  const item = byId(id);
  if (!item)
    return unavailable(
      evidence
        ? "This Case is outside the recording."
        : "The source file is unavailable.",
    );
  const peers = trail(item),
    saved = active().find((row) => row.case_id === id);
  main.innerHTML = `<div class="page-wrap case-view">${sourceStrip()}<div class="breadcrumb"><a href="#/">← Back to the alley</a><span>CASE FILE / ${item.id.slice(0, 8).toUpperCase()}</span></div><div class="mobile-case-action"><span>MOXIE REMEMBERS<br>LOCAL REPLAY ONLY</span>${saved ? `<a class="button primary" href="#/den/${saved.id}">Open memory →</a>` : `<button class="button primary" data-action="employ" data-id="${id}">Employ Moxie <span>↗</span></button>`}</div><div class="case-layout"><article class="case-paper"><div class="note-meta"><span>PONS / CHAIN 4663</span>${badge("PARTIAL EVIDENCE", "dark")}</div><div class="case-paper-title"><span class="eyebrow">WHAT HAPPENED</span><h1>${peers.length > 1 ? "A familiar address<br>left another trail." : "A launch left<br>a receipt."}</h1><p class="token-title">${esc(title(item))}</p></div><div class="finding"><span class="finding-icon" aria-hidden="true">↳</span><div><h2>${peers.length > 1 ? "Two launches. One reported creator." : "A recorded Pons launch."}</h2><p>${peers.length > 1 ? "This launch and one other in the capture report the same creator address. The two receipts are linked below." : "This source binds the launch to a checkpoint and transaction. No other launch by this creator appears in this capture."}</p></div></div><section class="why"><span class="eyebrow">WHY CARE</span><p>${peers.length > 1 ? "A repeated address gives you a concrete thread to follow. Your Rat can reconstruct when the next recorded launch appeared — and keep the result." : "A receipt is a starting point for research. Save the Case and your question; the replay can check for a later recorded address match."}</p><div class="unknown-note"><strong>What the Rat doesn’t know</strong><p>Who controls the address, whether the token is safe, and what happened outside these 20 launches. A match is a lead, never a verdict.</p></div></section><section class="recorded-events" aria-labelledby="trail-title"><div class="section-kicker"><h2 id="trail-title">FOLLOW THE RECEIPTS</h2><span>${peers.length} IN THIS CAPTURE</span></div>${peers.map((peer, i) => `<div class="event ${peer.id === id ? "current" : ""}"><span class="event-node">${String(i + 1).padStart(2, "0")}</span><div><span class="event-label">${peer.id === id ? "THIS CASE" : "RELATED RECORDED LAUNCH"}</span><a href="${linkCase(peer)}">${esc(title(peer))} ↗</a><small>BLOCK ${fmt(peer.block)}</small><code>${peer.txHash}</code></div></div>`).join("")}</section><details class="raw-receipts"><summary>Inspect exact source identifiers <span>+</span></summary><dl><dt>Token</dt><dd>${item.token}</dd><dt>Reported creator</dt><dd>${item.creator}</dd><dt>Transaction</dt><dd>${item.txHash}</dd><dt>Case / launch ID</dt><dd>${item.id}</dd><dt>Fact ID</dt><dd>${item.factId}</dd><dt>Checkpoint</dt><dd>${evidence.source.checkpoint}</dd><dt>Feed digest (SHA-256)</dt><dd>${evidence.source.feedDigest}</dd><dt>Checkpoint block hash</dt><dd>${evidence.source.checkpointHash}</dd></dl><button class="button ink-button" data-action="download-source">Download original source JSON ↓</button><p>Digest verification binds this row to the recorded publication. It is not an independent chain revalidation.</p></details></article>
    <aside class="case-aside"><div class="rat-portrait"><img src="/assets/rat-hero-mobile.webp" alt="Moxie at the memory desk" width="320" height="320"><span>MOXIE / MEMORY RAT</span></div><div class="assignment-brief"><span class="eyebrow">WHAT NEXT</span><h2>Give this trail<br>a longer memory.</h2><p>Save this Case. Ask Moxie to look for the next launch by this reported creator in the recording.</p><ul><li>One clear question</li><li>Exact replay receipt</li><li>Reopen or cancel anytime</li></ul>${saved ? `<a class="button primary" href="#/den/${saved.id}">Open saved assignment →</a>` : `<button class="button primary" data-action="employ" data-id="${id}">Employ Moxie <span>↗</span></button>`}<small class="demo-copy">LOCAL REPLAY · ${active().length}/5 slots used<br>No live watching. No notification delivery.</small></div></aside></div></div>`;
}

function receiptMarkup(job) {
  if (job.receiptError)
    return '<div class="receipt-error" role="alert"><strong>Saved receipt failed its integrity check.</strong><p>No result is inferred. Your Case and note remain saved. Run the recording again to reconstruct a valid receipt, or cancel this assignment.</p></div>';
  const receipt = job.receipt;
  if (!receipt) return "";
  return `<div class="replay-result"><span class="eyebrow">${receipt.matchIds.length ? "THE RAT FOUND A RECORDED MATCH" : "THE RAT CHECKED THE WINDOW"}</span><h3>${receipt.matchIds.length ? "Another launch. Same reported address." : "Quiet in this recording."}</h3><p>${receipt.matchIds.length ? "Moxie reconstructed a later launch from the same reported creator. This event was already in the historical capture." : "No later launch by this reported creator was found in this capture. This is not evidence of inactivity elsewhere."}</p>${receipt.matchIds
    .map((id) => {
      const matched = byId(id);
      return matched
        ? `<a class="match-link" href="${linkCase(matched)}">${esc(title(matched))}<span>BLOCK ${fmt(matched.block)} ↗</span></a>`
        : "";
    })
    .join(
      "",
    )}<div class="receipt-stats"><span>${receipt.examinedIds.length} later rows checked</span><span>${receipt.matchIds.length} recorded ${receipt.matchIds.length === 1 ? "match" : "matches"}</span></div><details class="receipt-details"><summary>Inspect replay receipt <span>+</span></summary><dl><dt>Outcome</dt><dd>${receipt.outcome}</dd><dt>Authority</dt><dd>PINNED_PUBLIC_SNAPSHOT</dd><dt>Receipt ID</dt><dd>${receipt.receiptId}</dd><dt>Source feed digest</dt><dd>${receipt.feedDigest}</dd><dt>Recorded range</dt><dd>${receipt.startBlock} → ${receipt.endBlock}</dd><dt>Run / completed locally</dt><dd>${job.run} / ${new Date(receipt.completedAt).toISOString()}</dd><dt>Delivery</dt><dd>LOCAL_RECEIPT_ONLY · nothing sent</dd></dl><button class="button secondary" data-action="download-receipt" data-id="${job.id}">Download receipt ↓</button></details></div>`;
}
function assignmentCard(job, expanded) {
  const item = byId(job.case_id),
    canceled = job.status === "CANCELLED",
    status = {
      PREPARED: "Saved · ready to replay",
      RUNNING: "Reconstructing the recording",
      COMPLETE: "Replay complete",
      CANCELLED: "Canceled · memory retained",
    }[job.status];
  return `<article class="assignment-card ${canceled ? "canceled" : ""}" data-job="${job.id}"><div class="job-top"><div><span class="eyebrow">MOXIE / ASSIGNMENT ${job.id.slice(0, 6).toUpperCase()}</span><h2>${item ? esc(title(item)) : "Saved Case " + job.case_id.slice(0, 8)}</h2></div>${badge(status, job.status === "COMPLETE" ? "green" : "")}</div><p class="job-question">“Find the next recorded launch by this reported creator.”</p><div class="job-meta"><span>REPLAY / OCT 09, 2026</span><span>${job.receipt ? "RECEIPT SAVED" : "NO EVENT OR NOTIFICATION CLAIMED"}</span></div>${job.status === "RUNNING" ? '<div class="working" role="status"><span class="working-dot"></span>Checking the recorded rows. You can leave this page.</div>' : ""}${expanded ? receiptMarkup(job) : ""}${expanded ? `<form class="note-form" data-job-id="${job.id}"><label for="note-${job.id}">Your field note <span>private to this browser’s local desk</span></label><textarea id="note-${job.id}" name="note" maxlength="500" rows="2" placeholder="What would you want to know next?">${esc(noteDrafts.get(job.id) ?? job.note)}</textarea><button class="text-button" type="submit">Save note ↗</button></form>` : `${job.note ? `<p class="saved-note">${esc(job.note)}</p>` : ""}`}<div class="job-actions">${!expanded ? `<a class="button primary" href="#/den/${job.id}">Open memory <span>↗</span></a>` : !canceled ? `<button class="button primary" data-action="replay" data-id="${job.id}" ${job.status === "RUNNING" || !evidence ? "disabled" : ""}>${job.status === "RUNNING" ? "Reading the trail…" : job.status === "COMPLETE" ? "Run replay again ↻" : "Run recorded trail →"}</button>` : ""}${item ? `<a class="text-link" href="${linkCase(item)}">Source Case ↗</a>` : ""}${!canceled ? `<button class="text-button cancel" data-action="cancel" data-id="${job.id}">Cancel assignment</button>` : ""}</div>${expanded ? `<p class="honesty">The replay runs on this machine. Closing the tab is fine. Stopping the server pauses unfinished work until restart. Cancellation prevents pending completion; existing receipts stay in memory.</p>` : ""}</article>`;
}
function denPage(id) {
  if (denFailed) {
    main.innerHTML = `<div class="page-wrap empty-state"><span class="eyebrow">LOCAL MEMORY UNAVAILABLE</span><h1>Your den could not be read.</h1><p>No empty desk is being inferred. Check the local server, then retry to reopen your saved work.</p><button class="button primary" data-action="retry">Retry local memory ↻</button></div>`;
    return;
  }
  const selected = id ? den.assignments.find((job) => job.id === id) : null;
  main.innerHTML = `<div class="page-wrap den-wrap"><div class="den-heading"><div><span class="eyebrow">YOUR DEN / LOCAL MEMORY</span><h1>${selected ? "A trail, remembered." : "Good to see you.<br>The Rat remembers."}</h1><p>${selected ? "Your saved question, source and replay result in one place." : "The Cases you gave Moxie stay here. Pick up where you left off."}</p></div><div class="memory-meter"><strong>${active().length}<span>/ 5</span></strong><small>MEMORY SLOTS USED</small><a href="#/capacity">Need more room? ↗</a></div></div><div class="den-notice"><span aria-hidden="true">↳</span><p><strong>Saved on this machine.</strong> This browser’s cookie reopens your desk. Clear cookies and you lose access; deleting the local database erases memory. No cloud account or live alerts.</p></div>${id && !selected ? `<div class="empty-state"><h2>That memory isn’t on this desk.</h2><p>It may belong to a different browser session.</p><a class="button primary" href="#/den">Open your den →</a></div>` : selected ? `<a class="back-link" href="#/den">← All memories</a>${assignmentCard(selected, true)}` : den.assignments.length ? `<div class="den-list">${den.assignments.map((job) => assignmentCard(job, false)).join("")}</div><a class="button secondary" href="#/">Find another trail ↗</a>` : `<div class="empty-den"><div class="empty-rat"><img src="/assets/rat-hero-mobile.webp" width="320" height="320" alt="Moxie waiting in the dumpster"></div><div><span class="eyebrow">MOXIE IS READY</span><h2>Nothing in the<br>memory pile. Yet.</h2><p>Find a launch that makes you curious. Check the evidence, then employ Moxie to keep it.</p><a class="button primary" href="${evidence ? "#/case/" + evidence.featuredId : "#/"}">Find your first trail <span>↗</span></a></div></div>`}</div>`;
}

function capacityPage() {
  main.innerHTML = `<div class="page-wrap capacity-wrap"><span class="eyebrow">A SMALL RAT. A BIGGER MEMORY.</span><h1>Good questions<br>deserve more room.</h1><p class="lede">Try five local assignments for free. Tell us what you’d want your next Rat to do.</p><div class="capacity-grid"><article class="capacity-card"><span class="eyebrow">MEMORY RAT / PROPOSED</span><h2>Room to remember.</h2><div class="price">$9 <span>/ month · price concept</span></div><p>A proposed plan for 25 saved Cases, organized notes and a longer trail of receipts.</p><p class="capacity-limit">Interest only. Additional capacity and cloud memory are not available in this build.</p><button class="button primary" data-action="interest-type" data-service="memory">Draft my interest ↗</button></article><article class="capacity-card"><span class="eyebrow">ONE QUESTION / BOUNDED SCOPE</span><h2>Go one layer deeper.</h2><div class="price">Request a scope</div><p>Ask for one investigation: named sources, a fixed budget, explicit unknowns and a receipt.</p><p class="capacity-limit">No investigation is ordered or started. Price and scope need a separate agreement.</p><button class="button secondary" data-action="interest-type" data-service="investigation">Draft a service request ↗</button></article></div><form id="interest-form" class="interest-form"><span class="eyebrow">LOCAL DRAFT / NOTHING SENT</span><h2>What should your Rat remember?</h2><label for="service">Type of interest</label><select id="service" name="service"><option value="memory">More memory capacity</option><option value="investigation">One bounded investigation</option></select><label for="interest-note">Your question <span>(optional, 500 characters)</span></label><textarea id="interest-note" name="note" maxlength="500" rows="3" placeholder="I’d return to BINRAT if my Rat could…"></textarea><p>No email, card, wallet, charge or entitlement. This saves a draft to local SQLite. Download it to keep a copy or share it yourself.</p><button class="button primary" type="submit">Save interest locally <span>↗</span></button><div id="interest-result" role="status"></div></form>${den.interests.length ? `<section class="drafts"><h2>Your saved drafts</h2>${den.interests.map((draft) => `<div><span>${draft.service === "memory" ? "Memory capacity" : "Bounded investigation"} · LOCAL DRAFT</span><button class="text-button" data-action="download-draft" data-id="${draft.id}">Download request ↓</button></div>`).join("")}</section>` : ""}</div>`;
}

function sourcePage() {
  if (!evidence) return unavailable();
  const s = evidence.source;
  main.innerHTML = `<div class="page-wrap source-page"><a class="back-link" href="#/">← The alley</a><span class="eyebrow">THE RECEIPTS BEHIND THE STORY</span><h1>Trust the source.<br>Know its limits.</h1><p class="lede">These are recorded public BINRAT responses from 9 October 2026. No collector, RPC or model is called by this product.</p><div class="status-grid"><div>${badge("STALE_VERIFIED")}<p>The original publication passed its digest and checkpoint contracts. Its freshness window has expired.</p></div><div>${badge("PARTIAL")}<p>Twenty launches on Pons, chain 4663. Missing names, unknown full history, no price or safety evaluation.</p></div><div>${badge("REPLAY", "green")}<p>Assignments reconstruct later rows in this capture. A local result is never a live alert or delivered message.</p></div></div><article class="source-details"><h2>Exact source binding</h2><dl><dt>Recorded GET</dt><dd>${s.capturedAt}</dd><dt>Publication verified at</dt><dd>${s.verifiedAt}</dd><dt>State as originally recorded</dt><dd>${s.originalState} — historical only, expired now</dd><dt>State used here</dt><dd>${s.state}</dd><dt>Checkpoint</dt><dd>${s.checkpoint}</dd><dt>Checkpoint block hash</dt><dd>${s.checkpointHash}</dd><dt>Canonical feed SHA-256</dt><dd>${s.feedDigest}</dd><dt>Source commit</dt><dd>${s.sourceSha}</dd></dl><button class="button primary" data-action="download-source">Download original source JSON ↓</button><p>Recomputed with the existing BINRAT snapshot validator. The saved transport receipt records production GETs; this build does not independently revalidate the chain.</p></article><article class="source-details"><h2>Read the five states correctly.</h2><dl><dt>FRESH_VERIFIED</dt><dd>A bound publication inside its explicit freshness window. Not claimed by this build.</dd><dt>STALE_VERIFIED</dt><dd>A valid bound publication whose freshness has expired. The source used here.</dd><dt>PARTIAL</dt><dd>Coverage is incomplete, regardless of freshness.</dd><dt>UNAVAILABLE</dt><dd>Missing, corrupt or unbound evidence. No substitute rows or optimistic upgrade.</dd><dt>REPLAY</dt><dd>Recorded evidence examined locally; no future event or external notification implied.</dd></dl><h2>Artwork & type</h2><p>Existing owner-approved BINRAT dumpster Rat and alley artwork copied byte for byte from REBIRTH 01.1. IBM Plex and Silkscreen are self-hosted with their license texts retained. No new asset ownership or rights are claimed.</p></article><a class="button secondary" href="#/">Find a trail →</a></div>`;
}
function unavailable(message = "The Rat won’t invent a trail.") {
  main.innerHTML = `<div class="page-wrap empty-state"><span class="eyebrow">SOURCE UNAVAILABLE</span><h1>${esc(message)}</h1><p>The recording could not be loaded or this Case is outside its bounds. Saved assignments remain accessible in your den. Evidence actions stay unavailable until a valid source returns.</p><button class="button primary" data-action="retry">Try the source again ↻</button><a class="button secondary" href="#/den">Open saved memory →</a></div>`;
}
function render({ focus = false } = {}) {
  // Keep the actual editor nodes while status panels update. Capturing a value
  // alone can still lose an in-flight native input event on a detached textarea.
  const editors = [...document.querySelectorAll(".note-form")];
  const activeEditor = document.activeElement;
  editors.forEach((form) =>
    noteDrafts.set(form.dataset.jobId, form.querySelector("textarea").value),
  );
  updateNav();
  const path = route().split("/");
  if (path[1] === "case") evidenceFile(path[2]);
  else if (path[1] === "den") denPage(path[2]);
  else if (path[1] === "capacity") capacityPage();
  else if (path[1] === "source") sourcePage();
  else home();
  for (const editor of editors) {
    const replacement = [...main.querySelectorAll(".note-form")].find(
      (form) => form.dataset.jobId === editor.dataset.jobId,
    );
    if (replacement) replacement.replaceWith(editor);
  }
  if (!focus && activeEditor?.isConnected) {
    activeEditor.focus({ preventScroll: true });
  }
  document.title = `BINRAT — ${path[1] === "case" ? "Evidence file" : path[1] === "den" ? "Your den" : path[1] === "capacity" ? "Rat capacity" : path[1] === "source" ? "Source & limits" : "The Night Desk"}`;
  if (focus) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
}
async function load() {
  const results = await Promise.allSettled([api("evidence"), api("den")]);
  evidence = results[0].status === "fulfilled" ? results[0].value : null;
  denFailed = results[1].status !== "fulfilled";
  if (!denFailed) den = results[1].value;
  else
    toast(
      "Your den could not be loaded. Try again; unsaved actions are not confirmed.",
    );
  render();
}

function employ(id) {
  const item = byId(id);
  if (!item) return;
  dialog.innerHTML = `<form id="employ-form" data-case-id="${id}"><div class="dialog-top"><span class="eyebrow">A QUESTION FOR MOXIE</span><button class="close-dialog" type="button" aria-label="Close assignment">×</button></div><h2 id="employ-title">Give the Rat<br>something to remember.</h2><p>Save <strong>${esc(title(item))}</strong> and check for the next launch by this reported creator in the recording.</p><div class="modal-truth">LOCAL REPLAY · HISTORICAL RECORDING<br>Not a live watch. Nothing will be sent.</div><label for="assignment-note">Your field note <span>(optional)</span></label><textarea id="assignment-note" name="note" rows="3" maxlength="500" placeholder="Why does this trail interest you?"></textarea><p class="dialog-footnote">One of five local slots. Reopen or cancel from your den.</p><button class="button primary" type="submit">Save Case & employ Moxie <span>↗</span></button><p class="form-error" role="alert"></p></form>`;
  dialog.showModal();
  dialog.querySelector(".close-dialog").onclick = () => dialog.close();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action,
    id = button.dataset.id;
  try {
    if (action === "employ") return employ(id);
    if (action === "clear-search") {
      query = "";
      $("#case-search").value = "";
      renderRows();
      $("#case-search").focus();
      return;
    }
    if (action === "retry") {
      button.disabled = true;
      await load();
      return;
    }
    if (action === "download-source")
      return download("binrat-pinned-source.json", await api("source"));
    if (action === "download-receipt")
      return download(
        "binrat-replay-receipt.json",
        den.assignments.find((job) => job.id === id)?.receipt,
      );
    if (action === "download-draft")
      return download(
        "binrat-service-interest.json",
        den.interests.find((item) => item.id === id),
      );
    if (action === "interest-type") {
      const form = $("#interest-form");
      $("#service").value = button.dataset.service;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      $("#interest-note").focus({ preventScroll: true });
      return;
    }
    if (action === "replay" || action === "cancel") {
      if (busy) return;
      busy = true;
      button.disabled = true;
      const result = await api(`assignments/${id}/${action}`, {});
      den.assignments = result.assignments;
      render();
      toast(
        action === "cancel"
          ? "Assignment canceled. Pending work stopped; saved receipts remain."
          : "Replay started. You can leave this page and return to your den.",
      );
    }
  } catch (error) {
    toast(
      messages[error.message] ||
        "The local action failed. Nothing is confirmed. Try again.",
    );
    button.disabled = false;
  } finally {
    busy = false;
  }
});
document.addEventListener("submit", async (event) => {
  if (
    !["employ-form", "interest-form"].includes(event.target.id) &&
    !event.target.matches(".note-form")
  )
    return;
  event.preventDefault();
  const form = event.target,
    button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const data = new FormData(form);
    if (form.id === "employ-form") {
      const result = await api("assignments", {
        caseId: form.dataset.caseId,
        note: data.get("note"),
      });
      den.assignments = result.assignments;
      dialog.close();
      location.hash = "/den/" + result.id;
      toast(
        "Moxie remembers. Your Case is saved locally; run its recorded trail when ready.",
      );
    } else if (form.matches(".note-form")) {
      const result = await api(`assignments/${form.dataset.jobId}/note`, {
        note: data.get("note"),
      });
      den.assignments = result.assignments;
      noteDrafts.delete(form.dataset.jobId);
      toast("Field note saved on this machine.");
    } else {
      const draft = await api("interest", {
        service: data.get("service"),
        note: data.get("note"),
      });
      den.interests.unshift(draft);
      $("#interest-result").innerHTML =
        `<strong>Draft saved locally. Nothing sent.</strong><button class="text-button" type="button" data-action="download-draft" data-id="${draft.id}">Download request ↓</button>`;
      toast(
        "Interest saved as a local draft. No order, charge or entitlement.",
      );
    }
  } catch (error) {
    const message =
      messages[error.message] ||
      "Could not save. Check the local server and try again.";
    const target = form.querySelector(".form-error");
    if (target) target.textContent = message;
    else toast(message);
  } finally {
    button.disabled = false;
  }
});
document.addEventListener("input", (event) => {
  if (event.target.matches(".note-form textarea"))
    noteDrafts.set(
      event.target.closest("form").dataset.jobId,
      event.target.value,
    );
});
function refreshDen() {
  const active = document.activeElement,
    id = active?.id,
    start = active?.selectionStart,
    end = active?.selectionEnd;
  const y = window.scrollY;
  render();
  if (id) {
    const replacement = document.getElementById(id);
    if (replacement) {
      replacement.focus({ preventScroll: true });
      if (typeof replacement.setSelectionRange === "function" && start !== null)
        replacement.setSelectionRange(start, end);
    }
  }
  window.scrollTo(0, y);
}
window.addEventListener("hashchange", () => render({ focus: true }));
window.addEventListener("focus", async () => {
  try {
    const next = await readDenInBackground();
    if (!next) return;
    const changed = JSON.stringify(den) !== JSON.stringify(next);
    den = next;
    updateNav();
    if (changed && route().startsWith("/den")) refreshDen();
  } catch {
    /* Preserve visible memory on transient failure. */
  }
});
setInterval(async () => {
  if (!den.assignments.some((job) => job.status === "RUNNING")) return;
  try {
    const next = await readDenInBackground();
    if (!next) return;
    const changed =
      JSON.stringify(den.assignments) !== JSON.stringify(next.assignments);
    den = next;
    if (changed) {
      updateNav();
      if (route().startsWith("/den")) refreshDen();
    }
  } catch {
    toast(
      "The local server is unavailable. Replay work resumes when it restarts.",
    );
  }
}, 750);
await load();
