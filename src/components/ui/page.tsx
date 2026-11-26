import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6">
      {back ? (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
          {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Abas/filtros como links (funcionam sem JavaScript e mantêm o estado na URL). */
export function Segmented({
  items,
  className,
}: {
  items: { href: string; label: ReactNode; active: boolean; count?: number }[];
  className?: string;
}) {
  return (
    <nav className={cn("-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
            item.active
              ? "border-transparent bg-ink text-page"
              : "border-line-strong bg-surface text-ink-2 hover:bg-hover hover:text-ink",
          )}
        >
          {item.label}
          {item.count != null ? (
            <span className={cn("tabular-nums", item.active ? "opacity-70" : "text-muted")}>{item.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** Linha "rótulo — valor" usada em resumos. */
export function KeyValue({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-sm", className)}>
      <span className="text-ink-2">{label}</span>
      <span className="text-right font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}
