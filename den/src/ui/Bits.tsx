import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatStamp, verifyReceiptPayload } from "../lib";
import type { Receipt } from "../types";
import { IconCheck, IconCross } from "./Glyphs";

export function Kicker({
  children,
  tone = "amber",
  as: Tag = "p",
}: {
  children: ReactNode;
  tone?: "amber" | "quiet" | "blood" | "acid";
  as?: "p" | "div" | "h2";
}) {
  const cls = tone === "amber" ? "kicker" : `kicker kicker--${tone}`;
  return <Tag className={cls}>{children}</Tag>;
}

export function Chip({
  children,
  tone,
  solid,
}: {
  children: ReactNode;
  tone?: "amber" | "blood" | "acid";
  solid?: boolean;
}) {
  const cls = ["chip", tone ? `chip--${tone}` : "", solid ? "chip--solid" : ""].filter(Boolean).join(" ");
  return <span className={cls}>{children}</span>;
}

export function Stamp({
  children,
  dark,
  soft,
  fresh,
}: {
  children: ReactNode;
  dark?: boolean;
  soft?: boolean;
  fresh?: boolean;
}) {
  const cls = ["stamp", dark ? "stamp--dark" : "", soft ? "stamp--soft" : "", fresh ? "stamp--fresh" : ""]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{children}</span>;
}

export function SectionLabel({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <h2 className={dark ? "section-label section-label--dark" : "section-label"}>{children}</h2>;
}

export function DataRow({ label, children, dark }: { label: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className={dark ? "data-row data-row--dark" : "data-row"}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function DenCam() {
  return (
    <figure className="cam">
      <figcaption className="cam-caption">
        <span className="cam-caption-left">
          <span className="rec-dot" aria-hidden="true" /> DEN CAM 03 · RECORDED STILL
        </span>
        <span>
          SUBJECT <b>RAT ZERO</b> · 08 OCT 2026
        </span>
      </figcaption>
      <div className="cam-frame">
        <img
          src="/assets/art/den-cam.webp"
          width={1000}
          height={800}
          alt="Pixel art: a black rat with one red cybernetic eye sits in a dumpster of discarded bags, cans and pizza, lit by a street lamp."
        />
        <span className="cam-tag cam-tag--br">ILLUSTRATION · NOT EVIDENCE</span>
      </div>
    </figure>
  );
}

const RAT_LINES: Record<string, string> = {
  den: "Six windows, ninety-one scraps, not one name. I keep what the record actually says.",
  "den-return": "You came back. The windows didn't move — but what I can replay for you did.",
  pile: "Smells familiar means I saw the address twice. Not that it's rotten. I don't guess.",
  case: "I file what I found and leave the holes visible. Read the unknowns before the headline.",
  wire: "A tripwire doesn't watch the chain. It pins a window so you can see what the next one recorded.",
  desk: "There is no till. There is a form. That is the whole economic story today.",
  manual: "If you only read one page, read the one that says what isn't live.",
  missing: "That file is not in this den. Six windows is not a chain; it never claimed to be.",
};

export function RatWire({ page = "den", line }: { page?: keyof typeof RAT_LINES | string; line?: string }) {
  const text = line ?? RAT_LINES[page] ?? RAT_LINES.den;
  return (
    <div className="rat-wire">
      <div className="rat-portrait" aria-hidden="true">
        <img src="/assets/art/den-cam.webp" alt="" width={1000} height={800} />
      </div>
      <p>
        <span className="who">RAT ZERO · ON THE RECORD</span>
        {text}
      </p>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  book,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  book?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={book ? "modal modal--book" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className="modal-head">
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          <button className="modal-close" onClick={onClose} ref={closeRef} type="button">
            CLOSE ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

type ToastTone = "info" | "good" | "bad";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { push: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const push = useCallback((message: string, tone: ToastTone = "info") => {
    counter.current += 1;
    const id = counter.current;
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 6000);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-wrap" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`} role="status">
            <span>{item.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export function ReceiptBlock({
  receipt,
  dark,
  title = "RECEIPT",
  defaultOpen = false,
}: {
  receipt: Receipt;
  dark?: boolean;
  title?: string;
  defaultOpen?: boolean;
}) {
  const [state, setState] = useState<"idle" | "running" | "ok" | "bad">("idle");
  const [computed, setComputed] = useState<string | null>(null);

  const verify = async () => {
    setState("running");
    try {
      const result = await verifyReceiptPayload(receipt.payload, receipt.digest);
      setComputed(result.recomputed);
      setState(result.verified ? "ok" : "bad");
    } catch {
      setState("bad");
    }
  };

  return (
    <div className={dark ? "receipt-block receipt-block--dark" : "receipt-block"}>
      <div className="spread" style={{ marginBottom: 8 }}>
        <span className={dark ? "mono muted" : "mono"} style={{ letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 10 }}>
          {title} · {receipt.kind}
        </span>
        <span className={dark ? "mono muted" : "mono"} style={{ fontSize: 10.5 }}>
          {formatStamp(receipt.issuedAt)}
        </span>
      </div>
      <div className={dark ? "digest digest--dark" : "digest"}>{receipt.digest}</div>
      <div className="verify-row">
        <button className={dark ? "btn btn--ghost btn--sm" : "btn btn--ghost btn--sm"} type="button" onClick={verify}>
          {state === "running" ? "CHECKING…" : "VERIFY IN THIS BROWSER"}
        </button>
        {state === "ok" && (
          <span className={dark ? "verified verified--dark" : "verified"}>
            <IconCheck size={12} /> DIGEST MATCH · RECOMPUTED HERE
          </span>
        )}
        {state === "bad" && (
          <span className={dark ? "verified verified--dark verified--bad" : "verified verified--bad"}>
            <IconCross size={12} /> MISMATCH · DO NOT TRUST THIS RECEIPT
          </span>
        )}
      </div>
      {computed && (
        <p className={dark ? "mono muted" : "mono"} style={{ fontSize: 10.5, wordBreak: "break-all", marginTop: 8 }}>
          recomputed: {computed}
        </p>
      )}
      <details style={{ marginTop: 10 }}>
        <summary
          className={dark ? "mono muted" : "mono"}
          style={{ cursor: "pointer", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          {defaultOpen ? "Hide" : "Show"} the SHA-256 payload ({Object.keys(receipt.payload).length} fields)
        </summary>
        <pre
          className="mono-code"
          style={{
            maxHeight: 260,
            overflow: "auto",
            margin: "10px 0 0",
            padding: 10,
            border: `1px dashed ${dark ? "var(--line)" : "rgba(120,98,62,.4)"}`,
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify(receipt.payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function Loading({ label = "READING THE DEN…" }: { label?: string }) {
  return (
    <div className="stack gap-10" role="status" aria-live="polite" style={{ padding: "40px 0" }}>
      <p className="kicker kicker--quiet">{label}</p>
      <div className="skeleton" style={{ width: "60%", height: 22 }} />
      <div className="skeleton" style={{ width: "88%" }} />
      <div className="skeleton" style={{ width: "74%" }} />
    </div>
  );
}

export function ErrorPanel({
  title = "THE DEN DID NOT ANSWER",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="notice notice--blood" role="alert">
      <p className="h3" style={{ marginBottom: 6 }}>
        {title}
      </p>
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry && (
        <button className="btn btn--ghost btn--sm" type="button" onClick={onRetry} style={{ marginTop: 12 }}>
          TRY AGAIN
        </button>
      )}
    </div>
  );
}
