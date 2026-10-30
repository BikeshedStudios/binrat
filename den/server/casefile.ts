import { canonicalJson, sha256Hex } from "./canonical.ts";
import {
  appearancesOf,
  metadataFilled,
  ratHandle,
  type Capture,
  type EvidenceModel,
  type RecordRow,
} from "./evidence.ts";

export const PRODUCT = {
  name: "BINRAT: THE DEN",
  short: "BINRAT",
  tagline: "THE RAT REMEMBERS.",
  ratName: "RAT ZERO",
  version: "den/0.1",
  mode: "RECORDED_REPLAY",
} as const;

export function shortAddress(value: string, lead = 6, tail = 4): string {
  if (!value.startsWith("0x") || value.length < lead + tail + 4) return value;
  return `${value.slice(0, 2 + lead)}…${value.slice(-tail)}`;
}

export function shortId(value: string): string {
  return value.slice(0, 8);
}

const iso = (value: string) => new Date(value).toISOString().replace(".000Z", "Z");

export type CaseTags = string[];

export type CaseSummary = {
  caseId: string;
  handle: string;
  handleBasis: string;
  fileNumber: string;
  deployer: string;
  deployerShort: string;
  token: string;
  tokenShort: string;
  block: string;
  symbol: string;
  name: string;
  priorLaunchCount: number;
  captureId: string;
  captureIndex: number;
  captureCheckpoint: string;
  captureReadAt: string;
  captureState: string;
  windows: number;
  appearances: number;
  scrapReads: number;
  priorDelta: number;
  tags: CaseTags;
  metadataFilled: number;
};

export function captureOf(model: EvidenceModel, record: RecordRow): Capture {
  const capture = model.captures[record.captureIndex];
  if (!capture) throw new Error("CAPTURE_MISSING");
  return capture;
}

export function caseSummary(model: EvidenceModel, record: RecordRow): CaseSummary {
  const handle = ratHandle(model, record);
  const appearances = appearancesOf(model, record.deployer);
  const windows = new Set(appearances.map((item) => item.captureId)).size;
  const filled = metadataFilled(record);
  const reads = model.observations.get(record.launchId)?.length ?? 1;
  const counts = appearances.map((item) => item.priorLaunchCount);
  const priorDelta = counts.length > 1 ? Math.max(...counts) - Math.min(...counts) : 0;
  const tags: CaseTags = [];
  if (windows >= 2) tags.push("RECORDED AGAIN");
  if (record.priorLaunchCount >= 10) tags.push("LONG RECORD");
  if (filled === 0) tags.push("NO NAME");
  if (reads > 1) tags.push(`READ ${reads}×`);
  if (record.captureState === "STALE_VERIFIED") tags.push("STALE AT CAPTURE");
  return {
    caseId: record.launchId,
    handle: handle.handle,
    handleBasis: handle.basis,
    fileNumber: record.blockNumber,
    deployer: record.deployer,
    deployerShort: shortAddress(record.deployer),
    token: record.token,
    tokenShort: shortAddress(record.token),
    block: record.blockNumber,
    symbol: record.symbol,
    name: record.name,
    priorLaunchCount: record.priorLaunchCount,
    captureId: record.captureId,
    captureIndex: record.captureIndex,
    captureCheckpoint: record.captureCheckpoint,
    captureReadAt: iso(record.captureReadAt),
    captureState: record.captureState,
    windows,
    appearances: appearances.length,
    scrapReads: reads,
    priorDelta,
    tags,
    metadataFilled: filled,
  };
}

export type CaseDigest = {
  digest: string;
  basis: string;
  material: unknown;
};

