import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addMonthsToKey,
  daysBetween,
  formatDateBR,
  formatMonthLong,
  isSupportedYear,
  isValidISODate,
  isValidMonthKey,
  monthRange,
  monthsBetween,
  relativeDayLabel,
  todayISO,
  toISO,
} from "./dates";

describe("datas", () => {
  it("valida datas", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("26-01-01")).toBe(false);
  });

  it("soma dias atravessando meses e anos", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("soma meses fixando no último dia quando necessário", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
  });

  it("calcula diferença em dias", () => {
    expect(daysBetween("2026-01-01", "2026-01-03")).toBe(2);
    expect(daysBetween("2026-03-10", "2026-03-01")).toBe(-9);
  });

  it("trabalha com chaves de mês", () => {
    expect(addMonthsToKey("2026-11", 2)).toBe("2027-01");
    expect(addMonthsToKey("2026-01", -13)).toBe("2024-12");
    expect(monthRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("aceita só meses e anos dentro da faixa suportada", () => {
    expect(isValidMonthKey("2026-11")).toBe(true);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(isValidMonthKey("0999-01")).toBe(false);
    expect(isValidMonthKey("2101-01")).toBe(false);
    expect(isSupportedYear(2000)).toBe(true);
    expect(isSupportedYear(1999)).toBe(false);
  });

  it("monta datas com ano de 4 dígitos", () => {
    expect(toISO(2026, 3, 5)).toBe("2026-03-05");
    expect(toISO(999, 1, 5)).toBe("0999-01-05");
  });

  it("formata em pt-BR", () => {
    expect(formatDateBR("2026-11-25")).toBe("25/11/2026");
    expect(formatMonthLong("2026-03")).toBe("Março de 2026");
  });

  it("gera rótulos relativos", () => {
    const today = "2026-11-25";
    expect(relativeDayLabel("2026-11-25", today)).toBe("hoje");
    expect(relativeDayLabel("2026-11-26", today)).toBe("amanhã");
    expect(relativeDayLabel("2026-11-24", today)).toBe("ontem");
    expect(relativeDayLabel("2026-11-30", today)).toBe("em 5 dias");
    expect(relativeDayLabel("2026-11-20", today)).toBe("há 5 dias");
  });

  it("usa o fuso de Brasília para 'hoje'", () => {
    // 02:00 UTC de 26/11 ainda é 25/11 em São Paulo (UTC-3)
    const now = new Date(Date.UTC(2026, 10, 26, 2, 0, 0));
    expect(todayISO("America/Sao_Paulo", now)).toBe("2026-11-25");
    expect(todayISO("UTC", now)).toBe("2026-11-26");
  });
});
