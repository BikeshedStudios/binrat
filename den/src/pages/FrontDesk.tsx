import { useState } from "react";
import { api, ApiFailure } from "../api";
import { formatStamp, number } from "../lib";
import { Link } from "../router";
import type { WorkOrderResponse } from "../types";
import { ErrorPanel, Kicker, RatWire, ReceiptBlock, SectionLabel, Stamp } from "../ui/Bits";

const SCOPES = [
  {
    id: "case-deep-dive",
    title: "FILE DEEP DIVE",
    detail: "One file, every recorded window it touches. Findings, unknowns and one verifiable receipt.",
  },
  {
    id: "deployer-trail",
    title: "ADDRESS TRAIL",
    detail: "One reported deployer across all packaged captures, with the recorded count movement between them.",
  },
  {
    id: "window-watch",
    title: "WINDOW STANDING ORDER",
    detail: "A standing interest in one capture window. It describes what a future authorized collector would have to record.",
  },
] as const;

export function FrontDesk() {
  const [scope, setScope] = useState<string>("case-deep-dive");
  const [note, setNote] = useState("");
  const [order, setOrder] = useState<WorkOrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const result = await api.requestWork(scope, note.trim());
      setOrder(result);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : "The request could not be recorded.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <Kicker tone="blood">ROOM 04 · EMPLOY</Kicker>
          <h1 className="page-title">THE FRONT DESK.</h1>
          <p className="page-sub">
            Choose the investigation you wish BINRAT could do next. Record an interest-only work order and get a local receipt.
          </p>
        </div>
        <div className="page-count">
          <b>$0.00</b>
          CHARGED · NO PAYMENT RAIL
        </div>
      </header>

      <div className="stamp-banner" role="note">
        <Stamp dark>NO PAYMENT EXISTS</Stamp>
        <p style={{ margin: 0, maxWidth: "62ch" }}>
          This local demo collects no payment and starts no investigator job. Your work order stays on this machine.
        </p>
      </div>

      <div className="desk-grid" style={{ marginTop: 20 }}>
        {!order ? (
          <article className="paper paper--torn" style={{ padding: "clamp(20px,2.6vw,32px)" }}>
            <form className="desk-form" onSubmit={submit}>
              <div>
                <SectionLabel>WHAT SHOULD THE RAT WORK ON?</SectionLabel>
                <div className="scope-options" role="radiogroup" aria-label="Investigation scope">
                  {SCOPES.map((option) => (
                    <label className="scope" key={option.id}>
                      <input
                        type="radio"
                        name="scope"
                        value={option.id}
                        checked={scope === option.id}
                        onChange={() => setScope(option.id)}
                      />
                      <span>
                        <b>{option.title}</b>
                        <span>{option.detail}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <SectionLabel>WHAT ARE YOU TRYING TO ANSWER? (OPTIONAL)</SectionLabel>
                <label className="visually-hidden" htmlFor="order-note">
                  What are you trying to answer?
                </label>
                <textarea
                  id="order-note"
                  className="field-area"
                  value={note}
                  maxLength={400}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. this wallet keeps appearing — is the count still moving in the capture I pinned?"
                />
                <p className="mono" style={{ fontSize: 10.5, color: "#6b5a41", margin: "6px 0 0" }}>
                  {note.length}/400 · STORED LOCALLY ONLY · NO EMAIL IS COLLECTED
                </p>
              </div>

              {error && <ErrorPanel title="THE DESK DID NOT TAKE IT" message={error} />}

              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <p className="mono" style={{ fontSize: 10.5, color: "#6b5a41", margin: 0 }}>
                    PRICE: <b style={{ color: "#8c2a1c" }}>NOT SET</b> · NO BILLING INTEGRATION EXISTS
                  </p>
                </div>
                <button type="submit" className="btn" disabled={sending}>
                  {sending ? "RECORDING…" : "RECORD INTEREST · $0"}
                </button>
              </div>
            </form>
          </article>
        ) : (
          <article className="ticket paper paper--torn">
            <div className="ticket-head">
              <div>
                <p className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "#6b5a41", margin: 0 }}>
                  WORK ORDER · INTEREST RECORDED
                </p>
                <p className="ticket-ref">{order.order.reference}</p>
              </div>
              <Stamp>NO PAYMENT TAKEN</Stamp>
            </div>
            <div className="ticket-meta">
              <span>SCOPE · {order.order.scope.replace(/-/g, " ").toUpperCase()}</span>
              <span>RECORDED · {formatStamp(new Date(order.order.createdAt).toISOString())}</span>
              <span>QUEUE POSITION · {number(order.position)} (LOCAL MACHINE ONLY)</span>
              <span>PAYMENT TAKEN · FALSE · CHECKOUT EXISTS · FALSE</span>
            </div>
            {order.order.note && (
              <p style={{ margin: 0, fontSize: 14, color: "#3b2a16", borderLeft: "2px solid rgba(140,42,28,.35)", paddingLeft: 10 }}>
                “{order.order.note}”
              </p>
            )}
            <div>
              <SectionLabel>WHAT A RUN WOULD DELIVER</SectionLabel>
              <p style={{ margin: 0, fontSize: 14, color: "#4a3925", lineHeight: 1.55 }}>{order.deliverable}</p>
            </div>
            <p className="mono" style={{ fontSize: 10.5, color: "#6b5a41", margin: 0, lineHeight: 1.5 }}>
              {order.boundary}
            </p>
            <div className="row">
              <Link to="/" className="btn btn--sm">
                BACK TO THE DEN
              </Link>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOrder(null)}>
                FILE ANOTHER
              </button>
            </div>
            <div style={{ marginTop: 6 }}>
              <ReceiptBlock receipt={order.receipt} title="INTEREST RECEIPT" />
            </div>
          </article>
        )}

        <aside className="stack gap-16">
          <div className="panel panel--pad">
            <SectionLabel dark>THE FREE VERSION IS THE PRODUCT</SectionLabel>
            <p style={{ margin: "0 0 12px", color: "var(--bone-2)", fontSize: 14, lineHeight: 1.55 }}>
              Every investigation on this desk is already runnable, locally and for free, from any file.
              “Employ the Rat” in a file performs the cross-check and returns the same class of receipt.
            </p>
            <Link to="/pile" className="btn btn--ghost btn--sm btn--block">
              OPEN THE PILE AND RUN ONE
            </Link>
          </div>

          <div className="panel panel--pad">
            <SectionLabel dark>THE ECONOMIC BOUNDARY</SectionLabel>
            <ul className="unknowns" style={{ gap: 6 }}>
              <li style={{ color: "var(--dim)" }}>No card fields, no redirects, no invoices.</li>
              <li style={{ color: "var(--dim)" }}>No capacity sold, no entitlement granted.</li>
              <li style={{ color: "var(--dim)" }}>No subscription, credits or referral payouts.</li>
              <li style={{ color: "var(--dim)" }}>Requests never leave this machine.</li>
            </ul>
          </div>

          <div className="panel panel--pad">
            <SectionLabel dark>WHY SHOW IT AT ALL?</SectionLabel>
            <p style={{ margin: 0, color: "var(--dim)", fontSize: 13.5, lineHeight: 1.55 }}>
              Because the honest version of a paid feature is the shape of the work plus the boundary
              around the payment. If the day comes, the receipt rule does not change: paid capacity buys
              labour, never truth.
            </p>
          </div>
        </aside>
      </div>

      <div style={{ marginTop: 26 }}>
        <RatWire page="desk" />
      </div>
    </>
  );
}