export async function caseDigest(model: EvidenceModel, record: RecordRow): Promise<CaseDigest> {
  const appearances = appearancesOf(model, record.deployer);
  const captures = [...new Set(appearances.map((item) => item.captureId))]
    .map((id) => model.captures.find((capture) => capture.id === id))
    .filter((capture): capture is Capture => Boolean(capture))
    .map((capture) => ({ captureId: capture.id, feedDigest: capture.feedDigest, checkpoint: capture.checkpoint }));
  const material = {
    caseId: record.launchId,
    deployer: record.deployer,
    token: record.token,
    block: record.blockNumber,
    txHash: record.txHash,
    factId: record.factId,
    captures,
  };
  return {
    digest: await sha256Hex(canonicalJson(material)),
    basis:
      "SHA-256 over this file's recorded fields plus the feed digests of every capture it appears in. Recompute it in your browser from the receipts panel.",
    material,
  };
}

export type Finding = {
  id: string;
  kind: "OBSERVED" | "DERIVED" | "COVERAGE" | "UNKNOWN";
  title: string;
  text: string;
};

export type Dossier = {
  caseId: string;
  handle: string;
  fileNumber: string;
  headline: string;
  deck: string;
  findings: Finding[];
  unknowns: string[];
  nextActions: Array<{ id: string; label: string; hint: string }>;
  coverage: {
    captures: number;
    records: number;
    windowsWithAddress: number;
    metadataFieldsFilled: number;
    coverage: "PARTIAL";
  };
  digest: CaseDigest;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function stamp(isoValue: string): string {
  const date = new Date(isoValue);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ${hours}:${minutes} UTC`;
}

export async function buildDossier(model: EvidenceModel, record: RecordRow): Promise<Dossier> {
  const summary = caseSummary(model, record);
  const capture = captureOf(model, record);
  const appearances = appearancesOf(model, record.deployer);
  const distinctCaptures = [...new Set(appearances.map((item) => item.captureId))];
  const laterCaptures = model.captures.filter((capture) => capture.checkpoint > record.captureCheckpoint);
  const laterAppearances = appearances.filter((item) => item.captureCheckpoint > record.captureCheckpoint);
  const first = appearances[0];
  const last = appearances[appearances.length - 1];
  const findings: Finding[] = [];

  if (distinctCaptures.length >= 2) {
    findings.push({
      id: "recurrence",
      kind: "OBSERVED",
      title: "The same address is on record more than once",
      text: `Reported deployer ${summary.deployerShort} appears in ${distinctCaptures.length} of ${model.captures.length} captures: block ${first?.blockNumber} read ${stamp(first?.captureReadAt ?? record.captureReadAt)}, and block ${last?.blockNumber} read ${stamp(last?.captureReadAt ?? record.captureReadAt)}.`,
    });
    const earliest = appearances[0]?.priorLaunchCount ?? record.priorLaunchCount;
    const latest = appearances[appearances.length - 1]?.priorLaunchCount ?? record.priorLaunchCount;
    if (latest !== earliest) {
      findings.push({
        id: "prior-moved",
        kind: "DERIVED",
        title: "Its recorded prior-launch count moved",
        text: `The recorded prior-launch count for this address was ${earliest} at the first capture and ${latest} at the last — a difference of ${latest - earliest} earlier launches on the same address's record. Both numbers are recorded values from packaged captures; neither is a rate the Rat measured.`,
      });
    } else {
      findings.push({
        id: "prior-held",
        kind: "DERIVED",
        title: "Its recorded count held still",
        text: `The recorded prior-launch count was ${latest} in every capture that contains this address. The Rat saw the same number twice, which is not the same as seeing nothing happen.`,
      });
    }
  } else {
    findings.push({
      id: "single-window",
      kind: "OBSERVED",
      title: "This address appears in one recorded window",
      text: `Reported deployer ${summary.deployerShort} appears once across the ${model.captures.length} recorded windows. ${laterCaptures.length > 0 ? `It is absent from the ${laterCaptures.length} later window${laterCaptures.length === 1 ? "" : "s"} (${laterCaptures.reduce((n, capture) => n + capture.recordCount, 0)} records), which is not the same as absent from the chain.` : "There are no later recorded windows to compare against yet."}`,
    });
  }

  findings.push({
    id: "no-name",
    kind: "OBSERVED",
    title: "No name was in the record",
    text:
      summary.metadataFilled === 0
        ? "Name, symbol, website, X, Telegram and image were all empty when this window was read. The Rat keeps the address and the receipt; it does not invent a token name."
        : `The capture held ${summary.metadataFilled} of 6 naming and social fields. Everything else was empty at read time.`,
  });

  findings.push({
    id: "prior-count",
    kind: "DERIVED",
    title: `The recorded prior-launch count is ${record.priorLaunchCount}`,
    text:
      record.priorLaunchCount === 0
        ? "Pons reported no earlier indexed launch for this address at capture time. That is a statement about the index at that block, not about the operator."
        : `Pons reported ${record.priorLaunchCount} earlier indexed launches for this address at capture time. BINRAT re-verifies the feed digest; it does not independently recount the provider's history.`,
  });

  const reads = model.observations.get(record.launchId) ?? [];
  if (reads.length > 1) {
    const counts = reads.map((item) => item.priorLaunchCount);
    const stable = new Set(counts).size === 1;
    findings.push({
      id: "reread",
      kind: "OBSERVED",
      title: `The same scrap was read ${reads.length} times`,
      text: `${reads.map((item) => `${item.captureId} at block ${item.captureCheckpoint}`).join(", ")}: ${
        stable
          ? `the recorded prior-launch count was ${counts[0]} every time.`
          : `the recorded prior-launch count went ${counts.join(" → ")}.`
      } A re-read is not a new launch.`,
    });
  }

  findings.push({
    id: "window",
    kind: "COVERAGE",
    title: "This file is one scrap in a bounded window",
    text: `Position ${record.position + 1} of ${capture.recordCount} in ${record.captureId}, a ${capture.recordCount}-record window ending at block ${record.captureCheckpoint}. ${model.summary.recordCount} records were recorded across ${model.captures.length} captures; coverage is PARTIAL and always will be at this size.`,
  });

  if (laterCaptures.length > 0) {
    findings.push({
      id: "later",
      kind: laterAppearances.length > 0 ? "DERIVED" : "COVERAGE",
      title:
        laterAppearances.length > 0
          ? "Later captures recorded it again"
          : "Later captures did not record it",
      text:
        laterAppearances.length > 0
          ? `${laterAppearances.length} later record${laterAppearances.length === 1 ? "" : "s"} across ${new Set(laterAppearances.map((item) => item.captureId)).size} capture${new Set(laterAppearances.map((item) => item.captureId)).size === 1 ? "" : "s"} ${laterAppearances.length === 1 ? "carries" : "carry"} the same reported deployer address. Pin this file and the Rat can replay that recorded trail.`
          : `The address does not appear in the ${laterCaptures.length} later recorded window${laterCaptures.length === 1 ? "" : "s"}. Absence inside a partial index is not a clean bill.`,
    });
  }

  const headline =
    distinctCaptures.length >= 2
      ? "The same address came back."
      : record.priorLaunchCount >= 10
        ? "An address with a long record."
        : "One scrap, one address, no name.";
  const deck =
    distinctCaptures.length >= 2
      ? `Recorded in ${distinctCaptures.length} of ${model.captures.length} windows. The Rat can show you exactly what changed between them.`
      : `Recorded once in ${model.summary.recordCount} scraps. The receipts are short, and the Rat will not pad them.`;

  return {
    caseId: record.launchId,
    handle: summary.handle,
    fileNumber: summary.fileNumber,
    headline,
    deck,
    findings,
    unknowns: [
      "Who controls the address, and whether that ever changes.",
      "Whether anyone trades, holds or uses what was launched.",
      "Intent, safety or profitability. Recurrence is not a verdict.",
      `What happened outside these ${model.captures.length} windows: ${model.summary.recordCount} records are not a chain.`,
    ],
    nextActions: [
      { id: "employ", label: "EMPLOY THE RAT", hint: "Cross-check all recorded windows and get a receipt." },
      { id: "watch", label: "LEAVE A TRIPWIRE", hint: "Pin this file; replay what later captures recorded." },
      { id: "method", label: "READ THE FIELD MANUAL", hint: "What is recorded, what is live, what is unknown." },
    ],
    coverage: {
      captures: model.captures.length,
      records: model.summary.recordCount,
      windowsWithAddress: distinctCaptures.length,
      metadataFieldsFilled: summary.metadataFilled,
      coverage: "PARTIAL",
    },
    digest: await caseDigest(model, record),
  };
}

