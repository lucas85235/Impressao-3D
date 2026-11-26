import { z } from "zod";
import { isSupportedYear, isValidISODate } from "@/lib/dates";

export const MAX_CENTS = 99_999_999_999; // R$ 999.999.999,99

/** Data de negócio "YYYY-MM-DD" válida e com ano entre 2000 e 2100. */
export const isoDate = z
  .string()
  .refine((v) => isValidISODate(v) && isSupportedYear(Number(v.slice(0, 4))), "Data inválida.");
export const cents = z.number().int("Valor inválido.").min(0, "Valor inválido.").max(MAX_CENTS, "Valor muito alto.");
export const positiveCents = z.number().int("Valor inválido.").min(1, "Informe um valor maior que zero.").max(MAX_CENTS, "Valor muito alto.");
export const id = z.number().int().positive();

/**
 * Id vindo de fora (argumento de Server Action ou parâmetro de rota "12").
 * Server Actions podem receber qualquer valor do cliente, então nunca confie no tipo do TypeScript.
 */
export function parseId(value: unknown): number | null {
  const candidate = typeof value === "string" && /^\d{1,15}$/.test(value) ? Number(value) : value;
  const parsed = id.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

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
