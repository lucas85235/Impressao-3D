"use client";

import { formatDateWeekday } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { ExpenseRow } from "@/server/queries/expenses";
import { ExpenseFormButton } from "./expense-form";
import { PaidToggle } from "./paid-toggle";

/** Lista de gastos agrupada por dia. Clicar em um gasto abre a edição. */
export function ExpenseList({
  expenses,
  categories,
  today,
}: {
  expenses: ExpenseRow[];
  categories: { id: number; name: string }[];
  today: string;
}) {
  const byDay = new Map<string, ExpenseRow[]>();
  for (const e of expenses) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  return (
    <div className="divide-y divide-line">
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="px-5 py-3">
          <h3 className="mb-1 flex justify-between text-xs font-medium text-ink-2">
            <span className="inline-block first-letter:uppercase">{formatDateWeekday(day)}</span>
            <span className="tabular-nums">{formatBRL(list.reduce((s, e) => s + e.amountCents, 0))}</span>
          </h3>
          <ul>
            {list.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <ExpenseFormButton
                  categories={categories}
                  today={today}
                  expense={e}
                  trigger={(open) => (
                    <button
                      type="button"
                      onClick={open}
                      className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.description}</span>
                        <span className="block truncate text-xs text-ink-2">
                          {[
                            e.installmentCount && e.installmentCount > 1 ? `Parcela ${e.installmentNumber}/${e.installmentCount}` : null,
                            e.categoryName ?? "Sem categoria",
                            e.supplier,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatBRL(e.amountCents)}</span>
                    </button>
                  )}
                />
                <PaidToggle expenseId={e.id} paid={e.paid} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
