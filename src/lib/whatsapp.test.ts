import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_REMINDER } from "./settings-defaults";
import { formatPhone, safeInternalPath, toWhatsAppNumber } from "./utils";
import { buildChargeMessage, renderTemplate, whatsappLink } from "./whatsapp";

describe("renderTemplate", () => {
  it("substitui e remove linhas vazias de placeholder", () => {
    expect(renderTemplate("Oi {cliente}!\n{pix}\nTchau", { cliente: "Ana", pix: "" })).toBe("Oi Ana!\nTchau");
  });

  it("mantém linhas em branco intencionais", () => {
    expect(renderTemplate("A\n\nB", {})).toBe("A\n\nB");
  });

  it("limpa espaço duplo quando placeholder fica vazio", () => {
    expect(renderTemplate("de {valor} {parcela} referente", { valor: "R$ 10,00", parcela: "" })).toBe(
      "de R$ 10,00 referente",
    );
  });
});

describe("buildChargeMessage", () => {
  it("monta a mensagem padrão", () => {
    const msg = buildChargeMessage(DEFAULT_TEMPLATE_REMINDER, {
      customerName: "Maria Souza",
      amountCents: 5000,
      dueDate: "2026-12-10",
      installmentNumber: 2,
      installmentCount: 3,
      saleTitle: "Miniaturas D&D",
      pixKey: "maria@pix.com",
    });
    expect(msg).toContain("Oi, Maria!");
    expect(msg).toContain("R$ 50,00 (parcela 2/3)");
    expect(msg).toContain("10/12/2026");
    expect(msg).toContain("Chave Pix: maria@pix.com");
  });

  it("sem pix e à vista", () => {
    const msg = buildChargeMessage(DEFAULT_TEMPLATE_REMINDER, {
      customerName: "João",
      amountCents: 1990,
      dueDate: "2026-12-10",
      installmentNumber: 1,
      installmentCount: 1,
      saleTitle: "Vaso",
    });
    expect(msg).not.toContain("Pix");
    expect(msg).toContain("de R$ 19,90 referente");
  });
});

describe("telefone", () => {
  it("normaliza para o WhatsApp", () => {
    expect(toWhatsAppNumber("(11) 98765-4321")).toBe("5511987654321");
    expect(toWhatsAppNumber("+55 11 98765-4321")).toBe("5511987654321");
    expect(toWhatsAppNumber("")).toBeNull();
  });

  it("formata", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("5511987654321")).toBe("(11) 98765-4321");
  });

  it("gera link do WhatsApp", () => {
    expect(whatsappLink("11987654321", "Olá!")).toBe("https://wa.me/5511987654321?text=Ol%C3%A1!");
    expect(whatsappLink(null, "Oi")).toBe("https://wa.me/?text=Oi");
  });
});

describe("safeInternalPath", () => {
  it("bloqueia redirecionamento externo", () => {
    expect(safeInternalPath("/vendas")).toBe("/vendas");
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("https://evil.com")).toBe("/");
    expect(safeInternalPath("/\\evil.com")).toBe("/");
  });
});
