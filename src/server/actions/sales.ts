"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { customers, installments, payments, saleItems, sales } from "@/db/schema";
import { PAYMENT_METHODS, SALE_STATUSES, type SaleStatus } from "@/lib/constants";
import { sortSchedule, validateSchedule } from "@/lib/domain/schedule";
import { formatBRL } from "@/lib/money";
import { fail, ok, type ActionResult } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { cents, firstIssue, id, isoDate, optionalText, positiveCents } from "@/server/validation";

const itemSchema = z.object({
  productId: id.nullable(),
  description: z.string().trim().min(1, "Descreva cada item da venda.").max(200),
  quantity: z.number().int().min(1, "Quantidade mínima é 1.").max(100_000),
  unitPriceCents: cents,
  unitCostCents: cents,
});

const saleSchema = z.object({
  id: id.optional(),
  customerId: id.nullable(),
  newCustomer: z
    .object({ name: z.string().trim().min(1, "Informe o nome do cliente.").max(120), phone: optionalText(30) })
    .nullish(),
  title: z.string().trim().max(200),
  date: isoDate,
  status: z.enum(SALE_STATUSES),
  channel: optionalText(60),
  deliveryDate: isoDate.nullish(),
  notes: optionalText(2000),
  discountCents: cents,
  shippingCents: cents,
  items: z.array(itemSchema).min(1, "Inclua pelo menos um item.").max(100, "Máximo de 100 itens."),
  installments: z.array(z.object({ dueDate: isoDate, amountCents: z.number().int() })).max(120),
  initialPayment: z
    .object({
      amountCents: positiveCents,
      method: z.enum(PAYMENT_METHODS),
      date: isoDate,
      installmentIndex: z.number().int().min(0),
    })
    .nullish(),
});

export type SaleInput = z.input<typeof saleSchema>;

function autoTitle(items: { description: string; quantity: number }[]): string {
  const first = items[0];
  const base = first.quantity > 1 ? `${first.quantity}x ${first.description}` : first.description;
  return items.length > 1 ? `${base} + ${items.length - 1} ${items.length - 1 === 1 ? "item" : "itens"}` : base;
}

export async function saveSaleAction(input: SaleInput): Promise<ActionResult<{ id: number }>> {
  await requireUser();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;

  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
  const cost = data.items.reduce((s, i) => s + i.quantity * i.unitCostCents, 0);
  const total = subtotal - data.discountCents + data.shippingCents;
  if (total < 0) return fail("O desconto não pode ser maior que o valor dos itens.");

  const schedule = sortSchedule(data.installments);
  const scheduleError = validateSchedule(schedule, total);
  if (scheduleError) return fail(scheduleError);

  const initial = data.id ? null : (data.initialPayment ?? null);
  if (initial) {
    if (initial.installmentIndex >= schedule.length) return fail("Parcela do pagamento inicial inválida.");
    if (initial.amountCents > total) return fail("Pagamento inicial maior que o total da venda.");
  }

  if (data.customerId) {
    const [c] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, data.customerId));
    if (!c) return fail("Cliente não encontrado.");
  }
  if (data.id) {
    const [existing] = await db.select({ id: sales.id }).from(sales).where(eq(sales.id, data.id));
    if (!existing) return fail("Venda não encontrada.");
  }

  const values = {
    title: data.title || autoTitle(data.items),
    date: data.date,
    status: data.status,
    channel: data.channel,
    deliveryDate: data.deliveryDate ?? null,
    notes: data.notes,
    subtotalCents: subtotal,
    discountCents: data.discountCents,
    shippingCents: data.shippingCents,
    totalCents: total,
    costCents: cost,
  };

  const saleId = await db.transaction(async (tx) => {
    let customerId = data.customerId;
    if (!customerId && data.newCustomer?.name) {
      const [c] = await tx
        .insert(customers)
        .values({ name: data.newCustomer.name, phone: data.newCustomer.phone })
        .returning({ id: customers.id });
      customerId = c.id;
    }

    let saleId: number;
    // Pagamentos que apontavam para uma parcela específica (por número), para religar após recriar o plano.
    let targeted: { paymentId: number; number: number }[] = [];

    if (data.id) {
      saleId = data.id;
      await tx.update(sales).set({ ...values, customerId }).where(eq(sales.id, saleId));
      await tx.delete(saleItems).where(eq(saleItems.saleId, saleId));
      targeted = await tx
        .select({ paymentId: payments.id, number: installments.number })
        .from(payments)
        .innerJoin(installments, eq(installments.id, payments.installmentId))
        .where(and(eq(payments.saleId, saleId), isNotNull(payments.installmentId)));
      await tx.update(payments).set({ installmentId: null }).where(eq(payments.saleId, saleId));
      await tx.delete(installments).where(eq(installments.saleId, saleId));
    } else {
      const [created] = await tx
        .insert(sales)
        .values({ ...values, customerId })
        .returning({ id: sales.id });
      saleId = created.id;
    }

    await tx.insert(saleItems).values(
      data.items.map((item, position) => ({
        saleId,
        position,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        unitCostCents: item.unitCostCents,
      })),
    );

    const insertedInstallments = schedule.length
      ? await tx
          .insert(installments)
          .values(schedule.map((row, i) => ({ saleId, number: i + 1, dueDate: row.dueDate, amountCents: row.amountCents })))
          .returning({ id: installments.id, number: installments.number })
      : [];

    const idByNumber = new Map(insertedInstallments.map((i) => [i.number, i.id]));
    for (const t of targeted) {
      const newId = idByNumber.get(t.number);
      if (newId) await tx.update(payments).set({ installmentId: newId }).where(eq(payments.id, t.paymentId));
    }

    if (initial) {
      await tx.insert(payments).values({
        saleId,
        installmentId: idByNumber.get(initial.installmentIndex + 1) ?? null,
        date: initial.date,
        amountCents: initial.amountCents,
        method: initial.method,
      });
    }
    return saleId;
  });

  revalidatePath("/", "layout");
  return ok({ id: saleId });
}

