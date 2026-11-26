"use client";

import { HandCoins } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { formatDateBR } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { addPaymentAction } from "@/server/actions/sales";

export type PayableInstallment = {
  id: number;
  number: number;
  count: number;
  dueDate: string;
  remainingCents: number;
};

const LAST_METHOD_KEY = "last-payment-method";

/** Botão + modal para registrar um recebimento (total ou parcial) de uma venda. */
export function PaymentButton({
  saleId,
  saleTitle,
  installments,
  defaultInstallmentId = null,
  saleRemainingCents,
  today,
  label = "Registrar pagamento",
  icon = true,
  variant = "primary",
  size = "md",
  className,
}: {
  saleId: number;
  saleTitle: string;
  installments: PayableInstallment[];
  defaultInstallmentId?: number | null;
  saleRemainingCents: number;
  today: string;
  label?: ReactNode;
  icon?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultAmount = (instId: number | null) =>
    instId ? (installments.find((i) => i.id === instId)?.remainingCents ?? saleRemainingCents) : (installments[0]?.remainingCents ?? saleRemainingCents);

  const [installmentId, setInstallmentId] = useState<number | null>(defaultInstallmentId);
  const [amount, setAmount] = useState(() => defaultAmount(defaultInstallmentId));
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");

  function openDialog() {
    setInstallmentId(defaultInstallmentId);
    setAmount(defaultAmount(defaultInstallmentId));
    setDate(today);
    setNotes("");
    setError(null);
    const last = localStorage.getItem(LAST_METHOD_KEY);
    if (last && (PAYMENT_METHODS as readonly string[]).includes(last)) setMethod(last as PaymentMethod);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addPaymentAction({ saleId, amountCents: amount, date, method, installmentId, notes });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      localStorage.setItem(LAST_METHOD_KEY, method);
      setOpen(false);
      toast.success(`Pagamento de ${formatBRL(amount)} registrado`, {
        description: result.data.confirmedQuote ? "O orçamento virou venda (em produção)." : undefined,
      });
    });
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={openDialog}>
        {icon ? <HandCoins /> : null}
        {label}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Registrar pagamento" description={saleTitle}>
        <form onSubmit={submit} className="space-y-4 pb-1">
          <Field label="Valor recebido" htmlFor={`pay-amount-${saleId}`}>
            <MoneyInput
              id={`pay-amount-${saleId}`}
              value={amount}
              onValueChange={setAmount}
              autoFocus
              className="h-12 text-lg font-semibold"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink-2 hover:bg-hover"
                onClick={() => setAmount(saleRemainingCents)}
              >
                Tudo em aberto · {formatBRL(saleRemainingCents)}
              </button>
              {installmentId ? (
                <button
                  type="button"
                  className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink-2 hover:bg-hover"
                  onClick={() => setAmount(defaultAmount(installmentId))}
                >
                  Só esta parcela · {formatBRL(defaultAmount(installmentId))}
                </button>
              ) : null}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" htmlFor={`pay-date-${saleId}`}>
              <Input id={`pay-date-${saleId}`} type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Forma" htmlFor={`pay-method-${saleId}`}>
              <Select id={`pay-method-${saleId}`} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {installments.length > 1 ? (
            <Field
              label="Abater de"
              htmlFor={`pay-inst-${saleId}`}
              hint="No automático, o valor quita primeiro a parcela mais antiga em aberto."
            >
              <Select
                id={`pay-inst-${saleId}`}
                value={installmentId ?? ""}
                onChange={(e) => {
                  const next = e.target.value ? Number(e.target.value) : null;
                  setInstallmentId(next);
                  setAmount(defaultAmount(next));
                }}
              >
                <option value="">Automático (mais antiga primeiro)</option>
                {installments.map((i) => (
                  <option key={i.id} value={i.id}>
                    Parcela {i.number}/{i.count} · vence {formatDateBR(i.dueDate)} · falta {formatBRL(i.remainingCents)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label="Observação (opcional)" htmlFor={`pay-notes-${saleId}`}>
            <Input id={`pay-notes-${saleId}`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </Field>

          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending || amount <= 0}>
            {pending ? "Salvando…" : `Confirmar ${amount > 0 ? formatBRL(amount) : ""}`}
          </Button>
        </form>
      </Modal>
    </>
  );
}
