// Dinheiro é sempre representado em CENTAVOS (inteiros) para evitar erros de ponto flutuante.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const brlNoCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const plain = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123456 → "R$ 1.234,56" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** 1234567 → "R$ 12,3 mil"; 50000 → "R$ 500" (para eixos e espaços curtos). */
export function formatBRLCompact(cents: number): string {
  if (Math.abs(cents) < 100_000) return brlNoCents.format(Math.round(cents / 100));
  return brlCompact.format(cents / 100);
}

/** 123456 → "R$ 1.235" (sem centavos, para destaques). */
export function formatBRLRounded(cents: number): string {
  return brlNoCents.format(Math.round(cents / 100));
}

/** 123456 → "1.234,56" (sem símbolo, para campos de formulário). */
export function formatMoneyPlain(cents: number): string {
  return plain.format(cents / 100);
}

/**
 * Converte texto digitado em centavos. Aceita "1.234,56", "1234,56", "1234.56",
 * "R$ 10", "10". Retorna null se não for um número válido.
 */
export function parseMoney(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw * 100) : null;

  let s = raw.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return null;
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;
  // Grupos de milhar válidos: "1.234.567" / "1,234,567"
  const groupsOk = (str: string, sep: "." | ",") => new RegExp(`^\\d{1,3}(\\${sep}\\d{3})*$`).test(str);
  let intPart = s;
  let fracPart = "";

  if (commas && dots) {
    // Os dois aparecem: o último é o decimal e só pode aparecer uma vez.
    const decSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    if ((decSep === "," ? commas : dots) !== 1) return null;
    const idx = s.lastIndexOf(decSep);
    const left = s.slice(0, idx);
    if (!groupsOk(left, thouSep)) return null;
    intPart = left.split(thouSep).join("");
    fracPart = s.slice(idx + 1);
  } else if (commas) {
    if (commas === 1) {
      // Padrão brasileiro: vírgula é decimal.
      [intPart, fracPart] = s.split(",");
    } else {
      if (!groupsOk(s, ",")) return null;
      intPart = s.replace(/,/g, "");
    }
  } else if (dots) {
    if (dots === 1) {
      const idx = s.indexOf(".");
      const after = s.slice(idx + 1);
      // "1.234" = milhar (padrão brasileiro); "12.5" / "12.50" = decimal.
      if (after.length === 3 && idx > 0) intPart = s.slice(0, idx) + after;
      else [intPart, fracPart] = [s.slice(0, idx), after];
    } else {
      if (!groupsOk(s, ".")) return null;
      intPart = s.replace(/\./g, "");
    }
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart) || (!intPart && !fracPart)) return null;
  const value = Number(`${intPart || "0"}.${fracPart || "0"}`);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

/**
 * Divide um total em N partes que somam exatamente o total.
 * Os centavos que sobram vão para as primeiras parcelas: 100,00 / 3 → 33,34 + 33,33 + 33,33.
 */
export function splitEvenly(totalCents: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Percentual (0–100) com proteção contra divisão por zero. */
export function percentOf(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export function formatPercent(value: number): string {
  return `${pct.format(value)}%`;
}
