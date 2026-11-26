import { addMonths } from "../dates";
import { splitEvenly } from "../money";

export type ExpenseInstallment = { installmentNumber: number; date: string; amountCents: number; paid: boolean };

/**
 * Parcelas de uma compra parcelada: uma por mês a partir de `firstDate`.
 * - amountMode "total": o valor informado é o total (centavos que sobram vão nas primeiras parcelas);
 *   "parcela": é o valor de cada parcela.
 * - paid: a 1ª parcela segue o que foi marcado. As seguintes só ficam pagas se a 1ª foi marcada
 *   como paga e a data delas já chegou; as demais vão para "Contas a pagar".
 */
export function planExpenseInstallments(args: {
  amountCents: number;
  firstDate: string;
  count: number;
  amountMode: "total" | "parcela";
  paid: boolean;
  today: string;
}): ExpenseInstallment[] {
  const { amountCents, firstDate, count, amountMode, paid, today } = args;
  const amounts = amountMode === "total" ? splitEvenly(amountCents, count) : Array<number>(count).fill(amountCents);
  return amounts.map((value, i) => {
    const date = addMonths(firstDate, i);
    return { installmentNumber: i + 1, date, amountCents: value, paid: i === 0 ? paid : paid && date <= today };
  });
}
