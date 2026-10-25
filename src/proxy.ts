// First line of route protection (Next.js 16 `proxy`, formerly middleware).
// It validates the session and the role's area, but every page, server action and route
// handler re-checks authorization itself (see src/server/auth/session.ts and src/server/authz).

import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth/auth";
import { AREA_ROLES, ROLE_HOME, areaForPath, isRole } from "@/server/authz/roles";

const CHANGE_PASSWORD_PATH = "/account/change-password";
const PROTECTED_PREFIXES = ["/admin", "/manager", "/supervisor", "/association", "/account", "/dashboard"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Development-only routes (the private design lab) never exist in production builds.
  if (process.env.NODE_ENV === "production" && (pathname === "/dev" || pathname.startsWith("/dev/"))) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  if (pathname !== "/login" && !isProtected(pathname)) return NextResponse.next();

  const session = getSessionCookie(request) ? await auth.api.getSession({ headers: request.headers }) : null;
  const user = session?.user as { role?: unknown; mustChangePassword?: boolean; isActive?: boolean } | undefined;
  const signedIn = Boolean(user && user.isActive !== false && isRole(user.role));

  if (pathname === "/login") {
    if (signedIn && isRole(user?.role)) return NextResponse.redirect(new URL(ROLE_HOME[user.role], request.url));
    return NextResponse.next();
  }

  if (!signedIn || !isRole(user?.role)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (user.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
  }

  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL(ROLE_HOME[user.role], request.url));
  }

  const area = areaForPath(pathname);
  if (area && !AREA_ROLES[area].includes(user.role)) {
    return NextResponse.rewrite(new URL("/forbidden", request.url), { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|brand|fonts|favicon.ico|icon.svg|robots.txt).*)"],
};
