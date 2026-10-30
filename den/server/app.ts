import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LENSES,
  PRODUCT,
  buildDossier,
  buildPile,
  buildReplay,
  caseSummary,
  findLead,
  shortAddress,
  stamp,
  type CaseSummary,
  type LensId,
  type ReplayView,
} from "./casefile.ts";
import { appearancesOf, type EvidenceModel, type RecordRow } from "./evidence.ts";
import { issueReceipt, readReceipt, RECEIPT_DIGEST_RULE } from "./receipts.ts";
import { runInvestigation } from "./run.ts";
import type { Store } from "./store.ts";

const here = dirname(fileURLToPath(import.meta.url));
const denRoot = resolve(here, "..");

const SESSION = /^[a-z0-9-]{8,64}$/i;
const SCOPES = ["case-deep-dive", "deployer-trail", "window-watch"] as const;
export type WorkOrderScope = (typeof SCOPES)[number];

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type DenResponse = { status: number; body: unknown; headers?: Record<string, string> };
export type DenRequest = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: string;
};

export type DenApp = {
  handle(request: DenRequest): Promise<DenResponse>;
  model: EvidenceModel;
  store: Store;
};

type Ctx = { model: EvidenceModel; store: Store; now: () => number; assets: AssetsFile };

type AssetsFile = {
  assets: Array<{ id: string; path: string; kind: string; origin: string; sha256: string; rights: string; change?: string }>;
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}): DenResponse => ({
  status,
  body,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
});

function header(request: DenRequest, name: string): string | undefined {
  const found = Object.entries(request.headers).find(([key]) => key.toLowerCase() === name);
  if (!found) return undefined;
  const value = found[1];
  return Array.isArray(value) ? value[0] : value;
}

function sessionOf(request: DenRequest): string | null {
  const raw = header(request, "x-den-session");
  if (!raw) return null;
  const value = raw.trim();
  if (!SESSION.test(value)) throw new ApiError(400, "SESSION_INVALID", "x-den-session must be 8-64 url-safe characters.");
  return value.toLowerCase();
}

function requireSession(request: DenRequest): string {
  const session = sessionOf(request);
  if (!session) throw new ApiError(400, "SESSION_REQUIRED", "This action needs the local den session header.");
  return session;
}

function parseBody<T>(request: DenRequest): T {
  if (!request.body) return {} as T;
  if (request.body.length > 16_384) throw new ApiError(413, "BODY_TOO_LARGE", "Request body is too large.");
  try {
    return JSON.parse(request.body) as T;
  } catch {
    throw new ApiError(400, "BODY_INVALID", "Request body must be JSON.");
  }
}

function requiresRecord(model: EvidenceModel, id: string): RecordRow {
  const record = model.byLaunchId.get(id);
  if (!record) throw new ApiError(404, "CASE_NOT_FOUND", "No recorded scrap has that id.");
  return record;
}

async function loadAssets(): Promise<AssetsFile> {
  return JSON.parse(await readFile(join(denRoot, "assets.json"), "utf8")) as AssetsFile;
}

function tripwireView(ctx: Ctx, tripwire: ReturnType<Store["listTripwires"]>[number]) {
  const record = ctx.model.byLaunchId.get(tripwire.caseId);
  const replays = ctx.store.listReplays(tripwire.id);
  const lastReplay = replays[0]
    ? (() => {
        try {
          const parsed = JSON.parse(replays[0].payload) as { replay: ReplayView; receiptDigest: string };
          return { id: replays[0].id, createdAt: new Date(replays[0].createdAt).toISOString(), digest: parsed.receiptDigest };
        } catch {
          return null;
        }
      })()
    : null;
  if (!record) {
    return {
      id: tripwire.id,
      status: tripwire.status,
      pinnedAt: new Date(tripwire.createdAt).toISOString(),
      updatedAt: new Date(tripwire.updatedAt).toISOString(),
      note: tripwire.note,
      unavailable: true,
      case: null,
      replay: null,
      lastReplay,
    };
  }
  return {
    id: tripwire.id,
    status: tripwire.status,
    pinnedAt: new Date(tripwire.createdAt).toISOString(),
    updatedAt: new Date(tripwire.updatedAt).toISOString(),
    note: tripwire.note,
    unavailable: false,
    case: caseSummary(ctx.model, record),
    replay: buildReplay(ctx.model, record),
    lastReplay,
  };
}

