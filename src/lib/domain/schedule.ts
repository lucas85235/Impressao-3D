import type { Frequency } from "../constants";
import { addDays, addMonths, formatDateBR, isValidISODate } from "../dates";
import { formatBRL, splitEvenly, sumCents } from "../money";

/** Uma linha do plano de recebimento (parcela ainda não salva). */
export type ScheduleRow = { dueDate: string; amountCents: number };

export function stepDate(first: string, frequency: Frequency, index: number): string {
  switch (frequency) {
    case "mensal":
      return addMonths(first, index);
    case "quinzenal":
      return addDays(first, 15 * index);
    case "semanal":
      return addDays(first, 7 * index);
  }
}

/** Parcelado em N vezes iguais (centavos restantes vão nas primeiras parcelas). */
export function buildInstallmentPlan(args: {
  totalCents: number;
  count: number;
  firstDueDate: string;
  frequency: Frequency;
}): ScheduleRow[] {
  const { totalCents, count, firstDueDate, frequency } = args;
  if (totalCents <= 0 || count < 1 || !isValidISODate(firstDueDate)) return [];
  return splitEvenly(totalCents, count).map((amountCents, i) => ({
    amountCents,
    dueDate: stepDate(firstDueDate, frequency, i),
  }));
}

/** Entrada + restante parcelado. */
export function buildDownPaymentPlan(args: {
  totalCents: number;
  downPaymentCents: number;
  downPaymentDate: string;
  count: number;
  firstDueDate: string;
  frequency: Frequency;
}): ScheduleRow[] {
  const { totalCents, downPaymentCents, downPaymentDate } = args;
  if (totalCents <= 0 || !isValidISODate(downPaymentDate)) return [];
  const down = Math.min(Math.max(downPaymentCents, 0), totalCents);
  const rows: ScheduleRow[] = [];
  if (down > 0) rows.push({ dueDate: downPaymentDate, amountCents: down });
  const rest = totalCents - down;
  if (rest > 0) {
    rows.push(
      ...buildInstallmentPlan({
        totalCents: rest,
        count: args.count,
        firstDueDate: args.firstDueDate,
        frequency: args.frequency,
      }),
    );
  }
  return rows;
}

/** Valida um plano contra o total da venda. Retorna a mensagem de erro ou null. */
export function validateSchedule(rows: ScheduleRow[], totalCents: number): string | null {
  if (totalCents <= 0) {
    return rows.length === 0 ? null : "Venda sem valor não deve ter parcelas.";
  }
  if (rows.length === 0) return "Inclua ao menos uma parcela no plano de pagamento.";
  if (rows.length > 120) return "Máximo de 120 parcelas.";
  for (const [i, row] of rows.entries()) {
    if (!isValidISODate(row.dueDate)) return `Parcela ${i + 1}: data de vencimento inválida.`;
    if (!Number.isInteger(row.amountCents) || row.amountCents <= 0) {
      return `Parcela ${i + 1}: valor precisa ser maior que zero.`;
    }
  }
  const sum = sumCents(rows.map((r) => r.amountCents));
  if (sum !== totalCents) {
    const diff = totalCents - sum;
    return `A soma das parcelas (${formatBRL(sum)}) não bate com o total (${formatBRL(totalCents)}). ${
      diff > 0 ? `Faltam ${formatBRL(diff)}.` : `Sobram ${formatBRL(-diff)}.`
    }`;
  }
  return null;
}

/**
 * Ao editar uma venda o plano é recriado. Religa cada pagamento que apontava para uma parcela:
 * primeiro à parcela de mesmo vencimento (de preferência com o mesmo número), senão à de mesmo número.
 * Sem correspondência, o pagamento fica solto (abatido da parcela mais antiga).
 * Devolve Map<paymentId, id da nova parcela>.
 */
export function relinkTargetedPayments(
  targeted: { paymentId: number; number: number; dueDate: string }[],
  next: { id: number; number: number; dueDate: string }[],
): Map<number, number> {
  const out = new Map<number, number>();
  for (const t of targeted) {
    const sameDate = next.filter((n) => n.dueDate === t.dueDate);
    const match = sameDate.find((n) => n.number === t.number) ?? sameDate[0] ?? next.find((n) => n.number === t.number);
    if (match) out.set(t.paymentId, match.id);
  }
  return out;
}

/** Ordena por vencimento (estável) — usado antes de numerar as parcelas. */
export function sortSchedule(rows: ScheduleRow[]): ScheduleRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.dueDate.localeCompare(b.r.dueDate) || a.i - b.i)
    .map(({ r }) => r);
}

export function describeSchedule(rows: ScheduleRow[]): string {
  if (rows.length === 0) return "Sem parcelas";
  if (rows.length === 1) return `À vista · vence ${formatDateBR(rows[0].dueDate)}`;
  const allEqual = rows.every((r) => r.amountCents === rows[0].amountCents);
  return allEqual
    ? `${rows.length}x de ${formatBRL(rows[0].amountCents)}`
    : `${rows.length} parcelas`;
}
