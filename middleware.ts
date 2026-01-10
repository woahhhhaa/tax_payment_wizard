import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;

  // If this is missing in production, next-auth/jwt can throw and Vercel will
  // surface it as `MIDDLEWARE_INVOCATION_FAILED` (500) for protected routes.
  // Fail closed by redirecting to login instead of crashing the whole route.
  if (!secret) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    url.searchParams.set("error", "missing_nextauth_secret");
    return NextResponse.redirect(url);
  }

  let token: Awaited<ReturnType<typeof getToken>> | null = null;
  try {
    token = await getToken({
      req: request,
      secret
    });
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    url.searchParams.set("error", "auth_token_error");
    return NextResponse.redirect(url);
  }

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/wizard", "/tax_payment_wizard_new.html"]
};
