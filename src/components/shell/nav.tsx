"use client";

import {
  BellRing,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  UserPlus,
  Users,
  Wallet,
  PackagePlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/brand";
import { buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";
import { ThemeToggle } from "./theme-toggle";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag },
  { href: "/cobrancas", label: "Cobranças", icon: BellRing, badge: true },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/gastos", label: "Gastos", icon: Wallet },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const QUICK_ADD = [
  { href: "/vendas/nova", label: "Nova venda", description: "Pedido, itens e parcelas", icon: ShoppingBag },
  { href: "/gastos?novo=1", label: "Novo gasto", description: "Filamento, peças, energia…", icon: Receipt },
  { href: "/clientes?novo=1", label: "Novo cliente", description: "Contato para cobranças", icon: UserPlus },
  { href: "/produtos?novo=1", label: "Novo produto", description: "Item do seu catálogo", icon: PackagePlus },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-critical px-1.5 text-[11px] font-semibold text-white tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Sidebar({ businessName, userName, alerts }: { businessName: string; userName: string; alerts: number }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <LogoMark />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{businessName}</p>
          <p className="text-xs text-ink-2">Gestão 3D</p>
        </div>
      </div>
      <div className="px-3 pb-3">
        <Link href="/vendas/nova" className={buttonClass({ className: "w-full" })}>
          <Plus /> Nova venda
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Principal">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
              )}
            >
              <item.icon className="size-[18px]" aria-hidden />
              {item.label}
              {item.badge ? <Badge count={alerts} /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-line p-4">
        <ThemeToggle />
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm text-ink-2">{userName}</p>
          <form action={logoutAction}>
            <button type="submit" className={buttonClass({ variant: "ghost", size: "sm" })} title="Sair">
              <LogOut /> Sair
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ businessName, alerts }: { businessName: string; alerts: number }) {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const tab = (href: string, label: string, Icon: LucideIcon, badge = 0) => {
    const active = isActive(pathname, href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium",
          active ? "text-accent-ink" : "text-ink-2",
        )}
      >
        <Icon className="size-[22px]" aria-hidden />
        {label}
        {badge ? (
          <span className="absolute top-1 left-1/2 ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-safe backdrop-blur lg:hidden"
        aria-label="Principal"
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {tab("/", "Início", LayoutDashboard)}
          {tab("/vendas", "Vendas", ShoppingBag)}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="-mt-5 inline-flex size-14 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30 active:scale-95"
              aria-label="Adicionar"
            >
              <Plus className="size-7" />
            </button>
          </div>
          {tab("/cobrancas", "Cobranças", BellRing, alerts)}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium text-ink-2"
          >
            <Menu className="size-[22px]" aria-hidden />
            Menu
          </button>
        </div>
      </nav>

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Adicionar">
        <div className="grid gap-2 pb-2">
          {QUICK_ADD.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAddOpen(false)}
              className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:bg-hover"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                <item.icon className="size-5" />
              </span>
              <span>
                <span className="block font-medium">{item.label}</span>
                <span className="block text-sm text-ink-2">{item.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </Modal>

      <Modal open={menuOpen} onOpenChange={setMenuOpen} title={businessName}>
        <div className="grid gap-1 pb-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex h-12 items-center gap-3 rounded-xl px-3 font-medium",
                isActive(pathname, item.href) ? "bg-accent-soft text-accent-ink" : "hover:bg-hover",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
              {item.badge ? <Badge count={alerts} /> : null}
            </Link>
          ))}
        </div>
        <div className="space-y-3 border-t border-line pt-4">
          <ThemeToggle />
          <form action={logoutAction}>
            <button type="submit" className={buttonClass({ variant: "secondary", className: "w-full" })}>
              <LogOut /> Sair da conta
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
}
