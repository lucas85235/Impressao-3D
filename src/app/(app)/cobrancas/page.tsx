import { BellRing, CircleCheck, CircleExclamationPoint, Clock, Hourglass, ReceiptText, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatTile } from "@/components/charts/stat";
import { PayableRow } from "@/components/expenses/payable-row";
import { groupOpenBySale, ReceivableRow } from "@/components/payments/receivable-row";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/page";
import { addDays, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { chargeLink } from "@/server/charge-links";
import { listPayables } from "@/server/queries/expenses";
import { getOpenInstallments, summarizeReceivables, type OpenInstallment } from "@/server/queries/receivables";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Cobranças" };

const FILTERS = ["todas", "atrasadas", "hoje", "semana", "pagar"] as const;
type Filter = (typeof FILTERS)[number];

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.filtro ?? "") ? (sp.filtro as Filter) : "todas";
  const today = todayISO();
  const [settings, open, payables] = await Promise.all([getSettings(), getOpenInstallments(today), listPayables(today, 30)]);

  const summary = summarizeReceivables(open, today, 7);
  const bySale = groupOpenBySale(open);
  const weekLimit = addDays(today, 7);

  const groups: { key: string; title: string; icon: typeof BellRing; items: OpenInstallment[] }[] = [
    { key: "atrasadas", title: "Atrasadas", icon: CircleExclamationPoint, items: open.filter((i) => i.dueDate < today) },
    { key: "hoje", title: "Vencem hoje", icon: Hourglass, items: open.filter((i) => i.dueDate === today) },
    {
      key: "semana",
      title: "Próximos 7 dias",
      icon: Clock,
      items: open.filter((i) => i.dueDate > today && i.dueDate <= weekLimit),
    },
    { key: "depois", title: "Mais adiante", icon: BellRing, items: open.filter((i) => i.dueDate > weekLimit) },
  ];
  const visibleGroups = groups.filter((g) => (filter === "todas" ? true : g.key === filter) && g.items.length > 0);
  const payablesDue = payables.filter((p) => p.date <= weekLimit);

  return (
    <>
      <PageHeader
        title="Cobranças"
        description="Quem está devendo, quanto e quando. Cobre pelo WhatsApp com a mensagem pronta."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total em aberto" icon={Wallet} value={formatBRL(summary.totalOpenCents)} footer={<Count n={open.length} />} />
        <StatTile
          label="Atrasado"
          icon={CircleExclamationPoint}
          value={<span className={summary.overdue.cents > 0 ? "text-critical-ink" : undefined}>{formatBRL(summary.overdue.cents)}</span>}
          footer={<Count n={summary.overdue.count} />}
        />
        <StatTile label="Vence hoje" icon={Hourglass} value={formatBRL(summary.dueToday.cents)} footer={<Count n={summary.dueToday.count} />} />
        <StatTile label="Próximos 7 dias" icon={Clock} value={formatBRL(summary.upcoming.cents)} footer={<Count n={summary.upcoming.count} />} />
      </div>

      <Segmented
        className="mb-4"
        items={FILTERS.map((f) => ({
          href: `/cobrancas?filtro=${f}`,
          active: f === filter,
          label: { todas: "Todas", atrasadas: "Atrasadas", hoje: "Hoje", semana: "Próximos 7 dias", pagar: "Contas a pagar" }[f],
          count:
            f === "todas"
              ? open.length
              : f === "atrasadas"
                ? summary.overdue.count
                : f === "hoje"
                  ? summary.dueToday.count
                  : f === "semana"
                    ? summary.upcoming.count
                    : payables.length,
        }))}
      />

      {filter === "pagar" ? (
        <Card>
          {payables.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Nenhuma conta a pagar"
              description="Gastos marcados como “não pago” (ex.: parcelas de uma impressora) aparecem aqui."
            />
          ) : (
            <ul className="divide-y divide-line px-5 py-1">
              {payables.map((p) => (
                <PayableRow key={p.id} expense={p} today={today} />
              ))}
            </ul>
          )}
        </Card>
      ) : visibleGroups.length === 0 ? (
        <Card>
          <EmptyState
            icon={CircleCheck}
            title={filter === "todas" ? "Nenhuma cobrança pendente" : "Nada nesta lista"}
            description={
              filter === "todas" ? "Todas as vendas estão quitadas. 🎉" : "Veja as outras abas para mais cobranças."
            }
            action={
              filter === "todas" ? (
                <Link href="/vendas/nova" className={buttonClass({ variant: "secondary" })}>
                  Registrar venda
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((group) => (
            <Card key={group.key}>
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <group.icon className="size-4 text-ink-2" aria-hidden />
                  {group.title}
                  <span className="font-normal text-ink-2">· {group.items.length}</span>
                </h2>
                <span className="text-sm font-medium tabular-nums">
                  {formatBRL(group.items.reduce((s, i) => s + i.remainingCents, 0))}
                </span>
              </div>
              <ul className="divide-y divide-line px-5">
                {group.items.map((item) => {
                  const sale = bySale.get(item.saleId)!;
                  return (
                    <ReceivableRow
                      key={item.installmentId}
                      item={item}
                      today={today}
                      waLink={chargeLink(settings, today, item)}
                      saleOpenInstallments={sale.installments}
                      saleRemainingCents={sale.remainingCents}
                    />
                  );
                })}
              </ul>
            </Card>
          ))}
          {filter === "todas" && payablesDue.length > 0 ? (
            <Card>
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ReceiptText className="size-4 text-ink-2" aria-hidden />
                  Suas contas a pagar (7 dias)
                  <span className="font-normal text-ink-2">· {payablesDue.length}</span>
                </h2>
                <span className="text-sm font-medium tabular-nums">
                  {formatBRL(payablesDue.reduce((s, p) => s + p.amountCents, 0))}
                </span>
              </div>
              <ul className="divide-y divide-line px-5">
                {payablesDue.map((p) => (
                  <PayableRow key={p.id} expense={p} today={today} />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ink-2">
        Quer ser avisado no celular? Ative as notificações em{" "}
        <Link href="/configuracoes#notificacoes" className="font-medium text-accent-ink hover:underline">
          Configurações
        </Link>
        .
      </p>
    </>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="text-xs text-ink-2">
      {n === 0 ? "nenhuma parcela" : `${n} ${n === 1 ? "parcela" : "parcelas"}`}
    </span>
  );
}
