import "server-only";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { customers, installments, payments, sales, type Installment } from "@/db/schema";
import { INACTIVE_SALE_STATUSES, type SaleStatus } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import {
  computeSalePayments,
  type AllocatedInstallment,
  type InstallmentStatus,
  type SaleSummary,
} from "@/lib/domain/allocation";

export type SalePaymentState = {
  installments: AllocatedInstallment<Installment>[];
  summary: SaleSummary;
};

function chunk<T>(arr: T[], size = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Calcula parcelas/pagamentos (abatimento) para várias vendas de uma vez. */
export async function computePaymentStates(
  saleRows: { id: number; totalCents: number }[],
  today: string,
): Promise<Map<number, SalePaymentState>> {
  const result = new Map<number, SalePaymentState>();
  if (saleRows.length === 0) return result;
  const ids = saleRows.map((s) => s.id);

  const instRows: Installment[] = [];
  const payRows: { id: number; saleId: number; date: string; amountCents: number; installmentId: number | null }[] = [];
  for (const part of chunk(ids)) {
    const [i, p] = await Promise.all([
      db.select().from(installments).where(inArray(installments.saleId, part)),
      db
        .select({
          id: payments.id,
          saleId: payments.saleId,
          date: payments.date,
          amountCents: payments.amountCents,
          installmentId: payments.installmentId,
        })
        .from(payments)
        .where(inArray(payments.saleId, part)),
    ]);
    instRows.push(...i);
    payRows.push(...p);
  }

  const instBySale = Map.groupBy(instRows, (r) => r.saleId);
  const payBySale = Map.groupBy(payRows, (r) => r.saleId);
  for (const s of saleRows) {
    result.set(s.id, computeSalePayments(s.totalCents, instBySale.get(s.id) ?? [], payBySale.get(s.id) ?? [], today));
  }
  return result;
}

export type OpenInstallment = {
  installmentId: number;
  number: number;
  count: number;
  dueDate: string;
  amountCents: number;
  paidCents: number;
  remainingCents: number;
  status: InstallmentStatus;
  daysOverdue: number;
  saleId: number;
  saleTitle: string;
  saleStatus: SaleStatus;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
};

/** Todas as parcelas com saldo em aberto de vendas ativas, ordenadas por vencimento (deduplicado por requisição). */
export const getOpenInstallments = cache(loadOpenInstallments);

async function loadOpenInstallments(today: string): Promise<OpenInstallment[]> {
  const paidSub = db
    .select({ saleId: payments.saleId, paid: sql<number>`sum(${payments.amountCents})`.as("paid") })
    .from(payments)
    .groupBy(payments.saleId)
    .as("paid_sub");

  const openSales = await db
    .select({
      id: sales.id,
      title: sales.title,
      status: sales.status,
      totalCents: sales.totalCents,
      customerId: sales.customerId,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(sales)
    .leftJoin(paidSub, eq(paidSub.saleId, sales.id))
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(
      and(
        notInArray(sales.status, [...INACTIVE_SALE_STATUSES]),
        sql`coalesce(${paidSub.paid}, 0) < ${sales.totalCents}`,
      ),
    );

  const states = await computePaymentStates(openSales, today);
  const out: OpenInstallment[] = [];
  for (const sale of openSales) {
    const state = states.get(sale.id);
    if (!state) continue;
    for (const inst of state.installments) {
      if (inst.remainingCents <= 0) continue;
      out.push({
        installmentId: inst.id,
        number: inst.number,
        count: state.installments.length,
        dueDate: inst.dueDate,
        amountCents: inst.amountCents,
        paidCents: inst.paidCents,
        remainingCents: inst.remainingCents,
        status: inst.status,
        daysOverdue: inst.daysOverdue,
        saleId: sale.id,
        saleTitle: sale.title,
        saleStatus: sale.status,
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
      });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.saleId - b.saleId);
}

export type ReceivablesSummary = {
  totalOpenCents: number;
  overdue: { count: number; cents: number };
  dueToday: { count: number; cents: number };
  upcoming: { count: number; cents: number };
};

export function summarizeReceivables(items: OpenInstallment[], today: string, daysAhead: number): ReceivablesSummary {
  const limit = addDays(today, daysAhead);
  const acc = (list: OpenInstallment[]) => ({
    count: list.length,
    cents: list.reduce((s, i) => s + i.remainingCents, 0),
  });
  return {
    totalOpenCents: items.reduce((s, i) => s + i.remainingCents, 0),
    overdue: acc(items.filter((i) => i.dueDate < today)),
    dueToday: acc(items.filter((i) => i.dueDate === today)),
    upcoming: acc(items.filter((i) => i.dueDate > today && i.dueDate <= limit)),
  };
}
