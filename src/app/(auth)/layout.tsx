import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand";
import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2.5">
        <LogoMark />
        <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card">{children}</div>
      <p className="mt-6 text-center text-xs text-muted">Vendas · cobranças · gastos da sua impressão 3D</p>
    </main>
  );
}
