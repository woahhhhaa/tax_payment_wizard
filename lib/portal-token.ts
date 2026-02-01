import { createHash, randomBytes } from "crypto";

const DEFAULT_LINK_TTL_DAYS = 30;

export function generatePortalToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPortalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getPortalBaseUrl(request: Request): string {
  const configured =
    process.env.APP_BASE_URL || process.env.PORTAL_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || "";
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return getRequestOrigin(request);
}

export function getPortalLinkExpiresAt(now: Date, ttlDays = getPortalLinkTtlDays()): Date {
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}

export function getPortalLinkTtlDays(): number {
  const raw = Number(process.env.PORTAL_LINK_TTL_DAYS ?? DEFAULT_LINK_TTL_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LINK_TTL_DAYS;
  return Math.min(Math.max(Math.floor(raw), 1), 365);
}

export function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const proto = forwardedProto ? forwardedProto.split(",")[0]?.trim() : "https";
    if (host) {
      return `${proto}://${host}`;
    }
  }
  return new URL(request.url).origin;
}
