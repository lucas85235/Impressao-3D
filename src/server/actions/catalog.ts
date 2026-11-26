"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { customers, products, saleItems, sales } from "@/db/schema";
import { fail, ok, type ActionResult } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { cents, firstIssue, id, optionalText } from "@/server/validation";

// ─── Clientes ──────────────────────────────────────────────────────────────

const customerSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cliente.").max(120),
  phone: optionalText(30),
  email: optionalText(120).refine((v) => !v || z.email().safeParse(v).success, "E-mail inválido."),
  instagram: optionalText(60).transform((v) => (v ? v.replace(/^@/, "") : v)),
  city: optionalText(80),
  notes: optionalText(2000),
});

export type CustomerInput = z.input<typeof customerSchema>;

export async function saveCustomerAction(
  customerId: number | null,
  input: CustomerInput,
): Promise<ActionResult<{ id: number; name: string; phone: string | null }>> {
  await requireUser();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  let savedId: number;
  if (customerId) {
    await db.update(customers).set(parsed.data).where(eq(customers.id, customerId));
    savedId = customerId;
  } else {
    const [created] = await db.insert(customers).values(parsed.data).returning({ id: customers.id });
    savedId = created.id;
  }
  revalidatePath("/", "layout");
  return ok({ id: savedId, name: parsed.data.name, phone: parsed.data.phone });
}

export async function deleteCustomerAction(customerId: number): Promise<ActionResult> {
  await requireUser();
  await db.transaction(async (tx) => {
    // As vendas continuam existindo, só perdem o vínculo com o cliente.
    await tx.update(sales).set({ customerId: null }).where(eq(sales.customerId, customerId));
    await tx.delete(customers).where(eq(customers.id, customerId));
  });
  revalidatePath("/", "layout");
  redirect("/clientes");
}

// ─── Produtos ──────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do produto.").max(120),
  category: optionalText(60),
  description: optionalText(2000),
  priceCents: cents,
  costCents: cents,
  filamentGrams: z.number().int().min(0).max(1_000_000).nullable(),
  printMinutes: z.number().int().min(0).max(1_000_000).nullable(),
  active: z.boolean(),
});

export type ProductInput = z.input<typeof productSchema>;

export async function saveProductAction(productId: number | null, input: ProductInput): Promise<ActionResult<{ id: number }>> {
  await requireUser();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  let savedId: number;
  if (productId) {
    await db.update(products).set(parsed.data).where(eq(products.id, productId));
    savedId = productId;
  } else {
    const [created] = await db.insert(products).values(parsed.data).returning({ id: products.id });
    savedId = created.id;
  }
  revalidatePath("/", "layout");
  return ok({ id: savedId });
}

export async function setProductActiveAction(productId: number, active: boolean): Promise<ActionResult> {
  await requireUser();
  await db.update(products).set({ active }).where(eq(products.id, id.parse(productId)));
  revalidatePath("/", "layout");
  return ok();
}

export async function deleteProductAction(productId: number): Promise<ActionResult> {
  await requireUser();
  await db.transaction(async (tx) => {
    // Itens de vendas antigas mantêm a descrição; só perdem o vínculo com o catálogo.
    await tx.update(saleItems).set({ productId: null }).where(eq(saleItems.productId, productId));
    await tx.delete(products).where(eq(products.id, productId));
  });
  revalidatePath("/", "layout");
  return ok();
}
