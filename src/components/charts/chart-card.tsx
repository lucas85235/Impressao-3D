"use client";

import { ChartColumn, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cartão de gráfico com alternância "gráfico / tabela" (a tabela é o equivalente acessível
 * e a forma de ler os valores sem precisar passar o mouse).
 */
export function ChartCard({
  title,
  description,
  legend,
  chart,
  table,
  className,
}: {
  title: string;
  description?: ReactNode;
  legend?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-2 hover:bg-hover hover:text-ink"
          aria-pressed={view === "table"}
        >
          {view === "chart" ? <Table2 className="size-3.5" /> : <ChartColumn className="size-3.5" />}
          {view === "chart" ? "Tabela" : "Gráfico"}
        </button>
      </div>
      {legend && view === "chart" ? <div className="px-5 pt-3">{legend}</div> : null}
      <div className="px-3 pt-2 pb-4 sm:px-4">{view === "chart" ? chart : <div className="px-2">{table}</div>}</div>
    </section>
  );
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-h-[280px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line text-left text-xs text-ink-2">
            {head.map((h, i) => (
              <th key={h} className={cn("py-2 font-medium", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line last:border-0">
              {row.map((cell, c) => (
                <td key={c} className={cn("py-2", c > 0 && "text-right tabular-nums")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
