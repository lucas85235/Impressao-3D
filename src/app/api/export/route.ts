import { db } from "@/db";
import {
  customers,
  expenseCategories,
  expenses,
  installments,
  payments,
  products,
  saleItems,
  sales,
  settings,
} from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { getCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Backup completo dos dados de negócio (sem senhas, sessões ou inscrições de push). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const [c, p, s, si, i, pay, ec, e, st] = await Promise.all([
    db.select().from(customers),
    db.select().from(products),
    db.select().from(sales),
    db.select().from(saleItems),
    db.select().from(installments),
    db.select().from(payments),
    db.select().from(expenseCategories),
    db.select().from(expenses),
    db.select().from(settings),
  ]);

  const body = JSON.stringify(
    {
      app: "gestao-3d",
      version: 1,
      exportedAt: new Date().toISOString(),
      note: "Valores em centavos. Datas no formato AAAA-MM-DD.",
      data: {
        customers: c,
        products: p,
        sales: s,
        saleItems: si,
        installments: i,
        payments: pay,
        expenseCategories: ec,
        expenses: e,
        settings: st.filter((row) => row.key !== "lastDigestDate"),
      },
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gestao3d-backup-${todayISO()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
