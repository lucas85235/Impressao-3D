"use client";

import { Pencil, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { saveCustomerAction } from "@/server/actions/catalog";

export type CustomerFormValues = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  city: string | null;
  notes: string | null;
};

export function CustomerFormButton({
  customer,
  autoOpen = false,
  variant = customer ? "secondary" : "primary",
  label,
}: {
  customer?: CustomerFormValues;
  autoOpen?: boolean;
  variant?: ButtonVariant;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(autoOpen);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && autoOpen) router.replace(pathname, { scroll: false });
  }

  function submit(formData: FormData) {
    setError(null);
    const get = (k: string) => String(formData.get(k) ?? "");
    startTransition(async () => {
      const result = await saveCustomerAction(customer?.id ?? null, {
        name: get("name"),
        phone: get("phone"),
        email: get("email"),
        instagram: get("instagram"),
        city: get("city"),
        notes: get("notes"),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(customer ? "Cliente atualizado" : "Cliente cadastrado");
      onOpenChange(false);
      if (!customer) router.push(`/clientes/${result.data.id}`);
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {customer ? <Pencil /> : <UserPlus />}
        {label ?? (customer ? "Editar" : "Novo cliente")}
      </Button>
      <Modal open={open} onOpenChange={onOpenChange} title={customer ? "Editar cliente" : "Novo cliente"}>
        <form action={submit} className="grid grid-cols-1 gap-4 pb-1 sm:grid-cols-2">
          <Field label="Nome" htmlFor="c-name" className="sm:col-span-2">
            <Input id="c-name" name="name" defaultValue={customer?.name} required maxLength={120} autoFocus />
          </Field>
          <Field label="WhatsApp" htmlFor="c-phone" hint="Com DDD. Usado nos lembretes de cobrança.">
            <Input
              id="c-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="(11) 98765-4321"
              defaultValue={customer?.phone ?? ""}
              maxLength={30}
            />
          </Field>
          <Field label="Instagram" htmlFor="c-insta">
            <Input id="c-insta" name="instagram" placeholder="@perfil" defaultValue={customer?.instagram ?? ""} maxLength={60} />
          </Field>
          <Field label="E-mail" htmlFor="c-email">
            <Input id="c-email" name="email" type="email" defaultValue={customer?.email ?? ""} maxLength={120} />
          </Field>
          <Field label="Cidade" htmlFor="c-city">
            <Input id="c-city" name="city" defaultValue={customer?.city ?? ""} maxLength={80} />
          </Field>
          <Field label="Observações" htmlFor="c-notes" className="sm:col-span-2">
            <Textarea id="c-notes" name="notes" defaultValue={customer?.notes ?? ""} maxLength={2000} />
          </Field>
          <div className="sm:col-span-2">
            <FormError message={error} />
          </div>
          <Button type="submit" size="lg" className="sm:col-span-2" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
