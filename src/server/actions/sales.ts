"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { customers, installments, payments, saleItems, sales } from "@/db/schema";
import { PAYMENT_METHODS, SALE_STATUSES, type SaleStatus } from "@/lib/constants";
import { relinkTargetedPayments, sortSchedule, validateSchedule } from "@/lib/domain/schedule";
import { formatBRL } from "@/lib/money";
import { fail, ok, type ActionResult } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { cents, firstIssue, id, isoDate, MAX_CENTS, optionalText, parseId, positiveCents } from "@/server/validation";

/** Regra de negócio violada dentro de uma transação: desfaz tudo e vira fail(). */
class ActionError extends Error {}

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

async function paidCentsOf(tx: Pick<typeof db, "select">, saleId: number): Promise<number> {
  const [row] = await tx
    .select({ paid: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(eq(payments.saleId, saleId));
  return Number(row?.paid ?? 0);
}

export async function saveSaleAction(input: SaleInput): Promise<ActionResult<{ id: number; confirmedQuote: boolean }>> {
  await requireUser();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const data = parsed.data;

  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
  const cost = data.items.reduce((s, i) => s + i.quantity * i.unitCostCents, 0);
  const total = subtotal - data.discountCents + data.shippingCents;
  if (total < 0) return fail("O desconto não pode ser maior que o valor dos itens.");
  // Quantidade × preço pode passar do inteiro seguro do JavaScript: barra antes de gravar.
  if ([subtotal, cost, total].some((v) => !Number.isSafeInteger(v) || v > MAX_CENTS)) {
    return fail("Valor total muito alto.");
  }

  const schedule = sortSchedule(data.installments);
  const scheduleError = validateSchedule(schedule, total);
  if (scheduleError) return fail(scheduleError);

  const initial = data.id ? null : (data.initialPayment ?? null);
  if (initial) {
    if (initial.installmentIndex >= schedule.length) return fail("Parcela do pagamento inicial inválida.");
    if (initial.amountCents > total) return fail("Pagamento inicial maior que o total da venda.");
    if (data.status === "cancelado") return fail("Venda cancelada não recebe pagamento.");
  }
  // Recebeu dinheiro na criação: o orçamento vira venda (mesma regra do botão "Receber").
  const confirmedQuote = Boolean(initial) && data.status === "orcamento";

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
    status: confirmedQuote ? ("em_producao" as const) : data.status,
    channel: data.channel,
    deliveryDate: data.deliveryDate ?? null,
    notes: data.notes,
    subtotalCents: subtotal,
    discountCents: data.discountCents,
    shippingCents: data.shippingCents,
    totalCents: total,
    costCents: cost,
  };

  let savedId: number;
  try {
    savedId = await db.transaction(async (tx) => {
      let customerId = data.customerId;
      if (!customerId && data.newCustomer?.name) {
        const [c] = await tx
          .insert(customers)
          .values({ name: data.newCustomer.name, phone: data.newCustomer.phone })
          .returning({ id: customers.id });
        customerId = c.id;
      }

      let saleId: number;
      // Pagamentos que apontavam para uma parcela específica, para religar após recriar o plano.
      let targeted: { paymentId: number; number: number; dueDate: string }[] = [];

      if (data.id) {
        saleId = data.id;
        const paid = await paidCentsOf(tx, saleId);
        if (total < paid) {
          throw new ActionError(
            `O novo total (${formatBRL(total)}) ficou menor que o já recebido (${formatBRL(paid)}). Apague ou ajuste os pagamentos antes.`,
          );
        }
        await tx.update(sales).set({ ...values, customerId }).where(eq(sales.id, saleId));
        await tx.delete(saleItems).where(eq(saleItems.saleId, saleId));
        targeted = await tx
          .select({ paymentId: payments.id, number: installments.number, dueDate: installments.dueDate })
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

      const inserted = schedule.length
        ? await tx
            .insert(installments)
            .values(schedule.map((row, i) => ({ saleId, number: i + 1, dueDate: row.dueDate, amountCents: row.amountCents })))
            .returning({ id: installments.id, number: installments.number, dueDate: installments.dueDate })
        : [];

      for (const [paymentId, installmentId] of relinkTargetedPayments(targeted, inserted)) {
        await tx.update(payments).set({ installmentId }).where(eq(payments.id, paymentId));
      }

      if (initial) {
        await tx.insert(payments).values({
          saleId,
          installmentId: inserted.find((i) => i.number === initial.installmentIndex + 1)?.id ?? null,
          date: initial.date,
          amountCents: initial.amountCents,
          method: initial.method,
        });
      }
      return saleId;
    });
  } catch (err) {
    if (err instanceof ActionError) return fail(err.message);
    throw err;
  }

  revalidatePath("/", "layout");
  return ok({ id: savedId, confirmedQuote });
}

export async function updateSaleStatusAction(saleId: number, status: SaleStatus): Promise<ActionResult<{ paidCents: number }>> {
  await requireUser();
  const sid = parseId(saleId);
  const next = z.enum(SALE_STATUSES).safeParse(status);
  if (!sid || !next.success) return fail("Status inválido.");
  const updated = await db.update(sales).set({ status: next.data }).where(eq(sales.id, sid)).returning({ id: sales.id });
  if (updated.length === 0) return fail("Venda não encontrada.");
  const paidCents = await paidCentsOf(db, sid);
  revalidatePath("/", "layout");
  return ok({ paidCents });
}

/** Exclui a venda (com itens, parcelas e pagamentos) e volta para a lista. */
export async function deleteSaleAction(saleId: number): Promise<ActionResult> {
  await requireUser();
  const sid = parseId(saleId);
  if (!sid) return fail("Venda inválida.");
  await db.transaction(async (tx) => {
    await tx.delete(payments).where(eq(payments.saleId, sid));
    await tx.delete(installments).where(eq(installments.saleId, sid));
    await tx.delete(saleItems).where(eq(saleItems.saleId, sid));
    await tx.delete(sales).where(eq(sales.id, sid));
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

  // Confere o saldo e grava na mesma transação (BEGIN IMMEDIATE no libSQL):
  // dois cliques ou duas abas ao mesmo tempo não conseguem pagar além do saldo.
  const result = await db.transaction(async (tx): Promise<ActionResult<{ confirmedQuote: boolean }>> => {
    const [sale] = await tx
      .select({ id: sales.id, status: sales.status, totalCents: sales.totalCents })
      .from(sales)
      .where(eq(sales.id, data.saleId));
    if (!sale) return fail("Venda não encontrada.");
    if (sale.status === "cancelado") return fail("Venda cancelada não recebe pagamentos.");

    const remaining = sale.totalCents - (await paidCentsOf(tx, sale.id));
    if (data.amountCents > remaining) {
      return fail(
        remaining <= 0 ? "Essa venda já está quitada." : `Valor maior que o saldo em aberto (${formatBRL(remaining)}).`,
      );
    }

    if (data.installmentId) {
      const [inst] = await tx
        .select({ id: installments.id })
        .from(installments)
        .where(and(eq(installments.id, data.installmentId), eq(installments.saleId, sale.id)));
      if (!inst) return fail("Parcela inválida.");
    }

    await tx.insert(payments).values(data);
    const confirmedQuote = sale.status === "orcamento";
    if (confirmedQuote) await tx.update(sales).set({ status: "em_producao" }).where(eq(sales.id, sale.id));
    return ok({ confirmedQuote });
  });

  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deletePaymentAction(paymentId: number): Promise<ActionResult> {
  await requireUser();
  const pid = parseId(paymentId);
  if (!pid) return fail("Pagamento inválido.");
  const deleted = await db.delete(payments).where(eq(payments.id, pid)).returning({ id: payments.id });
  if (deleted.length === 0) return fail("Pagamento não encontrado.");
  revalidatePath("/", "layout");
  return ok();
}
