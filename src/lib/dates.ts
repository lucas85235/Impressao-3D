// Datas de negócio são strings "YYYY-MM-DD" (sem fuso). Toda aritmética é feita em UTC
// sobre essas strings, então não existe o clássico bug de "virou o dia por causa do fuso".

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Faixa de anos aceita nas datas de negócio (barra ano digitado errado, como 0202 ou 2206). */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export function isSupportedYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

function parts(iso: string): [number, number, number] {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISO(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Data de hoje no fuso informado (padrão: horário de Brasília). */
export function todayISO(timeZone: string = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE, now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Soma meses mantendo o dia (ou o último dia do mês, se não existir).
 * 31/01 + 1 mês → 28/02 (ou 29 em ano bissexto); 31/01 + 2 meses → 31/03.
 */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (((total % 12) + 12) % 12) + 1;
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Diferença em dias: daysBetween("2026-01-01", "2026-01-03") === 2 */
export function daysBetween(fromISO: string, toISOStr: string): number {
  const [y1, m1, d1] = parts(fromISO);
  const [y2, m2, d2] = parts(toISOStr);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

// ─── Meses ("YYYY-MM") ─────────────────────────────────────────────────────

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function isValidMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && isSupportedYear(Number(value.slice(0, 4)));
}

export function addMonthsToKey(key: string, months: number): string {
  return monthKey(addMonths(`${key}-01`, months));
}

export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  return { start: `${key}-01`, end: toISO(y, m, daysInMonth(y, m)) };
}

/** Lista de chaves de mês de `fromKey` até `toKey` (inclusive). */
export function monthsBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let k = fromKey;
  while (k <= toKey && out.length < 600) {
    out.push(k);
    k = addMonthsToKey(k, 1);
  }
  return out;
}

// ─── Formatação pt-BR ──────────────────────────────────────────────────────

const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-11-25" → "25/11/2026" */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso || !ISO_RE.test(iso)) return "—";
  const [y, m, d] = parts(iso);
  return `${pad(d)}/${pad(m)}/${y}`;
}

/** "2026-11-25" → "25 nov" (ou "25 nov 2025" se for de outro ano que `refYear`). */
export function formatDateShort(iso: string, refYear?: number): string {
  const [y, m, d] = parts(iso);
  const base = `${d} ${MONTHS_SHORT[m - 1]}`;
  return refYear && refYear !== y ? `${base} ${y}` : base;
}

/** "2026-11-25" → "qua, 25 nov" */
export function formatDateWeekday(iso: string): string {
  const [y, m, d] = parts(iso);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS_SHORT[wd]}, ${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "2026-11" → "Novembro de 2026" */
export function formatMonthLong(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS_LONG[m - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

/** "2026-11" → "nov/26" */
export function formatMonthShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
}

/** "2026-11" → "nov" */
export function formatMonthAbbr(key: string): string {
  const m = Number(key.split("-")[1]);
  return MONTHS_SHORT[m - 1];
}

/** Rótulo relativo de vencimento: "hoje", "amanhã", "ontem", "em 3 dias", "há 5 dias". */
export function relativeDayLabel(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff > 1) return `em ${diff} dias`;
  return `há ${-diff} dias`;
}
