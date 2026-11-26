import "server-only";
import { and, asc, desc, eq, like, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers, payments, saleItems, sales } from "@/db/schema";
import { INACTIVE_SALE_STATUSES } from "@/lib/constants";
import { computePaymentStates } from "./receivables";

export const SALE_FILTERS = ["abertas", "atrasadas", "pagas", "todas", "orcamentos", "canceladas"] as const;
export type SaleFilter = (typeof SALE_FILTERS)[number];

export async function listSales({
  q,
  filter,
  today,
  customerId,
  limit = 300,
}: {
  q?: string;
  filter: SaleFilter;
  today: string;
  customerId?: number;
  limit?: number;
}) {
  const paidSub = db
    .select({ saleId: payments.saleId, paid: sql<number>`sum(${payments.amountCents})`.as("paid") })
    .from(payments)
    .groupBy(payments.saleId)
    .as("paid_sub");
  const paidCents = sql`coalesce(${paidSub.paid}, 0)`;

  const conditions: SQL[] = [];
  if (filter === "orcamentos") conditions.push(eq(sales.status, "orcamento"));
  else if (filter === "canceladas") conditions.push(eq(sales.status, "cancelado"));
  else if (filter !== "todas") conditions.push(notInArray(sales.status, [...INACTIVE_SALE_STATUSES]));
  // "Pagas" e "em aberto" dependem só da soma dos pagamentos: filtra no SQL, ANTES do limite.
  if (filter === "pagas") conditions.push(sql`${paidCents} >= ${sales.totalCents}`);
  if (filter === "abertas" || filter === "atrasadas") conditions.push(sql`${paidCents} < ${sales.totalCents}`);
  if (customerId) conditions.push(eq(sales.customerId, customerId));
  const term = q?.trim().toLowerCase();
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(or(like(sql`lower(${sales.title})`, pattern), like(sql`lower(${customers.name})`, pattern))!);
  }

  const query = db
    .select({
      id: sales.id,
      date: sales.date,
      title: sales.title,
      status: sales.status,
      totalCents: sales.totalCents,
      channel: sales.channel,
      customerId: sales.customerId,
      customerName: customers.name,
    })
    .from(sales)
    .leftJoin(paidSub, eq(paidSub.saleId, sales.id))
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sales.date), desc(sales.id));

  // "Atrasadas" precisa do abatimento parcela a parcela: busca todas as em aberto e só depois corta.
  const rows = filter === "atrasadas" ? await query : await query.limit(limit);
  const states = await computePaymentStates(rows, today);
  const withState = rows.map((r) => ({ ...r, summary: states.get(r.id)!.summary }));
  return filter === "atrasadas" ? withState.filter((r) => r.summary.status === "atrasada").slice(0, limit) : withState;
}

export type SaleListRow = Awaited<ReturnType<typeof listSales>>[number];

export async function getSaleDetail(id: number, today: string) {
  const [sale] = await db
    .select({
      sale: sales,
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        instagram: customers.instagram,
      },
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(eq(sales.id, id))
    .limit(1);
  if (!sale) return null;

  const [items, paymentRows, states] = await Promise.all([
    db.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.position), asc(saleItems.id)),
    db.select().from(payments).where(eq(payments.saleId, id)).orderBy(desc(payments.date), desc(payments.id)),
    computePaymentStates([{ id, totalCents: sale.sale.totalCents }], today),
  ]);
  const state = states.get(id)!;

  return {
    ...sale.sale,
    customer: sale.customer?.id ? sale.customer : null,
    items,
    payments: paymentRows,
    installments: state.installments,
    summary: state.summary,
  };
}

export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSaleDetail>>>;
