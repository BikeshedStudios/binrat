import { useEffect, useState } from "react";
import { api, ApiFailure } from "../api";
import { formatStamp, number, shortHash } from "../lib";
import type { MethodPayload } from "../types";
import { ErrorPanel, Kicker, Loading, RatWire, SectionLabel } from "../ui/Bits";

export function Manual() {
  const [data, setData] = useState<MethodPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .method()
      .then(setData)
      .catch((failure: unknown) =>
        setError(failure instanceof ApiFailure ? failure.message : "The manual could not be read."),
      );
  }, []);

  if (error) return <ErrorPanel message={error} />;
  if (!data) return <Loading label="OPENING THE FIELD MANUAL…" />;

  return (
    <>
      <header className="page-head">
        <div>
          <Kicker>ROOM 05 · METHOD</Kicker>
          <h1 className="page-title">FIELD MANUAL.</h1>
          <p className="page-sub">
            This page exists so you do not have to trust the rest of the site. Every claim below is either
            a recorded value, a reproducible local check, or an explicit “not included”.
          </p>
        </div>
        <div className="page-count">
          <b>{data.mode.replace(/_/g, " ")}</b>
          NO LIVE COLLECTOR · MOUNTED AT <span className="mono">{data.mounted}</span>
        </div>
      </header>

      <section className="manual-section" aria-labelledby="live-title">
        <SectionLabel>WHAT IS LIVE RIGHT NOW</SectionLabel>
        <div className="table-wrap">
          <table className="data-table" id="live-title">
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">State</th>
                <th scope="col">What that means</th>
              </tr>
            </thead>
            <tbody>
              {data.capabilities.map((capability) => (
                <tr key={capability.name}>
                  <td>{capability.name}</td>
                  <td>
                    <span
                      className={
                        capability.state === "AVAILABLE"
                          ? "chip chip--acid"
                          : capability.state === "NOT RUN"
                            ? "chip chip--blood"
                            : "chip"
                      }
                    >
                      {capability.state}
                    </span>
                  </td>
                  <td>{capability.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="manual-section" aria-labelledby="captures-title">
        <SectionLabel>THE SIX PACKAGED CAPTURES</SectionLabel>
        <div className="table-wrap">
          <table className="data-table" id="captures-title">
            <thead>
              <tr>
                <th scope="col">Capture</th>
                <th scope="col">Read</th>
                <th scope="col">Checkpoint</th>
                <th scope="col">State at read</th>
                <th scope="col">Records</th>
                <th scope="col">Source</th>
                <th scope="col">Feed digest (re-verified)</th>
              </tr>
            </thead>
            <tbody>
              {data.captures.map((capture) => (
                <tr key={capture.id}>
                  <td>{capture.id.toUpperCase()}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>
                    {formatStamp(capture.readAt)}
                  </td>
                  <td className="mono">{number(capture.checkpoint)}</td>
                  <td>
                    <span className="chip">{capture.state.replace(/_/g, " ")}</span>
                  </td>
                  <td className="mono">{capture.records}</td>
                  <td>
                    <span className="chip">{capture.sourceKind.replace(/_/g, " ")}</span>
                  </td>
                  <td>
                    <code title={capture.feedDigest}>{shortHash(capture.feedDigest, 10, 8)}</code>
                    <br />
                    <span className={capture.digestVerified ? "ok mono" : "no mono"} style={{ fontSize: 10.5 }}>
                      {capture.digestVerified ? "● VERIFIED ON BOOT" : "● FAILED"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="stack gap-6" style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
          {data.captures.map((capture) => (
            <li key={capture.id} className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
              {capture.id.toUpperCase()} · source file {capture.sourceFile} · sha256{" "}
              {capture.sourceFileSha256.slice(0, 16)}… · {capture.note}
            </li>
          ))}
        </ul>
      </section>

      <section className="manual-section" aria-labelledby="rules-title">
        <SectionLabel>THE RULES</SectionLabel>
        <div className="rules" id="rules-title">
          {data.boundaries.map((boundary) => (
            <article className="rule-card" key={boundary.id}>
              <span className="state">{boundary.state}</span>
              <h3>{boundary.title}</h3>
              <p>{boundary.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manual-section" aria-labelledby="check-title">
        <SectionLabel>HOW TO CHECK ME WITHOUT TRUSTING ME</SectionLabel>
        <div className="grid-2">
          <div className="panel panel--pad">
            <h3 className="h3" style={{ color: "var(--amber)", marginBottom: 8 }}>
              RECEIPT DIGESTS
            </h3>
            <p style={{ margin: "0 0 10px", color: "var(--bone-2)", fontSize: 13.5, lineHeight: 1.55 }}>
              {data.rule}
            </p>
            <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              {data.canonicalization}
            </p>
          </div>
          <div className="panel panel--pad">
            <h3 className="h3" style={{ color: "var(--amber)", marginBottom: 8 }}>
              REPRODUCE LOCALLY
            </h3>
            <pre
              className="mono-code"
              style={{ margin: 0, padding: 10, border: "1px dashed var(--line)", whiteSpace: "pre-wrap" }}
            >
              {`cd den
pnpm install --ignore-workspace
pnpm verify:evidence   # re-hash 6 captures + feed digests
pnpm test              # unit + API + persistence
pnpm test:e2e          # browser journey at 1440 and 390
pnpm build && pnpm start`}
            </pre>
          </div>
        </div>
      </section>

      <section className="manual-section" aria-labelledby="assets-title">
        <SectionLabel>ART AND TYPE LICENCES</SectionLabel>
        <div className="table-wrap">
          <table className="data-table" id="assets-title">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Kind</th>
                <th scope="col">Origin</th>
                <th scope="col">Rights</th>
                <th scope="col">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {data.assets.map((asset) => (
                <tr key={asset.id}>
                  <td className="mono">{asset.path.split("/").pop()}</td>
                  <td>{asset.kind}</td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {asset.origin}
                  </td>
                  <td>{asset.rights}</td>
                  <td>
                    <code>{shortHash(asset.sha256, 8, 6)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="manual-section" aria-labelledby="source-title">
        <SectionLabel>SOURCE</SectionLabel>
        <div className="panel panel--pad">
          <dl className="data-list" id="source-title">
            <div className="data-row data-row--dark">
              <dt>Owner worktree (read only)</dt>
              <dd>{data.sourceWorktree.path}</dd>
            </div>
            <div className="data-row data-row--dark">
              <dt>Owner HEAD</dt>
              <dd>{data.sourceWorktree.head}</dd>
            </div>
            <div className="data-row data-row--dark">
              <dt>Owner branch</dt>
              <dd>{data.sourceWorktree.branch}</dd>
            </div>
            <div className="data-row data-row--dark">
              <dt>Note</dt>
              <dd>{data.sourceWorktree.note}</dd>
            </div>
            <div className="data-row data-row--dark">
              <dt>This experiment</dt>
              <dd>den/ · branch experiment/binrat-den-01 · no deploy, no merge</dd>
            </div>
          </dl>
        </div>
      </section>

      <div style={{ marginTop: 26 }}>
        <RatWire page="manual" />
      </div>
    </>
  );
}
