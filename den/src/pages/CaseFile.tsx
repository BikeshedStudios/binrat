import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiFailure, refreshDen } from "../api";
import { canonicalJson, formatStamp, number, sha256Hex, shortHash, signed } from "../lib";
import { Link, useNavigate } from "../router";
import type { CasePayload, EmployResponse, EmployStep } from "../types";
import {
  DataRow,
  ErrorPanel,
  Kicker,
  Loading,
  Modal,
  RatWire,
  ReceiptBlock,
  SectionLabel,
  Stamp,
  useToast,
} from "../ui/Bits";
import { IconCheck, IconCross } from "../ui/Glyphs";

const KIND_LABEL: Record<string, string> = {
  OBSERVED: "OBSERVED",
  DERIVED: "DERIVED",
  COVERAGE: "COVERAGE",
  UNKNOWN: "UNKNOWN",
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = () => setReduced(query.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function CaseFile({ id }: { id: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [data, setData] = useState<CasePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const [run, setRun] = useState<EmployResponse | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [runState, setRunState] = useState<"loading" | "revealing" | "done">("loading");
  const [revealed, setRevealed] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);

  const [watchOpen, setWatchOpen] = useState(false);
  const [note, setNote] = useState("");
  const [watching, setWatching] = useState(false);
  const [pinned, setPinned] = useState(false);

  const [copied, setCopied] = useState(false);
  const receiptsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setError(null);
    setMissing(false);
    api
      .case(id)
      .then(setData)
      .catch((failure: unknown) => {
        if (failure instanceof ApiFailure && failure.status === 404) {
          setMissing(true);
          setError(failure.message);
        } else {
          setError(failure instanceof ApiFailure ? failure.message : "The file could not be read.");
        }
      });
  }, [id]);

  useEffect(load, [load]);

  const employ = useCallback(
    async (fresh = false) => {
      setRunOpen(true);
      setRunState("loading");
      setRevealed(0);
      setRunError(null);
      setRun(null);
      try {
        const result = await api.employ(id, fresh);
        setRun(result);
        if (reduced) {
          setRevealed(result.steps.length);
          setRunState("done");
        } else {
          setRunState("revealing");
        }
      } catch (failure) {
        setRunError(failure instanceof ApiFailure ? failure.message : "The Rat could not complete the run.");
        setRunState("done");
      }
    },
    [id, reduced],
  );

  useEffect(() => {
    if (runState !== "revealing" || !run) return;
    if (revealed >= run.steps.length) {
      setRunState("done");
      return;
    }
    const timer = window.setTimeout(() => setRevealed((n) => n + 1), 320);
    return () => window.clearTimeout(timer);
  }, [runState, revealed, run]);

  const pin = useCallback(async () => {
    setWatching(true);
    try {
      const result = await api.watch(id, note.trim());
      setPinned(true);
      setWatchOpen(false);
      refreshDen();
      toast.push(
        result.created
          ? `Pinned ${result.tripwire.case?.handle ?? "the file"} to ${result.tripwire.replay?.baseline.captureId ?? "its window"}.`
          : "This file is already pinned.",
        "good",
      );
    } catch (failure) {
      toast.push(failure instanceof ApiFailure ? failure.message : "The pin failed.", "bad");
    } finally {
      setWatching(false);
    }
  }, [id, note, toast]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.push("Clipboard blocked by the browser. Copy the URL from the address bar.", "bad");
    }
  };

  const movement = useMemo(() => {
    if (!data) return null;
    const { replay } = data;
    const later = replay.appearances.filter((item) => !item.sameScrap);
    const last = later[later.length - 1];
    if (!last) return null;
    return {
      from: replay.baseline.priorLaunchCount,
      to: last.priorLaunchCount,
      fromReadAt: replay.baseline.readAt,
      toReadAt: last.readAt,
      delta: replay.delta?.priorLaunchCount ?? last.priorLaunchCount - replay.baseline.priorLaunchCount,
    };
  }, [data]);

  if (missing) {
    return (
      <>
        <header className="page-head">
          <div>
            <Kicker tone="blood">FILE NOT FOUND</Kicker>
            <h1 className="page-title">NOT IN THIS DEN.</h1>
            <p className="page-sub">
              That id is not one of the {number(91)} scraps in the six packaged windows. Six windows is not
              the chain — an id missing here proves nothing about it.
            </p>
          </div>
        </header>
        <div className="empty">
          <p className="h2" style={{ fontSize: 16, marginBottom: 10 }}>
            TRY THE PILE.
          </p>
          <Link to="/pile" className="btn btn--sm">
            OPEN THE PILE
          </Link>
        </div>
        <div style={{ marginTop: 24 }}>
          <RatWire page="missing" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        {error ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : (
          <Loading label="PULLING THE FILE…" />
        )}
      </>
    );
  }

  const { dossier, record, capture, reads, related, replay } = data;
  const fileNo = number(dossier.fileNumber);

  return (
    <>
      <div className="case-toolbar">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">DEN</Link>
          <span className="sep">/</span>
          <Link to="/pile">PILE</Link>
          <span className="sep">/</span>
          <span aria-current="page">FILE {fileNo}</span>
        </nav>
        <div className="row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={copyLink}>
            {copied ? "LINK COPIED" : "COPY FILE LINK"}
          </button>
          <Link to="/pile" className="btn btn--ghost btn--sm">
            BACK TO THE PILE
          </Link>
        </div>
      </div>

      <div className="case-grid">
        <article className="dossier paper paper--torn" aria-labelledby="file-title">
          <header className="dossier-head">
            <div className="dossier-topline">
              <span>
                FILE {fileNo} · RAT HANDLE <b style={{ color: "#8c2a1c" }}>{dossier.handle}</b>
              </span>
              <Stamp soft>PARTIAL COVERAGE</Stamp>
            </div>
            <h1 className="dossier-title" id="file-title">
              {dossier.headline}
            </h1>
            <p className="dossier-deck">{dossier.deck}</p>
            <p className="mono" style={{ fontSize: 11, color: "#6b5a41", margin: 0 }}>
              HANDLE BASIS: {data.case.handleBasis.toUpperCase()} · NOT THE TOKEN'S NAME · NOT A VERDICT
            </p>
          </header>

          {movement && (
            <div className="dossier-movement">
              <span className="label">
                RECORDED PRIOR-LAUNCH COUNT · {formatStamp(movement.fromReadAt)} → {formatStamp(movement.toReadAt)}
              </span>
              <span className="from">{number(movement.from)}</span>
              <span aria-hidden="true" style={{ color: "#8a7354" }}>
                →
              </span>
              <span className="to">{number(movement.to)}</span>
              <span className="delta">{signed(movement.delta)} reported count change</span>
              <small className="mono" style={{ flexBasis: "100%", fontSize: 11, lineHeight: 1.5 }}>Not proof that these launches occurred between captures; indexing or backfill can change a cumulative count.</small>
            </div>
          )}

          <section>
            <SectionLabel>WHAT HAPPENED</SectionLabel>
            {dossier.findings.map((finding) => (
              <div className="finding" key={finding.id}>
                <span className="finding-kind" data-kind={finding.kind}>
                  {KIND_LABEL[finding.kind] ?? finding.kind}
                </span>
                <div className="finding-body">
                  <h3>{finding.title}</h3>
                  <p>{finding.text}</p>
                </div>
              </div>
            ))}
          </section>

          <section>
            <SectionLabel>WHAT THE RECORD DOES NOT SAY</SectionLabel>
            <ul className="unknowns">
              {dossier.unknowns.map((unknown) => (
                <li key={unknown}>{unknown}</li>
              ))}
            </ul>
          </section>

          <section ref={receiptsRef}>
            <SectionLabel>RECEIPTS</SectionLabel>
            <dl className="data-list">
              <DataRow label="Launch id">{record.launchId}</DataRow>
              <DataRow label="Fact id">{record.factId}</DataRow>
              <DataRow label="Reported deployer">{record.deployer}</DataRow>
              <DataRow label="Token">{record.token}</DataRow>
              <DataRow label="Transaction">{record.txHash}</DataRow>
              <DataRow label="Block / checkpoint">
                {number(record.block)} / {number(capture.checkpoint)}
              </DataRow>
              <DataRow label="Capture read">
                {capture.id.toUpperCase()} · {formatStamp(capture.readAt)} · {capture.state.replace(/_/g, " ")}
              </DataRow>
              <DataRow label="Name / symbol recorded">
                {record.name || record.symbol ? `${record.name} / ${record.symbol}` : "EMPTY IN EVERY READ"}
              </DataRow>
            </dl>
            <div style={{ marginTop: 12 }}>
              <p className="mono" style={{ fontSize: 11, color: "#6b5a41", margin: "0 0 6px" }}>
                {dossier.digest.basis}
              </p>
              <div className="digest">{dossier.digest.digest}</div>
              <div className="verify-row">
                <VerifyDigest material={dossier.digest.material} expected={dossier.digest.digest} />
              </div>
            </div>
          </section>
        </article>

        <aside className="case-aside">
          <div className="aside-panel aside-panel--crt">
            <p className="aside-title">RAT'S NEXT MOVE</p>
            <div className="aside-actions">
              <button className="btn btn--acid btn--sm btn--block" type="button" onClick={() => employ(false)}>
                EMPLOY THE RAT
              </button>
              <button className="btn btn--ghost btn--sm btn--block" type="button" onClick={() => setWatchOpen(true)}>
                {pinned ? "PINNED ✓" : "LEAVE A TRIPWIRE"}
              </button>
              <Link to="/manual" className="btn btn--ghost btn--sm btn--block">
                READ THE FIELD MANUAL
              </Link>
            </div>
            <p className="mono" style={{ fontSize: 11, color: "#9fce7a", margin: "12px 0 0", lineHeight: 1.5 }}>
              EMPLOY is a local cross-check over {number(dossier.coverage.records)} records. It makes zero
              network calls and returns a receipt you can recompute.
            </p>
            {pinned && (
              <p style={{ margin: "10px 0 0" }}>
                <Link to="/tripwire" className="link-underline mono" style={{ fontSize: 12 }}>
                  OPEN THE TRIPWIRE →
                </Link>
              </p>
            )}
          </div>

          <div className="aside-panel">
            <p className="aside-title">REPLAY FORECAST</p>
            <p className="mono" style={{ fontSize: 12, color: "var(--bone-2)", margin: 0, lineHeight: 1.5 }}>
              {replay.status === "RECORDED_AGAIN" && (
                <>
                  <span className="acid">● {replay.verdict}</span>
                  <br />
                  Pin this file and the Rat can show you the later window, both digests and the movement.
                </>
              )}
              {replay.status === "REREAD_ONLY" && (
                <>
                  <span className="amber">● {replay.verdict}</span>
                  <br />
                  The later window re-read this same scrap. A re-read is not a new launch.
                </>
              )}
              {replay.status === "NO_LATER_RECORD" && (
                <>
                  <span className="dim">● {replay.verdict}</span>
                  <br />
                  Pinning is still allowed, but the honest replay today is “nothing later”.
                </>
              )}
              {replay.status === "NO_LATER_CAPTURES" && (
                <>
                  <span className="dim">● {replay.verdict}</span>
                  <br />
                  Pin an earlier file if you want a forward-looking replay.
                </>
              )}
            </p>
            <div className="aside-meta">
              <div>
                <span>Capture</span>
                <b>
                  {capture.id.toUpperCase()} · {number(capture.recordCount)} REC
                </b>
              </div>
              <div>
                <span>Read</span>
                <b>{formatStamp(capture.readAt)}</b>
              </div>
              <div>
                <span>Digest</span>
                <b className="ok">{capture.digestVerified ? "VERIFIED" : "FAILED"}</b>
              </div>
              <div>
                <span>Source</span>
                <b>{capture.sourceKind.replace(/_/g, " ")}</b>
              </div>
              <div>
                <span>Windows with address</span>
                <b>{dossier.coverage.windowsWithAddress} / {dossier.coverage.captures}</b>
              </div>
            </div>
          </div>

          <div className="aside-panel">
            <p className="aside-title">READS OF THIS SCRAP</p>
            <div className="related-list">
              {reads.map((read) => (
                <div className="related-item" key={`${read.captureId}-${read.block}`}>
                  <span>
                    {read.captureId.toUpperCase()} · {formatStamp(read.readAt)}
                  </span>
                  <b>PRIOR {number(read.priorLaunchCount)}</b>
                </div>
              ))}
            </div>
          </div>

          {related.length > 0 && (
            <div className="aside-panel">
              <p className="aside-title">SAME ADDRESS, OTHER FILES</p>
              <div className="related-list">
                {related.map((item) => (
                  <Link className="related-item" key={item.caseId} to={`/case/${item.caseId}`}>
                    <span>FILE {number(item.fileNumber)}</span>
                    <b>PRIOR {number(item.priorLaunchCount)}</b>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div style={{ marginTop: 24 }}>
        <RatWire page="case" />
      </div>

      <section className="limits" aria-label="Boundaries of this file">
        <h2 className="kicker kicker--quiet">BOUNDARIES</h2>
        <ul>
          <li>
            <span className="mono">Recurrence</span>
            <b>OBSERVED</b>
            <span>Not a scam verdict, a person, a profit or a prediction.</span>
          </li>
          <li>
            <span className="mono">Coverage</span>
            <b>PARTIAL</b>
            <span>Six bounded windows; absence here is not absence from the chain.</span>
          </li>
          <li>
            <span className="mono">Live feed</span>
            <b>NOT RUN</b>
            <span>This file cannot change until a new capture is packaged with owner authorization.</span>
          </li>
        </ul>
      </section>

      {runOpen && (
        <Modal title="RAT AT WORK · LOCAL RUN" onClose={() => setRunOpen(false)}>
          {runState === "loading" && !runError && (
            <div className="terminal" role="status" aria-live="polite">
              <p className="terminal-label">
                <span>OPENING THE FILE</span>
                <span className="terminal-state">WORKING…</span>
              </p>
              <div className="progress">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: "30%" }} />
                </div>
              </div>
              <p className="terminal-detail">Local cross-check. No provider call, no model call, no network.</p>
            </div>
          )}

          {runError && <ErrorPanel message={runError} />}

          {run && (
            <div className="stack gap-16">
              <div className="progress">
                <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={run.steps.length} aria-valuenow={revealed}>
                  <div className="progress-fill" style={{ width: `${(revealed / run.steps.length) * 100}%` }} />
                </div>
                <p className="mono" style={{ fontSize: 10.5, color: "var(--acid-dim)", margin: 0 }}>
                  {revealed} / {run.steps.length} STEPS · {number(run.run.scan.recordsScanned)} RECORDS ·{" "}
                  {run.run.scan.capturesScanned} CAPTURES · 0 NETWORK CALLS
                </p>
              </div>

              <div className="terminal" aria-live="polite">
                {run.steps.map((step: EmployStep, index) => {
                  if (index >= revealed) return null;
                  const done = index < revealed - 1 || runState === "done";
                  return (
                    <div className="terminal-line" key={step.id} data-state={done ? "done" : "active"}>
                      <div className="terminal-label">
                        <span>{step.label}</span>
                        <span className="terminal-state">{done ? "OK" : "RUNNING"}</span>
                      </div>
                      <p className="terminal-detail">{step.detail}</p>
                    </div>
                  );
                })}
              </div>

              {runState === "done" && (
                <>
                  <div className="notice notice--acid">
                    <p className="h3" style={{ marginBottom: 6 }}>
                      FILE WRITTEN · {run.run.reused ? "REUSED FROM THIS SESSION" : "NEW RUN"}
                    </p>
                    <p style={{ margin: 0 }}>
                      {run.dossier.findings.length} findings and {run.dossier.unknowns.length} explicit
                      unknowns. Case digest <span className="mono">{shortHash(run.dossier.digest.digest, 12, 8)}</span>.
                    </p>
                  </div>
                  <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                    {run.run.pacingNote}
                  </p>
                  <ReceiptBlock receipt={run.receipt} dark title="EMPLOY RUN RECEIPT" />
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => {
                        setRunOpen(false);
                        receiptsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      READ THE RECEIPTS
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => employ(true)}
                      disabled={runState !== "done"}
                    >
                      RUN FRESH AGAIN
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setWatchOpen(true)}>
                      LEAVE A TRIPWIRE
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>
      )}

      {watchOpen && (
        <Modal title="LEAVE A TRIPWIRE · PIN THIS FILE" onClose={() => setWatchOpen(false)} book>
          <div className="stack gap-16">
            <p style={{ margin: 0, color: "var(--bone-2)", fontSize: 14.5 }}>
              The pin stores this file's baseline capture on your machine. Later, the tripwire can replay
              what later recorded windows contain. It will never claim an alert was delivered.
            </p>
            <dl className="data-list">
              <DataRow label="Baseline capture" dark>
                {capture.id.toUpperCase()} · checkpoint {number(capture.checkpoint)}
              </DataRow>
              <DataRow label="Read at" dark>
                {formatStamp(capture.readAt)}
              </DataRow>
              <DataRow label="Replay forecast" dark>
                <span className={replay.status === "RECORDED_AGAIN" ? "acid" : "dim"}>{replay.verdict}</span>
              </DataRow>
            </dl>
            <label className="stack gap-6">
              <span className="field-label" style={{ color: "var(--dim)" }}>
                WHY YOU ARE KEEPING IT (OPTIONAL, 200 CHARS)
              </span>
              <input
                className="field-input"
                style={{ background: "rgba(255,255,255,.04)", borderColor: "var(--line)", color: "var(--bone)" }}
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 200))}
                placeholder="e.g. the address with 565 prior launches"
              />
            </label>
            <div className="row">
              <button type="button" className="btn" onClick={pin} disabled={watching}>
                {watching ? "PINNING…" : "PIN THE FILE"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setWatchOpen(false)}>
                CANCEL
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function VerifyDigest({ material, expected }: { material: unknown; expected: string }) {
  const [state, setState] = useState<"idle" | "running" | "ok" | "bad">("idle");
  const verify = async () => {
    setState("running");
    const recomputed = await sha256Hex(canonicalJson(material));
    setState(recomputed === expected ? "ok" : "bad");
  };
  return (
    <>
      <button type="button" className="btn btn--ghost btn--sm" onClick={verify}>
        VERIFY CASE DIGEST
      </button>
      {state === "ok" && (
        <span className="verified">
          <IconCheck size={12} /> VERIFIED · CASE DIGEST MATCHES
        </span>
      )}
      {state === "bad" && (
        <span className="verified verified--bad">
          <IconCross size={12} /> MISMATCH
        </span>
      )}
    </>
  );
}
