import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleExclamationPoint,
  Clock,
  FileText,
  Hourglass,
  PackageCheck,
  Printer,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { SALE_STATUS_LABEL, type SaleStatus } from "@/lib/constants";
import type { InstallmentStatus, SalePaymentStatus } from "@/lib/domain/allocation";
import { cn } from "@/lib/utils";

export type Tone = "good" | "warning" | "serious" | "critical" | "accent" | "neutral";

const tones: Record<Tone, string> = {
  good: "bg-good-soft text-good-ink",
  warning: "bg-warning-soft text-warning-ink",
  serious: "bg-serious-soft text-serious-ink",
  critical: "bg-critical-soft text-critical-ink",
  accent: "bg-accent-soft text-accent-ink",
  neutral: "bg-hover text-ink-2",
};

/** Etiqueta de status — sempre ícone + texto (cor nunca carrega significado sozinha). */
export function Chip({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

export const installmentStatusMeta: Record<InstallmentStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  paga: { label: "Paga", tone: "good", icon: CircleCheck },
  atrasada: { label: "Atrasada", tone: "critical", icon: CircleExclamationPoint },
  vence_hoje: { label: "Vence hoje", tone: "warning", icon: Hourglass },
  parcial: { label: "Parcial", tone: "accent", icon: CircleDot },
  pendente: { label: "A vencer", tone: "neutral", icon: Clock },
};

export function InstallmentStatusChip({ status, daysOverdue }: { status: InstallmentStatus; daysOverdue?: number }) {
  const meta = installmentStatusMeta[status];
  const label =
    status === "atrasada" && daysOverdue
      ? `Atrasada · ${daysOverdue} ${daysOverdue === 1 ? "dia" : "dias"}`
      : meta.label;
  return (
    <Chip tone={meta.tone} icon={meta.icon}>
      {label}
    </Chip>
  );
}

export const salePaymentStatusMeta: Record<SalePaymentStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  paga: { label: "Pago", tone: "good", icon: CircleCheck },
  atrasada: { label: "Atrasado", tone: "critical", icon: CircleExclamationPoint },
  parcial: { label: "Parcial", tone: "accent", icon: CircleDot },
  pendente: { label: "Em aberto", tone: "neutral", icon: CircleDashed },
};

export function SalePaymentChip({ status }: { status: SalePaymentStatus }) {
  const meta = salePaymentStatusMeta[status];
  return (
    <Chip tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Chip>
  );
}

const saleStatusIcon: Record<SaleStatus, LucideIcon> = {
  orcamento: FileText,
  em_producao: Printer,
  pronto: PackageCheck,
  entregue: Truck,
  cancelado: Ban,
};

export function SaleStatusChip({ status }: { status: SaleStatus }) {
  return (
    <Chip tone="neutral" icon={saleStatusIcon[status]}>
      {SALE_STATUS_LABEL[status]}
    </Chip>
  );
}
