import { useCallback, useEffect, useState } from "react";
import { api, ApiFailure, DEN_REFRESH_EVENT } from "./api";
import { number } from "./lib";
import { Link, useRoute } from "./router";
import type { DenPayload } from "./types";
import { ErrorPanel, Kicker, Loading, RatWire } from "./ui/Bits";
import { Footer, Hud, TopBar } from "./ui/Chrome";
import { CaseFile } from "./pages/CaseFile";
import { CanonicalCase } from "./pages/CanonicalCase";
import { Den } from "./pages/Den";
import { FrontDesk } from "./pages/FrontDesk";
import { Manual } from "./pages/Manual";
import { Pile } from "./pages/Pile";
import { Tripwire } from "./pages/Tripwire";

type VisitInfo = {
  firstVisit: boolean;
  previousSeenAt: string | null;
  sinceMs: number | null;
  tripwires: { count: number; replayable: number };
} | null;

function NotFound() {
  return (
    <>
      <header className="page-head">
        <div>
          <Kicker tone="blood">ROOM NOT FOUND</Kicker>
          <h1 className="page-title">GRATE'S LOCKED.</h1>
          <p className="page-sub">
            That door is not part of this den. Nothing was lost: the five rooms are the Den, the Pile, the
            Tripwire, the Front Desk and the Field Manual.
          </p>
        </div>
      </header>
      <div className="doors-grid">
        <Link to="/" className="door">
          <h3>THE DEN</h3>
          <p>The lead file and the state of the evidence.</p>
          <div className="door-foot">
            <span>GO →</span>
          </div>
        </Link>
        <Link to="/pile" className="door">
          <h3>THE PILE</h3>
          <p>Every scrap the Rat pulled from the recorded windows.</p>
          <div className="door-foot">
            <span>GO →</span>
          </div>
        </Link>
        <Link to="/manual" className="door">
          <h3>FIELD MANUAL</h3>
          <p>What is live, what is recorded, what is not here.</p>
          <div className="door-foot">
            <span>GO →</span>
          </div>
        </Link>
      </div>
      <div style={{ marginTop: 24 }}>
        <RatWire page="missing" />
      </div>
    </>
  );
}

export default function App() {
  const path = useRoute();
  const [den, setDen] = useState<DenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState<VisitInfo>(null);

  const loadDen = useCallback(() => {
    setError(null);
    api
      .den()
      .then(setDen)
      .catch((failure: unknown) =>
        setError(failure instanceof ApiFailure ? failure.message : "The Den could not be reached."),
      );
  }, []);

  useEffect(() => {
    loadDen();
    api
      .visit()
      .then(setVisit)
      .catch(() => setVisit(null));
    const onRefresh = () => loadDen();
    window.addEventListener(DEN_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DEN_REFRESH_EVENT, onRefresh);
  }, [loadDen]);

  let page: React.ReactNode;
  if (path === "/") {
    page = den ? (
      <Den den={den} visit={visit} />
    ) : error ? (
      <ErrorPanel message={error} onRetry={loadDen} />
    ) : (
      <Loading />
    );
  } else if (path === "/pile") {
    page = <Pile />;
  } else if (path === "/canonical-case") {
    page = <CanonicalCase />;
  } else if (path.startsWith("/case/")) {
    const id = decodeURIComponent(path.slice("/case/".length)).replace(/\/+$/, "");
    page = id ? <CaseFile id={id} /> : <NotFound />;
  } else if (path === "/tripwire") {
    page = <Tripwire />;
  } else if (path === "/front-desk") {
    page = <FrontDesk />;
  } else if (path === "/manual") {
    page = <Manual />;
  } else {
    page = <NotFound />;
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        SKIP TO THE EVIDENCE
      </a>
      <TopBar tripwires={den?.tripwires.count ?? 0} />
      <main id="main" tabIndex={-1} className="main">
        {page}
      </main>
      <Footer />
      <Hud tripwires={den?.tripwires.count ?? 0} />
      <p className="visually-hidden">{den ? `${number(den.counters.scraps)} scraps recorded.` : ""}</p>
    </div>
  );
}
