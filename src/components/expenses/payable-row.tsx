import { Chip } from "@/components/ui/status";
import { formatDateBR, relativeDayLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { ExpenseRow } from "@/server/queries/expenses";
import { PaidToggle } from "./paid-toggle";
import { CircleExclamationPoint, Clock, Hourglass } from "lucide-react";

/** Conta a pagar (gasto ainda não pago). */
export function PayableRow({ expense, today }: { expense: ExpenseRow; today: string }) {
  const overdue = expense.date < today;
  const isToday = expense.date === today;
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">
            {expense.description}
            {expense.installmentCount && expense.installmentCount > 1
              ? ` (${expense.installmentNumber}/${expense.installmentCount})`
              : ""}
          </span>
          {overdue ? (
            <Chip tone="critical" icon={CircleExclamationPoint}>
              Vencida
            </Chip>
          ) : isToday ? (
            <Chip tone="warning" icon={Hourglass}>
              Vence hoje
            </Chip>
          ) : (
            <Chip tone="neutral" icon={Clock}>
              A pagar
            </Chip>
          )}
        </p>
        <p className="mt-0.5 text-xs text-ink-2">
          {formatDateBR(expense.date)} ({relativeDayLabel(expense.date, today)})
          {expense.categoryName ? ` · ${expense.categoryName}` : ""}
          {expense.supplier ? ` · ${expense.supplier}` : ""}
        </p>
      </div>
      <span className="font-semibold tabular-nums">{formatBRL(expense.amountCents)}</span>
      <PaidToggle expenseId={expense.id} paid={expense.paid} />
    </li>
  );
}