export async function updateSaleStatusAction(saleId: number, status: SaleStatus): Promise<ActionResult> {
  await requireUser();
  if (!SALE_STATUSES.includes(status)) return fail("Status inválido.");
  await db.update(sales).set({ status }).where(eq(sales.id, saleId));
  revalidatePath("/", "layout");
  return ok();
}

/** Exclui a venda (com itens, parcelas e pagamentos) e volta para a lista. */
export async function deleteSaleAction(saleId: number): Promise<ActionResult> {
  await requireUser();
  await db.transaction(async (tx) => {
    await tx.delete(payments).where(eq(payments.saleId, saleId));
    await tx.delete(installments).where(eq(installments.saleId, saleId));
    await tx.delete(saleItems).where(eq(saleItems.saleId, saleId));
    await tx.delete(sales).where(eq(sales.id, saleId));
  });
  revalidatePath("/", "layout");
  redirect("/vendas");
}

// ─── Pagamentos ────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  saleId: id,
  amountCents: positiveCents,
  date: isoDate,
  method: z.enum(PAYMENT_METHODS),
  installmentId: id.nullable(),
  notes: optionalText(500),
});

export type PaymentInput = z.input<typeof paymentSchema>;

export async function addPaymentAction(input: PaymentInput): Promise<ActionResult<{ confirmedQuote: boolean }>> {
  await requireUser();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;

  const [sale] = await db
    .select({ id: sales.id, status: sales.status, totalCents: sales.totalCents })
    .from(sales)
    .where(eq(sales.id, data.saleId));
  if (!sale) return fail("Venda não encontrada.");
  if (sale.status === "cancelado") return fail("Venda cancelada não recebe pagamentos.");

  const [{ paid }] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(eq(payments.saleId, sale.id));
  const remaining = sale.totalCents - Number(paid);
  if (data.amountCents > remaining) {
    return fail(
      remaining <= 0
        ? "Essa venda já está quitada."
        : `Valor maior que o saldo em aberto (${formatBRL(remaining)}).`,
    );
  }

  if (data.installmentId) {
    const [inst] = await db
      .select({ id: installments.id })
      .from(installments)
      .where(and(eq(installments.id, data.installmentId), eq(installments.saleId, sale.id)));
    if (!inst) return fail("Parcela inválida.");
  }

  await db.insert(payments).values(data);
  const confirmedQuote = sale.status === "orcamento";
  if (confirmedQuote) await db.update(sales).set({ status: "em_producao" }).where(eq(sales.id, sale.id));

  revalidatePath("/", "layout");
  return ok({ confirmedQuote });
}

export async function deletePaymentAction(paymentId: number): Promise<ActionResult> {
  await requireUser();
  await db.delete(payments).where(eq(payments.id, paymentId));
  revalidatePath("/", "layout");
  return ok();
}
