"use client";

import { Check, Circle } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setExpensePaidAction } from "@/server/actions/expenses";

/** Alterna "pago / a pagar" de um gasto com um clique. */
export function PaidToggle({ expenseId, paid }: { expenseId: number; paid: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setExpensePaidAction(expenseId, !paid);
          if (!result.ok) toast.error(result.error);
          else toast.success(paid ? "Marcado como a pagar" : "Marcado como pago");
        })
      }
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
        paid
          ? "border-transparent bg-good-soft text-good-ink hover:brightness-95"
          : "border-line-strong text-ink-2 hover:bg-hover hover:text-ink",
      )}
      aria-pressed={paid}
      title={paid ? "Pago — clique para marcar como a pagar" : "Marcar como pago"}
    >
      {paid ? <Check className="size-3.5" /> : <Circle className="size-3.5" />}
      {paid ? "Pago" : "Pagar"}
    </button>
  );
}
