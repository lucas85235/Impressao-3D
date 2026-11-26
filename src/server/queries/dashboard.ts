import "server-only";
import { and, between, count, desc, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses, payments, products, saleItems, sales } from "@/db/schema";
import { INACTIVE_SALE_STATUSES } from "@/lib/constants";
import {
  addMonthsToKey,
  formatMonthLong,
  isValidMonthKey,
  monthKey,
  monthRange,
  monthsBetween,
} from "@/lib/dates";
import type { OpenInstallment } from "./receivables";

const activeSale = notInArray(sales.status, [...INACTIVE_SALE_STATUSES]);

// ─── Período selecionado ───────────────────────────────────────────────────

export type Period = {
  mode: "mes" | "ano";
  key: string;
  start: string;
  end: string;
  label: string;
  prevStart: string;
  prevEnd: string;
  prevLabel: string;
  prevKey: string;
  nextKey: string;
  /** Meses exibidos no gráfico de evolução. */
  trendMonths: string[];
};

export function resolvePeriod(params: { periodo?: string; mes?: string; ano?: string }, today: string): Period {
  if (params.periodo === "ano") {
    const year = /^\d{4}$/.test(params.ano ?? "") ? Number(params.ano) : Number(today.slice(0, 4));
    return {
      mode: "ano",
      key: String(year),
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      label: `Ano de ${year}`,
      prevStart: `${year - 1}-01-01`,
      prevEnd: `${year - 1}-12-31`,
      prevLabel: String(year - 1),
      prevKey: String(year - 1),
      nextKey: String(year + 1),
      trendMonths: monthsBetween(`${year}-01`, `${year}-12`),
    };
  }
  const key = isValidMonthKey(params.mes) ? params.mes : monthKey(today);
  const { start, end } = monthRange(key);
  const prevKey = addMonthsToKey(key, -1);
  const prev = monthRange(prevKey);
  return {
    mode: "mes",
    key,
    start,
    end,
    label: formatMonthLong(key),
    prevStart: prev.start,
    prevEnd: prev.end,
    prevLabel: formatMonthLong(prevKey).split(" de ")[0].toLowerCase(),
    prevKey,
    nextKey: addMonthsToKey(key, 1),
    trendMonths: monthsBetween(addMonthsToKey(key, -11), key),
  };
}

// ─── Totais do período ─────────────────────────────────────────────────────

export type PeriodTotals = {
  receivedCents: number;
  expensesCents: number;
  soldCents: number;
  salesCount: number;
};

export async function getPeriodTotals(start: string, end: string): Promise<PeriodTotals> {
  const [[received], [spent], [sold]] = await Promise.all([
    db
      .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
      .from(payments)
      .innerJoin(sales, eq(sales.id, payments.saleId))
      .where(and(activeSale, between(payments.date, start, end))),
    db
      .select({ cents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)` })
      .from(expenses)
      .where(between(expenses.date, start, end)),
    db
      .select({ cents: sql<number>`coalesce(sum(${sales.totalCents}), 0)`, n: count() })
      .from(sales)
      .where(and(activeSale, between(sales.date, start, end))),
  ]);
  return {
    receivedCents: Number(received?.cents ?? 0),
    expensesCents: Number(spent?.cents ?? 0),
    soldCents: Number(sold?.cents ?? 0),
    salesCount: Number(sold?.n ?? 0),
  };
}

// ─── Série mensal (recebido x gastos) ──────────────────────────────────────

export type MonthlyPoint = { month: string; receivedCents: number; expensesCents: number };

export async function getMonthlySeries(months: string[]): Promise<MonthlyPoint[]> {
  if (months.length === 0) return [];
  const start = monthRange(months[0]).start;
  const end = monthRange(months[months.length - 1]).end;
  const [received, spent] = await Promise.all([
    db
      .select({ month: sql<string>`substr(${payments.date}, 1, 7)`, cents: sql<number>`sum(${payments.amountCents})` })
      .from(payments)
      .innerJoin(sales, eq(sales.id, payments.saleId))
      .where(and(activeSale, between(payments.date, start, end)))
      .groupBy(sql`substr(${payments.date}, 1, 7)`),
    db
      .select({ month: sql<string>`substr(${expenses.date}, 1, 7)`, cents: sql<number>`sum(${expenses.amountCents})` })
      .from(expenses)
      .where(between(expenses.date, start, end))
      .groupBy(sql`substr(${expenses.date}, 1, 7)`),
  ]);
  const r = new Map(received.map((x) => [x.month, Number(x.cents)]));
  const s = new Map(spent.map((x) => [x.month, Number(x.cents)]));
  return months.map((month) => ({ month, receivedCents: r.get(month) ?? 0, expensesCents: s.get(month) ?? 0 }));
}

// ─── Rankings ──────────────────────────────────────────────────────────────

export async function getTopProducts(start: string, end: string, limit = 6) {
  const groupKey = sql`coalesce(cast(${saleItems.productId} as text), lower(trim(${saleItems.description})))`;
  const rows = await db
    .select({
      name: sql<string>`coalesce(max(${products.name}), max(${saleItems.description}))`,
      qty: sql<number>`sum(${saleItems.quantity})`,
      revenueCents: sql<number>`sum(${saleItems.quantity} * ${saleItems.unitPriceCents})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .leftJoin(products, eq(products.id, saleItems.productId))
    .where(and(activeSale, between(sales.date, start, end)))
    .groupBy(groupKey)
    .orderBy(desc(sql`sum(${saleItems.quantity} * ${saleItems.unitPriceCents})`))
    .limit(limit);
  return rows.map((r) => ({ name: r.name, qty: Number(r.qty), cents: Number(r.revenueCents) }));
}

export async function getChannelBreakdown(start: string, end: string) {
  const label = sql<string>`coalesce(nullif(trim(${sales.channel}), ''), 'Não informado')`;
  const rows = await db
    .select({ name: label, n: count(), cents: sql<number>`sum(${sales.totalCents})` })
    .from(sales)
    .where(and(activeSale, between(sales.date, start, end)))
    .groupBy(label)
    .orderBy(desc(sql`sum(${sales.totalCents})`));
  return rows.map((r) => ({ name: r.name, count: Number(r.n), cents: Number(r.cents) }));
}

// ─── Previsão de recebimentos ──────────────────────────────────────────────

export type ForecastPoint = { month: string; cents: number; count: number };

/** Saldo a receber por mês de vencimento (a partir do mês atual). Atrasadas ficam fora. */
export function buildForecast(open: OpenInstallment[], today: string, months = 6): ForecastPoint[] {
  const first = monthKey(today);
  const keys = monthsBetween(first, addMonthsToKey(first, months - 1));
  const map = new Map(keys.map((k) => [k, { month: k, cents: 0, count: 0 }]));
  for (const inst of open) {
    if (inst.dueDate < today) continue;
    const point = map.get(monthKey(inst.dueDate));
    if (point) {
      point.cents += inst.remainingCents;
      point.count += 1;
    }
  }
  return [...map.values()];
}
