import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type RunRow = {
  id: string;
  sessionId: string;
  caseId: string;
  status: "COMPLETE";
  createdAt: number;
  completedAt: number;
  payload: string;
};

export type TripwireRow = {
  id: string;
  sessionId: string;
  caseId: string;
  note: string;
  status: "WATCHING" | "DROPPED";
  baselineCaptureId: string;
  createdAt: number;
  updatedAt: number;
};

export type ReplayRow = {
  id: string;
  tripwireId: string;
  createdAt: number;
  payload: string;
};

export type ReceiptRow = {
  id: string;
  kind: string;
  sessionId: string | null;
  ref: string | null;
  createdAt: number;
  digest: string;
  payload: string;
};

export type WorkOrderRow = {
  id: string;
  reference: string;
  sessionId: string;
  scope: string;
  note: string;
  status: "INTEREST_RECORDED";
  createdAt: number;
};

type Row = Record<string, unknown>;

const asString = (value: unknown) => String(value ?? "");

export type Store = ReturnType<typeof openStore>;

export function openStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    pragma journal_mode = wal;
    create table if not exists runs (
      id text primary key,
      session_id text not null,
      case_id text not null,
      status text not null,
      created_at integer not null,
      completed_at integer not null,
      payload text not null
    );
    create index if not exists runs_session_case on runs(session_id, case_id, status);
    create table if not exists tripwires (
      id text primary key,
      session_id text not null,
      case_id text not null,
      note text not null default '',
      status text not null,
      baseline_capture_id text not null,
      created_at integer not null,
      updated_at integer not null,
      unique(session_id, case_id)
    );
    create table if not exists replays (
      id text primary key,
      tripwire_id text not null,
      created_at integer not null,
      payload text not null
    );
    create index if not exists replays_tripwire on replays(tripwire_id, created_at);
    create table if not exists receipts (
      id text primary key,
      kind text not null,
      session_id text,
      ref text,
      created_at integer not null,
      digest text not null,
      payload text not null
    );
    create table if not exists work_orders (
      id text primary key,
      reference text not null,
      session_id text not null,
      scope text not null,
      note text not null,
      status text not null,
      created_at integer not null
    );
    create table if not exists visits (
      session_id text primary key,
      first_seen integer not null,
      last_seen integer not null
    );
    create table if not exists events (
      id integer primary key autoincrement,
      at integer not null,
      session_id text,
      kind text not null,
      ref text,
      detail text
    );
  `);

  const runGet = db.prepare("select * from runs where id = ?");
  const runFindComplete = db.prepare(
    "select * from runs where session_id = ? and case_id = ? and status = 'COMPLETE' order by created_at desc limit 1",
  );
  const runInsert = db.prepare(
    "insert into runs (id, session_id, case_id, status, created_at, completed_at, payload) values (?, ?, ?, ?, ?, ?, ?)",
  );
  const tripGet = db.prepare("select * from tripwires where id = ?");
  const tripFind = db.prepare("select * from tripwires where session_id = ? and case_id = ?");
  const tripList = db.prepare("select * from tripwires where session_id = ? order by created_at desc");
  const tripInsert = db.prepare(
    "insert into tripwires (id, session_id, case_id, note, status, baseline_capture_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const tripRevive = db.prepare(
    "update tripwires set status = 'WATCHING', note = ?, baseline_capture_id = ?, updated_at = ? where id = ?",
  );
  const tripDrop = db.prepare("update tripwires set status = 'DROPPED', updated_at = ? where id = ?");
  const tripCount = db.prepare("select count(*) as n from tripwires where session_id = ? and status = 'WATCHING'");
  const replayInsert = db.prepare("insert into replays (id, tripwire_id, created_at, payload) values (?, ?, ?, ?)");
  const replayList = db.prepare("select * from replays where tripwire_id = ? order by created_at desc");
  const receiptInsert = db.prepare(
    "insert into receipts (id, kind, session_id, ref, created_at, digest, payload) values (?, ?, ?, ?, ?, ?, ?)",
  );
  const receiptGet = db.prepare("select * from receipts where id = ?");
  const orderInsert = db.prepare(
    "insert into work_orders (id, reference, session_id, scope, note, status, created_at) values (?, ?, ?, ?, ?, ?, ?)",
  );
  const orderGet = db.prepare("select * from work_orders where id = ?");
  const orderCount = db.prepare("select count(*) as n from work_orders");
  const orderList = db.prepare("select * from work_orders where session_id = ? order by created_at desc");
  const visitGet = db.prepare("select * from visits where session_id = ?");
  const visitUpsert = db.prepare(
    "insert into visits (session_id, first_seen, last_seen) values (?, ?, ?) on conflict(session_id) do update set last_seen = excluded.last_seen",
  );
  const eventInsert = db.prepare(
    "insert into events (at, session_id, kind, ref, detail) values (?, ?, ?, ?, ?)",
  );

  const mapRun = (row: Row): RunRow => ({
    id: asString(row.id),
    sessionId: asString(row.session_id),
    caseId: asString(row.case_id),
    status: asString(row.status) as RunRow["status"],
    createdAt: Number(row.created_at),
    completedAt: Number(row.completed_at),
    payload: asString(row.payload),
  });
  const mapTripwire = (row: Row): TripwireRow => ({
    id: asString(row.id),
    sessionId: asString(row.session_id),
    caseId: asString(row.case_id),
    note: asString(row.note),
    status: asString(row.status) as TripwireRow["status"],
    baselineCaptureId: asString(row.baseline_capture_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  });
  const mapReceipt = (row: Row): ReceiptRow => ({
    id: asString(row.id),
    kind: asString(row.kind),
    sessionId: row.session_id == null ? null : asString(row.session_id),
    ref: row.ref == null ? null : asString(row.ref),
    createdAt: Number(row.created_at),
    digest: asString(row.digest),
    payload: asString(row.payload),
  });
  const mapOrder = (row: Row): WorkOrderRow => ({
    id: asString(row.id),
    reference: asString(row.reference),
    sessionId: asString(row.session_id),
    scope: asString(row.scope),
    note: asString(row.note),
    status: asString(row.status) as WorkOrderRow["status"],
    createdAt: Number(row.created_at),
  });

  return {
    path,
    close() {
      db.close();
    },
    peekVisit(sessionId: string) {
      const existing = visitGet.get(sessionId) as Row | undefined;
      return existing ? { firstSeen: Number(existing.first_seen), lastSeen: Number(existing.last_seen) } : null;
    },
    recordVisit(sessionId: string, now: number) {
      const existing = visitGet.get(sessionId) as Row | undefined;
      const firstSeen = existing ? Number(existing.first_seen) : now;
      const previousSeen = existing ? Number(existing.last_seen) : null;
      visitUpsert.run(sessionId, firstSeen, now);
      return { firstSeen, previousSeen };
    },
    insertRun(input: { sessionId: string; caseId: string; payload: string; now: number }) {
      const id = `run_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      runInsert.run(id, input.sessionId, input.caseId, "COMPLETE", input.now, input.now, input.payload);
      return mapRun(runGet.get(id) as Row);
    },
    findCompletedRun(sessionId: string, caseId: string) {
      const row = runFindComplete.get(sessionId, caseId) as Row | undefined;
      return row ? mapRun(row) : null;
    },
    getRun(id: string) {
      const row = runGet.get(id) as Row | undefined;
      return row ? mapRun(row) : null;
    },
    pinTripwire(input: {
      sessionId: string;
      caseId: string;
      baselineCaptureId: string;
      note: string;
      now: number;
    }) {
      const existing = tripFind.get(input.sessionId, input.caseId) as Row | undefined;
      if (existing) {
        const row = mapTripwire(existing);
        if (row.status === "DROPPED") {
          tripRevive.run(input.note, input.baselineCaptureId, input.now, row.id);
          return { tripwire: mapTripwire(tripGet.get(row.id) as Row), created: false };
        }
        return { tripwire: row, created: false };
      }
      const id = `tw_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
      tripInsert.run(id, input.sessionId, input.caseId, input.note, "WATCHING", input.baselineCaptureId, input.now, input.now);
      return { tripwire: mapTripwire(tripGet.get(id) as Row), created: true };
    },
    listTripwires(sessionId: string) {
      return (tripList.all(sessionId) as Row[]).map(mapTripwire);
    },
    getTripwire(id: string) {
      const row = tripGet.get(id) as Row | undefined;
      return row ? mapTripwire(row) : null;
    },
    dropTripwire(id: string, now: number) {
      tripDrop.run(now, id);
      const row = tripGet.get(id) as Row | undefined;
      return row ? mapTripwire(row) : null;
    },
    countWatching(sessionId: string) {
      return Number((tripCount.get(sessionId) as Row).n);
    },
    insertReplay(input: { tripwireId: string; payload: string; now: number }) {
      const id = `rpl_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
      replayInsert.run(id, input.tripwireId, input.now, input.payload);
      return { id, tripwireId: input.tripwireId, createdAt: input.now, payload: input.payload };
    },
    listReplays(tripwireId: string) {
      return (replayList.all(tripwireId) as Row[]).map((row) => ({
        id: asString(row.id),
        tripwireId: asString(row.tripwire_id),
        createdAt: Number(row.created_at),
        payload: asString(row.payload),
      })) as ReplayRow[];
    },
    insertReceipt(input: { id: string; kind: string; sessionId: string | null; ref: string | null; digest: string; payload: string; now: number }) {
      receiptInsert.run(input.id, input.kind, input.sessionId, input.ref, input.now, input.digest, input.payload);
      return mapReceipt(receiptGet.get(input.id) as Row);
    },
    getReceipt(id: string) {
      const row = receiptGet.get(id) as Row | undefined;
      return row ? mapReceipt(row) : null;
    },
    insertWorkOrder(input: { sessionId: string; scope: string; note: string; now: number }) {
      const id = `wo_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
      const sequence = Number((orderCount.get() as Row).n) + 1;
      const reference = `DEN-WO-${String(sequence).padStart(4, "0")}`;
      orderInsert.run(id, reference, input.sessionId, input.scope, input.note, "INTEREST_RECORDED", input.now);
      return mapOrder(orderGet.get(id) as Row);
    },
    getWorkOrder(id: string) {
      const row = orderGet.get(id) as Row | undefined;
      return row ? mapOrder(row) : null;
    },
    listWorkOrders(sessionId: string) {
      return (orderList.all(sessionId) as Row[]).map(mapOrder);
    },
    workOrderPosition() {
      return Number((orderCount.get() as Row).n);
    },
    log(input: { at: number; sessionId: string | null; kind: string; ref: string | null; detail: string }) {
      eventInsert.run(input.at, input.sessionId, input.kind, input.ref, input.detail);
    },
  };
}
