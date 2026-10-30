import { useEffect, useRef, useState } from "react";
import { api, ApiFailure } from "../api";
import { number } from "../lib";
import { useNavigate } from "../router";
import type { PilePayload } from "../types";
import { ErrorPanel, Kicker, Loading, RatWire } from "../ui/Bits";
import { IconArrow, IconSearch } from "../ui/Glyphs";

const LENS_LABEL: Record<string, string> = {
  scent: "SMELLS FAMILIAR",
  fresh: "LATEST SCRAPS",
  longest: "LONGEST RECORD",
};

export function Pile() {
  const navigate = useNavigate();
  const [lens, setLens] = useState<"scent" | "fresh" | "longest">("scent");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .pile({ lens, q: query })
        .then((payload) => {
          if (!controller.signal.aborted) {
            setData(payload);
            setLoading(false);
          }
        })
        .catch((failure: unknown) => {
          if (controller.signal.aborted) return;
          setError(failure instanceof ApiFailure ? failure.message : "The pile could not be read.");
          setLoading(false);
        });
    }, query ? 220 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lens, query, nonce]);

  return (
    <>
      <header className="page-head">
        <div>
          <Kicker>ROOM 02 · DISCOVER</Kicker>
          <h1 className="page-title">THE PILE.</h1>
          <p className="page-sub">
            Every scrap the Rat could pull from {number(data?.total ?? 0)} distinct launches across six
            recorded windows. No scores, no rankings of “quality” — only what the record holds.
          </p>
        </div>
        <div className="page-count">
          <b>{number(data?.matched ?? 0)}</b>
          <span>SCRAPS SHOWN</span>
          <span>OF {number(data?.total ?? 0)} DISTINCT · {number(120)} WINDOW READS</span>
        </div>
      </header>

      <div className="pile-controls">
        <div className="lenses" role="group" aria-label="Lens">
          {(data?.lenses ?? [
            { id: "scent", label: LENS_LABEL.scent, hint: "Addresses the Rat recorded in more than one window." },
            { id: "fresh", label: LENS_LABEL.fresh, hint: "Newest recorded blocks first." },
            { id: "longest", label: LENS_LABEL.longest, hint: "Highest recorded prior-launch count first." },
          ]).map((option) => (
            <button
              key={option.id}
              type="button"
              className="lens"
              aria-pressed={lens === option.id}
              title={option.hint}
              onClick={() => setLens(option.id as typeof lens)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="sniff">
          <IconSearch size={14} />
          <span className="visually-hidden">Search scraps by address, token, transaction, block or handle</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 120))}
            placeholder="0x address / token / tx / block"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {query && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setQuery("")}>
            CLEAR
          </button>
        )}
      </div>

      <p className="pile-hint">
        LENS: {LENS_LABEL[lens]} · SORTED LOCALLY, NEVER SCORED · {data?.query ? `FILTER “${data.query}”` : "NO FILTER"}
      </p>

      {error && <ErrorPanel message={error} onRetry={() => setNonce((n) => n + 1)} />}
      {loading && !data && <Loading label="SNIFFING THE PILE…" />}

      {data && data.rows.length === 0 && (
        <div className="empty">
          <p className="h2" style={{ fontSize: 16, marginBottom: 8 }}>
            NOTHING IN THESE {number(data.total)} SCRAPS.
          </p>
          <p style={{ margin: 0 }}>
            That is a statement about this partial index, not about the chain. Try a shorter fragment or
            clear the filter.
          </p>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div className="pile-grid" aria-live="polite">
          {data.rows.map((row) => (
            <button
              key={row.caseId}
              type="button"
              className="scrap"
              onClick={() => navigate(`/case/${row.caseId}`)}
              aria-label={`Open file ${row.fileNumber}, rat handle ${row.handle}, ${row.windows} recorded windows`}
            >
              <span className="scrap-top">
                <span className="scrap-rank">#{String(row.rank).padStart(2, "0")}</span>
                <span>{row.windows > 1 ? `SEEN IN ${row.windows} WINDOWS` : "ONE WINDOW"}</span>
              </span>
              <span className="scrap-handle">{row.handle}</span>
              <span className="scrap-block">BLOCK {number(row.block)}</span>
              <span className="scrap-addr">{row.deployerShort}</span>
              <span className="scrap-badges">
                <span className="mini-badge">PRIOR {number(row.priorLaunchCount)}</span>
                {row.scrapReads > 1 && <span className="mini-badge">READ {row.scrapReads}×</span>}
                {row.priorDelta > 0 && (
                  <span className="mini-badge mini-badge--red">COUNT MOVED +{number(row.priorDelta)}</span>
                )}
                {row.metadataFilled === 0 && <span className="mini-badge">NO NAME</span>}
              </span>
              <span className="scrap-foot">
                <span>{row.captureId.toUpperCase()} · {row.captureState.replace(/_/g, " ")}</span>
                <span>
                  <b>OPEN</b> <IconArrow size={11} />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {data?.after && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <a className="btn btn--ghost btn--sm" href={`/api/pile?lens=${lens}&q=${encodeURIComponent(query)}&offset=${data.after}`}>
            MORE SCRAPS (API)
          </a>
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        <RatWire page="pile" />
      </div>
    </>
  );
}
