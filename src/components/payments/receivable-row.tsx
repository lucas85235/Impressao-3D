import Link from "next/link";
import { InstallmentStatusChip } from "@/components/ui/status";
import { formatDateBR, relativeDayLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn, initials } from "@/lib/utils";
import type { OpenInstallment } from "@/server/queries/receivables";
import { PaymentButton, type PayableInstallment } from "./payment-button";
import { WhatsAppButton } from "./whatsapp-button";

/** Linha de cobrança: quem deve, quanto, quando — com atalhos de WhatsApp e "Receber". */
export function ReceivableRow({
  item,
  today,
  waLink,
  saleOpenInstallments,
  saleRemainingCents,
  compact = false,
}: {
  item: OpenInstallment;
  today: string;
  waLink: string;
  saleOpenInstallments: PayableInstallment[];
  saleRemainingCents: number;
  compact?: boolean;
}) {
  const overdue = item.dueDate < today;
  return (
    <li className={cn("@container py-3.5", compact && "py-3")}>
      <div className="flex flex-col gap-3 @xl:flex-row @xl:items-center">
      <Link href={`/vendas/${item.saleId}`} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            overdue ? "bg-critical-soft text-critical-ink" : "bg-accent-soft text-accent-ink",
          )}
          aria-hidden
        >
          {initials(item.customerName ?? "?")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-medium text-ink">{item.customerName ?? "Sem cliente"}</span>
            <InstallmentStatusChip status={item.status} daysOverdue={item.daysOverdue} />
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-2">
            {item.saleTitle}
            {item.count > 1 ? ` · parcela ${item.number}/${item.count}` : ""}
          </span>
          <span className="mt-0.5 block text-xs text-ink-2">
            Vence {formatDateBR(item.dueDate)} ({relativeDayLabel(item.dueDate, today)})
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-semibold text-ink tabular-nums">{formatBRL(item.remainingCents)}</span>
          {item.paidCents > 0 ? (
            <span className="block text-xs text-ink-2 tabular-nums">de {formatBRL(item.amountCents)}</span>
          ) : null}
        </span>
      </Link>
      <div className="flex gap-2 pl-12 @xl:pl-0">
        <WhatsAppButton href={waLink} hasPhone={Boolean(item.customerPhone)} className="flex-1 @xl:flex-none" />
        <PaymentButton
          saleId={item.saleId}
          saleTitle={item.saleTitle}
          installments={saleOpenInstallments}
          defaultInstallmentId={item.installmentId}
          saleRemainingCents={saleRemainingCents}
          today={today}
          label="Receber"
          variant="soft"
          size="sm"
          className="flex-1 @xl:flex-none"
        />
      </div>
      </div>
    </li>
  );
}

/** Agrupa as parcelas abertas por venda (para o diálogo de pagamento saber o que existe em aberto). */
export function groupOpenBySale(items: OpenInstallment[]) {
  const map = new Map<number, { installments: PayableInstallment[]; remainingCents: number }>();
  for (const i of items) {
    const cur = map.get(i.saleId) ?? { installments: [], remainingCents: 0 };
    cur.installments.push({
      id: i.installmentId,
      number: i.number,
      count: i.count,
      dueDate: i.dueDate,
      remainingCents: i.remainingCents,
    });
    cur.remainingCents += i.remainingCents;
    map.set(i.saleId, cur);
  }
  return map;
}
