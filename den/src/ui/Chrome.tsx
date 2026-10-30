import { Link, useRoute } from "../router";
import { IconDen, IconDesk, IconManual, IconPile, IconWire, RatMark } from "./Glyphs";

const ROOMS = [
  { to: "/", label: "DEN", key: "den", icon: IconDen },
  { to: "/pile", label: "THE PILE", key: "pile", icon: IconPile },
  { to: "/tripwire", label: "TRIPWIRE", key: "tripwire", icon: IconWire },
  { to: "/front-desk", label: "FRONT DESK", key: "desk", icon: IconDesk },
];

function isCurrent(path: string, to: string) {
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}

export function TopBar({ tripwires }: { tripwires: number }) {
  const path = useRoute();
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="BINRAT: The Den — home">
        <span className="brand-mark" aria-hidden="true" style={{ color: "var(--bone)" }}>
          <RatMark size={26} />
        </span>
        <span className="brand-text">
          <span className="brand-word">BINRAT</span>
          <span className="brand-sub">THE DEN</span>
        </span>
      </Link>

      <nav className="rooms" aria-label="Rooms">
        {ROOMS.map((room) => {
          const Icon = room.icon;
          return (
            <Link
              key={room.to}
              to={room.to}
              className="room"
              aria-current={isCurrent(path, room.to) ? "page" : undefined}
            >
              <Icon size={13} />
              {room.label}
              {room.key === "tripwire" && tripwires > 0 && <span className="room-count">{tripwires}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="top-right">
        <span className="mode-chip" title="No collector is running. The Den replays packaged windows.">
          <span className="mode-dot" aria-hidden="true" />
          RECORDED REPLAY
        </span>
        <Link to="/manual" className="manual-link" aria-current={isCurrent(path, "/manual") ? "page" : undefined}>
          FIELD MANUAL
        </Link>
      </div>
    </header>
  );
}

export function Hud({ tripwires }: { tripwires: number }) {
  const path = useRoute();
  const items = [
    { to: "/", label: "DEN", icon: IconDen },
    { to: "/pile", label: "PILE", icon: IconPile },
    { to: "/tripwire", label: `WIRE${tripwires ? ` ${tripwires}` : ""}`, icon: IconWire },
    { to: "/front-desk", label: "DESK", icon: IconDesk },
    { to: "/manual", label: "MANUAL", icon: IconManual },
  ];
  return (
    <nav className="hud" aria-label="Rooms">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className="hud-item"
            aria-current={isCurrent(path, item.to) ? "page" : undefined}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <h2>WHAT THIS IS</h2>
          <ul>
            <li>
              <span className="tick">▸</span> Six packaged Pons 4663 windows, 91 scraps, 120 reads.
            </li>
            <li>
              <span className="tick">▸</span> Every feed digest re-verified when the Den boots.
            </li>
            <li>
              <span className="tick">▸</span> Zero network calls at runtime. Your machine, your file.
            </li>
          </ul>
          <p className="footer-note">
            THE RAT REMEMBERS. He gets the scraps; you get the receipts. Nothing on this page is a
            verdict, a prediction or a price.
          </p>
        </div>
        <div>
          <h2>WHAT IT IS NOT</h2>
          <ul>
            <li>
              <span className="cross">✕</span> No live collector, alert delivery or Telegram.
            </li>
            <li>
              <span className="cross">✕</span> No checkout, payment, staking or entitlement.
            </li>
            <li>
              <span className="cross">✕</span> No $BINRAT token, address, sale or market claim.
            </li>
            <li>
              <span className="cross">✕</span> No identity, safety or profitability inference.
            </li>
          </ul>
        </div>
        <div>
          <h2>CHECK IT YOURSELF</h2>
          <ul>
            <li>
              <Link to="/manual" className="link-underline">
                Read the field manual
              </Link>
            </li>
            <li>
              <span className="mono" style={{ fontSize: 11.5 }}>
                pnpm verify:evidence
              </span>
            </li>
            <li>
              <span className="mono" style={{ fontSize: 11.5 }}>
                pnpm test
              </span>
            </li>
          </ul>
          <p className="footer-word" aria-hidden="true">
            THE RAT REMEMBERS · THE RAT REMEMBERS · THE RAT REMEMBERS
          </p>
        </div>
      </div>
    </footer>
  );
}
