import "server-only";
import { inArray } from "drizzle-orm";
import { sendNotification, setVapidDetails, WebPushError } from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

export type PushResult = { sent: number; failed: number; removed: number; devices: number; error?: string };

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured) return;
  const subject =
    process.env.VAPID_SUBJECT ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "mailto:admin@example.com");
  setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

/** Envia para todos os dispositivos inscritos (em paralelo, com timeout). Remove inscrições expiradas. */
export async function sendPushToAll(payload: PushPayload): Promise<PushResult> {
  if (!isPushConfigured()) return { sent: 0, failed: 0, removed: 0, devices: 0, error: "Push não configurado (VAPID)." };
  try {
    configure();
  } catch (err) {
    console.error("[push] chaves VAPID inválidas", err);
    return { sent: 0, failed: 0, removed: 0, devices: 0, error: "Chaves VAPID inválidas (gere de novo com npm run vapid)." };
  }

  const subs = await db.select().from(pushSubscriptions);
  const body = JSON.stringify(payload);
  // Um serviço de push lento não pode segurar os outros nem estourar o tempo da função.
  const results = await Promise.allSettled(
    subs.map((sub) =>
      sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
        TTL: 12 * 60 * 60,
        urgency: "normal",
        timeout: 10_000,
      }),
    ),
  );

  const delivered: number[] = [];
  const expired: number[] = [];
  let failed = 0;
  results.forEach((result, i) => {
    if (result.status === "fulfilled") delivered.push(subs[i].id);
    else if (result.reason instanceof WebPushError && (result.reason.statusCode === 404 || result.reason.statusCode === 410)) {
      expired.push(subs[i].id);
    } else {
      failed++;
      console.error("[push] falha ao enviar", result.reason);
    }
  });

  if (delivered.length) {
    await db.update(pushSubscriptions).set({ lastUsedAt: new Date() }).where(inArray(pushSubscriptions.id, delivered));
  }
  if (expired.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, expired));
  return { sent: delivered.length, failed, removed: expired.length, devices: subs.length };
}