export type ReplayAppearance = {
  caseId: string;
  captureId: string;
  checkpoint: string;
  block: string;
  priorLaunchCount: number;
  readAt: string;
  state: string;
  sameScrap: boolean;
};

export type ReplayView = {
  status: "RECORDED_AGAIN" | "REREAD_ONLY" | "NO_LATER_RECORD" | "NO_LATER_CAPTURES";
  baseline: {
    caseId: string;
    captureId: string;
    checkpoint: string;
    readAt: string;
    priorLaunchCount: number;
  };
  laterCaptures: Array<{ id: string; checkpoint: string; readAt: string; records: number }>;
  captures: Array<{ id: string; checkpoint: string; readAt: string; records: number }>;
  appearances: ReplayAppearance[];
  delta: {
    priorLaunchCount: number;
    checkpointBlocks: string;
    elapsedHours: number;
    laterRecordsScanned: number;
    laterWindows: number;
  } | null;
  newLaunches: number;
  rereadWindows: number;
  verdict: string;
  honestNote: string;
};

export function buildReplay(model: EvidenceModel, record: RecordRow): ReplayView {
  const appearances = appearancesOf(model, record.deployer);
  const laterCaptures = model.captures.filter((capture) => capture.checkpoint > record.captureCheckpoint);
  const laterAppearances = appearances.filter((item) => item.captureCheckpoint > record.captureCheckpoint);
  const laterRecordsScanned = laterCaptures.reduce((total, capture) => total + capture.recordCount, 0);
  const newLaunches = laterAppearances.filter((item) => item.launchId !== record.launchId);
  const rereads = laterAppearances.filter((item) => item.launchId === record.launchId);
  const laterWindows = new Set(newLaunches.map((item) => item.captureId)).size;
  const rereadWindows = new Set(rereads.map((item) => item.captureId)).size;
  const latestNew = newLaunches[newLaunches.length - 1];
  const delta = latestNew
    ? {
        priorLaunchCount: latestNew.priorLaunchCount - record.priorLaunchCount,
        checkpointBlocks: (BigInt(latestNew.captureCheckpoint) - BigInt(record.captureCheckpoint)).toString(),
        elapsedHours: Math.round(
          (new Date(latestNew.captureReadAt).getTime() - new Date(record.captureReadAt).getTime()) / 3_600_000,
        ),
        laterRecordsScanned,
        laterWindows,
      }
    : null;
  const status: ReplayView["status"] =
    laterCaptures.length === 0
      ? "NO_LATER_CAPTURES"
      : newLaunches.length > 0
        ? "RECORDED_AGAIN"
        : rereads.length > 0
          ? "REREAD_ONLY"
          : "NO_LATER_RECORD";

  return {
    status,
    baseline: {
      caseId: record.launchId,
      captureId: record.captureId,
      checkpoint: record.captureCheckpoint,
      readAt: iso(record.captureReadAt),
      priorLaunchCount: record.priorLaunchCount,
    },
    captures: model.captures.map((capture) => ({
      id: capture.id,
      checkpoint: capture.checkpoint,
      readAt: iso(capture.readAtIso),
      records: capture.recordCount,
    })),
    laterCaptures: laterCaptures.map((capture) => ({
      id: capture.id,
      checkpoint: capture.checkpoint,
      readAt: iso(capture.readAtIso),
      records: capture.recordCount,
    })),
    appearances: laterAppearances.map((item) => ({
      caseId: item.launchId,
      captureId: item.captureId,
      checkpoint: item.captureCheckpoint,
      block: item.blockNumber,
      priorLaunchCount: item.priorLaunchCount,
      readAt: iso(item.captureReadAt),
      state: item.captureState,
      sameScrap: item.launchId === record.launchId,
    })),
    delta,
    newLaunches: newLaunches.length,
    rereadWindows,
    verdict:
      status === "RECORDED_AGAIN"
        ? `RECORDED AGAIN · ${newLaunches.length} later launch${newLaunches.length === 1 ? "" : "es"} from the same address in ${laterWindows} window${laterWindows === 1 ? "" : "s"}`
        : status === "REREAD_ONLY"
          ? `RE-READ ONLY · the same scrap was swept again in ${rereadWindows} later window${rereadWindows === 1 ? "" : "s"}; no new launch`
          : status === "NO_LATER_RECORD"
            ? `NO LATER RECORD · scanned ${laterRecordsScanned} records in ${laterCaptures.length} later window${laterCaptures.length === 1 ? "" : "s"}`
            : "NO LATER CAPTURES · this file sits in the newest window",
    honestNote:
      "This is a replay of already-recorded windows. No collector ran, nothing was fetched, and no alert was delivered. A later window is evidence, not a notification.",
  };
}

