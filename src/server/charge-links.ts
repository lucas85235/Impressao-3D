import "server-only";
import type { AppSettings } from "@/lib/settings-defaults";
import { buildChargeMessage, whatsappLink } from "@/lib/whatsapp";

/** Link de cobrança no WhatsApp para uma parcela (usa o modelo de "lembrete" ou de "atraso"). */
export function chargeLink(
  settings: AppSettings,
  today: string,
  inst: {
    dueDate: string;
    remainingCents: number;
    number: number;
    count: number;
    saleTitle: string;
    customerName: string | null;
    customerPhone: string | null;
  },
): string {
  const template = inst.dueDate < today ? settings.templateOverdue : settings.templateReminder;
  const message = buildChargeMessage(template, {
    customerName: inst.customerName,
    amountCents: inst.remainingCents,
    dueDate: inst.dueDate,
    installmentNumber: inst.number,
    installmentCount: inst.count,
    saleTitle: inst.saleTitle,
    pixKey: settings.pixKey,
    businessName: settings.businessName,
  });
  return whatsappLink(inst.customerPhone, message);
}
