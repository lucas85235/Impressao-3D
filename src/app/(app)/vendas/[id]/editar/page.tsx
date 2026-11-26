import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SaleForm } from "@/components/sales/sale-form";
import { PageHeader } from "@/components/ui/page";
import { todayISO } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { listCustomerOptions, listProductOptions, listUsedChannels } from "@/server/queries/catalog";
import { getSaleDetail } from "@/server/queries/sales";

export const metadata: Metadata = { title: "Editar venda" };

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const today = todayISO();
  const sale = await getSaleDetail(Number(id), today);
  if (!sale) notFound();

  const [customers, catalog, channels] = await Promise.all([
    listCustomerOptions(),
    listProductOptions(),
    listUsedChannels(),
  ]);
  // Mantém no seletor produtos inativos que já estão nesta venda.
  const products = [...catalog];
  for (const item of sale.items) {
    if (item.productId && !products.some((p) => p.id === item.productId)) {
      products.push({ id: item.productId, name: item.description, priceCents: item.unitPriceCents, costCents: item.unitCostCents });
    }
  }

  return (
    <>
      <PageHeader title="Editar venda" back={{ href: `/vendas/${sale.id}`, label: sale.title }} />
      <SaleForm
        customers={customers}
        products={products}
        channels={channels}
        today={today}
        initial={{
          id: sale.id,
          customerId: sale.customerId,
          title: sale.title,
          date: sale.date,
          status: sale.status,
          channel: sale.channel,
          deliveryDate: sale.deliveryDate,
          notes: sale.notes,
          discountCents: sale.discountCents,
          shippingCents: sale.shippingCents,
          items: sale.items.map((i) => ({
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
            unitCostCents: i.unitCostCents,
          })),
          installments: [...sale.installments]
            .sort((a, b) => a.number - b.number)
            .map((i) => ({ dueDate: i.dueDate, amountCents: i.amountCents })),
          paidCents: sale.summary.paidCents,
        }}
      />
    </>
  );
}
