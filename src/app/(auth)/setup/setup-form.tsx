"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { setupAction } from "@/server/actions/auth";

export function SetupForm({ requireCode }: { requireCode: boolean }) {
  const [state, formAction, pending] = useActionState(setupAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Bem-vindo! 👋</h1>
        <p className="mt-1 text-sm text-ink-2">Crie sua conta de acesso. Só você (ou quem tiver a senha) entra no app.</p>
      </div>
      <Field label="Seu nome" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required autoFocus defaultValue={state?.values?.name} />
      </Field>
      <Field label="Nome do negócio" htmlFor="businessName" hint="Aparece no app e nas mensagens de cobrança.">
        <Input id="businessName" name="businessName" placeholder="Ex.: Ateliê Camadas 3D" defaultValue={state?.values?.businessName} />
      </Field>
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Field label="Senha" htmlFor="password" hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirme a senha" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {requireCode ? (
        <Field label="Código de configuração" htmlFor="setupCode" hint="O valor da variável SETUP_CODE do servidor.">
          <Input id="setupCode" name="setupCode" type="password" autoComplete="off" required />
        </Field>
      ) : null}
      <FormError message={state?.error} />
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Criando…" : "Criar conta e entrar"}
      </Button>
    </form>
  );
}
