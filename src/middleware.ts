import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Endpoints called by third parties / schedulers, authenticated by signature or secret instead of Origin.
const CSRF_EXEMPT = ["/api/auth/", "/api/payments/liqpay/callback", "/api/cron/"];

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const role = req.auth?.user?.role;

  if (path.startsWith("/admin")) {
    if (!req.auth) return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(path)}`, nextUrl));
    if (role !== "ADMIN" && role !== "STAFF") return NextResponse.redirect(new URL("/", nextUrl));
  }
  if (path.startsWith("/account") && !req.auth) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(path)}`, nextUrl));
  }

  // CSRF: browsers always send Origin on cross-site POSTs. Reject state-changing API calls from other origins.
  if (path.startsWith("/api/") && MUTATING.has(req.method) && !CSRF_EXEMPT.some((p) => path.startsWith(p))) {
    const origin = req.headers.get("origin");
    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (!origin || (origin !== nextUrl.origin && origin !== site)) {
      return NextResponse.json({ error: "Forbidden (origin)" }, { status: 403 });
    }
  }
  return NextResponse.next();
});

export const config = { matcher: ["/admin/:path*", "/account/:path*", "/api/:path*"] };
