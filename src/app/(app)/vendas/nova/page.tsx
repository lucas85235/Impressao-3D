import type { Metadata } from "next";
import { SaleForm } from "@/components/sales/sale-form";
import { PageHeader } from "@/components/ui/page";
import { todayISO } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { listCustomerOptions, listProductOptions, listUsedChannels } from "@/server/queries/catalog";

export const metadata: Metadata = { title: "Nova venda" };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [customers, products, channels] = await Promise.all([
    listCustomerOptions(),
    listProductOptions(),
    listUsedChannels(),
  ]);
  const defaultCustomerId = Number(sp.cliente) || null;

  return (
    <>
      <PageHeader title="Nova venda" back={{ href: "/vendas", label: "Vendas" }} />
      <SaleForm
        customers={customers}
        products={products}
        channels={channels}
        today={todayISO()}
        defaultCustomerId={customers.some((c) => c.id === defaultCustomerId) ? defaultCustomerId : null}
      />
    </>
  );
}
