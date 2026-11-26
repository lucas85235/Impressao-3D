"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import {
  DEFAULT_TEMPLATE_OVERDUE,
  DEFAULT_TEMPLATE_REMINDER,
  TEMPLATE_PLACEHOLDERS,
} from "@/lib/settings-defaults";
import { buildChargeMessage } from "@/lib/whatsapp";
import { changePasswordAction, updateProfileAction } from "@/server/actions/auth";
import { saveBusinessSettingsAction, saveTemplatesAction } from "@/server/actions/settings";

export function BusinessForm({
  initial,
}: {
  initial: { businessName: string; pixKey: string; reminderDaysAhead: number };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const result = await saveBusinessSettingsAction({
            businessName: String(fd.get("businessName") ?? ""),
            pixKey: String(fd.get("pixKey") ?? ""),
            reminderDaysAhead: Number(fd.get("reminderDaysAhead") ?? 3),
          });
          if (!result.ok) setError(result.error);
          else toast.success("Configurações salvas");
        });
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <Field label="Nome do negócio" htmlFor="s-business">
        <Input id="s-business" name="businessName" defaultValue={initial.businessName} required maxLength={80} />
      </Field>
      <Field label="Chave Pix" htmlFor="s-pix" hint="Vai junto nas mensagens de cobrança.">
        <Input id="s-pix" name="pixKey" defaultValue={initial.pixKey} maxLength={140} placeholder="CPF, e-mail, telefone ou aleatória" />
      </Field>
      <Field
        label="Avisar com quantos dias de antecedência"
        htmlFor="s-days"
        hint="Parcelas que vencem dentro desse prazo entram no lembrete diário."
      >
        <Input id="s-days" name="reminderDaysAhead" type="number" min={0} max={30} defaultValue={initial.reminderDaysAhead} />
      </Field>
      <div className="sm:col-span-2">
        <FormError message={error} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

export function TemplatesForm({
  initial,
  pixKey,
  businessName,
}: {
  initial: { templateReminder: string; templateOverdue: string };
  pixKey: string;
  businessName: string;
}) {
  const [reminder, setReminder] = useState(initial.templateReminder);
  const [overdue, setOverdue] = useState(initial.templateOverdue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sample = {
    customerName: "Maria Souza",
    amountCents: 4990,
    dueDate: "2026-12-10",
    installmentNumber: 2,
    installmentCount: 3,
    saleTitle: "Miniaturas para RPG",
    pixKey,
    businessName,
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TemplateField
          id="t-reminder"
          label="Lembrete (antes ou no dia do vencimento)"
          value={reminder}
          onChange={setReminder}
          onReset={() => setReminder(DEFAULT_TEMPLATE_REMINDER)}
          preview={buildChargeMessage(reminder, sample)}
        />
        <TemplateField
          id="t-overdue"
          label="Cobrança de parcela atrasada"
          value={overdue}
          onChange={setOverdue}
          onReset={() => setOverdue(DEFAULT_TEMPLATE_OVERDUE)}
          preview={buildChargeMessage(overdue, { ...sample, dueDate: "2026-11-10" })}
        />
      </div>
      <div className="rounded-xl bg-hover p-3 text-xs text-ink-2">
        <p className="mb-1.5 font-medium text-ink">Campos que você pode usar:</p>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {TEMPLATE_PLACEHOLDERS.map((p) => (
            <li key={p.key}>
              <code className="rounded bg-surface px-1 py-0.5 text-ink">{p.key}</code> {p.label}
            </li>
          ))}
        </ul>
      </div>
      <FormError message={error} />
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await saveTemplatesAction({ templateReminder: reminder, templateOverdue: overdue });
            if (!result.ok) setError(result.error);
            else toast.success("Mensagens salvas");
          });
        }}
      >
        {pending ? "Salvando…" : "Salvar mensagens"}
      </Button>
    </div>
  );
}

function TemplateField({
  id,
  label,
  value,
  onChange,
  onReset,
  preview,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  preview: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink">
          <RotateCcw className="size-3.5" /> Padrão
        </button>
      </div>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-36 font-mono text-[13px]" maxLength={1500} />
      <div className="rounded-xl border border-line bg-good-soft/50 p-3">
        <p className="mb-1 text-[11px] font-medium tracking-wide text-ink-2 uppercase">Prévia</p>
        <p className="text-sm whitespace-pre-wrap">{preview}</p>
      </div>
    </div>
  );
}

export function ProfileForm({ initial }: { initial: { name: string; email: string } }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const result = await updateProfileAction({ name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "") });
          if (!result.ok) setError(result.error);
          else toast.success("Dados atualizados");
        });
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <Field label="Seu nome" htmlFor="u-name">
        <Input id="u-name" name="name" defaultValue={initial.name} required maxLength={80} />
      </Field>
      <Field label="E-mail de acesso" htmlFor="u-email">
        <Input id="u-email" name="email" type="email" defaultValue={initial.email} required />
      </Field>
      <div className="sm:col-span-2">
        <FormError message={error} />
      </div>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar dados"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const result = await changePasswordAction({
            current: String(fd.get("current") ?? ""),
            password: String(fd.get("password") ?? ""),
            confirm: String(fd.get("confirm") ?? ""),
          });
          if (!result.ok) setError(result.error);
          else toast.success("Senha alterada", { description: "Os outros aparelhos foram desconectados." });
        });
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <Field label="Senha atual" htmlFor="pw-current">
        <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="Nova senha" htmlFor="pw-new">
        <Input id="pw-new" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirmar" htmlFor="pw-confirm">
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <div className="sm:col-span-3">
        <FormError message={error} />
      </div>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Salvando…" : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}
