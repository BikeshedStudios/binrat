/** Receipt verification: the browser must be able to disagree with the server. */
export function canonicalJson(value: unknown): string {
  const normalize = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(normalize)
      : item && typeof item === "object"
        ? Object.fromEntries(
            Object.keys(item as Record<string, unknown>)
              .sort()
              .map((key) => [key, normalize((item as Record<string, unknown>)[key])]),
          )
        : item;
  return JSON.stringify(normalize(value));
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyReceiptPayload(payload: unknown, expected: string) {
  const recomputed = await sha256Hex(canonicalJson(payload));
  return { recomputed, verified: recomputed === expected };
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getUTCDate())} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function formatWhen(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function number(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n.toLocaleString("en-GB") : String(value);
}

export function signed(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("en-GB")}`;
}

export function shortHash(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
