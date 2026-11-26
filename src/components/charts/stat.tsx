import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Variação percentual entre períodos (null quando não dá para comparar). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Delta com direção × se subir é bom (ex.: gastos subindo = ruim). Sempre ícone + texto. */
export function Delta({ value, upIsGood = true, vs }: { value: number | null; upIsGood?: boolean; vs: string }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-xs text-ink-2">sem comparação com {vs}</span>;
  }
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return <span className="text-xs text-ink-2">igual a {vs}</span>;
  const up = rounded > 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-good-ink" : "text-critical-ink")}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : "−"}
      {formatPercent(Math.abs(rounded))}
      <span className="font-normal text-ink-2">&nbsp;vs {vs}</span>
    </span>
  );
}

export function StatTile({
  label,
  value,
  icon: Icon,
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-card", className)}>
      <div className="flex items-center gap-2 text-sm text-ink-2">
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
        {label}
      </div>
      <div className="mt-1.5 text-[22px] leading-tight font-semibold tracking-tight text-ink sm:text-2xl">{value}</div>
      {footer ? <div className="mt-1">{footer}</div> : null}
    </div>
  );
}

/**
 * Medidor (progresso): preenchimento na cor da série, trilho em um tom mais claro da mesma rampa.
 */
export function Meter({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-track-1", className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="h-full rounded-full bg-series-1 transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
