import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-cookie";

/*
 * Checagem OTIMISTA de login (só olha se o cookie existe).
 * A validação real da sessão acontece em requireUser(), em cada página e server action.
 */

const PUBLIC_PATHS = ["/login", "/setup"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!token && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  if (token) {
    // Renova a validade do cookie a cada navegação (sessão deslizante).
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/cron|sw\\.js|manifest\\.webmanifest|icons/|icon|apple-icon|favicon\\.ico|robots\\.txt).*)",
  ],
};
