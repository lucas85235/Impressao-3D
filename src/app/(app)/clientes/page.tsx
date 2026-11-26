import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CustomerFormButton } from "@/components/customers/customer-form";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Chip } from "@/components/ui/status";
import { formatDateBR, todayISO } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn, formatPhone, initials } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { listCustomers } from "@/server/queries/catalog";
import { CircleExclamationPoint } from "lucide-react";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; novo?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const rows = await listCustomers({ q, today: todayISO() });

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Quem compra de você, quanto já comprou e quanto ainda deve."
        actions={<CustomerFormButton autoOpen={sp.novo === "1"} />}
      />

      <form className="relative mb-4 max-w-md" action="/clientes">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, telefone ou @" className="pl-9" aria-label="Buscar clientes" />
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            description={q ? "Tente outro termo." : "Cadastre seus clientes para cobrar pelo WhatsApp com um clique."}
          />
        ) : (
          <ul className="divide-y divide-line p-2">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-hover">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      c.overdueCents > 0 ? "bg-critical-soft text-critical-ink" : "bg-accent-soft text-accent-ink",
                    )}
                    aria-hidden
                  >
                    {initials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      {c.overdueCents > 0 ? (
                        <Chip tone="critical" icon={CircleExclamationPoint}>
                          {formatBRL(c.overdueCents)} atrasado
                        </Chip>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink-2">
                      {[formatPhone(c.phone), c.instagram ? `@${c.instagram}` : null, c.city].filter(Boolean).join(" · ") ||
                        "Sem contato"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular-nums">{formatBRL(c.boughtCents)}</span>
                    <span className="block text-xs text-ink-2">
                      {c.orders} {c.orders === 1 ? "pedido" : "pedidos"}
                      {c.lastDate ? ` · ${formatDateBR(c.lastDate)}` : ""}
                    </span>
                    {c.openCents > 0 ? (
                      <span className="block text-xs text-ink-2 tabular-nums">deve {formatBRL(c.openCents)}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
