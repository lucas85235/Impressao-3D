import { Clock, Package, Search, Weight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductFormButton } from "@/components/products/product-form";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/page";
import { Chip } from "@/components/ui/status";
import { formatBRL, formatPercent } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { listProductCategories, listProducts } from "@/server/queries/catalog";

export const metadata: Metadata = { title: "Produtos" };

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}min` : ""}` : `${m}min`;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inativos?: string; novo?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const showInactive = sp.inativos === "1";
  const [rows, categories] = await Promise.all([listProducts({ q, showInactive }), listProductCategories()]);

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Seu catálogo: preços, custos e margens. Base para orçamentos e divulgação."
        actions={<ProductFormButton categories={categories} autoOpen={sp.novo === "1"} />}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          items={[
            { href: `/produtos${q ? `?q=${encodeURIComponent(q)}` : ""}`, label: "Ativos", active: !showInactive },
            { href: `/produtos?inativos=1${q ? `&q=${encodeURIComponent(q)}` : ""}`, label: "Todos", active: showInactive },
          ]}
        />
        <form className="relative sm:w-72" action="/produtos">
          {showInactive ? <input type="hidden" name="inativos" value="1" /> : null}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Buscar produto" className="pl-9" aria-label="Buscar produtos" />
        </form>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title={q ? "Nenhum produto encontrado" : "Catálogo vazio"}
            description="Cadastre o que você imprime com preço e custo — fica mais rápido montar as vendas e ver sua margem."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const margin = p.priceCents > 0 && p.costCents > 0 ? ((p.priceCents - p.costCents) / p.priceCents) * 100 : null;
            return (
              <Card key={p.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{p.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {p.category ? <Chip>{p.category}</Chip> : null}
                      {!p.active ? <Chip tone="warning">Inativo</Chip> : null}
                    </div>
                  </div>
                  <ProductFormButton product={p} categories={categories} compact />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-ink-2">Preço</p>
                    <p className="font-semibold tabular-nums">{formatBRL(p.priceCents)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-2">Custo</p>
                    <p className="font-medium tabular-nums">{p.costCents ? formatBRL(p.costCents) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-2">Margem</p>
                    <p className="font-medium tabular-nums">{margin === null ? "—" : formatPercent(margin)}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-2">
                  {p.filamentGrams ? (
                    <span className="inline-flex items-center gap-1">
                      <Weight className="size-3.5" aria-hidden /> {p.filamentGrams} g
                    </span>
                  ) : null}
                  {p.printMinutes ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden /> {formatMinutes(p.printMinutes)}
                    </span>
                  ) : null}
                  <span className="ml-auto tabular-nums">
                    {p.soldQty > 0 ? `${p.soldQty} vendidos · ${formatBRL(p.revenueCents)}` : "Nenhuma venda ainda"}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ink-2">
        Dica: ao montar uma <Link href="/vendas/nova" className="font-medium text-accent-ink hover:underline">nova venda</Link>,
        escolha o produto do catálogo e o preço/custo são preenchidos sozinhos.
      </p>
    </>
  );
}
