import { todayISO } from "@/lib/dates";
import { secretsMatch } from "@/server/password";
import { runDailyReminders } from "@/server/reminders";

/*
 * Lembrete diário de cobranças (push).
 * Chamado pelo Cron da Vercel (vercel.json) ou por qualquer agendador externo com:
 *   Authorization: Bearer <CRON_SECRET>
 * Use ?force=1 para reenviar no mesmo dia (teste).
 */

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return secretsMatch(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }
  if (!authorized(request)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("force") === "1";
  const result = await runDailyReminders({ today: todayISO(), force });
  return Response.json(result);
}
