import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, lte, ne, or, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { authAttempts, sessions, users } from "@/db/schema";
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from "@/lib/session-cookie";

// ─── Senhas ────────────────────────────────────────────────────────────────

export { hashPassword, verifyPassword, secretsMatch, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "./password";

// ─── Sessões ───────────────────────────────────────────────────────────────

const RENEW_WHEN_LESS_THAN_MS = 15 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cria a sessão e grava o cookie. Só pode ser chamada em Server Action / Route Handler. */
export async function createSession(userId: number) {
  const store = await cookies();
  const previous = store.get(SESSION_COOKIE)?.value;
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  // Faxina: a sessão anterior deste navegador e as sessões já vencidas.
  await db
    .delete(sessions)
    .where(or(lte(sessions.expiresAt, new Date()), previous ? eq(sessions.id, hashToken(previous)) : undefined));
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

/** Encerra as sessões do usuário em todos os outros aparelhos (a deste navegador continua). */
export async function revokeOtherSessions(userId: number) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const current = token ? hashToken(token) : "";
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, current)));
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

// ─── Limite de tentativas (login, criação da conta, troca de senha) ────────

const WINDOW_MS = 15 * 60 * 1000;

export type AttemptCheck = { blocked: boolean; retryInMinutes: number };

/**
 * Conta UMA tentativa para `key` e diz se ela passou de `max` na janela de 15 min.
 * Chame ANTES de conferir a senha/código. É um único INSERT … ON CONFLICT (atômico):
 * requisições em paralelo não conseguem passar todas juntas pelo limite.
 */
export async function takeAttempt(key: string, max: number): Promise<AttemptCheck> {
  const now = Date.now();
  const expired = sql`${authAttempts.windowStart} <= ${now - WINDOW_MS}`;
  const [row] = await db
    .insert(authAttempts)
    .values({ key, count: 1, windowStart: new Date(now) })
    .onConflictDoUpdate({
      target: authAttempts.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${authAttempts.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN ${now} ELSE ${authAttempts.windowStart} END`,
      },
    })
    .returning({ count: authAttempts.count, windowStart: authAttempts.windowStart });
  const elapsed = now - row.windowStart.getTime();
  return {
    blocked: row.count > max,
    retryInMinutes: Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 60000)),
  };
}

export async function clearAttempts(key: string) {
  await db.delete(authAttempts).where(eq(authAttempts.key, key));
}

/** Apaga contadores com a janela vencida (a tabela não cresce sem limite). */
export async function pruneAttempts() {
  await db.delete(authAttempts).where(lte(authAttempts.windowStart, new Date(Date.now() - WINDOW_MS)));
}

/** IP de quem fez a requisição. Na Vercel o x-forwarded-for é preenchido pela plataforma (não pelo cliente). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "local";
}
