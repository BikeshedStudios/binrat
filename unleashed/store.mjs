import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { replayEvidence, sha256, SOURCE_SHA } from "./evidence.mjs";

export class LocalStore {
  constructor(path, evidence, now = Date.now) {
    this.db = new DatabaseSync(path);
    this.evidence = evidence;
    this.now = now;
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
        case_id TEXT NOT NULL, status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL, due_at INTEGER, run INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS receipts (assignment_id TEXT NOT NULL REFERENCES assignments(id), run INTEGER NOT NULL,
        payload TEXT NOT NULL, completed_at INTEGER NOT NULL, PRIMARY KEY(assignment_id,run));
      CREATE TABLE IF NOT EXISTS interests (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
        service TEXT NOT NULL, note TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS assignment_owner ON assignments(session_id);
      CREATE INDEX IF NOT EXISTS interest_owner ON interests(session_id);`);
  }
  session(id) {
    if (id && this.db.prepare("SELECT id FROM sessions WHERE id=?").get(id))
      return id;
    const created = randomUUID();
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?)")
      .run(created, this.now());
    return created;
  }
  own(session, id) {
    const row = this.db
      .prepare("SELECT * FROM assignments WHERE session_id=? AND id=?")
      .get(session, id);
    if (!row) throw Error("ASSIGNMENT_NOT_FOUND");
    return row;
  }
  list(session) {
    return this.db
      .prepare(
        "SELECT * FROM assignments WHERE session_id=? ORDER BY created_at DESC,id",
      )
      .all(session)
      .map((row) => ({
        ...row,
        ...(() => {
          const found = this.db
            .prepare(
              "SELECT payload,completed_at FROM receipts WHERE assignment_id=? AND run=?",
            )
            .get(row.id, row.run);
          if (!found) return { receipt: null, receiptError: null };
          try {
            const stored = JSON.parse(found.payload),
              { receiptId, ...material } = stored;
            if (
              receiptId !== "replay:" + sha256(material) ||
              stored.mode !== "REPLAY" ||
              stored.sourceSha !== SOURCE_SHA ||
              stored.sourceCaseId !== row.case_id ||
              (this.evidence &&
                sha256(stored) !==
                  sha256(replayEvidence(this.evidence, row.case_id)))
            )
              throw Error("RECEIPT_INVALID");
            return {
              receipt: {
                ...stored,
                completedAt: new Date(found.completed_at).toISOString(),
              },
              receiptError: null,
            };
          } catch {
            return { receipt: null, receiptError: "RECEIPT_INVALID" };
          }
        })(),
      }));
  }
  create(session, caseId, note = "") {
    if (
      !this.evidence ||
      !this.evidence.cases.some((item) => item.id === caseId)
    )
      throw Error("CASE_NOT_FOUND");
    this.validateNote(note);
    const duplicate = this.db
      .prepare(
        "SELECT id FROM assignments WHERE session_id=? AND case_id=? AND status!='CANCELLED'",
      )
      .get(session, caseId);
    if (duplicate) return duplicate.id;
    const count = this.db
      .prepare(
        "SELECT COUNT(*) AS n FROM assignments WHERE session_id=? AND status!='CANCELLED'",
      )
      .get(session).n;
    if (count >= 5) throw Error("CAPACITY_REACHED");
    // Total history is also bounded; cancellation cannot grow storage forever.
    if (
      this.db
        .prepare("SELECT COUNT(*) AS n FROM assignments WHERE session_id=?")
        .get(session).n >= 100
    )
      throw Error("HISTORY_LIMIT");
    const id = randomUUID(),
      now = this.now();
    this.db
      .prepare(
        "INSERT INTO assignments (id,session_id,case_id,status,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
      )
      .run(id, session, caseId, "PREPARED", note, now, now);
    return id;
  }
  validateNote(note) {
    if (typeof note !== "string" || note.length > 500)
      throw Error("NOTE_INVALID");
  }
  action(session, id, action, note) {
    const row = this.own(session, id),
      now = this.now();
    if (action === "cancel") {
      this.db
        .prepare(
          "UPDATE assignments SET status='CANCELLED',due_at=NULL,updated_at=? WHERE id=?",
        )
        .run(now, id);
    } else if (action === "note") {
      this.validateNote(note);
      this.db
        .prepare("UPDATE assignments SET note=?,updated_at=? WHERE id=?")
        .run(note, now, id);
    } else if (action === "replay") {
      if (!this.evidence) throw Error("EVIDENCE_UNAVAILABLE");
      if (row.status === "CANCELLED") throw Error("ASSIGNMENT_CANCELLED");
      if (row.status === "RUNNING") return;
      this.db
        .prepare(
          "UPDATE assignments SET status='RUNNING',due_at=?,updated_at=?,run=run+1 WHERE id=?",
        )
        .run(now + 1800, now, id);
    } else throw Error("ACTION_INVALID");
  }
  runDue() {
    if (!this.evidence) return;
    const rows = this.db
      .prepare(
        "SELECT * FROM assignments WHERE status='RUNNING' AND due_at<=? LIMIT 20",
      )
      .all(this.now());
    for (const row of rows) {
      const receipt = replayEvidence(this.evidence, row.case_id);
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db
          .prepare("INSERT INTO receipts VALUES (?,?,?,?)")
          .run(row.id, row.run, JSON.stringify(receipt), this.now());
        this.db
          .prepare(
            "UPDATE assignments SET status='COMPLETE',due_at=NULL,updated_at=? WHERE id=? AND status='RUNNING'",
          )
          .run(this.now(), row.id);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
  }
  interest(session, service, note = "") {
    if (!["memory", "investigation"].includes(service))
      throw Error("SERVICE_INVALID");
    this.validateNote(note);
    if (
      this.db
        .prepare("SELECT COUNT(*) AS n FROM interests WHERE session_id=?")
        .get(session).n >= 10
    )
      throw Error("DRAFT_LIMIT");
    const id = randomUUID(),
      now = this.now();
    this.db
      .prepare("INSERT INTO interests VALUES (?,?,?,?,?)")
      .run(id, session, service, note, now);
    return {
      id,
      service,
      note,
      createdAt: new Date(now).toISOString(),
      state: "LOCAL_DRAFT_ONLY",
      sent: false,
      priceStatus: "PROPOSED_NOT_BILLABLE",
    };
  }
  interests(session) {
    return this.db
      .prepare(
        "SELECT id,service,note,created_at FROM interests WHERE session_id=? ORDER BY created_at DESC",
      )
      .all(session)
      .map((row) => ({
        id: row.id,
        service: row.service,
        note: row.note,
        createdAt: new Date(row.created_at).toISOString(),
        state: "LOCAL_DRAFT_ONLY",
        sent: false,
        priceStatus: "PROPOSED_NOT_BILLABLE",
      }));
  }
  close() {
    this.db.close();
  }
}
