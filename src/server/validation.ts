import { z } from "zod";
import { isValidISODate } from "@/lib/dates";

export const MAX_CENTS = 99_999_999_999; // R$ 999.999.999,99

export const isoDate = z.string().refine((v) => isValidISODate(v), "Data inválida.");
export const cents = z.number().int("Valor inválido.").min(0, "Valor inválido.").max(MAX_CENTS, "Valor muito alto.");
export const positiveCents = z.number().int("Valor inválido.").min(1, "Informe um valor maior que zero.").max(MAX_CENTS, "Valor muito alto.");
export const id = z.number().int().positive();

/** Texto opcional: string vazia vira null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? "Dados inválidos.";
}
