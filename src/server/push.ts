import "server-only";
import { eq } from "drizzle-orm";
import { sendNotification, setVapidDetails, WebPushError } from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

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

/** Envia para todos os dispositivos inscritos. Remove inscrições expiradas. */
export async function sendPushToAll(payload: PushPayload) {
  if (!isPushConfigured()) return { sent: 0, failed: 0, removed: 0, devices: 0, error: "Push não configurado (VAPID)." };
  configure();
  const subs = await db.select().from(pushSubscriptions);
  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const sub of subs) {
    try {
      await sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 12 * 60 * 60, urgency: "normal" },
      );
      sent++;
      await db.update(pushSubscriptions).set({ lastUsedAt: new Date() }).where(eq(pushSubscriptions.id, sub.id));
    } catch (err) {
      if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        removed++;
      } else {
        failed++;
        console.error("[push] falha ao enviar", err);
      }
    }
  }
  return { sent, failed, removed, devices: subs.length };
}
