import {
  ArrowRight,
  ChevronLeft,
  CircleDollarSign,
  ChevronRight,
  CircleExclamationPoint,
  Clock,
  Hourglass,
  Plus,
  ReceiptText,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ForecastChart, TrendChart } from "@/components/charts/bar-charts";
import { ChartCard, DataTable, LegendItem } from "@/components/charts/chart-card";
import { RankedBars } from "@/components/charts/ranked-bars";
import { Delta, percentChange, StatTile } from "@/components/charts/stat";
import { ReceivableRow, groupOpenBySale } from "@/components/payments/receivable-row";
import { SaleRow } from "@/components/sales/sale-row";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
import { formatDateWeekday, formatMonthAbbr, formatMonthLong, formatMonthShort, monthKey } from "@/lib/dates";
import { formatBRL, formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { chargeLink } from "@/server/charge-links";
import { todayISO } from "@/lib/dates";
import {
  buildForecast,
  getChannelBreakdown,
  getMonthlySeries,
  getPeriodTotals,
  getTopProducts,
  resolvePeriod,
} from "@/server/queries/dashboard";
import { expensesByCategory, listPayables } from "@/server/queries/expenses";
import { getOpenInstallments, summarizeReceivables } from "@/server/queries/receivables";
import { listSales } from "@/server/queries/sales";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Início" };

type SearchParams = Promise<{ periodo?: string; mes?: string; ano?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const period = resolvePeriod(sp, today);

  const [settings, open, totals, prevTotals, series, categories, topProducts, channels, recent, payables] =
    await Promise.all([
      getSettings(),
      getOpenInstallments(today),
      getPeriodTotals(period.start, period.end),
      getPeriodTotals(period.prevStart, period.prevEnd),
      getMonthlySeries(period.trendMonths),
      expensesByCategory(period.start, period.end, { paidOnly: true }),
      getTopProducts(period.start, period.end),
      getChannelBreakdown(period.start, period.end),
      listSales({ filter: "todas", today, limit: 5 }),
      listPayables(today, 7),
    ]);

  const recv = summarizeReceivables(open, today, 7);
  const bySale = groupOpenBySale(open);
  const forecast = buildForecast(open, today, 6);
  const profit = totals.receivedCents - totals.expensesCents;
  const prevProfit = prevTotals.receivedCents - prevTotals.expensesCents;
  const margin = totals.receivedCents > 0 ? (profit / totals.receivedCents) * 100 : null;
  const ticket = totals.salesCount ? Math.round(totals.soldCents / totals.salesCount) : 0;
  const isEmpty = open.length === 0 && totals.salesCount === 0 && totals.expensesCents === 0 && recent.length === 0;

  const multiYear = period.trendMonths[0].slice(0, 4) !== period.trendMonths[period.trendMonths.length - 1].slice(0, 4);
  const trendData = series.map((p) => ({
    label: multiYear && (p.month.endsWith("-01") || p.month === period.trendMonths[0]) ? formatMonthShort(p.month) : formatMonthAbbr(p.month),
    longLabel: formatMonthLong(p.month),
    received: p.receivedCents,
    expenses: p.expensesCents,
  }));
  const forecastData = forecast.map((p) => ({
    label: formatMonthAbbr(p.month),
    longLabel: formatMonthLong(p.month),
    cents: p.cents,
    count: p.count,
  }));

  const currentMonth = monthKey(today);
  const currentYear = today.slice(0, 4);
  const periodHref = (mode: "mes" | "ano", key: string) => (mode === "mes" ? `/?periodo=mes&mes=${key}` : `/?periodo=ano&ano=${key}`);
  const isCurrent = period.mode === "mes" ? period.key === currentMonth : period.key === currentYear;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-2 first-letter:uppercase">{formatDateWeekday(today)}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Olá, {firstName}</h1>
        </div>
        <Link href="/vendas/nova" className={buttonClass({ className: "hidden sm:inline-flex" })}>
          <Plus /> Nova venda
        </Link>
      </header>

      {recv.overdue.count > 0 ? (
        <Link
          href="/cobrancas?filtro=atrasadas"
          className="flex items-center gap-3 rounded-2xl border border-critical/25 bg-critical-soft px-4 py-3 text-critical-ink transition-colors hover:brightness-[0.98]"
        >
          <CircleExclamationPoint className="size-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            <strong className="font-semibold">
              {recv.overdue.count} {recv.overdue.count === 1 ? "cobrança atrasada" : "cobranças atrasadas"}
            </strong>{" "}
            somando {formatBRL(recv.overdue.cents)}.
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium">
            Cobrar <ArrowRight className="size-4" />
          </span>
        </Link>
      ) : null}

      {isEmpty ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title="Comece registrando sua primeira venda"
            description="Cadastre o pedido, os itens e como o cliente vai pagar (à vista, parcelado ou com entrada). O resto o app calcula."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/vendas/nova" className={buttonClass()}>
                  <Plus /> Nova venda
                </Link>
                <Link href="/gastos?novo=1" className={buttonClass({ variant: "secondary" })}>
                  Registrar um gasto
                </Link>
              </div>
            }
          />
        </Card>
      ) : null}

      {/* ── A receber (situação atual, não depende do período) ── */}
      <section aria-labelledby="receber-title" className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title={<span id="receber-title">Cobranças</span>}
            description="Situação de hoje — o que os clientes ainda devem"
            action={
              <Link href="/cobrancas" className={buttonClass({ variant: "ghost", size: "sm" })}>
                Ver todas <ArrowRight />
              </Link>
            }
          />
          <CardContent className="@container pt-4">
            <div className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
              <MiniStat label="Em aberto" value={formatBRL(recv.totalOpenCents)} icon={Wallet} />
              <MiniStat
                label="Atrasado"
                value={formatBRL(recv.overdue.cents)}
                icon={CircleExclamationPoint}
                tone={recv.overdue.cents > 0 ? "critical" : undefined}
                detail={recv.overdue.count ? `${recv.overdue.count} parcela${recv.overdue.count > 1 ? "s" : ""}` : "nenhuma"}
              />
              <MiniStat
                label="Vence hoje"
                value={formatBRL(recv.dueToday.cents)}
                icon={Hourglass}
                tone={recv.dueToday.cents > 0 ? "warning" : undefined}
                detail={recv.dueToday.count ? `${recv.dueToday.count} parcela${recv.dueToday.count > 1 ? "s" : ""}` : "nenhuma"}
              />
              <MiniStat
                label="Próximos 7 dias"
                value={formatBRL(recv.upcoming.cents)}
                icon={Clock}
                detail={recv.upcoming.count ? `${recv.upcoming.count} parcela${recv.upcoming.count > 1 ? "s" : ""}` : "nenhuma"}
              />
            </div>

            {open.length > 0 ? (
              <ul className="mt-3 divide-y divide-line">
                {open.slice(0, 4).map((item) => {
                  const sale = bySale.get(item.saleId)!;
                  return (
                    <ReceivableRow
                      key={item.installmentId}
                      item={item}
                      today={today}
                      waLink={chargeLink(settings, today, item)}
                      saleOpenInstallments={sale.installments}
                      saleRemainingCents={sale.remainingCents}
                      compact
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-good-soft px-3 py-2.5 text-sm text-good-ink">
                Nenhuma cobrança pendente. Tudo em dia! 🎉
              </p>
            )}
            {payables.length > 0 ? (
              <Link
                href="/cobrancas?filtro=pagar"
                className="mt-3 flex items-center gap-2 rounded-xl bg-hover px-3 py-2.5 text-sm text-ink-2 hover:text-ink"
              >
                <ReceiptText className="size-4" aria-hidden />
                {payables.length} {payables.length === 1 ? "conta a pagar" : "contas a pagar"} nos próximos 7 dias
                <ArrowRight className="ml-auto size-4" />
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <ChartCard
          className="xl:col-span-2"
          title="Previsão de recebimentos"
          description="Parcelas a vencer por mês (sem as atrasadas)"
          chart={<ForecastChart data={forecastData} />}
          table={
            <DataTable
              head={["Mês", "Parcelas", "A receber"]}
              rows={forecastData.map((p) => [p.longLabel, p.count, formatBRL(p.cents)])}
            />
          }
        />
      </section>

      {/* ── Resultados (filtrados pelo período) ── */}
      <section aria-labelledby="resultados-title" className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="resultados-title" className="text-lg font-semibold tracking-tight">
              Resultados
            </h2>
            <p className="text-sm text-ink-2">O que entrou e saiu do caixa no período. Gastos ainda não pagos ficam de fora.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-hover p-1" role="tablist" aria-label="Agrupar por">
              {(["mes", "ano"] as const).map((mode) => (
                <Link
                  key={mode}
                  href={periodHref(mode, mode === "mes" ? currentMonth : currentYear)}
                  role="tab"
                  aria-selected={period.mode === mode}
                  className={cn(
                    "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium",
                    period.mode === mode ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {mode === "mes" ? "Mês" : "Ano"}
                </Link>
              ))}
            </div>
            <div className="inline-flex items-center rounded-xl border border-line-strong bg-surface">
              <Link
                href={periodHref(period.mode, period.prevKey)}
                className="inline-flex size-9 items-center justify-center rounded-l-xl text-ink-2 hover:bg-hover hover:text-ink"
                aria-label="Período anterior"
              >
                <ChevronLeft className="size-4" />
              </Link>
              <span className="min-w-36 px-2 text-center text-sm font-medium">{period.label}</span>
              <Link
                href={periodHref(period.mode, period.nextKey)}
                className="inline-flex size-9 items-center justify-center rounded-r-xl text-ink-2 hover:bg-hover hover:text-ink"
                aria-label="Próximo período"
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>
            {!isCurrent ? (
              <Link href="/" className={buttonClass({ variant: "ghost", size: "sm" })}>
                Hoje
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          {/* Número principal: lucro do período */}
          <Card className="xl:col-span-2">
            <CardContent className="flex h-full flex-col justify-between gap-5">
              <div>
                <p className="flex items-center gap-2 text-sm text-ink-2">
                  {profit >= 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
                  {profit >= 0 ? "Lucro" : "Prejuízo"} · {period.label}
                </p>
                <p
                  className={cn(
                    "mt-2 text-[44px] leading-none font-semibold tracking-tight sm:text-5xl",
                    profit < 0 ? "text-critical-ink" : "text-ink",
                  )}
                >
                  {formatBRL(profit)}
                </p>
                <div className="mt-2">
                  <Delta value={percentChange(profit, prevProfit)} vs={period.prevLabel} />
                </div>
              </div>
              <div className="space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-2">
                    <span className="size-2.5 rounded-[3px] bg-series-1" aria-hidden /> Recebido
                  </span>
                  <span className="font-medium tabular-nums">{formatBRL(totals.receivedCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-2">
                    <span className="size-2.5 rounded-[3px] bg-series-2" aria-hidden /> Gastos
                  </span>
                  <span className="font-medium tabular-nums">− {formatBRL(totals.expensesCents)}</span>
                </div>
                <div className="flex items-center justify-between text-ink-2">
                  <span>Margem sobre o recebido</span>
                  <span className="font-medium text-ink tabular-nums">{margin === null ? "—" : formatPercent(margin)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 xl:col-span-3 xl:gap-4">
            <StatTile
              label="Recebido"
              icon={TrendingUp}
              value={formatBRL(totals.receivedCents)}
              footer={<Delta value={percentChange(totals.receivedCents, prevTotals.receivedCents)} vs={period.prevLabel} />}
            />
            <StatTile
              label="Gastos"
              icon={Wallet}
              value={formatBRL(totals.expensesCents)}
              footer={
                <Delta
                  value={percentChange(totals.expensesCents, prevTotals.expensesCents)}
                  upIsGood={false}
                  vs={period.prevLabel}
                />
              }
            />
            <StatTile
              label="Vendido"
              icon={ShoppingBag}
              value={formatBRL(totals.soldCents)}
              footer={
                <span className="text-xs text-ink-2">
                  {totals.salesCount} {totals.salesCount === 1 ? "venda" : "vendas"} no período
                </span>
              }
            />
            <StatTile
              label="Ticket médio"
              icon={CircleDollarSign}
              value={totals.salesCount ? formatBRL(ticket) : "—"}
              footer={<span className="text-xs text-ink-2">valor médio por venda</span>}
            />
          </div>
        </div>

        <ChartCard
          title="Recebido x Gastos por mês"
          description={period.mode === "mes" ? "Últimos 12 meses até o mês selecionado" : `Meses de ${period.key}`}
          legend={
            <div className="flex gap-4">
              <LegendItem color="var(--series-1)" label="Recebido" />
              <LegendItem color="var(--series-2)" label="Gastos" />
            </div>
          }
          chart={<TrendChart data={trendData} />}
          table={
            <DataTable
              head={["Mês", "Recebido", "Gastos", "Resultado"]}
              rows={trendData.map((p) => [p.longLabel, formatBRL(p.received), formatBRL(p.expenses), formatBRL(p.received - p.expenses)])}
            />
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader title="Gastos por categoria" description={period.label} />
            <CardContent>
              <RankedBars
                series={2}
                items={categories.map((c) => ({ name: c.name, value: c.cents }))}
                empty="Nenhum gasto no período."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Produtos mais vendidos" description="Por faturamento bruto" />
            <CardContent>
              <RankedBars
                items={topProducts.map((p) => ({ name: p.name, value: p.cents, detail: `${p.qty} un.` }))}
                empty="Nenhuma venda no período."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Canais de venda" description="De onde vêm os pedidos" />
            <CardContent>
              <RankedBars
                items={channels.map((c) => ({ name: c.name, value: c.cents, detail: `${c.count} ${c.count === 1 ? "venda" : "vendas"}` }))}
                empty="Nenhuma venda no período."
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {recent.length > 0 ? (
        <Card>
          <CardHeader
            title="Últimas vendas"
            action={
              <Link href="/vendas?filtro=todas" className={buttonClass({ variant: "ghost", size: "sm" })}>
                Ver todas <ArrowRight />
              </Link>
            }
          />
          <ul className="mt-2 divide-y divide-line px-2 pb-2">
            {recent.map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
  detail,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone?: "critical" | "warning";
  detail?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2.5",
        tone === "critical" ? "bg-critical-soft" : tone === "warning" ? "bg-warning-soft" : "bg-hover",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs",
          tone === "critical" ? "text-critical-ink" : tone === "warning" ? "text-warning-ink" : "text-ink-2",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold text-ink tabular-nums sm:text-lg">{value}</p>
      {detail ? <p className="text-[11px] text-ink-2">{detail}</p> : null}
    </div>
  );
}
