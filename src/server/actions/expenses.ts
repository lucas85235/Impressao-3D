"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { expenseCategories, expenses } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { planExpenseInstallments } from "@/lib/domain/expenses";
import { fail, ok, type ActionResult } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { firstIssue, id, isoDate, optionalText, parseId, positiveCents } from "@/server/validation";

const expenseSchema = z.object({
  description: z.string().trim().min(1, "Descreva o gasto.").max(200),
  amountCents: positiveCents,
  date: isoDate,
  categoryId: id.nullable(),
  supplier: optionalText(120),
  paid: z.boolean(),
  method: optionalText(40),
  notes: optionalText(2000),
});

const createSchema = expenseSchema.extend({
  installmentCount: z.number().int().min(1).max(60).default(1),
  /** "total": o valor informado é o total da compra; "parcela": é o valor de cada parcela. */
  amountMode: z.enum(["total", "parcela"]).default("total"),
});

export type ExpenseInput = z.input<typeof createSchema>;

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult<{ count: number }>> {
  await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { installmentCount: n, amountMode, ...data } = parsed.data;

  if (n === 1) {
    await db.insert(expenses).values(data);
  } else {
    if (amountMode === "total" && data.amountCents < n) {
      return fail(`Valor pequeno demais para ${n} parcelas (cada uma precisa de pelo menos R$ 0,01).`);
    }
    const plan = planExpenseInstallments({
      amountCents: data.amountCents,
      firstDate: data.date,
      count: n,
      amountMode,
      paid: data.paid,
      today: todayISO(),
    });
    const groupId = randomUUID();
    await db.insert(expenses).values(plan.map((p) => ({ ...data, ...p, groupId, installmentCount: n })));
  }
  revalidatePath("/", "layout");
  return ok({ count: n });
}

export async function updateExpenseAction(expenseId: number, input: z.input<typeof expenseSchema>): Promise<ActionResult> {
  await requireUser();
  const eid = parseId(expenseId);
  if (!eid) return fail("Gasto inválido.");
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const updated = await db.update(expenses).set(parsed.data).where(eq(expenses.id, eid)).returning({ id: expenses.id });
  if (updated.length === 0) return fail("Gasto não encontrado.");
  revalidatePath("/", "layout");
  return ok();
}

export async function setExpensePaidAction(expenseId: number, paid: boolean): Promise<ActionResult> {
  await requireUser();
  const eid = parseId(expenseId);
  if (!eid || typeof paid !== "boolean") return fail("Dados inválidos.");
  const updated = await db.update(expenses).set({ paid }).where(eq(expenses.id, eid)).returning({ id: expenses.id });
  if (updated.length === 0) return fail("Gasto não encontrado.");
  revalidatePath("/", "layout");
  return ok();
}

export async function deleteExpenseAction(expenseId: number, scope: "one" | "group" = "one"): Promise<ActionResult> {
  await requireUser();
  const eid = parseId(expenseId);
  if (!eid) return fail("Gasto inválido.");
  const [row] = await db.select({ groupId: expenses.groupId }).from(expenses).where(eq(expenses.id, eid));
  if (!row) return fail("Gasto não encontrado.");
  if (scope === "group" && row.groupId) {
    await db.delete(expenses).where(eq(expenses.groupId, row.groupId));
  } else {
    await db.delete(expenses).where(eq(expenses.id, eid));
  }
  revalidatePath("/", "layout");
  return ok();
}

export async function createExpenseCategoryAction(name: unknown): Promise<ActionResult<{ id: number; name: string }>> {
  await requireUser();
  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) return fail("Informe o nome da categoria.");
  const existing = await db.query.expenseCategories.findFirst({ where: eq(expenseCategories.name, clean) });
  if (existing) return ok({ id: existing.id, name: existing.name });
  const [created] = await db
    .insert(expenseCategories)
    .values({ name: clean, position: 100 })
    .returning({ id: expenseCategories.id, name: expenseCategories.name });
  revalidatePath("/", "layout");
  return ok(created);
}
