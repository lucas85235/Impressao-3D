import { CalendarClock, Pencil, Trash } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Meter } from "@/components/charts/stat";
import { PaymentButton } from "@/components/payments/payment-button";
import { WhatsAppButton } from "@/components/payments/whatsapp-button";
import { SaleStatusSelect } from "@/components/sales/sale-status-select";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm";
import { KeyValue, PageHeader } from "@/components/ui/page";
import { InstallmentStatusChip, SalePaymentChip } from "@/components/ui/status";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDateBR, relativeDayLabel, todayISO } from "@/lib/dates";
import { formatBRL, formatPercent } from "@/lib/money";
import { cn, formatPhone } from "@/lib/utils";
import { deletePaymentAction, deleteSaleAction } from "@/server/actions/sales";
import { requireUser } from "@/server/auth";
import { chargeLink } from "@/server/charge-links";
import { getSaleDetail } from "@/server/queries/sales";
import { getSettings } from "@/server/settings";
import { parseId } from "@/server/validation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Venda #${id}` };
}

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const saleId = parseId((await params).id);
  const today = todayISO();
  const [sale, settings] = await Promise.all([saleId ? getSaleDetail(saleId, today) : null, getSettings()]);
  if (!sale) notFound();

  const s = sale.summary;
  const inactive = sale.status === "orcamento" || sale.status === "cancelado";
  const openInstallments = sale.installments
    .filter((i) => i.remainingCents > 0)
    .map((i) => ({
      id: i.id,
      number: i.number,
      count: sale.installments.length,
      dueDate: i.dueDate,
      remainingCents: i.remainingCents,
    }));
  const next = sale.installments.find((i) => i.remainingCents > 0);
  const linkFor = (inst: { dueDate: string; remainingCents: number; number: number }) =>
    chargeLink(settings, today, {
      ...inst,
      count: sale.installments.length,
      saleTitle: sale.title,
      customerName: sale.customer?.name ?? null,
      customerPhone: sale.customer?.phone ?? null,
    });
  const installmentLabel = new Map(sale.installments.map((i) => [i.id, `${i.number}/${sale.installments.length}`]));
  const margin =
    sale.costCents > 0 && sale.subtotalCents - sale.discountCents > 0
      ? ((sale.subtotalCents - sale.discountCents - sale.costCents) / (sale.subtotalCents - sale.discountCents)) * 100
      : null;

  return (
    <>
      <PageHeader
        back={{ href: "/vendas", label: "Vendas" }}
        title={sale.title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {sale.customer ? (
              <Link href={`/clientes/${sale.customer.id}`} className="font-medium text-accent-ink hover:underline">
                {sale.customer.name}
              </Link>
            ) : (
              <span>Sem cliente</span>
            )}
            <span aria-hidden>·</span>
            <span>{formatDateBR(sale.date)}</span>
            {sale.channel ? (
              <>
                <span aria-hidden>·</span>
                <span>{sale.channel}</span>
              </>
            ) : null}
            {sale.deliveryDate ? (
              <>
                <span aria-hidden>·</span>
                <span>Entrega {formatDateBR(sale.deliveryDate)}</span>
              </>
            ) : null}
          </span>
        }
        actions={
          <>
            <SaleStatusSelect saleId={sale.id} status={sale.status} />
            <Link href={`/vendas/${sale.id}/editar`} className={buttonClass({ variant: "secondary", size: "md" })}>
              <Pencil /> Editar
            </Link>
            <ConfirmButton
              title="Excluir esta venda?"
              description="Itens, parcelas e pagamentos registrados também serão apagados. Para manter o histórico, prefira mudar a situação para “Cancelado”."
              onConfirm={deleteSaleAction.bind(null, sale.id)}
              variant="ghost"
              size="icon"
              ariaLabel="Excluir venda"
            >
              <Trash />
            </ConfirmButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Resumo financeiro */}
        <Card className="xl:col-span-3">
          <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {inactive ? null : <SalePaymentChip status={s.status} />}
                {sale.status === "orcamento" ? (
                  <span className="text-sm text-ink-2">Orçamento — ainda não conta no faturamento nem gera cobranças.</span>
                ) : null}
                {sale.status === "cancelado" ? (
                  <span className="text-sm text-ink-2">
                    {s.paidCents > 0
                      ? `Venda cancelada. Os ${formatBRL(s.paidCents)} recebidos continuam no caixa; se devolveu o dinheiro, apague o pagamento em “Pagamentos recebidos”.`
                      : "Venda cancelada."}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-ink-2">Total</p>
                  <p className="text-xl font-semibold tracking-tight sm:text-2xl">{formatBRL(sale.totalCents)}</p>
                </div>
                <div>
                  <p className="text-sm text-ink-2">Recebido</p>
                  <p className="text-xl font-semibold tracking-tight sm:text-2xl">{formatBRL(s.paidCents)}</p>
                </div>
                <div>
                  <p className="text-sm text-ink-2">Em aberto</p>
                  <p className={cn("text-xl font-semibold tracking-tight sm:text-2xl", s.overdueCents > 0 && "text-critical-ink")}>
                    {formatBRL(s.remainingCents)}
                  </p>
                </div>
              </div>
              {sale.totalCents > 0 ? (
                <div className="mt-4 max-w-xl">
                  <Meter value={s.paidCents} max={sale.totalCents} label="Quanto já foi recebido" />
                  <p className="mt-1.5 text-xs text-ink-2">
                    {s.paidInstallments} de {s.installmentCount} {s.installmentCount === 1 ? "parcela quitada" : "parcelas quitadas"}
                    {s.overdueCents > 0 ? ` · ${formatBRL(s.overdueCents)} em atraso` : ""}
                    {s.creditCents > 0 ? ` · crédito do cliente: ${formatBRL(s.creditCents)}` : ""}
                  </p>
                </div>
              ) : null}
            </div>
            {s.remainingCents > 0 && sale.status !== "cancelado" ? (
              <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
                <PaymentButton
                  saleId={sale.id}
                  saleTitle={sale.title}
                  installments={openInstallments}
                  saleRemainingCents={s.remainingCents}
                  today={today}
                />
                {next ? (
                  <WhatsAppButton
                    href={linkFor(next)}
                    label="Cobrar no WhatsApp"
                    size="md"
                    hasPhone={Boolean(sale.customer?.phone)}
                  />
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Parcelas */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Parcelas"
            description={sale.customer?.phone ? `WhatsApp do cliente: ${formatPhone(sale.customer.phone)}` : undefined}
          />
          <CardContent className="pt-3">
            {sale.installments.length === 0 ? (
              <p className="py-4 text-sm text-ink-2">Sem parcelas (venda sem valor).</p>
            ) : (
              <ul className="divide-y divide-line">
                {sale.installments.map((inst) => (
                  <li key={inst.id} className="@container py-3">
                    <div className="flex flex-col gap-2 @lg:flex-row @lg:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-hover text-xs font-semibold text-ink-2 tabular-nums">
                        {inst.number}/{sale.installments.length}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-medium tabular-nums">{formatBRL(inst.amountCents)}</span>
                          {inactive ? null : <InstallmentStatusChip status={inst.status} daysOverdue={inst.daysOverdue} />}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-2">
                          <CalendarClock className="size-3.5" aria-hidden />
                          {formatDateBR(inst.dueDate)}
                          {inst.remainingCents > 0 ? ` (${relativeDayLabel(inst.dueDate, today)})` : ""}
                          {inst.paidAt ? ` · quitada em ${formatDateBR(inst.paidAt)}` : ""}
                          {inst.remainingCents > 0 && inst.paidCents > 0 ? ` · pago ${formatBRL(inst.paidCents)}, falta ${formatBRL(inst.remainingCents)}` : ""}
                        </p>
                      </div>
                    </div>
                    {inst.remainingCents > 0 && sale.status !== "cancelado" ? (
                      <div className="flex gap-2 pl-12 @lg:pl-0">
                        <WhatsAppButton href={linkFor(inst)} hasPhone={Boolean(sale.customer?.phone)} className="flex-1 @lg:flex-none" />
                        <PaymentButton
                          saleId={sale.id}
                          saleTitle={sale.title}
                          installments={openInstallments}
                          defaultInstallmentId={inst.id}
                          saleRemainingCents={s.remainingCents}
                          today={today}
                          label="Receber"
                          variant="soft"
                          size="sm"
                          className="flex-1 @lg:flex-none"
                        />
                      </div>
                    ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pagamentos */}
        <Card>
          <CardHeader title="Pagamentos recebidos" />
          <CardContent className="pt-3">
            {sale.payments.length === 0 ? (
              <p className="py-4 text-sm text-ink-2">Nenhum pagamento registrado ainda.</p>
            ) : (
              <ul className="divide-y divide-line">
                {sale.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium tabular-nums">{formatBRL(p.amountCents)}</p>
                      <p className="text-xs text-ink-2">
                        {formatDateBR(p.date)} · {PAYMENT_METHOD_LABEL[p.method]}
                        {p.installmentId && installmentLabel.get(p.installmentId)
                          ? ` · parcela ${installmentLabel.get(p.installmentId)}`
                          : ""}
                      </p>
                      {p.notes ? <p className="mt-0.5 truncate text-xs text-ink-2">{p.notes}</p> : null}
                    </div>
                    <ConfirmButton
                      title="Excluir este pagamento?"
                      description={`${formatBRL(p.amountCents)} de ${formatDateBR(p.date)} voltará a constar como em aberto.`}
                      onConfirm={deletePaymentAction.bind(null, p.id)}
                      successMessage="Pagamento excluído"
                      variant="ghost"
                      size="icon-sm"
                      ariaLabel="Excluir pagamento"
                    >
                      <Trash />
                    </ConfirmButton>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Itens */}
        <Card className="xl:col-span-2">
          <CardHeader title="Itens" />
          <CardContent className="pt-3">
            <ul className="divide-y divide-line">
              {sale.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-xs text-ink-2 tabular-nums">
                      {item.quantity} × {formatBRL(item.unitPriceCents)}
                      {item.unitCostCents > 0 ? ` · custo ${formatBRL(item.unitCostCents)}/un.` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{formatBRL(item.quantity * item.unitPriceCents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-line pt-2">
              <KeyValue label="Itens" value={formatBRL(sale.subtotalCents)} />
              {sale.discountCents > 0 ? <KeyValue label="Desconto" value={`− ${formatBRL(sale.discountCents)}`} /> : null}
              {sale.shippingCents > 0 ? <KeyValue label="Frete" value={`+ ${formatBRL(sale.shippingCents)}`} /> : null}
              <KeyValue label={<strong className="text-ink">Total</strong>} value={formatBRL(sale.totalCents)} />
              {sale.costCents > 0 ? (
                <KeyValue
                  label="Custo estimado · margem"
                  value={`${formatBRL(sale.costCents)} · ${margin === null ? "—" : formatPercent(margin)}`}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>

        {sale.notes ? (
          <Card>
            <CardHeader title="Observações" />
            <CardContent className="pt-3">
              <p className="text-sm whitespace-pre-wrap text-ink-2">{sale.notes}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
