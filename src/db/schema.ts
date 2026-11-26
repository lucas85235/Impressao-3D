import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
// Import relativo (não "@/"): o drizzle-kit carrega este arquivo fora do Next.
import { PAYMENT_METHODS, SALE_STATUSES } from "../lib/constants";

/*
 * Convenções:
 * - Dinheiro sempre em CENTAVOS (inteiro). Nunca float.
 * - Datas de negócio (venda, vencimento, pagamento, gasto) como texto "YYYY-MM-DD".
 * - Timestamps técnicos (created/updated) como epoch ms.
 */

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// ─── Autenticação ──────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 (hex) do token do cookie — o token em si nunca é salvo. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Controle simples de tentativas de login (anti força-bruta). */
export const authAttempts = sqliteTable("auth_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: integer("window_start", { mode: "timestamp_ms" }).notNull(),
});

// ─── Configurações (chave/valor JSON) ──────────────────────────────────────

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─── Cadastros ─────────────────────────────────────────────────────────────

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    instagram: text("instagram"),
    city: text("city"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("customers_name_idx").on(t.name)],
);

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  priceCents: integer("price_cents").notNull().default(0),
  /** Custo estimado por unidade (material + energia + extras). */
  costCents: integer("cost_cents").notNull().default(0),
  filamentGrams: integer("filament_grams"),
  printMinutes: integer("print_minutes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Vendas, parcelas e pagamentos ─────────────────────────────────────────

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    date: text("date").notNull(),
    title: text("title").notNull(),
    status: text("status", { enum: SALE_STATUSES }).notNull().default("em_producao"),
    /** Canal de origem (Instagram, WhatsApp, feira...). */
    channel: text("channel"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    /** Custo estimado total (soma dos custos unitários dos itens). */
    costCents: integer("cost_cents").notNull().default(0),
    deliveryDate: text("delivery_date"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("sales_date_idx").on(t.date),
    index("sales_customer_idx").on(t.customerId),
    index("sales_status_idx").on(t.status),
  ],
);

export const saleItems = sqliteTable(
  "sale_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId), index("sale_items_product_idx").on(t.productId)],
);

/** Plano de recebimento: cada linha é uma parcela com vencimento. */
export const installments = sqliteTable(
  "installments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    dueDate: text("due_date").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [index("installments_sale_idx").on(t.saleId), index("installments_due_idx").on(t.dueDate)],
);

/**
 * Dinheiro efetivamente recebido. Pode apontar para uma parcela específica
 * (installmentId) ou ficar "solto" — nesse caso é abatido da parcela mais antiga.
 */
export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    installmentId: integer("installment_id").references(() => installments.id, {
      onDelete: "set null",
    }),
    date: text("date").notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull().default("pix"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("payments_sale_idx").on(t.saleId), index("payments_date_idx").on(t.date)],
);

// ─── Gastos ────────────────────────────────────────────────────────────────

export const expenseCategories = sqliteTable("expense_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  position: integer("position").notNull().default(0),
});

export const expenses = sqliteTable(
  "expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Data da compra / vencimento da parcela. */
    date: text("date").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    categoryId: integer("category_id").references(() => expenseCategories.id, {
      onDelete: "set null",
    }),
    supplier: text("supplier"),
    paid: integer("paid", { mode: "boolean" }).notNull().default(true),
    method: text("method"),
    /** Agrupa as parcelas de uma mesma compra parcelada. */
    groupId: text("group_id"),
    installmentNumber: integer("installment_number"),
    installmentCount: integer("installment_count"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("expenses_date_idx").on(t.date), index("expenses_group_idx").on(t.groupId)],
);

// ─── Notificações push ─────────────────────────────────────────────────────

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
});

export type Customer = typeof customers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Installment = typeof installments.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type User = typeof users.$inferSelect;
