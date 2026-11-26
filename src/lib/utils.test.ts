import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./utils";

describe("safeInternalPath", () => {
  it("mantém caminhos internos", () => {
    expect(safeInternalPath("/")).toBe("/");
    expect(safeInternalPath("/vendas?filtro=todas")).toBe("/vendas?filtro=todas");
    expect(safeInternalPath("/clientes/3#vendas")).toBe("/clientes/3#vendas");
    expect(safeInternalPath("/%2F/site.com")).toBe("/%2F/site.com");
  });

  it("recusa outros domínios e truques de parsing", () => {
    const bad = [
      "//site.com",
      "/\\site.com",
      "/\t/site.com",
      "/\n/site.com",
      "/\r/site.com",
      "/.//site.com",
      "/..//site.com",
      "https://site.com",
      "site.com",
      "",
      "/\u0000x",
    ];
    for (const value of bad) expect(safeInternalPath(value), JSON.stringify(value)).toBe("/");
  });

  it("usa o fallback para valores que não são texto ou longos demais", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath(123, "/vendas")).toBe("/vendas");
    expect(safeInternalPath(`/${"a".repeat(2001)}`)).toBe("/");
  });
});
