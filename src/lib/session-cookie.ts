// Compartilhado entre proxy.ts e server/auth.ts.

export const SESSION_COOKIE = "g3d_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

/**
 * Cookie "secure" em produção. Para rodar `npm start` em rede local via http
 * (sem HTTPS), defina COOKIE_SECURE=false.
 */
export function isCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
}

export function sessionCookieOptions(maxAgeMs = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}
