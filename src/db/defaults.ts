import { DEFAULT_EXPENSE_CATEGORIES } from "../lib/constants";
import type { Db } from "./client";
import { expenseCategories } from "./schema";

/** Dados mínimos que o app espera existir (idempotente). */
export async function ensureDefaults(db: Db) {
  const existing = await db.select({ id: expenseCategories.id }).from(expenseCategories).limit(1);
  if (existing.length === 0) {
    await db
      .insert(expenseCategories)
      .values(DEFAULT_EXPENSE_CATEGORIES.map((name, position) => ({ name, position })));
  }
}
