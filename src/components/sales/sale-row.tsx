import Link from "next/link";
import { Meter } from "@/components/charts/stat";
import { SalePaymentChip, SaleStatusChip } from "@/components/ui/status";
import { formatDateShort } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { SaleListRow } from "@/server/queries/sales";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function SaleRow({ sale, showCustomer = true }: { sale: SaleListRow; showCustomer?: boolean }) {
  const [, m, d] = sale.date.split("-");
  const s = sale.summary;
  const inactive = sale.status === "orcamento" || sale.status === "cancelado";
  return (
    <li>
      <Link
        href={`/vendas/${sale.id}`}
        className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-hover"
        title={formatDateShort(sale.date)}
      >
        <span className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-hover py-1.5 leading-none">
          <span className="text-base font-semibold text-ink tabular-nums">{Number(d)}</span>
          <span className="mt-0.5 text-[11px] text-ink-2 uppercase">{MONTHS[Number(m) - 1]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{sale.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {showCustomer ? <span className="mr-1 truncate text-sm text-ink-2">{sale.customerName ?? "Sem cliente"}</span> : null}
            {sale.status !== "entregue" ? <SaleStatusChip status={sale.status} /> : null}
            {!inactive ? <SalePaymentChip status={s.status} /> : null}
          </span>
        </span>
        <span className="w-24 shrink-0 text-right sm:w-32">
          <span className="block font-semibold text-ink tabular-nums">{formatBRL(sale.totalCents)}</span>
          {!inactive && s.status !== "paga" && sale.totalCents > 0 ? (
            <>
              <Meter value={s.paidCents} max={sale.totalCents} label="Recebido" className="mt-1.5 h-1.5" />
              <span className="mt-1 block text-[11px] text-ink-2 tabular-nums">falta {formatBRL(s.remainingCents)}</span>
            </>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
