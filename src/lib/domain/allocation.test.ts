import { describe, expect, it } from "vitest";
import { allocatePayments, computeSalePayments, type InstallmentLike, type PaymentLike } from "./allocation";

const plan: InstallmentLike[] = [
  { id: 1, number: 1, dueDate: "2026-10-10", amountCents: 5000 },
  { id: 2, number: 2, dueDate: "2026-11-10", amountCents: 5000 },
  { id: 3, number: 3, dueDate: "2026-12-10", amountCents: 5000 },
];
const today = "2026-11-25";

let nextId = 1;
const pay = (date: string, amountCents: number, installmentId: number | null = null): PaymentLike => ({
  id: nextId++,
  date,
  amountCents,
  installmentId,
});

describe("allocatePayments", () => {
  it("sem pagamentos: vencidas ficam atrasadas", () => {
    const { installments } = allocatePayments(plan, [], today);
    expect(installments.map((i) => i.status)).toEqual(["atrasada", "atrasada", "pendente"]);
    expect(installments[0].daysOverdue).toBe(46);
  });

  it("pagamento solto abate da parcela mais antiga (FIFO)", () => {
    const { installments } = allocatePayments(plan, [pay("2026-10-10", 5000)], today);
    expect(installments[0]).toMatchObject({ status: "paga", paidAt: "2026-10-10", remainingCents: 0 });
    expect(installments[1].status).toBe("atrasada");
  });

  it("pagamento em partes deixa a parcela parcial", () => {
    const { installments } = allocatePayments(
      plan,
      [pay("2026-10-10", 5000), pay("2026-11-10", 5000), pay("2026-11-20", 2000)],
      today,
    );
    expect(installments[2]).toMatchObject({ paidCents: 2000, remainingCents: 3000, status: "parcial" });
  });

  it("parcial e vencida continua atrasada, com o restante correto", () => {
    const { installments } = allocatePayments(plan, [pay("2026-10-12", 3000)], today);
    expect(installments[0]).toMatchObject({ paidCents: 3000, remainingCents: 2000, status: "atrasada" });
  });

  it("pagamento direcionado quita a parcela escolhida", () => {
    const { installments } = allocatePayments(plan, [pay("2026-11-01", 5000, 3)], today);
    expect(installments[2].status).toBe("paga");
    expect(installments[0].status).toBe("atrasada");
  });

  it("excedente de pagamento direcionado segue para a mais antiga", () => {
    const { installments } = allocatePayments(plan, [pay("2026-11-01", 7000, 3)], today);
    expect(installments[2].remainingCents).toBe(0);
    expect(installments[0]).toMatchObject({ paidCents: 2000, remainingCents: 3000 });
  });

  it("valor acima do total vira crédito", () => {
    const { creditCents, installments } = allocatePayments(plan, [pay("2026-11-01", 16000)], today);
    expect(creditCents).toBe(1000);
    expect(installments.every((i) => i.status === "paga")).toBe(true);
  });

  it("parcela que vence hoje", () => {
    const { installments } = allocatePayments(
      [{ id: 9, number: 1, dueDate: today, amountCents: 1000 }],
      [],
      today,
    );
    expect(installments[0].status).toBe("vence_hoje");
  });

  it("registra a data em que a parcela foi quitada", () => {
    const { installments } = allocatePayments(plan, [pay("2026-10-01", 2000), pay("2026-10-15", 3000)], today);
    expect(installments[0].paidAt).toBe("2026-10-15");
  });
});

describe("computeSalePayments", () => {
  it("resume a venda", () => {
    const { summary } = computeSalePayments(15000, plan, [pay("2026-10-10", 5000)], today);
    expect(summary).toMatchObject({
      paidCents: 5000,
      remainingCents: 10000,
      overdueCents: 5000,
      status: "atrasada",
      paidInstallments: 1,
      installmentCount: 3,
      nextDue: { number: 2, dueDate: "2026-11-10", remainingCents: 5000 },
    });
  });

  it("venda quitada", () => {
    const { summary } = computeSalePayments(15000, plan, [pay("2026-10-10", 15000)], today);
    expect(summary.status).toBe("paga");
    expect(summary.nextDue).toBeNull();
  });

  it("venda com pagamento parcial em dia", () => {
    const future: InstallmentLike[] = [{ id: 1, number: 1, dueDate: "2026-12-01", amountCents: 10000 }];
    const { summary } = computeSalePayments(10000, future, [pay("2026-11-20", 4000)], today);
    expect(summary.status).toBe("parcial");
    expect(summary.remainingCents).toBe(6000);
  });

  it("venda sem valor é considerada paga", () => {
    const { summary } = computeSalePayments(0, [], [], today);
    expect(summary.status).toBe("paga");
  });
});
