/**
 * Cria um banco de DEMONSTRAÇÃO com 12 meses de dados fictícios (datas relativas a hoje).
 * Só roda se DATABASE_URL tiver "demo" no nome — nunca apaga o banco real.
 *
 *   npm run db:demo      → cria/recria data/demo.db
 *   npm run dev:demo     → abre o app usando esse banco
 *
 * Login da demonstração: demo@gestao3d.local / demo1234
 */
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../src/db/client";
import { ensureDefaults } from "../src/db/defaults";
import * as t from "../src/db/schema";
import type { PaymentMethod, SaleStatus } from "../src/lib/constants";
import { addDays, addMonths, daysInMonth, todayISO, toISO } from "../src/lib/dates";
import { buildDownPaymentPlan, buildInstallmentPlan, type ScheduleRow } from "../src/lib/domain/schedule";
import { splitEvenly } from "../src/lib/money";
import { hashPassword } from "../src/server/password";

loadEnvConfig(process.cwd());

export const DEMO_EMAIL = "demo@gestao3d.local";
export const DEMO_PASSWORD = "demo1234";

// Gerador pseudoaleatório determinístico (os mesmos dados a cada execução no mesmo dia).
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(3_2026);
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const chance = (p: number) => rand() < p;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) {
    if ((r -= w) < 0) return v;
  }
  return entries[entries.length - 1][0];
}
const minDate = (a: string, b: string) => (a < b ? a : b);

const PRODUCTS = [
  { name: "Vaso geométrico 15cm", category: "Decoração", priceCents: 4990, costCents: 1150, filamentGrams: 120, printMinutes: 300 },
  { name: "Chaveiro personalizado", category: "Brindes", priceCents: 1500, costCents: 280, filamentGrams: 12, printMinutes: 35 },
  { name: "Miniatura RPG 32mm", category: "Miniaturas", priceCents: 3500, costCents: 600, filamentGrams: 25, printMinutes: 180 },
  { name: "Suporte de headset", category: "Utilidades", priceCents: 6990, costCents: 1500, filamentGrams: 160, printMinutes: 420 },
  { name: "Luminária lua 12cm", category: "Decoração", priceCents: 8990, costCents: 2100, filamentGrams: 140, printMinutes: 600 },
  { name: "Organizador de mesa", category: "Utilidades", priceCents: 5490, costCents: 1300, filamentGrams: 150, printMinutes: 360 },
  { name: "Action figure 18cm (resina)", category: "Miniaturas", priceCents: 18990, costCents: 4200, filamentGrams: null, printMinutes: 720 },
  { name: "Topo de bolo personalizado", category: "Festas", priceCents: 3990, costCents: 700, filamentGrams: 40, printMinutes: 150 },
];

const CUSTOMERS = [
  "Ana Beatriz Costa",
  "Bruno Almeida",
  "Carla Mendes",
  "Diego Ferreira",
  "Eduarda Lima",
  "Felipe Rocha",
  "Gabriela Nunes",
  "Henrique Souza",
  "Isabela Martins",
  "João Pedro Ribeiro",
  "Larissa Gomes",
  "Marcos Vinícius",
  "Natália Barros",
  "Rafael Teixeira",
];

const CHANNELS: [string, number][] = [
  ["Instagram", 35],
  ["WhatsApp", 25],
  ["Indicação", 15],
  ["Feira/Evento", 10],
  ["Shopee", 10],
  ["Mercado Livre", 5],
];

