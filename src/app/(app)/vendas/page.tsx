import { Plus, Search, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SaleRow } from "@/components/sales/sale-row";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/page";
import { todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { listSales, SALE_FILTERS, type SaleFilter } from "@/server/queries/sales";

export const metadata: Metadata = { title: "Vendas" };

const FILTER_LABEL: Record<SaleFilter, string> = {
  abertas: "Em aberto",
  atrasadas: "Atrasadas",
  pagas: "Pagas",
  todas: "Todas",
  orcamentos: "Orçamentos",
  canceladas: "Canceladas",
};

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const filter: SaleFilter = (SALE_FILTERS as readonly string[]).includes(sp.filtro ?? "") ? (sp.filtro as SaleFilter) : "abertas";
  const q = sp.q?.trim() ?? "";
  const today = todayISO();
  const rows = await listSales({ q, filter, today });

  const total = rows.reduce((s, r) => s + r.totalCents, 0);
  const open = rows.reduce((s, r) => s + r.summary.remainingCents, 0);
  const href = (f: SaleFilter) => `/vendas?filtro=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader
        title="Vendas"
        description="Pedidos, parcelas e quanto falta receber de cada um."
        actions={
          <Link href="/vendas/nova" className={buttonClass()}>
            <Plus /> Nova venda
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented items={SALE_FILTERS.map((f) => ({ href: href(f), label: FILTER_LABEL[f], active: f === filter }))} />
        <form className="relative lg:w-72" action="/vendas">
          <input type="hidden" name="filtro" value={filter} />
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Buscar pedido ou cliente" className="pl-9" aria-label="Buscar vendas" />
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={q ? "Nenhuma venda encontrada" : filter === "abertas" ? "Nenhuma venda em aberto" : "Nada por aqui"}
            description={q ? "Tente outro termo de busca." : "Registre um pedido para acompanhar pagamentos e parcelas."}
            action={
              <Link href="/vendas/nova" className={buttonClass()}>
                <Plus /> Nova venda
              </Link>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line p-2">
              {rows.map((sale) => (
                <SaleRow key={sale.id} sale={sale} />
              ))}
            </ul>
            <div className="flex flex-wrap justify-between gap-2 border-t border-line px-5 py-3 text-sm text-ink-2">
              <span>
                {rows.length} {rows.length === 1 ? "venda" : "vendas"}
              </span>
              <span className="tabular-nums">
                Total {formatBRL(total)}
                {filter !== "orcamentos" && filter !== "canceladas" ? ` · em aberto ${formatBRL(open)}` : ""}
              </span>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
