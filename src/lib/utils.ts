import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Resultado padrão das server actions. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function ok(): { ok: true; data: undefined };
export function ok<T>(data: T): { ok: true; data: T };
export function ok(data?: unknown) {
  return { ok: true as const, data };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Normaliza telefone brasileiro para o formato do WhatsApp (55 + DDD + número). */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return digits.length >= 8 ? digits : null;
}

/** "11987654321" → "(11) 98765-4321" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Mantém só caminhos internos (evita open redirect no ?next=).
 * Recusa "//site.com", barra invertida e caracteres de controle: o navegador descarta TAB e
 * quebras de linha ao montar a URL, então "/\t/site.com" viraria "//site.com" (outro domínio).
 */
export function safeInternalPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length > 2000) return fallback;
  if (!value.startsWith("/") || /[\u0000-\u001F\u007F\\]/.test(value)) return fallback;
  try {
    const base = "http://app.invalid";
    const url = new URL(value, base);
    // "/.//site.com" é normalizado para "//site.com": também recusado.
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
