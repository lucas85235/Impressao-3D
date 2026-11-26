import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Lista ranqueada (nome · barra · valor por linha). Uma única cor por lista;
 * a barra é proporcional ao maior valor. Melhor que pizza/rosca para comparar partes.
 */
export function RankedBars({
  items,
  series = 1,
  empty = "Nada no período.",
  formatValue = formatBRL,
}: {
  items: { name: string; value: number; detail?: string }[];
  series?: 1 | 2;
  empty?: string;
  formatValue?: (v: number) => string;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-ink-2">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <ul className="space-y-3.5">
      {items.map((item) => {
        const pct = (item.value / max) * 100;
        const share = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <li key={item.name}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink" title={item.name}>
                {item.name}
                {item.detail ? <span className="ml-1.5 text-xs text-ink-2">{item.detail}</span> : null}
              </span>
              <span className="shrink-0 font-medium text-ink tabular-nums">
                {formatValue(item.value)}
                <span className="ml-1.5 text-xs font-normal text-ink-2">{share}%</span>
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-hover">
              <div
                className={cn("h-full rounded-full", series === 1 ? "bg-series-1" : "bg-series-2")}
                style={{ width: `${Math.max(pct, 1.5)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
