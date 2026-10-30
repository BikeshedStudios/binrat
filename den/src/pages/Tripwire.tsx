import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiFailure, refreshDen } from "../api";
import { formatStamp, number } from "../lib";
import { Link } from "../router";
import type { Receipt, ReplayView, Tripwire as TripwireModel } from "../types";
import {
  ErrorPanel,
  Kicker,
  Loading,
  Modal,
  RatWire,
  ReceiptBlock,
  Stamp,
  useToast,
} from "../ui/Bits";
import { IconArrow, IconWire } from "../ui/Glyphs";

type ReplayResult = { replay: ReplayView; receipt: Receipt };

function statusTone(status: ReplayView["status"]) {
  if (status === "RECORDED_AGAIN") return "chip--acid";
  if (status === "REREAD_ONLY") return "chip--amber";
  return "chip--blood";
}

function statusLabel(status: ReplayView["status"]) {
  return status.replace(/_/g, " ");
}

export function Tripwire() {
  const toast = useToast();
  const [items, setItems] = useState<TripwireModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayOpen, setReplayOpen] = useState<TripwireModel | null>(null);
  const [replay, setReplay] = useState<ReplayResult | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .tripwires()
      .then((payload) => setItems(payload.tripwires))
      .catch((failure: unknown) =>
        setError(failure instanceof ApiFailure ? failure.message : "The tripwire could not be read."),
      );
  }, []);

  useEffect(load, [load]);

  const watching = useMemo(() => (items ?? []).filter((item) => item.status === "WATCHING"), [items]);
  const dropped = useMemo(() => (items ?? []).filter((item) => item.status === "DROPPED"), [items]);

  const openReplay = async (item: TripwireModel) => {
    setReplayOpen(item);
    setReplay(null);
    setReplayError(null);
    if (!item.replay) return;
    try {
      const result = await api.replay(item.id);
      setReplay({ replay: result.replay, receipt: result.receipt });
      load();
    } catch (failure) {
      setReplayError(failure instanceof ApiFailure ? failure.message : "The replay failed.");
    }
  };

  const drop = async (item: TripwireModel) => {
    setBusy(item.id);
    try {
      await api.drop(item.id);
      toast.push("Tripwire dropped. The file stays in the pile; the pin is gone.", "info");
      refreshDen();
      load();
    } catch (failure) {
      toast.push(failure instanceof ApiFailure ? failure.message : "Could not drop the pin.", "bad");
    } finally {
      setBusy(null);
    }
  };

  const restore = async (item: TripwireModel) => {
    if (!item.case) return;
    setBusy(item.id);
    try {
      await api.watch(item.case.caseId, item.note);
      toast.push("Pin restored.", "good");
      refreshDen();
      load();
    } catch (failure) {
      toast.push(failure instanceof ApiFailure ? failure.message : "Could not restore the pin.", "bad");
    } finally {
      setBusy(null);
    }
  };

  const replayable = watching.filter((item) => item.replay?.status === "RECORDED_AGAIN").length;

  return (
    <>
      <header className="page-head">
        <div>
          <Kicker tone="acid">ROOM 03 · REMEMBER</Kicker>
          <h1 className="page-title">THE TRIPWIRE.</h1>
          <p className="page-sub">
            A pin holds a file to the window it came from. The Rat cannot watch the chain, so he does the
            next honest thing: he replays what later windows already recorded.
          </p>
        </div>
        <div className="page-count">
          <b>{watching.length}</b>
          <span>PINNED {watching.length === 1 ? "FILE" : "FILES"}</span>
          <span>{replayable} WITH A LATER RECORD</span>
        </div>
      </header>

      <div className="tripwire-hero">
        <div className="notice notice--acid" style={{ borderLeftWidth: 3 }}>
          <p className="h3" style={{ marginBottom: 6, color: "var(--acid)" }}>
            HOW THIS RETURN WORKS
          </p>
          <p style={{ margin: 0, color: "var(--bone-2)" }}>
            Your pin stores a baseline capture. A replay compares it with later captures that were
            packaged on 08–09 OCT 2026, then issues a receipt with both digests. It is a recorded diff —
            not a live alert, not a prediction, and not a message that was sent anywhere.
          </p>
          <div className="away-steps" style={{ marginTop: 14 }}>
            <span>PIN A BASELINE</span>
            <span>REPLAY LATER WINDOWS</span>
            <span>GET BOTH DIGESTS</span>
          </div>
        </div>
        {watching.length > 0 && (
          <div className="tripwire-art" aria-hidden="true">
            <img src="/assets/art/tripwire-rat.webp" width={900} height={900} alt="" />
          </div>
        )}
      </div>

      {error && <ErrorPanel message={error} onRetry={load} />}
      {!items && !error && <Loading label="CHECKING THE WIRE…" />}

      {items && watching.length === 0 && (
        <div className="empty">
          <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
            <IconWire size={30} />
            <p className="h2" style={{ fontSize: 17, margin: 0 }}>
              NOTHING IS PINNED.
            </p>
            <p style={{ maxWidth: "52ch", margin: "0 auto" }}>
              The Rat forgets what you don't leave with him. Open a file and pin it — the pin survives a
              restart and a closed browser.
            </p>
            <Link to="/pile" className="btn btn--sm" style={{ marginTop: 6 }}>
              FIND A FILE TO PIN <IconArrow size={12} />
            </Link>
          </div>
        </div>
      )}

      {watching.length > 0 && (
        <div className="pin-grid">
          {watching.map((item) => (
            <article className="pin paper paper--torn" key={item.id}>
              <div className="pin-top">
                <div>
                  <p className="pin-title">{item.case?.handle ?? "FILE UNAVAILABLE"}</p>
                  <p className="pin-file">
                    FILE {item.case ? number(item.case.fileNumber) : "—"} · {item.case?.deployerShort ?? "—"}
                  </p>
                </div>
                <Stamp soft>{item.replay ? statusLabel(item.replay.status) : "NO REPLAY"}</Stamp>
              </div>
              {item.note && <p className="pin-note">“{item.note}”</p>}
              <div className="pin-verdict">
                <span>
                  PINNED {formatStamp(item.pinnedAt)}
                  <br />
                  BASELINE {item.replay?.baseline.captureId.toUpperCase() ?? "—"} · BLOCK{" "}
                  {number(item.replay?.baseline.checkpoint ?? "0")}
                </span>
                <span>
                  <b>{item.replay?.verdict ?? "NO RECORDED WINDOW"}</b>
                </span>
              </div>
              <div className="pin-actions">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => openReplay(item)}
                  disabled={!item.case}
                >
                  REPLAY RECORDED WINDOWS
                </button>
                {item.case && (
                  <Link to={`/case/${item.case.caseId}`} className="btn btn--ghost btn--sm">
                    OPEN FILE
                  </Link>
                )}
                <button
                  type="button"
                  className="btn btn--blood btn--sm"
                  onClick={() => drop(item)}
                  disabled={busy === item.id}
                >
                  {busy === item.id ? "DROPPING…" : "DROP"}
                </button>
              </div>
              {item.lastReplay && (
                <p className="mono" style={{ fontSize: 10.5, color: "#6b5a41", margin: 0 }}>
                  LAST REPLAY {formatStamp(item.lastReplay.createdAt)} · DIGEST{" "}
                  {item.lastReplay.digest.slice(0, 16)}…
                </p>
              )}
            </article>
          ))}
          <Link to="/pile" className="pin pin--ghost">
            <span className="ghost-plus" aria-hidden="true">
              +
            </span>
            <span className="pin-title">NOTHING ELSE PINNED</span>
            <span className="pin-file">
              A pin is how the Rat remembers for you. Find another scrap and leave it here.
            </span>
            <span className="loop-cta">FIND A FILE TO PIN →</span>
          </Link>
        </div>
      )}

      {dropped.length > 0 && (
        <section style={{ marginTop: 30 }} aria-labelledby="dropped-label">
          <h2 className="h3" id="dropped-label" style={{ color: "var(--muted)", marginBottom: 10 }}>
            DROPPED PINS ({dropped.length})
          </h2>
          <div className="related-list" style={{ maxWidth: 720 }}>
            {dropped.map((item) => (
              <div className="related-item" key={item.id} style={{ opacity: 0.75 }}>
                <span>
                  {item.case?.handle ?? "FILE"} · FILE {item.case ? number(item.case.fileNumber) : "—"} ·
                  DROPPED {formatStamp(item.updatedAt)}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => restore(item)}
                  disabled={busy === item.id}
                >
                  PIN AGAIN
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ marginTop: 26 }}>
        <RatWire page="wire" />
      </div>

      {replayOpen && (
        <Modal title={`REPLAY TAPE · ${replayOpen.case?.handle ?? "FILE"}`} onClose={() => setReplayOpen(null)}>
          {!replay && !replayError && (
            <p className="terminal-detail" role="status">
              Reading the recorded windows…
            </p>
          )}
          {replayError && <ErrorPanel message={replayError} />}
          {replay && (
            <div className="stack gap-16">
              <div>
                <div className="spread" style={{ marginBottom: 8 }}>
                  <span className={`chip ${statusTone(replay.replay.status)}`}>{replay.replay.verdict}</span>
                  <span className="mono muted" style={{ fontSize: 10.5 }}>
                    {replay.replay.captures.length} CAPTURES · 0 NETWORK CALLS
                  </span>
                </div>
                <ReplayTape replay={replay.replay} />
              </div>

              {replay.replay.delta && (
                <div className="movement" style={{ borderColor: "var(--line)" }}>
                  <span className="mono muted" style={{ flexBasis: "100%", fontSize: 10.5 }}>
                    RECORDED PRIOR-LAUNCH COUNT
                  </span>
                  <span className="figure figure--small" style={{ color: "var(--bone-2)" }}>
                    {number(replay.replay.baseline.priorLaunchCount)}
                  </span>
                  <span aria-hidden="true" style={{ color: "var(--muted)" }}>
                    →
                  </span>
                  <span className="figure figure--small">{number(replay.replay.baseline.priorLaunchCount + replay.replay.delta.priorLaunchCount)}</span>
                  <span className="mono acid" style={{ marginLeft: "auto", fontSize: 13 }}>
                    {replay.replay.delta.priorLaunchCount >= 0 ? "+" : "−"}
                    {number(Math.abs(replay.replay.delta.priorLaunchCount))} REPORTED COUNT
                  </span>
                  <span className="mono muted" style={{ flexBasis: "100%", fontSize: 11 }}>
                    {number(replay.replay.delta.checkpointBlocks)} blocks and{" "}
                    {number(replay.replay.delta.elapsedHours)} hours between the baseline and the last later
                    record · {number(replay.replay.delta.laterRecordsScanned)} records scanned
                  </span>
                </div>
              )}

              <div className="stack gap-6">
                {replay.replay.appearances.length === 0 && (
                  <p style={{ margin: 0, color: "var(--bone-2)" }}>
                    No later packaged window contains this address. The Rat will not turn that into an
                    event: absence inside partial coverage is not a clean bill.
                  </p>
                )}
                {replay.replay.appearances.map((appearance) => (
                  <div className="related-item" key={`${appearance.captureId}-${appearance.block}`}>
                    <span>
                      {appearance.captureId.toUpperCase()} · BLOCK {number(appearance.block)} ·{" "}
                      {formatStamp(appearance.readAt)}
                      {appearance.sameScrap ? " · SAME SCRAP RE-READ" : " · NEW SCRAP"}
                    </span>
                    <b>PRIOR {number(appearance.priorLaunchCount)}</b>
                  </div>
                ))}
              </div>

              <p className="mono" style={{ fontSize: 11.5, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                {replay.replay.honestNote}
              </p>

              <ReceiptBlock receipt={replay.receipt} dark title="REPLAY RECEIPT" />

              <div className="row">
                {replayOpen.case && (
                  <Link to={`/case/${replayOpen.case.caseId}`} className="btn btn--ghost btn--sm">
                    OPEN THE BASELINE FILE
                  </Link>
                )}
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReplayOpen(null)}>
                  CLOSE TAPE
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function ReplayTape({ replay }: { replay: ReplayView }) {
  const hits = new Map<string, "hit" | "reread">();
  for (const appearance of replay.appearances) {
    hits.set(appearance.captureId, appearance.sameScrap ? "reread" : "hit");
  }
  const count = replay.captures.length;
  return (
    <div className="replay-wrap">
      <div className="replay-axis">
        <div className="replay-axis-line" aria-hidden="true" />
        {replay.captures.map((capture, index) => {
          const tone =
            capture.id === replay.baseline.captureId ? "baseline" : hits.get(capture.id) ?? "later";
          const left = count === 1 ? 50 : 5 + (index / (count - 1)) * 90;
          return (
            <div className="replay-stop" key={capture.id} style={{ left: `${left}%` }}>
              <span className="replay-dot" data-tone={tone} />
              <span className="replay-label">
                {capture.id.replace("cap-", "C")}
                <span className="replay-block">{number(capture.checkpoint).slice(-6)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <ul className="replay-legend">
        <li>
          <span className="key key--baseline" /> BASELINE PIN
        </li>
        <li>
          <span className="key key--hit" /> SAME ADDRESS RECORDED
        </li>
        <li>
          <span className="key key--later" /> LATER WINDOW
        </li>
      </ul>
      <p className="timeline-caption">
        Packaged captures in checkpoint order. Short block numbers are the last six digits. Nothing on
        this tape is live.
      </p>
    </div>
  );
}
