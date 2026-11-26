import { describe, expect, it } from "vitest";
import {
  buildDownPaymentPlan,
  buildInstallmentPlan,
  relinkTargetedPayments,
  sortSchedule,
  validateSchedule,
} from "./schedule";

describe("relinkTargetedPayments", () => {
  // Pagamento 10 apontava para a parcela 3 (vence 10/03).
  const targeted = [{ paymentId: 10, number: 3, dueDate: "2026-03-10" }];

  it("segue o vencimento quando a parcela muda de número", () => {
    const next = [
      { id: 101, number: 1, dueDate: "2025-12-15" },
      { id: 102, number: 2, dueDate: "2026-01-10" },
      { id: 103, number: 3, dueDate: "2026-02-10" },
      { id: 104, number: 4, dueDate: "2026-03-10" },
    ];
    expect(relinkTargetedPayments(targeted, next)).toEqual(new Map([[10, 104]]));
  });

  it("usa o número quando as datas mudaram", () => {
    const next = [
      { id: 201, number: 1, dueDate: "2026-01-12" },
      { id: 202, number: 2, dueDate: "2026-02-12" },
      { id: 203, number: 3, dueDate: "2026-03-12" },
    ];
    expect(relinkTargetedPayments(targeted, next)).toEqual(new Map([[10, 203]]));
  });

  it("deixa o pagamento solto sem correspondência", () => {
    const next = [
      { id: 301, number: 1, dueDate: "2026-01-12" },
      { id: 302, number: 2, dueDate: "2026-02-12" },
    ];
    expect(relinkTargetedPayments(targeted, next).size).toBe(0);
  });

  it("entre parcelas do mesmo dia, prefere o mesmo número", () => {
    const next = [
      { id: 401, number: 2, dueDate: "2026-03-10" },
      { id: 402, number: 3, dueDate: "2026-03-10" },
    ];
    expect(relinkTargetedPayments(targeted, next)).toEqual(new Map([[10, 402]]));
  });
});

describe("buildInstallmentPlan", () => {
  it("gera parcelas mensais iguais", () => {
    expect(
      buildInstallmentPlan({ totalCents: 30000, count: 3, firstDueDate: "2026-11-30", frequency: "mensal" }),
    ).toEqual([
      { dueDate: "2026-11-30", amountCents: 10000 },
      { dueDate: "2026-12-30", amountCents: 10000 },
      { dueDate: "2027-01-30", amountCents: 10000 },
    ]);
  });

  it("mantém o dia original mesmo após mês curto", () => {
    const rows = buildInstallmentPlan({ totalCents: 40000, count: 4, firstDueDate: "2026-01-31", frequency: "mensal" });
    expect(rows.map((r) => r.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("suporta semanal e quinzenal", () => {
    expect(
      buildInstallmentPlan({ totalCents: 300, count: 3, firstDueDate: "2026-11-01", frequency: "semanal" }).map(
        (r) => r.dueDate,
      ),
    ).toEqual(["2026-11-01", "2026-11-08", "2026-11-15"]);
    expect(
      buildInstallmentPlan({ totalCents: 200, count: 2, firstDueDate: "2026-11-01", frequency: "quinzenal" }).map(
        (r) => r.dueDate,
      ),
    ).toEqual(["2026-11-01", "2026-11-16"]);
  });

  it("distribui os centavos", () => {
    const rows = buildInstallmentPlan({ totalCents: 10000, count: 3, firstDueDate: "2026-11-01", frequency: "mensal" });
    expect(rows.map((r) => r.amountCents)).toEqual([3334, 3333, 3333]);
  });
});

describe("buildDownPaymentPlan", () => {
  it("entrada + restante parcelado", () => {
    const rows = buildDownPaymentPlan({
      totalCents: 25000,
      downPaymentCents: 5000,
      downPaymentDate: "2026-11-25",
      count: 2,
      firstDueDate: "2026-12-25",
      frequency: "mensal",
    });
    expect(rows).toEqual([
      { dueDate: "2026-11-25", amountCents: 5000 },
      { dueDate: "2026-12-25", amountCents: 10000 },
      { dueDate: "2027-01-25", amountCents: 10000 },
    ]);
  });

  it("entrada igual ao total vira pagamento único", () => {
    const rows = buildDownPaymentPlan({
      totalCents: 5000,
      downPaymentCents: 9000,
      downPaymentDate: "2026-11-25",
      count: 2,
      firstDueDate: "2026-12-25",
      frequency: "mensal",
    });
    expect(rows).toEqual([{ dueDate: "2026-11-25", amountCents: 5000 }]);
  });
});

describe("validateSchedule", () => {
  it("aceita plano que soma o total", () => {
    expect(validateSchedule([{ dueDate: "2026-11-25", amountCents: 1000 }], 1000)).toBeNull();
  });

  it("aponta diferença de soma", () => {
    expect(validateSchedule([{ dueDate: "2026-11-25", amountCents: 900 }], 1000)).toMatch(/Faltam/);
    expect(validateSchedule([{ dueDate: "2026-11-25", amountCents: 1100 }], 1000)).toMatch(/Sobram/);
  });

  it("rejeita data e valor inválidos", () => {
    expect(validateSchedule([{ dueDate: "2026-02-30", amountCents: 1000 }], 1000)).toMatch(/data/);
    expect(validateSchedule([{ dueDate: "2026-02-10", amountCents: 0 }, { dueDate: "2026-02-11", amountCents: 1000 }], 1000)).toMatch(
      /maior que zero/,
    );
  });

  it("venda sem valor não precisa de parcelas", () => {
    expect(validateSchedule([], 0)).toBeNull();
    expect(validateSchedule([], 100)).toMatch(/ao menos uma parcela/);
  });
});

describe("sortSchedule", () => {
  it("ordena por vencimento mantendo empates estáveis", () => {
    expect(
      sortSchedule([
        { dueDate: "2026-12-01", amountCents: 1 },
        { dueDate: "2026-11-01", amountCents: 2 },
        { dueDate: "2026-12-01", amountCents: 3 },
      ]).map((r) => r.amountCents),
    ).toEqual([2, 1, 3]);
  });
});
