import { useEffect, useState } from "react";
import { api, ApiFailure } from "../api";
import { formatStamp, number, shortHash } from "../lib";
import { Link } from "../router";
import type { CanonicalCasePayload } from "../types";
import { ErrorPanel, Kicker, Loading, SectionLabel, Stamp } from "../ui/Bits";

/** One historical production Case, separate from the six Den replay windows. */
export function CanonicalCase() {
  const [data, setData] = useState<CanonicalCasePayload | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let mounted = true;
    api.canonicalCase().then((value) => {
      if (mounted) { setData(value); setError(""); }
    }).catch((cause: unknown) => {
      if (mounted) {
        setData(null);
        setError(cause instanceof ApiFailure ? cause.message : "Canonical source unavailable.");
      }
    });
    return () => { mounted = false; };
  }, [retry]);

  return (
    <>
      <header className="page-head">
        <div>
          <Kicker>ROOM 01B · PINNED PRODUCTION CAPTURE</Kicker>
          <h1 className="page-title">THE OLD FILE.</h1>
          <p className="page-sub">A historical canonical Case, not a current feed, a live investigation or one of the Den's six replay windows.</p>
        </div>
        <div className="page-count"><b>01</b><span>PINNED CASE</span></div>
      </header>
      {error && <ErrorPanel title="CANONICAL SOURCE UNAVAILABLE" message={error} onRetry={() => setRetry((n) => n + 1)} />}
      {!data && !error && <Loading label="VERIFYING PINNED CASE…" />}
      {data && (
        <div className="stack gap-16">
          <article className="paper paper--torn" style={{ padding: "clamp(20px,3vw,36px)" }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <SectionLabel>OCT 2026 · PONS 4663</SectionLabel><Stamp soft>PARTIAL HISTORY</Stamp>
            </div>
            <h2 className="h2" style={{ color: "#2a1d0f", marginTop: 12 }}>THE INDEX REMEMBERS AN OLDER LAUNCH.</h2>
            <p style={{ color: "#4a3925", lineHeight: 1.7 }}>
              This launch, originally recorded at block <b>{number(data.launchBlock)}</b>, was still retrievable
              after disappearing from the captured latest-20 feed. Its canonical Case includes
              <b> {number(data.priorIndexedCount)} earlier launches</b> with the same Pons-reported deployer
              address, within the Case's own 20-record window.
            </p>
            <div className="dossier-movement">
              <span className="label">EARLIER INDEXED LAUNCHES IN THIS RETURNED WINDOW</span>
              <span className="to">{number(data.priorIndexedCount)}</span>
              <span className="mono" style={{ flexBasis: "100%", fontSize: 11, color: "#4a3925" }}>
                Not the total history of the reported deployer.
              </span>
            </div>
            <SectionLabel>WHY CARE?</SectionLabel>
            <p style={{ color: "#4a3925", lineHeight: 1.7 }}>
              The Case preserves its own source facts and bounded predecessor window rather than silently
              borrowing a different live-feed count. The address is a reported field, not proof of a real-world owner.
            </p>
            <SectionLabel>WHAT REMAINS UNKNOWN?</SectionLabel>
            <p style={{ color: "#4a3925", lineHeight: 1.7 }}>
              Full history, on-chain ancestry independently verified by RPC, token name, price outcome,
              safety, wallet ownership and future behavior. This is a historical reconstruction, not a time-machine replay.
            </p>
          </article>
          <section className="panel panel--pad" aria-label="Canonical Case source receipt">
            <SectionLabel dark>PINNED SOURCE RECEIPT</SectionLabel>
            <p className="mono" style={{ color: "var(--bone-2)", lineHeight: 1.85, overflowWrap: "anywhere" }}>
              CASE ID: {data.caseId}<br />
              TX: {data.txHash}<br />
              TOKEN: {data.token}<br />
              REPORTED DEPLOYER: {data.reportedDeployer}<br />
              SOURCE FACT: {data.sourceFactId}<br />
              ENVELOPE DIGEST: {data.digest}<br />
              CHECKPOINT: {data.checkpoint.checkpointBlock}<br />
              PUBLICATION VERSION: {data.checkpoint.publicationVersion}<br />
              VERIFIED AT CAPTURE: {formatStamp(new Date(data.checkpoint.verifiedAtMs).toISOString())}
            </p>
            <p style={{ color: "var(--bone-3)" }}>
              Server-side validated using the existing canonical source contract and separately pinned receipt.
              This is not a digital signature or independent chain proof.
              Source: <code style={{ overflowWrap: "anywhere" }}>{data.evidenceFile}</code>.
            </p>
          </section>
          <section className="panel panel--pad">
            <SectionLabel dark>{number(data.previous.length)} EARLIER SOURCE RECORDS</SectionLabel>
            <div className="stack gap-6">
              {data.previous.map((item, i) => (
                <div key={item.id} className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <span className="mono" style={{ color: "var(--bone-2)" }}>#{i + 1} · BLOCK {number(item.block)}</span>
                  <span className="mono" style={{ color: "var(--muted)" }}>{shortHash(item.id)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="panel panel--pad">
            <SectionLabel dark>WHAT NEXT?</SectionLabel>
            <p style={{ color: "var(--bone-2)" }}>
              This pinned Case has no live Watch and is not part of the Den's replay data. To employ a local
              Rat on a packaged capture, return to the Pile.
            </p>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <Link to="/pile" className="btn">BACK TO THE PILE</Link>
              <Link to="/" className="btn btn--ghost">RETURN TO THE DEN</Link>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
