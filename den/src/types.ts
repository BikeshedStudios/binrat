export type Capture = {
  id: string;
  checkpoint: string;
  readAt: string;
  state: string;
  records: number;
  kind: "PUBLIC_GET" | "READ_ONLY_D1";
  origin: string;
  digest: string;
  digestVerified: boolean;
};

export type EvidenceSummary = {
  captureCount: number;
  recordCount: number;
  launchCount: number;
  rereadEntries: number;
  uniqueDeployers: number;
  crossWindowDeployers: number;
  blankMetadataRecords: number;
  namedRecords: number;
  firstReadAt: string;
  lastReadAt: string;
  spanHours: number;
  firstCheckpoint: string;
  lastCheckpoint: string;
  checkpointSpan: string;
  allDigestsVerified: boolean;
  coverage: "PARTIAL";
  mode: "RECORDED_REPLAY";
  chainId: 4663;
};

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
  tags: string[];
  metadataFilled: number;
};

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
  digest: { digest: string; basis: string; material: unknown };
};

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

export type Receipt = {
  id: string;
  kind: string;
  issuedAt: string;
  digest: string;
  payload: Record<string, unknown>;
  ref: string | null;
};

export type Tripwire = {
  id: string;
  status: "WATCHING" | "DROPPED";
  pinnedAt: string;
  updatedAt: string;
  note: string;
  unavailable: boolean;
  case: CaseSummary | null;
  replay: ReplayView | null;
  lastReplay: { id: string; createdAt: string; digest: string } | null;
};

export type DenPayload = {
  product: { name: string; tagline: string; ratName: string; version: string; mode: string };
  mode: "RECORDED_REPLAY";
  evidence: EvidenceSummary & { sources: Capture[] };
  lead: CaseSummary & {
    dossierHeadline: string;
    dossierDeck: string;
    movement: {
      windows: number;
      records: number;
      from: number;
      to: number;
      delta: number;
      fromBlock: string;
      toBlock: string;
      fromReadAt: string;
      toReadAt: string;
      fromCapture: string;
      toCapture: string;
    } | null;
    replay: ReplayView;
    stamp: string;
  };
  counters: {
    scraps: number;
    uniqueDeployers: number;
    repeaters: number;
    blankNames: number;
    lenses: number;
  };
  tripwires: {
    count: number;
    replayable: number;
    dropped: number;
    lastReplayAt: string | null;
    lastReplayDigest: string | null;
  };
  visit: { firstVisit: boolean; previousSeenAt: string | null };
  limits: Array<{ label: string; state: string; note: string }>;
};

export type PilePayload = {
  lenses: Array<{ id: "scent" | "fresh" | "longest"; label: string; hint: string }>;
  lens: "scent" | "fresh" | "longest";
  query: string;
  total: number;
  matched: number;
  rows: Array<CaseSummary & { rank: number }>;
  after: string | null;
};

export type CasePayload = {
  dossier: Dossier;
  case: CaseSummary;
  record: {
    launchId: string;
    factId: string;
    token: string;
    txHash: string;
    deployer: string;
    block: string;
    name: string;
    symbol: string;
    metadata: Record<string, string>;
    priorLaunchCount: number;
    position: number;
    scrapReads: number;
  };
  capture: {
    id: string;
    checkpoint: string;
    readAt: string;
    state: string;
    recordCount: number;
    digestVerified: boolean;
    sourceKind: "PUBLIC_GET" | "READ_ONLY_D1";
    sourceFile: string;
  };
  reads: Array<{
    captureId: string;
    checkpoint: string;
    block: string;
    priorLaunchCount: number;
    readAt: string;
    state: string;
  }>;
  related: CaseSummary[];
  replay: ReplayView;
  pages: { pile: string; tripwire: string; manual: string };
};

export type EmployStep = { id: string; label: string; detail: string };

export type EmployResponse = {
  run: {
    id: string;
    caseId: string;
    status: "COMPLETE";
    startedAt: string;
    completedAt: string;
    pacing: "PRESENTATION_ONLY";
    pacingNote: string;
    scan: {
      capturesScanned: number;
      recordsScanned: number;
      uniqueDeployers: number;
      windowsWithAddress: number;
      metadataFieldsFilled: number;
    };
    headline: string;
    digest: string;
    receiptDigest: string;
    reused: boolean;
  };
  steps: EmployStep[];
  dossier: Dossier;
  receipt: Receipt;
  reused?: boolean;
};

export type MethodPayload = {
  product: { name: string; tagline: string; version: string };
  mode: string;
  rule: string;
  canonicalization: string;
  captures: Array<{
    id: string;
    checkpoint: string;
    checkpointBlockHash: string;
    feedDigest: string;
    readAt: string;
    stamp: string;
    state: string;
    status: { state: string | null; verifiedAt: string | null; publicationVersion: number | null; lastSyncError: string | null } | null;
    records: number;
    sourceKind: string;
    origin: string;
    sourceFile: string;
    sourceFileSha256: string;
    packagedFile: string;
    packagedSha256: string;
    digestVerified: boolean;
    note: string;
  }>;
  boundaries: Array<{ id: string; title: string; text: string; state: string }>;
  capabilities: Array<{ name: string; state: string; detail: string }>;
  assets: Array<{ id: string; path: string; kind: string; origin: string; sha256: string; rights: string; change?: string }>;
  sourceWorktree: { path: string; head: string; branch: string; note: string };
  mounted: string;
};

export type WorkOrderResponse = {
  order: {
    id: string;
    reference: string;
    scope: string;
    note: string;
    status: string;
    createdAt: number;
  };
  receipt: Receipt;
  position: number;
  paymentTaken: false;
  boundary: string;
  deliverable: string;
};


export type CanonicalCasePayload = {
  mode: "PINNED_HISTORICAL_CAPTURE";
  liveData: false;
  watchAvailable: false;
  replayAvailable: false;
  caseId: string;
  chainId: 4663;
  source: "PONS_V2";
  launchBlock: string;
  token: string;
  txHash: string;
  reportedDeployer: string;
  sourceFactId: string;
  priorIndexedCount: number;
  previous: Array<{ id: string; block: string; sourceFactId: string }>;
  coverage: { mode: string; history: "PARTIAL"; resultLimit: number; countScope: string; olderHistory: string };
  reconstruction: "PUBLISHED_CHECKPOINT_RECONSTRUCTION";
  archivedPublication: false;
  pointInTimeReplay: false;
  checkpoint: { chainId: 4663; checkpointBlock: string; checkpointBlockHash: string; feedDigest: string; publicationVersion: number; verifiedAtMs: number };
  digest: string;
  verification: "CANONICAL_VALIDATOR_AND_FIXED_CAPTURE_PIN";
  evidenceFile: string;
  caveat: string;
};