/**
 * Deterministic lead: the address whose recorded count moved the most, pinned at its first
 * appearance so a tripwire on it can be replayed forward. Ties break on window count.
 */
export function findLead(model: EvidenceModel): RecordRow {
  const groups = [...model.byDeployer.entries()].map(([deployer, rows]) => {
    const windows = new Set(rows.map((row) => row.captureId)).size;
    const counts = rows.map((row) => row.priorLaunchCount);
    const delta = Math.max(...counts) - Math.min(...counts);
    const first = [...rows].sort((a, b) => (BigInt(a.captureCheckpoint) < BigInt(b.captureCheckpoint) ? -1 : 1))[0];
    return { deployer, rows, windows, delta, maxCount: Math.max(...counts), first };
  });
  groups.sort(
    (a, b) =>
      b.delta - a.delta ||
      b.windows - a.windows ||
      b.maxCount - a.maxCount ||
      (BigInt(b.first.captureCheckpoint) < BigInt(a.first.captureCheckpoint) ? -1 : 1),
  );
  const best = groups[0];
  if (!best) throw new Error("EVIDENCE_EMPTY");
  return model.byLaunchId.get(best.first.launchId) ?? best.first;
}

export type LensId = "scent" | "fresh" | "longest";

export const LENSES: Array<{ id: LensId; label: string; hint: string }> = [
  { id: "scent", label: "SMELLS FAMILIAR", hint: "Addresses the Rat recorded in more than one window." },
  { id: "fresh", label: "LATEST SCRAPS", hint: "Newest recorded blocks first." },
  { id: "longest", label: "LONGEST RECORD", hint: "Highest recorded prior-launch count first." },
];

