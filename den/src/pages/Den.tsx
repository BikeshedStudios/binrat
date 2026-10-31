import { formatStamp, number, signed } from "../lib";
import { Link } from "../router";
import type { DenPayload } from "../types";
import { DenCam, Kicker, RatWire, Stamp } from "../ui/Bits";
import { IconArrow, IconFile, IconPile, IconWire } from "../ui/Glyphs";

type VisitInfo = {
  firstVisit: boolean;
  previousSeenAt: string | null;
  sinceMs: number | null;
  tripwires: { count: number; replayable: number };
} | null;

function awayCopy(den: DenPayload) {
  const { count, replayable } = den.tripwires;
  if (count > 0) {
    return {
      title: count === 1 ? "ONE FILE IS STILL PINNED." : `${count} FILES ARE STILL PINNED.`,
      body:
        replayable > 0
          ? `${replayable} of them can replay a later recorded window right now. The replay compares two packaged captures and hands you a digest — it is not a notification and nothing was fetched.`
          : "None of the pinned files appear in a later recorded window yet. The Rat will say so rather than invent an event.",
      cta: "OPEN THE TRIPWIRE",
      to: "/tripwire",
      steps: [
        replayable > 0 ? "LATER WINDOWS RECORDED IT" : "NO LATER RECORD YET",
        "RECORDED REPLAY ONLY",
        "NO ALERT DELIVERED",
      ],
    };
  }
  return {
    title: "THE RETURN HOOK IS A PIN, NOT A PROMISE.",
    body:
      "Leave a file with the Rat and he pins the window it came from. Come back and he replays what later recorded windows already contain, with both feed digests. No collector runs, so no alert is ever claimed.",
    cta: "CHOOSE A FILE TO PIN",
    to: `/case/${den.lead.caseId}`,
    steps: ["PIN A FILE", "COME BACK", "READ THE RECORDED DIFF"],
  };
}

