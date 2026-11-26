import { describe, expect, it } from "vitest";
import { planExpenseInstallments } from "./expenses";

const today = "2026-11-26";

describe("planExpenseInstallments", () => {
  it("divide o total em parcelas mensais (centavos extras nas primeiras)", () => {
    const plan = planExpenseInstallments({
      amountCents: 1000,
      firstDate: "2026-01-31",
      count: 3,
      amountMode: "total",
      paid: true,
      today,
    });
    expect(plan.map((p) => p.amountCents)).toEqual([334, 333, 333]);
    expect(plan.map((p) => p.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(plan.map((p) => p.installmentNumber)).toEqual([1, 2, 3]);
  });

  it("repete o valor quando ele é o de cada parcela", () => {
    const plan = planExpenseInstallments({
      amountCents: 5000,
      firstDate: "2026-11-10",
      count: 2,
      amountMode: "parcela",
      paid: false,
      today,
    });
    expect(plan.map((p) => p.amountCents)).toEqual([5000, 5000]);
  });

  it("compra antiga marcada como paga: parcelas vencidas pagas, futuras em aberto", () => {
    const plan = planExpenseInstallments({
      amountCents: 1000,
      firstDate: "2026-09-26",
      count: 4,
      amountMode: "parcela",
      paid: true,
      today,
    });
    expect(plan.map((p) => [p.date, p.paid])).toEqual([
      ["2026-09-26", true],
      ["2026-10-26", true],
      ["2026-11-26", true],
      ["2026-12-26", false],
    ]);
  });

  it("1ª parcela em aberto: nenhuma parcela vira paga sozinha", () => {
    const plan = planExpenseInstallments({
      amountCents: 3000,
      firstDate: "2026-09-10",
      count: 3,
      amountMode: "total",
      paid: false,
      today,
    });
    expect(plan.every((p) => !p.paid)).toBe(true);
  });
});
