"use client";

import { PackagePlus, Pencil, Trash } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { formatPercent } from "@/lib/money";
import { deleteProductAction, saveProductAction } from "@/server/actions/catalog";

export type ProductFormValues = {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  priceCents: number;
  costCents: number;
  filamentGrams: number | null;
  printMinutes: number | null;
  active: boolean;
};

export function ProductFormButton({
  product,
  categories,
  autoOpen = false,
  compact = false,
}: {
  product?: ProductFormValues;
  categories: string[];
  autoOpen?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(autoOpen);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState(product?.priceCents ?? 0);
  const [cost, setCost] = useState(product?.costCents ?? 0);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && autoOpen) router.replace(pathname, { scroll: false });
  }

  function submit(formData: FormData) {
    setError(null);
    const get = (k: string) => String(formData.get(k) ?? "").trim();
    const hours = Number(get("hours") || 0);
    const minutes = Number(get("minutes") || 0);
    const grams = get("grams");
    startTransition(async () => {
      const result = await saveProductAction(product?.id ?? null, {
        name: get("name"),
        category: get("category"),
        description: get("description"),
        priceCents: price,
        costCents: cost,
        filamentGrams: grams ? Math.round(Number(grams)) : null,
        printMinutes: hours || minutes ? Math.round(hours * 60 + minutes) : null,
        active: formData.get("active") === "on",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(product ? "Produto atualizado" : "Produto cadastrado");
      onOpenChange(false);
    });
  }

  const margin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;

  return (
    <>
      {product ? (
        <Button variant="ghost" size={compact ? "icon-sm" : "sm"} onClick={() => setOpen(true)} aria-label={`Editar ${product.name}`}>
          <Pencil />
          {compact ? null : "Editar"}
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <PackagePlus /> Novo produto
        </Button>
      )}
      <Modal open={open} onOpenChange={onOpenChange} title={product ? "Editar produto" : "Novo produto"}>
        <form action={submit} className="grid grid-cols-1 gap-4 pb-1 sm:grid-cols-2">
          <Field label="Nome" htmlFor="p-name" className="sm:col-span-2">
            <Input id="p-name" name="name" defaultValue={product?.name} required maxLength={120} autoFocus={!product} />
          </Field>
          <Field label="Categoria" htmlFor="p-cat">
            <Input
              id="p-cat"
              name="category"
              list="product-categories"
              defaultValue={product?.category ?? ""}
              placeholder="Decoração, chaveiros…"
              maxLength={60}
            />
            <datalist id="product-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox name="active" label="Ativo no catálogo" defaultChecked={product?.active ?? true} />
          </div>
          <Field label="Preço de venda" htmlFor="p-price">
            <MoneyInput id="p-price" value={price} onValueChange={setPrice} />
          </Field>
          <Field
            label="Custo estimado"
            htmlFor="p-cost"
            hint={margin === null ? "Material + energia + extras, por unidade." : `Margem: ${formatPercent(margin)}`}
          >
            <MoneyInput id="p-cost" value={cost} onValueChange={setCost} />
          </Field>
          <Field label="Filamento (g)" htmlFor="p-grams">
            <Input
              id="p-grams"
              name="grams"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={product?.filamentGrams ?? ""}
            />
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-medium">Tempo de impressão</span>
            <div className="grid grid-cols-2 gap-2">
              <Input
                name="hours"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="h"
                aria-label="Horas"
                defaultValue={product?.printMinutes ? Math.floor(product.printMinutes / 60) : ""}
              />
              <Input
                name="minutes"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                placeholder="min"
                aria-label="Minutos"
                defaultValue={product?.printMinutes ? product.printMinutes % 60 : ""}
              />
            </div>
          </div>
          <Field label="Descrição" htmlFor="p-desc" className="sm:col-span-2" hint="Útil para anúncios e catálogo no futuro.">
            <Textarea id="p-desc" name="description" defaultValue={product?.description ?? ""} maxLength={2000} />
          </Field>
          <div className="sm:col-span-2">
            <FormError message={error} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row-reverse">
            <Button type="submit" size="lg" className="sm:flex-1" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            {product ? (
              <ConfirmButton
                title={`Excluir ${product.name}?`}
                description="Vendas antigas mantêm o item pelo nome. Se só quiser tirar do catálogo, desmarque “Ativo”."
                onConfirm={async () => {
                  const r = await deleteProductAction(product.id);
                  if (r.ok) onOpenChange(false);
                  return r;
                }}
                successMessage="Produto excluído"
                variant="ghost"
                size="lg"
              >
                <Trash /> Excluir
              </ConfirmButton>
            ) : null}
          </div>
        </form>
      </Modal>
    </>
  );
}
