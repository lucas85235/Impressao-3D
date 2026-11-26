import { formatDateBR } from "./dates";
import { formatBRL } from "./money";
import { toWhatsAppNumber } from "./utils";

/** Substitui {placeholders}. Linhas que ficam vazias só por causa de um placeholder somem. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template
    .split("\n")
    .map((line) => {
      const rendered = line.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
      return { original: line, rendered: rendered.replace(/[ \t]{2,}/g, " ").replace(/ ([,.!?])/g, "$1") };
    })
    .filter(({ original, rendered }) => original.trim() === "" || rendered.trim() !== "")
    .map(({ rendered }) => rendered.trimEnd())
    .join("\n")
    .trim();
}

export type ChargeInfo = {
  customerName: string | null;
  amountCents: number;
  dueDate: string;
  installmentNumber: number;
  installmentCount: number;
  saleTitle: string;
  pixKey?: string;
  businessName?: string;
};

export function buildChargeMessage(template: string, info: ChargeInfo): string {
  const firstName = info.customerName?.trim().split(/\s+/)[0] ?? "";
  return renderTemplate(template, {
    cliente: firstName,
    valor: formatBRL(info.amountCents).replace(/ /g, " "),
    vencimento: formatDateBR(info.dueDate),
    parcela: info.installmentCount > 1 ? `(parcela ${info.installmentNumber}/${info.installmentCount})` : "",
    pedido: info.saleTitle,
    pix: info.pixKey ? `Chave Pix: ${info.pixKey}` : "",
    loja: info.businessName ?? "",
  });
}

/** Link que abre o WhatsApp com a mensagem pronta (sem telefone: o usuário escolhe o contato). */
export function whatsappLink(phone: string | null | undefined, message: string): string {
  const number = toWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}
