import { ChevronLeft, ChevronRight, CircleCheck, Clock, Receipt, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat";
import { CategoryFilter } from "@/components/expenses/category-filter";
import { ExpenseFormButton } from "@/components/expenses/expense-form";
import { ExpenseList } from "@/components/expenses/expense-list";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { addMonthsToKey, formatMonthLong, isValidMonthKey, monthKey, monthRange, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { listExpenseCategories } from "@/server/queries/catalog";
import { expensesByCategory, listExpenses } from "@/server/queries/expenses";

export const metadata: Metadata = { title: "Gastos" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; categoria?: string; novo?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const month = isValidMonthKey(sp.mes) ? sp.mes : monthKey(today);
  const categoryId = Number(sp.categoria) || null;
  const { start, end } = monthRange(month);

  const [categories, rows, byCategory] = await Promise.all([
    listExpenseCategories(),
    listExpenses({ month, categoryId: categoryId ?? undefined }),
    expensesByCategory(start, end),
  ]);

  const total = rows.reduce((s, e) => s + e.amountCents, 0);
  const paid = rows.filter((e) => e.paid).reduce((s, e) => s + e.amountCents, 0);
  const href = (m: string) => `/gastos?mes=${m}${categoryId ? `&categoria=${categoryId}` : ""}`;

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Filamento, peças, energia, embalagens… tudo que sai do caixa."
        actions={<ExpenseFormButton categories={categories} today={today} autoOpen={sp.novo === "1"} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-xl border border-line-strong bg-surface">
          <Link
            href={href(addMonthsToKey(month, -1))}
            className="inline-flex size-9 items-center justify-center rounded-l-xl text-ink-2 hover:bg-hover hover:text-ink"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-40 px-2 text-center text-sm font-medium">{formatMonthLong(month)}</span>
          <Link
            href={href(addMonthsToKey(month, 1))}
            className="inline-flex size-9 items-center justify-center rounded-r-xl text-ink-2 hover:bg-hover hover:text-ink"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <Suspense>
          <CategoryFilter categories={categories} value={categoryId} />
        </Suspense>
        {month !== monthKey(today) ? (
          <Link href="/gastos" className={buttonClass({ variant: "ghost", size: "sm" })}>
            Mês atual
          </Link>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          className="col-span-2 sm:col-span-1"
          label={categoryId ? "Total (filtro)" : "Total do mês"}
          icon={Wallet}
          value={formatBRL(total)}
        />
        <StatTile label="Pago" icon={CircleCheck} value={formatBRL(paid)} />
        <StatTile label="A pagar" icon={Clock} value={formatBRL(total - paid)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {rows.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhum gasto neste mês"
              description="Registre compras de filamento, peças, energia e embalagens para saber seu lucro real."
            />
          ) : (
            <ExpenseList expenses={rows} categories={categories} today={today} />
          )}
        </Card>
        <Card>
          <CardHeader title="Por categoria" description={formatMonthLong(month)} />
          <CardContent>
            <RankedBars series={2} items={byCategory.map((c) => ({ name: c.name, value: c.cents }))} empty="Nenhum gasto." />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
