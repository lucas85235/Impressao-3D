"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatBRLCompact } from "@/lib/money";

/*
 * Especificação visual (ver CLAUDE.md / paleta validada):
 * barras finas (≤ 20px), ponta arredondada de 4px só no topo, 2px de respiro entre barras,
 * grade horizontal fina e discreta, tooltip com valor em destaque e nome em segundo plano.
 */

const axisTick = { fill: "var(--muted)", fontSize: 12 };

function TooltipBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-44 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-1.5 text-xs text-ink-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {color ? <span className="h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden /> : null}
      <span className="font-semibold text-ink tabular-nums">{value}</span>
      <span className="text-ink-2">{label}</span>
    </div>
  );
}

export type TrendPoint = { label: string; longLabel: string; received: number; expenses: number };

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <BarChart
      responsive
      style={{ width: "100%", height: 260 }}
      data={data}
      margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
      barGap={2}
      barCategoryGap="24%"
    >
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--axis)" }} tick={axisTick} tickMargin={6} />
      <YAxis
        tickFormatter={(v: number) => formatBRLCompact(v)}
        tickLine={false}
        axisLine={false}
        tick={axisTick}
        width={76}
      />
      <Tooltip
        cursor={{ fill: "var(--hover-wash)", stroke: "none" }}
        content={({ active, payload }) => {
          const point = payload?.[0]?.payload as TrendPoint | undefined;
          if (!active || !point) return null;
          const result = point.received - point.expenses;
          return (
            <TooltipBox title={point.longLabel}>
              <TooltipRow color="var(--series-1)" label="Recebido" value={formatBRL(point.received)} />
              <TooltipRow color="var(--series-2)" label="Gastos" value={formatBRL(point.expenses)} />
              <div className="mt-1.5 border-t border-line pt-1.5">
                <TooltipRow label={result >= 0 ? "Lucro" : "Prejuízo"} value={formatBRL(result)} />
              </div>
            </TooltipBox>
          );
        }}
      />
      <Bar dataKey="received" name="Recebido" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={500} />
      <Bar dataKey="expenses" name="Gastos" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={20} animationDuration={500} />
    </BarChart>
  );
}

export type ForecastBar = { label: string; longLabel: string; cents: number; count: number };

export function ForecastChart({ data }: { data: ForecastBar[] }) {
  return (
    <BarChart
      responsive
      style={{ width: "100%", height: 220 }}
      data={data}
      margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
      barCategoryGap="30%"
    >
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--axis)" }} tick={axisTick} tickMargin={6} />
      <YAxis
        tickFormatter={(v: number) => formatBRLCompact(v)}
        tickLine={false}
        axisLine={false}
        tick={axisTick}
        width={76}
        allowDecimals={false}
      />
      <Tooltip
        cursor={{ fill: "var(--hover-wash)", stroke: "none" }}
        content={({ active, payload }) => {
          const point = payload?.[0]?.payload as ForecastBar | undefined;
          if (!active || !point) return null;
          return (
            <TooltipBox title={point.longLabel}>
              <TooltipRow color="var(--series-1)" label="a receber" value={formatBRL(point.cents)} />
              <p className="text-xs text-ink-2">
                {point.count} {point.count === 1 ? "parcela" : "parcelas"}
              </p>
            </TooltipBox>
          );
        }}
      />
      <Bar dataKey="cents" name="A receber" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={500} />
    </BarChart>
  );
}
