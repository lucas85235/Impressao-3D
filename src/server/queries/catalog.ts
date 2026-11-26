import "server-only";
import { and, asc, desc, eq, like, max, notInArray, or, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { customers, expenseCategories, products, saleItems, sales } from "@/db/schema";
import { INACTIVE_SALE_STATUSES } from "@/lib/constants";
import { getOpenInstallments } from "./receivables";

// ─── Clientes ──────────────────────────────────────────────────────────────

export async function listCustomerOptions() {
  return db
    .select({ id: customers.id, name: customers.name, phone: customers.phone })
    .from(customers)
    .orderBy(asc(sql`lower(${customers.name})`));
}

export async function listCustomers({ q, today }: { q?: string; today: string }) {
  const salesAgg = db
    .select({
      customerId: sales.customerId,
      orders: sql<number>`count(*)`.as("orders"),
      boughtCents: sql<number>`coalesce(sum(${sales.totalCents}), 0)`.as("bought_cents"),
      lastDate: max(sales.date).as("last_date"),
    })
    .from(sales)
    .where(notInArray(sales.status, [...INACTIVE_SALE_STATUSES]))
    .groupBy(sales.customerId)
    .as("sales_agg");

  const term = q?.trim().toLowerCase();
  const pattern = `%${term}%`;
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      instagram: customers.instagram,
      city: customers.city,
      orders: sql<number>`coalesce(${salesAgg.orders}, 0)`,
      boughtCents: sql<number>`coalesce(${salesAgg.boughtCents}, 0)`,
      lastDate: salesAgg.lastDate,
    })
    .from(customers)
    .leftJoin(salesAgg, eq(salesAgg.customerId, customers.id))
    .where(
      term
        ? or(
            like(sql`lower(${customers.name})`, pattern),
            like(customers.phone, pattern),
            like(sql`lower(${customers.instagram})`, pattern),
          )
        : undefined,
    )
    .orderBy(asc(sql`lower(${customers.name})`));

  const open = await getOpenInstallments(today);
  const openBy = new Map<number, { openCents: number; overdueCents: number }>();
  for (const inst of open) {
    if (!inst.customerId) continue;
    const cur = openBy.get(inst.customerId) ?? { openCents: 0, overdueCents: 0 };
    cur.openCents += inst.remainingCents;
    if (inst.status === "atrasada") cur.overdueCents += inst.remainingCents;
    openBy.set(inst.customerId, cur);
  }
  return rows.map((r) => ({ ...r, ...(openBy.get(r.id) ?? { openCents: 0, overdueCents: 0 }) }));
}

export type CustomerRow = Awaited<ReturnType<typeof listCustomers>>[number];

export async function getCustomer(id: number) {
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row ?? null;
}

// ─── Produtos ──────────────────────────────────────────────────────────────

export async function listProductOptions() {
  return db
    .select({ id: products.id, name: products.name, priceCents: products.priceCents, costCents: products.costCents })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(sql`lower(${products.name})`));
}

export async function listProducts({ q, showInactive }: { q?: string; showInactive?: boolean }) {
  const soldAgg = db
    .select({
      productId: saleItems.productId,
      qty: sql<number>`sum(${saleItems.quantity})`.as("qty"),
      revenueCents: sql<number>`sum(${saleItems.quantity} * ${saleItems.unitPriceCents})`.as("revenue_cents"),
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(notInArray(sales.status, [...INACTIVE_SALE_STATUSES]))
    .groupBy(saleItems.productId)
    .as("sold_agg");

  const term = q?.trim().toLowerCase();
  const conditions = [];
  if (!showInactive) conditions.push(eq(products.active, true));
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(or(like(sql`lower(${products.name})`, pattern), like(sql`lower(${products.category})`, pattern))!);
  }

  return db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      description: products.description,
      priceCents: products.priceCents,
      costCents: products.costCents,
      filamentGrams: products.filamentGrams,
      printMinutes: products.printMinutes,
      active: products.active,
      soldQty: sql<number>`coalesce(${soldAgg.qty}, 0)`,
      revenueCents: sql<number>`coalesce(${soldAgg.revenueCents}, 0)`,
    })
    .from(products)
    .leftJoin(soldAgg, eq(soldAgg.productId, products.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sql`coalesce(${soldAgg.qty}, 0)`), asc(sql`lower(${products.name})`));
}

export type ProductRow = Awaited<ReturnType<typeof listProducts>>[number];

export async function listProductCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(sql`${products.category} is not null and ${products.category} <> ''`)
    .orderBy(asc(products.category));
  return rows.map((r) => r.category!).filter(Boolean);
}

// ─── Categorias de gasto ───────────────────────────────────────────────────

export async function listExpenseCategories() {
  return db
    .select({ id: expenseCategories.id, name: expenseCategories.name })
    .from(expenseCategories)
    .orderBy(asc(expenseCategories.position), asc(expenseCategories.name));
}

// ─── Canais de venda já usados (sugestões) ─────────────────────────────────

export async function listUsedChannels(): Promise<string[]> {
  const rows = await db
    .select({ channel: sales.channel, n: sum(sql`1`) })
    .from(sales)
    .where(sql`${sales.channel} is not null and ${sales.channel} <> ''`)
    .groupBy(sales.channel)
    .orderBy(desc(sum(sql`1`)));
  return rows.map((r) => r.channel!);
}
