"use client";

import { Plus, Trash } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { addMonths, formatDateBR } from "@/lib/dates";
import { formatBRL, splitEvenly } from "@/lib/money";
import {
  createExpenseAction,
  createExpenseCategoryAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/server/actions/expenses";

export type ExpenseFormValues = {
  id: number;
  description: string;
  amountCents: number;
  date: string;
  categoryId: number | null;
  supplier: string | null;
  paid: boolean;
  method: string | null;
  notes: string | null;
  groupId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
};

type Category = { id: number; name: string };

/**
 * Botão (ou gatilho customizado) que abre o formulário de gasto.
 * Sem `expense` cria; com `expense` edita.
 */
export function ExpenseFormButton({
  categories: initialCategories,
  today,
  expense,
  autoOpen = false,
  variant = "primary",
  trigger,
}: {
  categories: Category[];
  today: string;
  expense?: ExpenseFormValues;
  autoOpen?: boolean;
  variant?: ButtonVariant;
  trigger?: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isEdit = Boolean(expense);
  const [open, setOpen] = useState(autoOpen);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState(initialCategories);

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense?.amountCents ?? 0);
  const [date, setDate] = useState(expense?.date ?? today);
  const [categoryId, setCategoryId] = useState<number | null>(expense?.categoryId ?? initialCategories[0]?.id ?? null);
  const [supplier, setSupplier] = useState(expense?.supplier ?? "");
  const [paid, setPaid] = useState(expense?.paid ?? true);
  const [method, setMethod] = useState(expense?.method ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [installments, setInstallments] = useState(false);
  const [count, setCount] = useState(2);
  const [amountMode, setAmountMode] = useState<"total" | "parcela">("total");
  const [newCategory, setNewCategory] = useState<string | null>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && autoOpen) router.replace(pathname, { scroll: false });
  }

  function openForm() {
    setError(null);
    setOpen(true);
  }

  async function addCategory() {
    if (!newCategory?.trim()) return;
    const result = await createExpenseCategoryAction(newCategory);
    if (!result.ok) return toast.error(result.error);
    setCategories((list) => (list.some((c) => c.id === result.data.id) ? list : [...list, result.data]));
    setCategoryId(result.data.id);
    setNewCategory(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const base = {
      description,
      amountCents: amount,
      date,
      categoryId,
      supplier,
      paid,
      method: method || null,
      notes,
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateExpenseAction(expense!.id, base)
        : await createExpenseAction({ ...base, installmentCount: installments ? count : 1, amountMode });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Gasto atualizado" : installments ? `${count} parcelas registradas` : "Gasto registrado");
      onOpenChange(false);
      if (!isEdit) {
        setDescription("");
        setAmount(0);
        setSupplier("");
        setNotes("");
        setInstallments(false);
      }
    });
  }

  const preview =
    installments && amount > 0
      ? (amountMode === "total" ? splitEvenly(amount, count) : Array<number>(count).fill(amount)).map((v, i) => ({
          amount: v,
          date: addMonths(date, i),
        }))
      : [];

  return (
    <>
      {trigger ? (
        trigger(openForm)
      ) : (
        <Button variant={variant} onClick={openForm}>
          <Plus /> Novo gasto
        </Button>
      )}
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={isEdit ? "Editar gasto" : "Novo gasto"}
        description={
          isEdit && expense?.installmentCount && expense.installmentCount > 1
            ? `Parcela ${expense.installmentNumber} de ${expense.installmentCount} — alterações valem só para esta parcela.`
            : undefined
        }
      >
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 pb-1 sm:grid-cols-2">
          <Field label="Descrição" htmlFor="e-desc" className="sm:col-span-2">
            <Input
              id="e-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: 2kg PLA preto"
              required
              maxLength={200}
              autoFocus={!isEdit}
            />
          </Field>
          <Field label={installments && amountMode === "parcela" ? "Valor de cada parcela" : "Valor"} htmlFor="e-amount">
            <MoneyInput id="e-amount" value={amount} onValueChange={setAmount} />
          </Field>
          <Field label={installments ? "Data da 1ª parcela" : "Data"} htmlFor="e-date">
            <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>

          <Field label="Categoria" htmlFor="e-cat">
            {newCategory === null ? (
              <Select
                id="e-cat"
                value={categoryId ?? ""}
                onChange={(e) => {
                  if (e.target.value === "__new") setNewCategory("");
                  else setCategoryId(e.target.value ? Number(e.target.value) : null);
                }}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new">+ Nova categoria…</option>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="e-cat"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nome da categoria"
                  maxLength={60}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addCategory();
                    }
                  }}
                />
                <Button variant="secondary" onClick={() => void addCategory()}>
                  Criar
                </Button>
              </div>
            )}
          </Field>
          <Field label="Fornecedor / loja" htmlFor="e-supplier">
            <Input id="e-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={120} placeholder="Opcional" />
          </Field>
          <Field label="Forma de pagamento" htmlFor="e-method">
            <Select id="e-method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">Não informar</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label={installments ? "1ª parcela já paga" : "Já está pago"}
              description="Gastos não pagos aparecem em “Contas a pagar”."
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />
          </div>

          {!isEdit ? (
            <div className="space-y-3 rounded-xl border border-line p-3 sm:col-span-2">
              <Checkbox
                label="Compra parcelada"
                description="Ex.: impressora em 10x no cartão. Cria uma parcela por mês."
                checked={installments}
                onChange={(e) => setInstallments(e.target.checked)}
              />
              {installments ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Parcelas" htmlFor="e-count">
                    <Select id="e-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                      {Array.from({ length: 47 }, (_, i) => i + 2).map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="O valor informado é" htmlFor="e-mode">
                    <Select id="e-mode" value={amountMode} onChange={(e) => setAmountMode(e.target.value as "total" | "parcela")}>
                      <option value="total">O total da compra</option>
                      <option value="parcela">O valor de cada parcela</option>
                    </Select>
                  </Field>
                  {preview.length > 0 ? (
                    <p className="text-xs text-ink-2 sm:col-span-2">
                      {count}x de {formatBRL(preview[preview.length - 1].amount)} · de {formatDateBR(preview[0].date)} até{" "}
                      {formatDateBR(preview[preview.length - 1].date)} · total {formatBRL(preview.reduce((s, p) => s + p.amount, 0))}.
                      Parcelas futuras ficam como “a pagar”.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <Field label="Observações" htmlFor="e-notes" className="sm:col-span-2">
            <Textarea id="e-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="min-h-16" />
          </Field>

          <div className="sm:col-span-2">
            <FormError message={error} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row-reverse">
            <Button type="submit" size="lg" className="sm:flex-1" disabled={pending || amount <= 0}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            {isEdit && expense ? (
              <div className="flex gap-2">
                <ConfirmButton
                  title="Excluir este gasto?"
                  onConfirm={async () => {
                    const r = await deleteExpenseAction(expense.id, "one");
                    if (r.ok) onOpenChange(false);
                    return r;
                  }}
                  successMessage="Gasto excluído"
                  variant="ghost"
                  size="lg"
                >
                  <Trash /> Excluir
                </ConfirmButton>
                {expense.groupId && expense.installmentCount && expense.installmentCount > 1 ? (
                  <ConfirmButton
                    title={`Excluir as ${expense.installmentCount} parcelas?`}
                    description="Todas as parcelas desta compra serão apagadas."
                    confirmLabel="Excluir todas"
                    onConfirm={async () => {
                      const r = await deleteExpenseAction(expense.id, "group");
                      if (r.ok) onOpenChange(false);
                      return r;
                    }}
                    successMessage="Parcelas excluídas"
                    variant="ghost"
                    size="lg"
                  >
                    Todas as parcelas
                  </ConfirmButton>
                ) : null}
              </div>
            ) : null}
          </div>
        </form>
      </Modal>
    </>
  );
}
