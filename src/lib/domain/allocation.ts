import { daysBetween } from "../dates";
import { sumCents } from "../money";

/*
 * Regras de abatimento dos pagamentos nas parcelas
 * ------------------------------------------------
 * 1. Os pagamentos são processados em ordem cronológica.
 * 2. Se o pagamento indica uma parcela (installmentId), abate primeiro nela.
 * 3. O que sobrar (ou pagamentos sem parcela indicada) abate da parcela em aberto
 *    mais antiga (FIFO por vencimento).
 * 4. Se ainda sobrar, vira crédito do cliente.
 *
 * Isso permite tanto pagamentos "em partes" (R$ 30 de uma parcela de R$ 50)
 * quanto adiantar uma parcela específica.
 */

export type InstallmentLike = { id: number; number: number; dueDate: string; amountCents: number };
export type PaymentLike = { id: number; date: string; amountCents: number; installmentId: number | null };

export type InstallmentStatus = "paga" | "atrasada" | "vence_hoje" | "parcial" | "pendente";
export type SalePaymentStatus = "paga" | "atrasada" | "parcial" | "pendente";

export type AllocatedInstallment<T extends InstallmentLike = InstallmentLike> = T & {
  paidCents: number;
  remainingCents: number;
  /** Data do pagamento que quitou a parcela. */
  paidAt: string | null;
  status: InstallmentStatus;
  /** Dias de atraso (0 se não estiver atrasada). */
  daysOverdue: number;
};

export function allocatePayments<T extends InstallmentLike>(
  installments: T[],
  payments: PaymentLike[],
  today: string,
): { installments: AllocatedInstallment<T>[]; creditCents: number } {
  const state = [...installments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.number - b.number)
    .map((inst) => ({
      ...inst,
      paidCents: 0,
      remainingCents: Math.max(0, inst.amountCents),
      paidAt: null as string | null,
    }));
  const byId = new Map(state.map((s) => [s.id, s]));

  const apply = (target: (typeof state)[number], amount: number, date: string): number => {
    const used = Math.min(amount, target.remainingCents);
    if (used <= 0) return 0;
    target.paidCents += used;
    target.remainingCents -= used;
    if (target.remainingCents === 0) target.paidAt = date;
    return used;
  };

  let creditCents = 0;
  const ordered = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  for (const p of ordered) {
    let left = p.amountCents;
    if (left <= 0) continue;
    if (p.installmentId != null) {
      const target = byId.get(p.installmentId);
      if (target) left -= apply(target, left, p.date);
    }
    for (const s of state) {
      if (left <= 0) break;
      left -= apply(s, left, p.date);
    }
    creditCents += left;
  }

  const result = state.map((s) => {
    let status: InstallmentStatus;
    let daysOverdue = 0;
    if (s.remainingCents === 0) status = "paga";
    else if (s.dueDate < today) {
      status = "atrasada";
      daysOverdue = daysBetween(s.dueDate, today);
    } else if (s.dueDate === today) status = "vence_hoje";
    else if (s.paidCents > 0) status = "parcial";
    else status = "pendente";
    return { ...s, status, daysOverdue };
  });

  return { installments: result, creditCents };
}

export type SaleSummary = {
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  creditCents: number;
  overdueCents: number;
  status: SalePaymentStatus;
  installmentCount: number;
  paidInstallments: number;
  nextDue: { number: number; dueDate: string; remainingCents: number } | null;
};

export function summarizeSale(
  totalCents: number,
  allocated: AllocatedInstallment[],
  payments: PaymentLike[],
): SaleSummary {
  const paidCents = sumCents(payments.map((p) => Math.max(0, p.amountCents)));
  const remainingCents = Math.max(0, totalCents - paidCents);
  const creditCents = Math.max(0, paidCents - totalCents);
  const overdueCents = sumCents(allocated.filter((i) => i.status === "atrasada").map((i) => i.remainingCents));
  const open = allocated.filter((i) => i.remainingCents > 0);
  const next = open[0];

  let status: SalePaymentStatus;
  if (remainingCents === 0) status = "paga";
  else if (overdueCents > 0) status = "atrasada";
  else if (paidCents > 0) status = "parcial";
  else status = "pendente";

  return {
    totalCents,
    paidCents,
    remainingCents,
    creditCents,
    overdueCents,
    status,
    installmentCount: allocated.length,
    paidInstallments: allocated.length - open.length,
    nextDue: next ? { number: next.number, dueDate: next.dueDate, remainingCents: next.remainingCents } : null,
  };
}

/** Atalho: aloca e resume de uma vez. */
export function computeSalePayments<T extends InstallmentLike>(
  totalCents: number,
  installments: T[],
  payments: PaymentLike[],
  today: string,
) {
  const { installments: allocated } = allocatePayments(installments, payments, today);
  return { installments: allocated, summary: summarizeSale(totalCents, allocated, payments) };
}
