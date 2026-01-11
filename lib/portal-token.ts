import { createHash, randomBytes } from "crypto";

export function generatePortalToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPortalToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
