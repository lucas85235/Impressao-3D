import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { authAttempts, sessions, users } from "@/db/schema";
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from "@/lib/session-cookie";

// ─── Senhas ────────────────────────────────────────────────────────────────

export { hashPassword, verifyPassword, PASSWORD_MIN_LENGTH } from "./password";

// ─── Sessões ───────────────────────────────────────────────────────────────

const RENEW_WHEN_LESS_THAN_MS = 15 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cria a sessão e grava o cookie. Só pode ser chamada em Server Action / Route Handler. */
export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: number; name: string; email: string };

/** Usuário logado (ou null). Deduplicado por requisição. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row) return null;
  const remaining = row.expiresAt.getTime() - Date.now();
  if (remaining <= 0) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (remaining < RENEW_WHEN_LESS_THAN_MS) {
    // Sessão deslizante: quem usa o app continua logado. (O cookie é renovado pelo proxy.)
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, id));
  }
  return { id: row.userId, name: row.name, email: row.email };
});

/** Garante usuário logado — use em TODA página e server action protegida. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function hasAnyUser(): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(users);
  return (row?.n ?? 0) > 0;
}

// ─── Limite de tentativas de login ─────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function loginThrottle(key: string): Promise<{ blocked: boolean; retryInMinutes: number }> {
  const [row] = await db.select().from(authAttempts).where(eq(authAttempts.key, key)).limit(1);
  if (!row) return { blocked: false, retryInMinutes: 0 };
  const elapsed = Date.now() - row.windowStart.getTime();
  if (elapsed > WINDOW_MS) return { blocked: false, retryInMinutes: 0 };
  return {
    blocked: row.count >= MAX_ATTEMPTS,
    retryInMinutes: Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 60000)),
  };
}

export async function registerFailedLogin(key: string) {
  const [row] = await db.select().from(authAttempts).where(eq(authAttempts.key, key)).limit(1);
  const now = new Date();
  if (!row || now.getTime() - row.windowStart.getTime() > WINDOW_MS) {
    await db
      .insert(authAttempts)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: authAttempts.key, set: { count: 1, windowStart: now } });
  } else {
    await db
      .update(authAttempts)
      .set({ count: row.count + 1 })
      .where(eq(authAttempts.key, key));
  }
}

export async function clearLoginAttempts(key: string) {
  await db.delete(authAttempts).where(eq(authAttempts.key, key));
}
