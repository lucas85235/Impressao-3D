import "server-only";
import { formatBRL } from "@/lib/money";
import { listPayables } from "@/server/queries/expenses";
import { getOpenInstallments, summarizeReceivables } from "@/server/queries/receivables";
import { sendPushToAll, type PushPayload } from "@/server/push";
import { getSettings, saveSettings } from "@/server/settings";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Monta o resumo diário de cobranças. Retorna null quando não há nada pendente. */
export async function buildDailyDigest(today: string): Promise<PushPayload | null> {
  const settings = await getSettings();
  const [open, payables] = await Promise.all([
    getOpenInstallments(today),
    listPayables(today, 0),
  ]);
  const r = summarizeReceivables(open, today, settings.reminderDaysAhead);
  const parts: string[] = [];
  if (r.overdue.count) parts.push(`${plural(r.overdue.count, "atrasada", "atrasadas")} (${formatBRL(r.overdue.cents)})`);
  if (r.dueToday.count) parts.push(`${plural(r.dueToday.count, "vence", "vencem")} hoje (${formatBRL(r.dueToday.cents)})`);
  if (r.upcoming.count) {
    parts.push(
      `${plural(r.upcoming.count, "vence", "vencem")} em até ${plural(settings.reminderDaysAhead, "dia", "dias")} (${formatBRL(r.upcoming.cents)})`,
    );
  }
  if (payables.length) parts.push(`${plural(payables.length, "conta a pagar", "contas a pagar")}`);
  if (parts.length === 0) return null;

  const title = r.overdue.count
    ? "Você tem cobranças atrasadas"
    : r.dueToday.count
      ? "Cobranças para hoje"
      : payables.length && !r.upcoming.count
        ? "Contas a pagar hoje"
        : "Próximas cobranças";

  return {
    title: `${title} · ${settings.businessName}`,
    body: parts.join(" · ").replace(/ /g, " "),
    url: "/cobrancas",
    tag: "resumo-diario",
  };
}

/** Executado pelo agendador (cron). Envia no máximo um resumo por dia, a menos que force=true. */
export async function runDailyReminders({ today, force = false }: { today: string; force?: boolean }) {
  const settings = await getSettings();
  if (!force && settings.lastDigestDate === today) {
    return { status: "ja-enviado-hoje" as const };
  }
  const digest = await buildDailyDigest(today);
  if (!digest) {
    await saveSettings({ lastDigestDate: today });
    return { status: "nada-pendente" as const };
  }
  const result = await sendPushToAll(digest);
  if (result.sent > 0) await saveSettings({ lastDigestDate: today });
  return { status: result.devices === 0 ? ("sem-dispositivos" as const) : ("enviado" as const), digest, ...result };
}