export type PileRow = CaseSummary & { rank: number };

export function buildPile(
  model: EvidenceModel,
  options: { lens: LensId; query: string; limit: number; offset: number },
): { rows: PileRow[]; total: number; matched: number } {
  const scored = model.launches.map((record) => ({ record, summary: caseSummary(model, record) }));
  const query = options.query.trim().toLowerCase();
  const filtered = query
    ? scored.filter(({ record, summary }) =>
        [record.launchId, record.deployer, record.token, record.txHash, record.blockNumber, summary.handle]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : scored;
  const sorted = [...filtered].sort((a, b) => {
    if (options.lens === "scent") {
      return (
        b.summary.priorDelta - a.summary.priorDelta ||
        b.summary.windows - a.summary.windows ||
        a.record.captureIndex - b.record.captureIndex ||
        a.record.position - b.record.position
      );
    }
    if (options.lens === "longest") {
      return (
        b.summary.priorLaunchCount - a.summary.priorLaunchCount ||
        (BigInt(b.record.blockNumber) < BigInt(a.record.blockNumber) ? -1 : 1)
      );
    }
    return (
      b.record.captureIndex - a.record.captureIndex ||
      a.record.position - b.record.position
    );
  });
  const rows = sorted
    .slice(options.offset, options.offset + options.limit)
    .map(({ summary }, index) => ({ ...summary, rank: options.offset + index + 1 }));
  return { rows, total: model.launches.length, matched: sorted.length };
}