const METHODS: [PaymentMethod, number][] = [
  ["pix", 70],
  ["dinheiro", 10],
  ["cartao_credito", 12],
  ["cartao_debito", 5],
  ["transferencia", 3],
];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  // Só arquivo local com "demo" no nome: o script APAGA todas as tabelas.
  if (!url.startsWith("file:") || !url.includes("demo")) {
    console.error('Por segurança, rode com um banco de demonstração: DATABASE_URL=file:./data/demo.db (use "npm run db:demo").');
    process.exit(1);
  }

  const today = todayISO();
  const db = createDb(url);
  await migrate(db, { migrationsFolder: "drizzle" });
  await ensureDefaults(db);

  // Limpa tudo (somente no banco demo).
  for (const table of [
    t.payments,
    t.installments,
    t.saleItems,
    t.sales,
    t.expenses,
    t.products,
    t.customers,
    t.sessions,
    t.authAttempts,
    t.pushSubscriptions,
    t.users,
    t.settings,
  ]) {
    await db.delete(table);
  }

  await db.insert(t.users).values({ name: "Demo", email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASSWORD) });
  await db.insert(t.settings).values([
    { key: "businessName", value: JSON.stringify("Camadas Ateliê 3D") },
    { key: "pixKey", value: JSON.stringify("pix@exemplo.com") },
  ]);

  const products = await db.insert(t.products).values(PRODUCTS).returning();
  const customers = await db
    .insert(t.customers)
    .values(
      CUSTOMERS.map((name, i) => ({
        name,
        phone: `(11) 90000-${String(1001 + i).padStart(4, "0")}`,
        instagram: chance(0.6) ? name.toLowerCase().split(" ")[0] + ".3d" : null,
        city: pick(["São Paulo", "Campinas", "Santo André", "Guarulhos", "Osasco"]),
      })),
    )
    .returning();
  const categories = await db.select().from(t.expenseCategories);
  const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;

  // ─── Vendas ──────────────────────────────────────────────────────────────
  let salesCount = 0;
  for (let m = 11; m >= 0; m--) {
    const monthStart = addMonths(`${today.slice(0, 7)}-01`, -m);
    const [y, mo] = monthStart.split("-").map(Number);
    const lastDay = minDate(toISO(y, mo, daysInMonth(y, mo)), today);
    const maxDay = Number(lastDay.slice(8));
    const n = between(4, 7) + (m < 4 ? 2 : 0); // negócio crescendo
    for (let k = 0; k < n; k++) {
      const date = toISO(y, mo, between(1, maxDay));
      const age = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
      const status: SaleStatus =
        age > 20 ? (chance(0.03) ? "cancelado" : "entregue") : pick(["em_producao", "pronto", "entregue"] as const);

      const items = Array.from({ length: weighted([[1, 60], [2, 30], [3, 10]]) }, () => {
        if (chance(0.15)) {
          const price = between(30, 250) * 100;
          return { productId: null, description: "Peça técnica sob medida", quantity: 1, unitPriceCents: price, unitCostCents: Math.round(price * 0.25) };
        }
        const p = pick(products);
        const quantity = p.name.startsWith("Chaveiro") ? between(5, 25) : between(1, 3);
        return { productId: p.id, description: p.name, quantity, unitPriceCents: p.priceCents, unitCostCents: p.costCents };
      });
      const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
      const discount = chance(0.15) ? Math.round(subtotal * 0.1) : 0;
      const shipping = chance(0.25) ? between(15, 30) * 100 : 0;
      const total = subtotal - discount + shipping;
      const customer = chance(0.92) ? pick(customers) : null;

      const plan = weighted<"avista" | "parcelado" | "entrada">([["avista", 55], ["parcelado", 30], ["entrada", 15]]);
      let schedule: ScheduleRow[];
      if (plan === "avista") schedule = [{ dueDate: chance(0.7) ? date : addDays(date, between(3, 15)), amountCents: total }];
      else if (plan === "parcelado")
        schedule = buildInstallmentPlan({ totalCents: total, count: between(2, 4), firstDueDate: addMonths(date, 1), frequency: "mensal" });
      else
        schedule = buildDownPaymentPlan({
          totalCents: total,
          downPaymentCents: Math.round(total * pick([0.3, 0.4, 0.5])),
          downPaymentDate: date,
          count: between(2, 3),
          firstDueDate: addMonths(date, 1),
          frequency: "mensal",
        });

      const [sale] = await db
        .insert(t.sales)
        .values({
          customerId: customer?.id ?? null,
          date,
          title: items.length > 1 ? `${items[0].description} + ${items.length - 1}` : items[0].quantity > 1 ? `${items[0].quantity}x ${items[0].description}` : items[0].description,
          status,
          channel: weighted(CHANNELS),
          subtotalCents: subtotal,
          discountCents: discount,
          shippingCents: shipping,
          totalCents: total,
          costCents: items.reduce((s, i) => s + i.quantity * i.unitCostCents, 0),
        })
        .returning();
      salesCount++;
      await db.insert(t.saleItems).values(items.map((i, position) => ({ ...i, saleId: sale.id, position })));
      const insts = await db
        .insert(t.installments)
        .values(schedule.map((r, i) => ({ saleId: sale.id, number: i + 1, dueDate: r.dueDate, amountCents: r.amountCents })))
        .returning();

      if (status === "cancelado") continue;
      for (const inst of insts) {
        const method = weighted(METHODS);
        if (inst.dueDate < today) {
          const roll = rand();
          // Parcelas recentes têm mais chance de estar em aberto (é o que gera cobranças na demo).
          const recent = inst.dueDate >= addDays(today, -45);
          if (roll < (recent ? 0.68 : 0.95)) {
            const paidOn = minDate(addDays(inst.dueDate, between(-2, 3)), today);
            await db.insert(t.payments).values({ saleId: sale.id, installmentId: inst.id, date: paidOn < date ? date : paidOn, amountCents: inst.amountCents, method });
          } else if (roll < (recent ? 0.84 : 0.98)) {
            await db.insert(t.payments).values({ saleId: sale.id, installmentId: inst.id, date: inst.dueDate, amountCents: Math.round(inst.amountCents / 2), method, notes: "Pagou metade" });
          }
        } else if (inst.number === 1 && inst.dueDate === date && chance(0.6)) {
          await db.insert(t.payments).values({ saleId: sale.id, installmentId: inst.id, date, amountCents: inst.amountCents, method });
        }
      }
    }
  }

  // Dois orçamentos em aberto no mês atual.
  for (const [desc, price] of [["Luminária personalizada com nome", 12990], ["Kit 30 lembrancinhas de casamento", 45000]] as const) {
    const [sale] = await db
      .insert(t.sales)
      .values({ customerId: pick(customers).id, date: today, title: desc, status: "orcamento", channel: "WhatsApp", subtotalCents: price, totalCents: price })
      .returning();
    await db.insert(t.saleItems).values({ saleId: sale.id, description: desc, quantity: 1, unitPriceCents: price });
    await db.insert(t.installments).values({ saleId: sale.id, number: 1, dueDate: addDays(today, 7), amountCents: price });
  }

  // ─── Gastos ──────────────────────────────────────────────────────────────
  const expenseRows: (typeof t.expenses.$inferInsert)[] = [];
  for (let m = 11; m >= 0; m--) {
    const monthStart = addMonths(`${today.slice(0, 7)}-01`, -m);
    const [y, mo] = monthStart.split("-").map(Number);
    const maxDay = Number(minDate(toISO(y, mo, daysInMonth(y, mo)), today).slice(8));
    const day = () => toISO(y, mo, between(1, maxDay));
    for (let i = 0; i < between(2, 3); i++) {
      expenseRows.push({
        date: day(),
        description: `PLA ${pick(["preto", "branco", "cinza", "azul", "vermelho", "silk dourado"])} 1kg`,
        amountCents: between(85, 135) * 100 + 90,
        categoryId: cat("Filamento"),
        supplier: pick(["Fornecedor de filamentos", "Marketplace"]),
        method: "pix",
      });
    }
    expenseRows.push({ date: toISO(y, mo, Math.min(10, maxDay)), description: "Energia (parte da impressão)", amountCents: between(55, 95) * 100, categoryId: cat("Energia elétrica"), method: "boleto" });
    expenseRows.push({ date: day(), description: "Caixas e plástico bolha", amountCents: between(20, 45) * 100, categoryId: cat("Embalagens"), supplier: "Papelaria" });
    if (chance(0.55)) expenseRows.push({ date: day(), description: "Impulsionamento no Instagram", amountCents: between(30, 90) * 100, categoryId: cat("Marketing e anúncios"), method: "cartao_credito" });
    if (chance(0.35)) expenseRows.push({ date: day(), description: pick(["Bico 0.4 + tubo PTFE", "Cama PEI magnética", "Correia e rolamentos"]), amountCents: between(35, 160) * 100, categoryId: cat("Peças e manutenção") });
    if (chance(0.5)) expenseRows.push({ date: day(), description: "Taxas do marketplace", amountCents: between(15, 45) * 100, categoryId: cat("Taxas e tarifas") });
    if (chance(0.2)) expenseRows.push({ date: day(), description: "Resina padrão 1L", amountCents: between(130, 190) * 100, categoryId: cat("Resina") });
  }
  // Impressora nova em 10x, comprada há 5 meses (parcelas futuras ficam "a pagar").
  const printerStart = addMonths(today, -5);
  const groupId = randomUUID();
  splitEvenly(349900, 10).forEach((amountCents, i) => {
    const date = addMonths(printerStart, i);
    expenseRows.push({
      date,
      description: "Impressora 3D nova",
      amountCents,
      categoryId: cat("Equipamentos"),
      supplier: "Loja de eletrônicos",
      method: "cartao_credito",
      paid: date < today,
      groupId,
      installmentNumber: i + 1,
      installmentCount: 10,
    });
  });
  for (let i = 0; i < expenseRows.length; i += 50) {
    await db.insert(t.expenses).values(expenseRows.slice(i, i + 50));
  }

  console.log(`✓ Demo pronta: ${salesCount + 2} vendas, ${customers.length} clientes, ${expenseRows.length} gastos.`);
  console.log(`  Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}  →  npm run dev:demo`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