function leadMovement(model: EvidenceModel, record: RecordRow) {
  const appearances = appearancesOf(model, record.deployer);
  const first = appearances[0];
  const last = appearances[appearances.length - 1];
  if (!first || !last || appearances.length < 2) return null;
  return {
    windows: new Set(appearances.map((item) => item.captureId)).size,
    records: appearances.length,
    from: first.priorLaunchCount,
    to: last.priorLaunchCount,
    delta: last.priorLaunchCount - first.priorLaunchCount,
    fromBlock: first.blockNumber,
    toBlock: last.blockNumber,
    fromReadAt: new Date(first.captureReadAt).toISOString(),
    toReadAt: new Date(last.captureReadAt).toISOString(),
    fromCapture: first.captureId,
    toCapture: last.captureId,
  };
}

export function createDenApp(options: {
  model: EvidenceModel;
  store: Store;
  now?: () => number;
  assets?: AssetsFile;
}): DenApp {
  const { model, store } = options;
  const now = options.now ?? (() => Date.now());
  if (!model.summary.allDigestsVerified) throw new Error("EVIDENCE_NOT_VERIFIED");
  const ctx: Ctx = { model, store, now, assets: options.assets ?? { assets: [] } };
  const lead = findLead(model);
  const leadSummary = caseSummary(model, lead);
  let leadDossier: Awaited<ReturnType<typeof buildDossier>> | null = null;

  const api = {
    async handle(request: DenRequest): Promise<DenResponse> {
      const url = new URL(request.url, "http://den.local");
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const method = request.method.toUpperCase();
      try {
        return await route(request, method, path, url);
      } catch (error) {
        if (error instanceof ApiError) {
          return json(error.status, { error: { code: error.code, message: error.message } });
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        if (process.env.DEN_DEBUG) console.error(error);
        return json(500, { error: { code: "INTERNAL", message } });
      }
    },
  };

  async function route(request: DenRequest, method: string, path: string, url: URL): Promise<DenResponse> {
    if (!leadDossier) leadDossier = await buildDossier(model, lead);
    if (path === "/api/health" && method === "GET") {
      return json(200, {
        ok: true,
        product: PRODUCT,
        mode: PRODUCT.mode,
        evidence: {
          captures: model.summary.captureCount,
          records: model.summary.recordCount,
          digestsVerified: model.summary.allDigestsVerified,
          coverage: model.summary.coverage,
        },
        store: "sqlite",
      });
    }

    if (path === "/api/den" && method === "GET") {
      const session = sessionOf(request);
      const watching = session ? store.listTripwires(session).filter((item) => item.status === "WATCHING") : [];
      const views = watching.map((item) => tripwireView(ctx, item));
      const replayable = views.filter((view) => view.replay?.status === "RECORDED_AGAIN").length;
      const lastReplay = session
        ? watching
            .flatMap((item) => store.listReplays(item.id))
            .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
        : null;
      let lastReplayDigest: string | null = null;
      if (lastReplay) {
        try {
          lastReplayDigest = (JSON.parse(lastReplay.payload) as { receiptDigest?: string }).receiptDigest ?? null;
        } catch {
          lastReplayDigest = null;
        }
      }
      const visit = session ? store.peekVisit(session) : null;
      return json(200, {
        product: PRODUCT,
        mode: PRODUCT.mode,
        evidence: {
          ...model.summary,
          sources: model.captures.map((capture) => ({
            id: capture.id,
            checkpoint: capture.checkpoint,
            readAt: capture.readAtIso,
            state: capture.state,
            records: capture.recordCount,
            kind: capture.source.kind,
            origin: capture.source.origin,
            digest: capture.feedDigest,
            digestVerified: capture.digestVerified,
          })),
        },
        lead: {
          ...leadSummary,
          dossierHeadline: leadDossier.headline,
          dossierDeck: leadDossier.deck,
          movement: leadMovement(model, lead),
          replay: buildReplay(model, lead),
          stamp: stamp(lead.captureReadAt),
        },
        counters: {
          scraps: model.summary.recordCount,
          uniqueDeployers: model.summary.uniqueDeployers,
          repeaters: model.summary.crossWindowDeployers,
          blankNames: model.summary.blankMetadataRecords,
          lenses: LENSES.length,
        },
        tripwires: {
          count: watching.length,
          replayable,
          dropped: session ? store.listTripwires(session).filter((item) => item.status === "DROPPED").length : 0,
          lastReplayAt: lastReplay ? new Date(lastReplay.createdAt).toISOString() : null,
          lastReplayDigest,
        },
        visit: visit
          ? {
              firstVisit: false,
              previousSeenAt: new Date(visit.lastSeen).toISOString(),
            }
          : { firstVisit: true, previousSeenAt: null },
        limits: [
          { label: "Live feed", state: "NOT RUN", note: "No collector was started. The Den reads packaged captures." },
          { label: "Recorded windows", state: `${model.summary.captureCount} PACKAGED`, note: "Each window is a bounded 20-record read." },
          { label: "Network at runtime", state: "ZERO CALLS", note: "The server never fetches a provider or RPC." },
          { label: "$BINRAT", state: "NOT LAUNCHED", note: "No token, sale, stake or entitlement exists." },
          { label: "Alerts", state: "NOT DELIVERED", note: "Tripwires replay recorded windows; they do not send messages." },
        ],
      });
    }

    if (path === "/api/pile" && method === "GET") {
      const lensParam = url.searchParams.get("lens") ?? "scent";
      const lens = (LENSES.find((item) => item.id === lensParam)?.id ?? "scent") as LensId;
      const query = (url.searchParams.get("q") ?? "").slice(0, 120);
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 60) || 60, 1), 120);
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
      const pile = buildPile(model, { lens, query, limit, offset });
      return json(200, {
        lenses: LENSES,
        lens,
        query,
        total: pile.total,
        matched: pile.matched,
        rows: pile.rows,
        after: pile.rows.length + offset < pile.matched ? String(pile.rows.length + offset) : null,
      });
    }

    if (path.startsWith("/api/case/") && path.endsWith("/employ") && method === "POST") {
      const id = path.slice("/api/case/".length, -"/employ".length);
      const session = requireSession(request);
      const record = requiresRecord(model, id);
      const body = parseBody<{ fresh?: boolean }>(request);
      if (!body.fresh) {
        const existing = store.findCompletedRun(session, id);
        if (existing) {
          const payload = JSON.parse(existing.payload) as { run: unknown; dossier: unknown; receipt: unknown };
          return json(200, {
            run: { ...(payload.run as object), id: existing.id, reused: true },
            steps: (payload as { steps?: unknown }).steps ?? [],
            dossier: payload.dossier,
            receipt: payload.receipt,
            reused: true,
          });
        }
      }
      const result = await runInvestigation(model, record, now());
      const receipt = await issueReceipt(store, {
        kind: "EMPLOY_RUN",
        sessionId: session,
        ref: record.launchId,
        payload: result.receiptPayload,
        now: now(),
      });
      const stored = store.insertRun({
        sessionId: session,
        caseId: id,
        payload: JSON.stringify({ run: result.run, dossier: result.dossier, receipt, steps: result.steps }),
        now: now(),
      });
      store.log({ at: now(), sessionId: session, kind: "employ", ref: id, detail: result.run.receiptDigest });
      return json(201, {
        run: { ...result.run, id: stored.id, reused: false },
        steps: result.steps,
        dossier: result.dossier,
        receipt,
      });
    }

    if (path.startsWith("/api/runs/") && method === "GET") {
      const id = path.slice("/api/runs/".length);
      const session = requireSession(request);
      const run = store.getRun(id);
      if (!run || run.sessionId !== session) throw new ApiError(404, "RUN_NOT_FOUND", "No such run.");
      return json(200, JSON.parse(run.payload));
    }

    if (path.startsWith("/api/case/") && method === "GET") {
      const id = path.slice("/api/case/".length);
      const record = requiresRecord(model, id);
      const dossier = await buildDossier(model, record);
      const summary = caseSummary(model, record);
      const reads = model.observations.get(id) ?? [];
      const related = (model.byDeployer.get(record.deployer) ?? []).filter((item) => item.launchId !== id);
      return json(200, {
        dossier,
        case: summary,
        record: {
          launchId: record.launchId,
          factId: record.factId,
          token: record.token,
          txHash: record.txHash,
          deployer: record.deployer,
          block: record.blockNumber,
          name: record.name,
          symbol: record.symbol,
          metadata: record.metadata,
          priorLaunchCount: record.priorLaunchCount,
          position: record.position,
          scrapReads: reads.length,
        },
        capture: {
          id: record.captureId,
          checkpoint: record.captureCheckpoint,
          readAt: new Date(record.captureReadAt).toISOString(),
          state: record.captureState,
          recordCount: model.captures[record.captureIndex]?.recordCount ?? 0,
          digestVerified: model.captures[record.captureIndex]?.digestVerified ?? false,
          sourceKind: model.captures[record.captureIndex]?.source.kind ?? "PUBLIC_GET",
          sourceFile: model.captures[record.captureIndex]?.source.file ?? "",
        },
        reads: reads.map((item) => ({
          captureId: item.captureId,
          checkpoint: item.captureCheckpoint,
          block: item.blockNumber,
          priorLaunchCount: item.priorLaunchCount,
          readAt: new Date(item.captureReadAt).toISOString(),
          state: item.captureState,
        })),
        related: related.map((item) => caseSummary(model, item)),
        replay: buildReplay(model, record),
        pages: { pile: "/pile", tripwire: "/tripwire", manual: "/manual" },
      });
    }

    if (path.startsWith("/api/case/") && path.endsWith("/watch") && method === "POST") {
      const id = path.slice("/api/case/".length, -"/watch".length);
      const session = requireSession(request);
      const record = requiresRecord(model, id);
      const body = parseBody<{ note?: string }>(request);
      const note = (body.note ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
      const pinned = store.pinTripwire({
        sessionId: session,
        caseId: id,
        baselineCaptureId: record.captureId,
        note,
        now: now(),
      });
      const view = tripwireView(ctx, pinned.tripwire);
      return json(pinned.created ? 201 : 200, { tripwire: view, created: pinned.created });
    }

    if (path === "/api/tripwires" && method === "GET") {
      const session = sessionOf(request);
      const items = session ? store.listTripwires(session) : [];
      return json(200, { tripwires: items.map((item) => tripwireView(ctx, item)) });
    }

    if (path.startsWith("/api/tripwires/") && path.endsWith("/replay") && method === "POST") {
      const id = path.slice("/api/tripwires/".length, -"/replay".length);
      const session = requireSession(request);
      const tripwire = store.getTripwire(id);
      if (!tripwire || tripwire.sessionId !== session) throw new ApiError(404, "TRIPWIRE_NOT_FOUND", "No such tripwire.");
      if (tripwire.status !== "WATCHING") throw new ApiError(409, "TRIPWIRE_DROPPED", "This tripwire was cancelled.");
      const record = requiresRecord(model, tripwire.caseId);
      const replay = buildReplay(model, record);
      const issuedAt = new Date(now()).toISOString();
      const payload = {
        kind: "BINRAT_TRIPWIRE_REPLAY",
        schemaVersion: "binrat.den.tripwire-replay/1",
        product: "BINRAT: THE DEN",
        mode: "RECORDED_REPLAY",
        tripwireId: tripwire.id,
        caseId: record.launchId,
        deployer: record.deployer,
        baseline: replay.baseline,
        status: replay.status,
        laterCaptures: replay.laterCaptures,
        appearances: replay.appearances,
        delta: replay.delta,
        verdict: replay.verdict,
        networkCalls: 0,
        alertDelivered: false,
        issuedAt,
      };
      const receipt = await issueReceipt(store, {
        kind: "TRIPWIRE_REPLAY",
        sessionId: session,
        ref: tripwire.id,
        payload,
        now: now(),
      });
      store.insertReplay({
        tripwireId: tripwire.id,
        payload: JSON.stringify({ replay, receiptId: receipt.id, receiptDigest: receipt.digest }),
        now: now(),
      });
      store.log({ at: now(), sessionId: session, kind: "replay", ref: tripwire.id, detail: replay.status });
      return json(201, { replay, receipt, tripwire: tripwireView(ctx, { ...tripwire, updatedAt: now() }) });
    }

    if (path.startsWith("/api/tripwires/") && method === "DELETE") {
      const id = path.slice("/api/tripwires/".length);
      const session = requireSession(request);
      const tripwire = store.getTripwire(id);
      if (!tripwire || tripwire.sessionId !== session) throw new ApiError(404, "TRIPWIRE_NOT_FOUND", "No such tripwire.");
      const dropped = store.dropTripwire(id, now());
      store.log({ at: now(), sessionId: session, kind: "drop", ref: id, detail: "cancelled" });
      return json(200, { tripwire: dropped ? tripwireView(ctx, dropped) : null });
    }

    if (path === "/api/work-orders" && method === "POST") {
      const session = requireSession(request);
      const body = parseBody<{ scope?: string; note?: string }>(request);
      const scope = body.scope as WorkOrderScope | undefined;
      if (!scope || !SCOPES.includes(scope)) throw new ApiError(400, "SCOPE_INVALID", `scope must be one of ${SCOPES.join(", ")}.`);
      const note = (body.note ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 400);
      const order = store.insertWorkOrder({ sessionId: session, scope, note, now: now() });
      const receipt = await issueReceipt(store, {
        kind: "WORK_ORDER_INTEREST",
        sessionId: session,
        ref: order.id,
        payload: {
          kind: "BINRAT_WORK_ORDER_INTEREST",
          schemaVersion: "binrat.den.work-order/1",
          mode: "INTEREST_ONLY",
          reference: order.reference,
          scope: order.scope,
          note: order.note || null,
          paymentTaken: false,
          checkoutExists: false,
          entitlementGranted: false,
          createdAt: new Date(order.createdAt).toISOString(),
        },
        now: now(),
      });
      store.log({ at: now(), sessionId: session, kind: "work-order", ref: order.reference, detail: scope });
      return json(201, {
        order,
        receipt,
        position: store.workOrderPosition(),
        paymentTaken: false,
        boundary:
          "No checkout exists. Nothing was charged, no capacity was sold and no entitlement was granted. This order is a local interest record on your machine.",
        deliverable:
          "A bounded run would re-read the recorded windows for this file, write the findings it can support, list the unknowns and return one receipt with a digest you can verify.",
      });
    }

    if (path === "/api/work-orders" && method === "GET") {
      const session = sessionOf(request);
      return json(200, { orders: session ? store.listWorkOrders(session) : [], paymentTaken: false });
    }

    if (path === "/api/visit" && method === "POST") {
      const session = requireSession(request);
      parseBody(request);
      const visit = store.recordVisit(session, now());
      const watching = store.listTripwires(session).filter((item) => item.status === "WATCHING");
      const replayable = watching.map((item) => tripwireView(ctx, item)).filter((view) => view.replay?.status === "RECORDED_AGAIN").length;
      store.log({ at: now(), sessionId: session, kind: "visit", ref: null, detail: "den opened" });
      return json(200, {
        firstVisit: visit.previousSeen === null,
        previousSeenAt: visit.previousSeen === null ? null : new Date(visit.previousSeen).toISOString(),
        sinceMs: visit.previousSeen === null ? null : now() - visit.previousSeen,
        tripwires: { count: watching.length, replayable },
      });
    }

    if (path === "/api/method" && method === "GET") {
      return json(200, {
        product: PRODUCT,
        mode: PRODUCT.mode,
        rule: RECEIPT_DIGEST_RULE,
        canonicalization: model.manifest.canonicalization,
        captures: model.captures.map((capture) => ({
          id: capture.id,
          checkpoint: capture.checkpoint,
          checkpointBlockHash: capture.checkpointBlockHash,
          feedDigest: capture.feedDigest,
          readAt: capture.readAtIso,
          stamp: stamp(capture.readAtIso),
          state: capture.state,
          status: capture.status,
          records: capture.recordCount,
          sourceKind: capture.source.kind,
          origin: capture.source.origin,
          sourceFile: capture.source.file,
          sourceFileSha256: capture.source.fileSha256,
          packagedFile: capture.packaged.file,
          packagedSha256: capture.packaged.sha256,
          digestVerified: capture.digestVerified,
          note: capture.note,
        })),
        boundaries: [
          {
            id: "live",
            title: "There is no live feed in this build",
            text: "The Den opens six packaged captures recorded 08-09 OCT 2026. It never calls a provider, RPC or collector while you use it.",
            state: "NOT RUN",
          },
          {
            id: "replay",
            title: "Return is a recorded replay, not an alert",
            text: "A tripwire pins a baseline capture. What it shows you later is what later recorded windows already contain. No notification was delivered and no event is predicted.",
            state: "RECORDED",
          },
          {
            id: "claims",
            title: "Recurrence is not a verdict",
            text: "An address appearing often is a recorded fact. It is never presented as proof of a scam, a person, a profit or a future outcome.",
            state: "BOUNDARY",
          },
          {
            id: "metadata",
            title: "Blank names stay blank",
            text: "All 120 records were captured without a name or symbol. The Rat gives files handles derived from recorded fields, labelled as handles, never as token names.",
            state: "OBSERVED",
          },
          {
            id: "payment",
            title: "Nothing is for sale",
            text: "The front desk records interest locally. There is no checkout, no billing, no entitlement, no staking and no token.",
            state: "NOT CONNECTED",
          },
          {
            id: "coverage",
            title: "Coverage is partial and labelled so",
            text: "Each capture is a bounded 20-record window of chain 4663. Absence from these windows is not absence from the chain.",
            state: "PARTIAL",
          },
        ],
        capabilities: [
          { name: "Recorded evidence", state: "AVAILABLE", detail: `${model.summary.recordCount} window reads / ${model.summary.launchCount} distinct launches across ${model.summary.captureCount} captures; digests re-verified on boot.` },
          { name: "Case files", state: "AVAILABLE", detail: "Derived from recorded fields with a recomputable digest." },
          { name: "Employ the Rat", state: "LOCAL RUN", detail: "Deterministic local cross-check; zero network calls." },
          { name: "Tripwire replay", state: "RECORDED ONLY", detail: "Compares a pinned baseline with later packaged windows." },
          { name: "Live collector", state: "NOT RUN", detail: "Requires separate owner authorization and provider budget." },
          { name: "Telegram delivery", state: "NOT CONNECTED", detail: "No message is queued or sent by this build." },
          { name: "Payments / capacity", state: "NOT CONNECTED", detail: "No checkout, entitlement or staking." },
          { name: "$BINRAT", state: "NOT LAUNCHED", detail: "No token address or market claim exists." },
        ],
        assets: ctx.assets.assets,
        sourceWorktree: model.manifest.sourceWorktree,
        mounted: "den/",
      });
    }

    if (path.startsWith("/api/receipts/") && method === "GET") {
      const id = path.slice("/api/receipts/".length);
      const session = sessionOf(request);
      const found = await readReceipt(store, id);
      if (!found) throw new ApiError(404, "RECEIPT_NOT_FOUND", "No such receipt.");
      if (found.receipt.payload && store.getReceipt(id)?.sessionId && store.getReceipt(id)?.sessionId !== session) {
        throw new ApiError(404, "RECEIPT_NOT_FOUND", "No such receipt.");
      }
      return json(200, { ...found, rule: RECEIPT_DIGEST_RULE });
    }

    if (path.startsWith("/api/")) throw new ApiError(404, "NOT_FOUND", "No such API route.");
    throw new ApiError(404, "NOT_FOUND", "Not found.");
  }

  return { handle: (request) => api.handle(request), model, store };
}

export async function createDefaultApp(options: { model: EvidenceModel; store: Store; now?: () => number }) {
  const assets = await loadAssets();
  return createDenApp({ ...options, assets });
}

export type { CaseSummary };
