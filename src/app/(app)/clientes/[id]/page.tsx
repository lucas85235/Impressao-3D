import { AtSign, Mail, MapPin, MessageCircle, Phone, Plus, ShoppingBag, Trash } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatTile } from "@/components/charts/stat";
import { CustomerFormButton } from "@/components/customers/customer-form";
import { SaleRow } from "@/components/sales/sale-row";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { INACTIVE_SALE_STATUSES } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { formatPhone, toWhatsAppNumber } from "@/lib/utils";
import { deleteCustomerAction } from "@/server/actions/catalog";
import { requireUser } from "@/server/auth";
import { getCustomer } from "@/server/queries/catalog";
import { listSales } from "@/server/queries/sales";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomer(Number(id));
  return { title: customer?.name ?? "Cliente" };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const customer = await getCustomer(Number(id));
  if (!customer) notFound();
  const today = todayISO();
  const sales = await listSales({ filter: "todas", today, customerId: customer.id });

  const active = sales.filter((s) => !INACTIVE_SALE_STATUSES.includes(s.status));
  const bought = active.reduce((s, r) => s + r.totalCents, 0);
  const open = active.reduce((s, r) => s + r.summary.remainingCents, 0);
  const overdue = active.reduce((s, r) => s + r.summary.overdueCents, 0);
  const wa = toWhatsAppNumber(customer.phone);

  return (
    <>
      <PageHeader
        back={{ href: "/clientes", label: "Clientes" }}
        title={customer.name}
        actions={
          <>
            {wa ? (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary" })}>
                <MessageCircle /> WhatsApp
              </a>
            ) : null}
            <CustomerFormButton customer={customer} />
            <Link href={`/vendas/nova?cliente=${customer.id}`} className={buttonClass()}>
              <Plus /> Nova venda
            </Link>
            <ConfirmButton
              title={`Excluir ${customer.name}?`}
              description="As vendas deste cliente continuam no sistema, mas ficam sem cliente vinculado."
              onConfirm={deleteCustomerAction.bind(null, customer.id)}
              variant="ghost"
              size="icon"
              ariaLabel="Excluir cliente"
            >
              <Trash />
            </ConfirmButton>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total comprado" value={formatBRL(bought)} />
        <StatTile label="Pedidos" value={active.length} />
        <StatTile label="Em aberto" value={formatBRL(open)} />
        <StatTile
          label="Atrasado"
          value={<span className={overdue > 0 ? "text-critical-ink" : undefined}>{formatBRL(overdue)}</span>}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pedidos" />
          {sales.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Nenhum pedido ainda" />
          ) : (
            <ul className="mt-2 divide-y divide-line p-2">
              {sales.map((sale) => (
                <SaleRow key={sale.id} sale={sale} showCustomer={false} />
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Contato" />
          <CardContent className="space-y-3 text-sm">
            <Info icon={Phone} value={customer.phone ? formatPhone(customer.phone) : null} empty="Sem telefone" />
            <Info
              icon={AtSign}
              value={
                customer.instagram ? (
                  <a
                    href={`https://instagram.com/${customer.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-ink hover:underline"
                  >
                    @{customer.instagram}
                  </a>
                ) : null
              }
              empty="Sem Instagram"
            />
            <Info icon={Mail} value={customer.email} empty="Sem e-mail" />
            <Info icon={MapPin} value={customer.city} empty="Cidade não informada" />
            {customer.notes ? <p className="border-t border-line pt-3 whitespace-pre-wrap text-ink-2">{customer.notes}</p> : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Info({ icon: Icon, value, empty }: { icon: typeof Phone; value: React.ReactNode; empty: string }) {
  return (
    <p className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-ink-2" aria-hidden />
      {value ? <span className="min-w-0 truncate">{value}</span> : <span className="text-ink-2">{empty}</span>}
    </p>
  );
}
