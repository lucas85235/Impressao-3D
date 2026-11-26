import { describe, expect, it } from "vitest";
import { formatBRL, parseMoney, splitEvenly } from "./money";

const nbsp = (s: string) => s.replace(/ /g, " ");

describe("parseMoney", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["R$ 10", 1000],
    ["10", 1000],
    ["0,5", 50],
    ["12.5", 1250],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["1,234,567", 123456700],
    ["  R$ 2.500,00 ", 250000],
    ["-15,90", -1590],
  ])("%s → %i", (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it.each(["", "abc", "1,2,3,4", "R$", "1.2.3,4.5"])("rejeita %j", (input) => {
    expect(parseMoney(input)).toBeNull();
  });

  it("aceita número", () => {
    expect(parseMoney(19.9)).toBe(1990);
  });
});

describe("formatBRL", () => {
  it("formata em reais", () => {
    expect(nbsp(formatBRL(123456))).toBe("R$ 1.234,56");
    expect(nbsp(formatBRL(5))).toBe("R$ 0,05");
  });
});

describe("splitEvenly", () => {
  it("divide e distribui centavos nas primeiras partes", () => {
    expect(splitEvenly(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitEvenly(10001, 2)).toEqual([5001, 5000]);
    expect(splitEvenly(900, 3)).toEqual([300, 300, 300]);
  });

  it("sempre soma o total", () => {
    for (const total of [1, 99, 12345, 999999]) {
      for (const n of [1, 2, 3, 7, 12]) {
        expect(splitEvenly(total, n).reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it("retorna vazio para N inválido", () => {
    expect(splitEvenly(100, 0)).toEqual([]);
  });
});
