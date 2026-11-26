import type { ReactNode } from "react";
import { MobileNav, Sidebar } from "@/components/shell/nav";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
import { todayISO } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { getOpenInstallments } from "@/server/queries/receivables";
import { getSettings } from "@/server/settings";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const today = todayISO();
  const [settings, open] = await Promise.all([getSettings(), getOpenInstallments(today)]);
  // Badge de alerta: parcelas atrasadas + que vencem hoje.
  const alerts = open.filter((i) => i.dueDate <= today).length;

  return (
    <div className="min-h-dvh">
      <Sidebar businessName={settings.businessName} userName={user.name} alerts={alerts} />
      <div className="lg:pl-[248px]">
        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-32 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>
      <MobileNav businessName={settings.businessName} alerts={alerts} />
      <ServiceWorkerRegister />
    </div>
  );
}
