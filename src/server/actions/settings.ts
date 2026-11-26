"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { fail, ok, type ActionResult } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { isPushConfigured, sendPushToAll } from "@/server/push";
import { buildDailyDigest } from "@/server/reminders";
import { saveSettings } from "@/server/settings";
import { firstIssue } from "@/server/validation";

const businessSchema = z.object({
  businessName: z.string().trim().min(1, "Informe o nome do negócio.").max(80),
  pixKey: z.string().trim().max(140),
  reminderDaysAhead: z.number().int().min(0, "Mínimo 0 dias.").max(30, "Máximo 30 dias."),
});

export async function saveBusinessSettingsAction(input: z.input<typeof businessSchema>): Promise<ActionResult> {
  await requireUser();
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  await saveSettings(parsed.data);
  revalidatePath("/", "layout");
  return ok();
}

const templatesSchema = z.object({
  templateReminder: z.string().trim().min(1, "A mensagem não pode ficar vazia.").max(1500),
  templateOverdue: z.string().trim().min(1, "A mensagem não pode ficar vazia.").max(1500),
});

export async function saveTemplatesAction(input: z.input<typeof templatesSchema>): Promise<ActionResult> {
  await requireUser();
  const parsed = templatesSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  await saveSettings(parsed.data);
  revalidatePath("/", "layout");
  return ok();
}

// ─── Notificações push ─────────────────────────────────────────────────────

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
});

export async function savePushSubscriptionAction(subscription: unknown, userAgent: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return fail("Inscrição de notificação inválida.");
  const { endpoint, keys } = parsed.data;
  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent.slice(0, 300) })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent.slice(0, 300) },
    });
  revalidatePath("/configuracoes");
  return ok();
}

export async function removePushSubscriptionAction(endpointOrId: string | number): Promise<ActionResult> {
  await requireUser();
  if (typeof endpointOrId === "number") {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, endpointOrId));
  } else {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpointOrId));
  }
  revalidatePath("/configuracoes");
  return ok();
}

export async function sendTestPushAction(): Promise<ActionResult<{ sent: number }>> {
  await requireUser();
  if (!isPushConfigured()) return fail("Configure as chaves VAPID no servidor (npm run vapid).");
  const digest = await buildDailyDigest(todayISO());
  const result = await sendPushToAll(
    digest ?? {
      title: "Notificações ativadas ✅",
      body: "Tudo certo! Você vai receber aqui o resumo diário das cobranças.",
      url: "/cobrancas",
      tag: "teste",
    },
  );
  if (result.devices === 0) return fail("Nenhum dispositivo inscrito. Ative as notificações primeiro.");
  if (result.sent === 0) return fail("Não foi possível entregar a notificação. Tente reativar neste dispositivo.");
  return ok({ sent: result.sent });
}
