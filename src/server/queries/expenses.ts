import "server-only";
import { and, asc, between, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenseCategories, expenses } from "@/db/schema";
import { addDays, monthRange } from "@/lib/dates";

const expenseColumns = {
  id: expenses.id,
  date: expenses.date,
  description: expenses.description,
  amountCents: expenses.amountCents,
  categoryId: expenses.categoryId,
  categoryName: expenseCategories.name,
  supplier: expenses.supplier,
  paid: expenses.paid,
  method: expenses.method,
  groupId: expenses.groupId,
  installmentNumber: expenses.installmentNumber,
  installmentCount: expenses.installmentCount,
  notes: expenses.notes,
};

export async function listExpenses({ month, categoryId }: { month: string; categoryId?: number }) {
  const { start, end } = monthRange(month);
  return db
    .select(expenseColumns)
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(and(between(expenses.date, start, end), categoryId ? eq(expenses.categoryId, categoryId) : undefined))
    .orderBy(desc(expenses.date), desc(expenses.id));
}

export type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];

/** Gastos agrupados por categoria no intervalo (maior primeiro). */
export async function expensesByCategory(start: string, end: string) {
  const rows = await db
    .select({
      categoryId: expenses.categoryId,
      name: sql<string>`coalesce(${expenseCategories.name}, 'Sem categoria')`,
      cents: sql<number>`sum(${expenses.amountCents})`,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(between(expenses.date, start, end))
    .groupBy(expenses.categoryId)
    .orderBy(desc(sql`sum(${expenses.amountCents})`));
  return rows.map((r) => ({ ...r, cents: Number(r.cents) }));
}

/** Contas a pagar: gastos não pagos vencidos ou vencendo nos próximos dias. */
export async function listPayables(today: string, daysAhead: number) {
  return db
    .select(expenseColumns)
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(and(eq(expenses.paid, false), lte(expenses.date, addDays(today, daysAhead))))
    .orderBy(asc(expenses.date), asc(expenses.id));
}

export async function getExpense(id: number) {
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return row ?? null;
}
