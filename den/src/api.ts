import type {
  CasePayload,
  DenPayload,
  EmployResponse,
  MethodPayload,
  PilePayload,
  Receipt,
  Tripwire,
  WorkOrderResponse,
} from "./types";

const SESSION_KEY = "binrat.den.session.v1";
export const DEN_REFRESH_EVENT = "binrat:den-refresh";

export function refreshDen() {
  window.dispatchEvent(new Event(DEN_REFRESH_EVENT));
}

function makeSession(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function denSession(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && /^[a-z0-9-]{8,64}$/i.test(existing)) return existing;
    const created = makeSession();
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return "no-storage-session";
  }
}

export class ApiFailure extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("x-den-session", denSession());
  if (init.body) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiFailure(0, "OFFLINE", "The Den's local server did not answer. Is it running?");
  }
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiFailure(response.status, "BAD_JSON", "The Den returned something that is not JSON.");
    }
  }
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiFailure(response.status, error?.code ?? "REQUEST_FAILED", error?.message ?? `Request failed (${response.status}).`);
  }
  return body as T;
}

export const api = {
  den: () => request<DenPayload>("/api/den"),
  canonicalCase: () => request<import("./types").CanonicalCasePayload>("/api/canonical-case"),
  visit: () =>
    request<{
      firstVisit: boolean;
      previousSeenAt: string | null;
      sinceMs: number | null;
      tripwires: { count: number; replayable: number };
    }>("/api/visit", { method: "POST" }),
  pile: (params: { lens: string; q: string }) =>
    request<PilePayload>(`/api/pile?lens=${encodeURIComponent(params.lens)}&q=${encodeURIComponent(params.q)}&limit=120`),
  case: (id: string) => request<CasePayload>(`/api/case/${id}`),
  employ: (id: string, fresh = false) =>
    request<EmployResponse>(`/api/case/${id}/employ`, {
      method: "POST",
      body: JSON.stringify({ fresh }),
    }),
  watch: (id: string, note: string) =>
    request<{ tripwire: Tripwire; created: boolean }>(`/api/case/${id}/watch`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  tripwires: () => request<{ tripwires: Tripwire[] }>("/api/tripwires"),
  replay: (id: string) =>
    request<{ replay: import("./types").ReplayView; receipt: Receipt; tripwire: Tripwire }>(
      `/api/tripwires/${id}/replay`,
      { method: "POST", body: "{}" },
    ),
  drop: (id: string) => request<{ tripwire: Tripwire | null }>(`/api/tripwires/${id}`, { method: "DELETE" }),
  workOrders: () => request<{ orders: unknown[]; paymentTaken: false }>("/api/work-orders"),
  requestWork: (scope: string, note: string) =>
    request<WorkOrderResponse>("/api/work-orders", {
      method: "POST",
      body: JSON.stringify({ scope, note }),
    }),
  method: () => request<MethodPayload>("/api/method"),
  receipt: (id: string) =>
    request<{ receipt: Receipt; recomputed: string; verified: boolean; rule: string }>(`/api/receipts/${id}`),
};