export function Den({ den, visit }: { den: DenPayload; visit: VisitInfo }) {
  const lead = den.lead;
  const movement = lead.movement;
  const away = awayCopy(den);
  const evidence = den.evidence;

  return (
    <>
      <section className="hero" aria-labelledby="den-title">
        <div className="hero-copy">
          <Kicker>PONS 4663 · RECORDED REPLAY</Kicker>
          <h1 className="hero-title" id="den-title">
            THE RAT
            <br />
            <span className="line-2">REMEMBERS.</span>
          </h1>
          <p className="hero-lede">
            {number(evidence.captureCount)} recorded windows. <b>{number(evidence.launchCount)} scraps</b>.{" "}
            <b>No names in any of them</b>. One address's provider-reported prior-launch count was{" "}
            <b>{number(movement?.delta ?? 0)} higher</b> in a later capture. That is not proof of launches in that interval.
          </p>
          <div className="cta-row">
            <Link to={`/case/${lead.caseId}`} className="btn">
              OPEN THE FILE <IconArrow size={14} />
            </Link>
            <Link to="/pile" className="btn btn--ghost">
              SNIFF THE PILE
            </Link>
          </div>
          <div className="hero-facts" aria-label="Evidence at a glance">
            <span>08–09 OCT 2026</span>
            <span>{number(evidence.captureCount)} WINDOWS</span>
            <span>{number(evidence.recordCount)} READS</span>
            <span>{number(evidence.launchCount)} SCRAPS</span>
            <span>{number(evidence.namedRecords)} NAMES</span>
          </div>
        </div>

        <Link
          to={`/case/${lead.caseId}`}
          className="lead-card paper paper--torn"
          aria-label={`Open the lead file: ${lead.handle}, block ${lead.fileNumber}`}
        >
          <span className="paper-tape paper-tape--tl" aria-hidden="true" />
          <div className="lead-top">
            <span className="lead-kicker">
              RAT HANDLE <b className="lead-handle">{lead.handle}</b> · FILE {number(lead.fileNumber)}
            </span>
            <Stamp soft>PARTIAL COVERAGE</Stamp>
          </div>
          <h2 className="lead-title">{lead.dossierHeadline}</h2>
          <p className="lead-deck">{lead.dossierDeck}</p>
          {movement && (
            <div className="movement">
              <span className="from">{number(movement.from)}</span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
              <span className="to">{number(movement.to)}</span>
              <span className="delta">{signed(movement.delta)} reported count</span>
              <span className="movement-caption">
                Recorded prior-launch count for {lead.deployerShort} · {formatStamp(movement.fromReadAt)} →{" "}
                {formatStamp(movement.toReadAt)}
              </span>
            </div>
          )}
          <div className="lead-foot">
            <span className="micro">RAT HANDLE, NOT A TOKEN NAME · NOT A VERDICT</span>
            <span className="h3" style={{ color: "#8c2a1c" }}>
              OPEN FILE {number(lead.fileNumber)} →
            </span>
          </div>
        </Link>

        <div className="hero-art">
          <DenCam />
        </div>
      </section>

      <section className="panel panel--pad" style={{ marginBottom: 18 }} aria-label="Historical canonical Case">
        <Kicker tone="quiet">SEPARATE EVIDENCE · OCTOBER 2026 PRODUCTION CAPTURE</Kicker>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 className="h3" style={{ margin: "8px 0", color: "var(--bone)" }}>ONE CANONICAL CASE. NOT ANOTHER REPLAY.</h2>
            <p style={{ color: "var(--bone-3)", margin: 0 }}>An older source-backed Case with 19 earlier indexed launches and a fixed historical receipt.</p>
          </div>
          <Link to="/canonical-case" className="btn btn--ghost">OPEN THE OLD FILE →</Link>
        </div>
      </section>
      <div className="tape" aria-label="Provenance summary">
        <strong>CHAIN {evidence.chainId}</strong>
        <span className="tape-sep">/</span>
        <span>{number(evidence.captureCount)} PACKAGED CAPTURES</span>
        <span className="tape-sep">/</span>
        <span>{number(evidence.recordCount)} RECORDS READ</span>
        <span className="tape-sep">/</span>
        <span>{number(evidence.launchCount)} DISTINCT SCRAPS</span>
        <span className="tape-sep">/</span>
        <span className="acid">
          {evidence.allDigestsVerified ? "ALL FEED DIGESTS RE-VERIFIED" : "DIGEST CHECK FAILED"}
        </span>
        <span className="tape-sep">/</span>
        <span>NO LIVE FEED · NO NETWORK AT RUNTIME</span>
      </div>

      <section className="away" aria-labelledby="away-title">
        <div className="away-icon" aria-hidden="true">
          <IconWire size={22} />
        </div>
        <div>
          <h2 id="away-title">{away.title}</h2>
          <p>{away.body}</p>
          <div className="away-steps">
            {away.steps.map((step) => (
              <span key={step}>{step}</span>
            ))}
          </div>
          {den.tripwires.lastReplayAt && (
            <p className="mono" style={{ margin: "10px 0 0", fontSize: 10.5, color: "var(--muted)" }}>
              LAST REPLAY {formatStamp(den.tripwires.lastReplayAt)} · DIGEST{" "}
              {(den.tripwires.lastReplayDigest ?? "").slice(0, 20)}…
            </p>
          )}
        </div>
        <Link to={away.to} className="btn btn--ghost btn--sm">
          {away.cta}
        </Link>
      </section>

      {visit?.previousSeenAt && !visit.firstVisit && (
        <p className="mono muted" style={{ marginTop: 12, fontSize: 11.5 }}>
          DEN REOPENED · LAST SEEN {formatStamp(visit.previousSeenAt)} ·{" "}
          {den.tripwires.count > 0
            ? `${den.tripwires.count} pinned · ${den.tripwires.replayable} replayable`
            : "nothing pinned yet"}
        </p>
      )}

      <section className="doors" aria-labelledby="doors-title">
        <div className="doors-head">
          <h2 className="h2" id="doors-title">
            THREE DOORS. NO DASHBOARD.
          </h2>
          <p className="mono muted" style={{ fontSize: 11.5, margin: 0 }}>
            Every control below performs a real local action.
          </p>
        </div>
        <div className="doors-grid">
          <Link to="/pile" className="door">
            <div className="door-icon">
              <IconPile size={20} />
              <span className="kicker" style={{ margin: 0 }}>
                DISCOVER
              </span>
            </div>
            <h3>THE PILE</h3>
            <p>
              {number(evidence.launchCount)} scraps out of {number(evidence.captureCount)} windows. Search any
              address, token, transaction or block. Three lenses, no scores.
            </p>
            <div className="door-foot">
              <span>
                <b>{number(evidence.launchCount)}</b> FILES
              </span>
              <span>OPEN →</span>
            </div>
          </Link>

          <Link to="/tripwire" className="door door--acid">
            <div className="door-icon">
              <IconWire size={20} />
              <span className="kicker kicker--acid" style={{ margin: 0 }}>
                REMEMBER
              </span>
            </div>
            <h3>THE TRIPWIRE</h3>
            <p>
              Pin a file to its recorded window. Replaying later windows is the only “return” this build
              can honestly offer — so it is the one it offers.
            </p>
            <div className="door-foot">
              <span>
                <b>{number(den.tripwires.count)}</b> PINNED · <b>{number(den.tripwires.replayable)}</b>{" "}
                REPLAYABLE
              </span>
              <span>OPEN →</span>
            </div>
          </Link>

          <Link to="/front-desk" className="door door--blood">
            <div className="door-icon">
              <IconFile size={20} />
              <span className="kicker kicker--blood" style={{ margin: 0 }}>
                EMPLOY
              </span>
            </div>
            <h3>THE FRONT DESK</h3>
            <p>
              Request a bounded investigation and watch the Rat work the records locally. There is no
              checkout, no charge and no entitlement.
            </p>
            <div className="door-foot">
              <span>
                <b>INTEREST ONLY</b>
              </span>
              <span>OPEN →</span>
            </div>
          </Link>
        </div>
      </section>

      <section className="doors" aria-labelledby="loop-title">
        <div className="doors-head">
          <h2 className="h2" id="loop-title">
            THE LOOP, IN FOUR MOVES.
          </h2>
        </div>
        <ol className="loop" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {[
            {
              n: "01",
              title: "FIND",
              text: "Open a scrap with a real address, block and transaction.",
              to: `/case/${lead.caseId}`,
              cta: "THE LEAD",
            },
            {
              n: "02",
              title: "EMPLOY",
              text: "Make the Rat cross-check every recorded window and write a file.",
              to: `/case/${lead.caseId}`,
              cta: "RUN IT",
            },
            {
              n: "03",
              title: "LEAVE",
              text: "Pin the file to its baseline capture. It survives a restart.",
              to: "/tripwire",
              cta: "PIN IT",
            },
            {
              n: "04",
              title: "RETURN",
              text: "Replay what later windows already recorded, with both digests.",
              to: "/tripwire",
              cta: "REPLAY IT",
            },
          ].map((step) => (
            <li key={step.n} className="loop-step">
              <span className="loop-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <Link to={step.to} className="loop-cta">
                {step.cta} →
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div style={{ marginTop: 24 }}>
        <RatWire page={visit && !visit.firstVisit ? "den-return" : "den"} />
      </div>

      <section className="limits" aria-label="Limits">
        <h2 className="kicker kicker--quiet">WHAT IS NOT HAPPENING</h2>
        <ul>
          {den.limits.map((limit) => (
            <li key={limit.label}>
              <span className="mono">{limit.label}</span>
              <b>{limit.state}</b>
              <span>{limit.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
