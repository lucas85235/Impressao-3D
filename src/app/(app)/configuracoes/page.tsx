import { desc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PushManager } from "@/components/settings/push-manager";
import { BusinessForm, PasswordForm, ProfileForm, TemplatesForm } from "@/components/settings/settings-forms";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { getVapidPublicKey } from "@/server/push";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, devices] = await Promise.all([
    getSettings(),
    db
      .select({
        id: pushSubscriptions.id,
        userAgent: pushSubscriptions.userAgent,
        createdAt: pushSubscriptions.createdAt,
        lastUsedAt: pushSubscriptions.lastUsedAt,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id))
      .orderBy(desc(pushSubscriptions.createdAt)),
  ]);

  return (
    <>
      <PageHeader title="Configurações" description="Seu negócio, lembretes de cobrança e conta." />
      <div className="space-y-4">
        <Section title="Negócio" description="Aparece no app e nas mensagens enviadas aos clientes.">
          <BusinessForm
            initial={{
              businessName: settings.businessName,
              pixKey: settings.pixKey,
              reminderDaysAhead: settings.reminderDaysAhead,
            }}
          />
        </Section>

        <Section
          title="Mensagens de cobrança (WhatsApp)"
          description="Texto que abre pronto no WhatsApp quando você toca em “Cobrar”."
        >
          <TemplatesForm
            initial={{ templateReminder: settings.templateReminder, templateOverdue: settings.templateOverdue }}
            pixKey={settings.pixKey}
            businessName={settings.businessName}
          />
        </Section>

        <Section
          id="notificacoes"
          title="Lembretes automáticos"
          description="Receba no celular/computador, todo dia de manhã, um resumo das cobranças atrasadas, do dia e das próximas."
        >
          <PushManager
            vapidPublicKey={getVapidPublicKey()}
            devices={devices.map((d) => ({
              id: d.id,
              userAgent: d.userAgent,
              createdAt: d.createdAt.toISOString(),
              lastUsedAt: d.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </Section>

        <Section title="Aparência">
          <div className="max-w-xs">
            <ThemeToggle />
          </div>
        </Section>

        <Section title="Sua conta">
          <div className="space-y-6">
            <ProfileForm initial={{ name: user.name, email: user.email }} />
            <div className="border-t border-line pt-5">
              <PasswordForm />
            </div>
          </div>
        </Section>

        <Section title="Backup dos dados" description="Baixe tudo (clientes, vendas, parcelas, pagamentos, gastos, produtos) em um arquivo JSON.">
          <a href="/api/export" className={buttonClass({ variant: "secondary" })}>
            <Download /> Baixar backup
          </a>
        </Section>
      </div>
    </>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader title={title} description={description} />
      <CardContent>{children}</CardContent>
    </Card>
  );
}
