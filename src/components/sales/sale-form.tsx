"use client";

import { CalendarClock, Plus, Trash, UserPlus, Users, Wand } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  SALE_CHANNELS,
  SALE_STATUSES,
  SALE_STATUS_LABEL,
  type Frequency,
  type PaymentMethod,
  type SaleStatus,
} from "@/lib/constants";
import { addMonths, formatDateBR, formatDateWeekday } from "@/lib/dates";
import { buildDownPaymentPlan, buildInstallmentPlan, sortSchedule, validateSchedule, type ScheduleRow } from "@/lib/domain/schedule";
import { formatBRL, formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";
import { saveSaleAction } from "@/server/actions/sales";

type CustomerOption = { id: number; name: string; phone: string | null };
type ProductOption = { id: number; name: string; priceCents: number; costCents: number };
type ItemState = {
  key: string;
  productId: number | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
};
type RowState = { key: string; dueDate: string; amountCents: number };
type PlanMode = "avista" | "parcelado" | "entrada" | "personalizado";

export type SaleFormInitial = {
  id: number;
  customerId: number | null;
  title: string;
  date: string;
  status: SaleStatus;
  channel: string | null;
  deliveryDate: string | null;
  notes: string | null;
  discountCents: number;
  shippingCents: number;
  items: Omit<ItemState, "key">[];
  installments: { dueDate: string; amountCents: number }[];
  paidCents: number;
};

let seq = 0;
const uid = () => `k${++seq}`;
const emptyItem = (): ItemState => ({
  key: uid(),
  productId: null,
  description: "",
  quantity: 1,
  unitPriceCents: 0,
  unitCostCents: 0,
});

const PLAN_MODES: { value: PlanMode; label: string; hint: string }[] = [
  { value: "avista", label: "À vista", hint: "Um pagamento só" },
  { value: "parcelado", label: "Parcelado", hint: "N parcelas iguais" },
  { value: "entrada", label: "Entrada + parcelas", hint: "Sinal agora, resto depois" },
  { value: "personalizado", label: "Personalizado", hint: "Datas e valores livres" },
];

export function SaleForm({
  customers,
  products,
  channels,
  today,
  initial,
  defaultCustomerId,
}: {
  customers: CustomerOption[];
  products: ProductOption[];
  channels: string[];
  today: string;
  initial?: SaleFormInitial;
  defaultCustomerId?: number | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Cliente e pedido
  const [customerId, setCustomerId] = useState<number | null>(initial?.customerId ?? defaultCustomerId ?? null);
  const [newCustomer, setNewCustomer] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? today);
  const [status, setStatus] = useState<SaleStatus>(initial?.status ?? "em_producao");
  const [channel, setChannel] = useState(initial?.channel ?? "");
  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Itens
  const [items, setItems] = useState<ItemState[]>(() =>
    initial?.items.length ? initial.items.map((i) => ({ ...i, key: uid() })) : [emptyItem()],
  );
  const [discount, setDiscount] = useState(initial?.discountCents ?? 0);
  const [shipping, setShipping] = useState(initial?.shippingCents ?? 0);

  // Plano de pagamento
  const initialMode: PlanMode = initial ? (initial.installments.length > 1 ? "personalizado" : "avista") : "avista";
  const [mode, setMode] = useState<PlanMode>(initialMode);
  const [avistaDue, setAvistaDue] = useState(initial?.installments[0]?.dueDate ?? today);
  const [receivedNow, setReceivedNow] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [count, setCount] = useState(3);
  const [firstDue, setFirstDue] = useState(addMonths(today, 1));
  const [frequency, setFrequency] = useState<Frequency>("mensal");
  const [downCents, setDownCents] = useState(0);
  const [downReceived, setDownReceived] = useState(true);
  const [rows, setRows] = useState<RowState[]>(() =>
    initial && initial.installments.length > 1 ? initial.installments.map((r) => ({ ...r, key: uid() })) : [],
  );

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
  const cost = items.reduce((s, i) => s + i.quantity * i.unitCostCents, 0);
  const total = subtotal - discount + shipping;
  const marginBase = subtotal - discount;
  const margin = marginBase > 0 && cost > 0 ? ((marginBase - cost) / marginBase) * 100 : null;

  const schedule: ScheduleRow[] = useMemo(() => {
    if (total <= 0) return [];
    switch (mode) {
      case "avista":
        return [{ dueDate: avistaDue, amountCents: total }];
      case "parcelado":
        return buildInstallmentPlan({ totalCents: total, count, firstDueDate: firstDue, frequency });
      case "entrada":
        return buildDownPaymentPlan({
          totalCents: total,
          downPaymentCents: downCents,
          downPaymentDate: date,
          count,
          firstDueDate: firstDue,
          frequency,
        });
      case "personalizado":
        return rows.map((r) => ({ dueDate: r.dueDate, amountCents: r.amountCents }));
    }
  }, [mode, total, avistaDue, count, firstDue, frequency, downCents, date, rows]);

  const sortedSchedule = sortSchedule(schedule);
  const scheduleError = total > 0 ? validateSchedule(sortedSchedule, total) : null;
  const scheduleSum = schedule.reduce((s, r) => s + r.amountCents, 0);

  function switchMode(next: PlanMode) {
    if (next === "personalizado" && mode !== "personalizado") {
      setRows(
        schedule.length
          ? schedule.map((r) => ({ ...r, key: uid() }))
          : [{ key: uid(), dueDate: today, amountCents: Math.max(total, 0) }],
      );
    }
    setMode(next);
  }

  function updateItem(key: string, patch: Partial<ItemState>) {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function pickProduct(key: string, productId: number | null) {
    const p = products.find((x) => x.id === productId);
    updateItem(
      key,
      p
        ? { productId: p.id, description: p.name, unitPriceCents: p.priceCents, unitCostCents: p.costCents }
        : { productId: null },
    );
  }

  function updateRow(key: string, patch: Partial<RowState>) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function fixDifference() {
    const diff = total - scheduleSum;
    if (!diff || rows.length === 0) return;
    setRows((list) => {
      const copy = [...list];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, amountCents: Math.max(0, last.amountCents + diff) };
      return copy;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newCustomer && !ncName.trim()) return setError("Informe o nome do novo cliente.");
    if (items.some((i) => !i.description.trim())) return setError("Descreva cada item da venda.");
    if (total < 0) return setError("O desconto não pode ser maior que o valor dos itens.");
    if (scheduleError) return setError(scheduleError);

    let initialPayment = null;
    if (!isEdit && total > 0) {
      if (mode === "avista" && receivedNow) {
        initialPayment = { amountCents: total, method, date, installmentIndex: 0 };
      } else if (mode === "entrada" && downReceived && downCents > 0) {
        initialPayment = { amountCents: Math.min(downCents, total), method, date, installmentIndex: 0 };
      }
    }

    startTransition(async () => {
      const result = await saveSaleAction({
        id: initial?.id,
        customerId: newCustomer ? null : customerId,
        newCustomer: newCustomer ? { name: ncName.trim(), phone: ncPhone.trim() || null } : null,
        title: title.trim(),
        date,
        status,
        channel: channel.trim() || null,
        deliveryDate: deliveryDate || null,
        notes: notes.trim() || null,
        discountCents: discount,
        shippingCents: shipping,
        items: items.map(({ key: _key, ...rest }) => ({ ...rest, description: rest.description.trim() })),
        installments: sortedSchedule,
        initialPayment,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Venda atualizada" : "Venda registrada");
      router.push(`/vendas/${result.data.id}`);
    });
  }

  const allChannels = Array.from(new Set([...channels, ...SALE_CHANNELS]));

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
      <div className="min-w-0 space-y-4">
        {/* ── Cliente e pedido ── */}
        <Card>
          <CardHeader title="Cliente e pedido" />
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {newCustomer ? (
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2">
                  <Field label="Nome do novo cliente" htmlFor="nc-name">
                    <Input id="nc-name" value={ncName} onChange={(e) => setNcName(e.target.value)} autoFocus maxLength={120} />
                  </Field>
                  <Field label="WhatsApp (opcional)" htmlFor="nc-phone">
                    <Input
                      id="nc-phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="(11) 98765-4321"
                      value={ncPhone}
                      onChange={(e) => setNcPhone(e.target.value)}
                      maxLength={30}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => setNewCustomer(false)}
                    className="inline-flex items-center gap-1.5 text-sm text-accent-ink hover:underline sm:col-span-2"
                  >
                    <Users className="size-4" /> Escolher cliente existente
                  </button>
                </div>
              ) : (
                <Field label="Cliente" htmlFor="customer">
                  <div className="flex gap-2">
                    <Select
                      id="customer"
                      value={customerId ?? ""}
                      onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Sem cliente / venda avulsa</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    <Button variant="secondary" onClick={() => setNewCustomer(true)} title="Cadastrar novo cliente">
                      <UserPlus /> <span className="hidden sm:inline">Novo</span>
                    </Button>
                  </div>
                </Field>
              )}
            </div>

            <Field
              label="Título do pedido"
              htmlFor="title"
              className="sm:col-span-2"
              hint="Opcional — se ficar vazio, usamos o nome dos itens."
            >
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Miniaturas para RPG"
                maxLength={200}
              />
            </Field>

            <Field label="Data da venda" htmlFor="date">
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field
              label="Situação"
              htmlFor="status"
              hint={status === "orcamento" ? "Orçamentos não contam no faturamento nem geram cobranças." : undefined}
            >
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as SaleStatus)}>
                {SALE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SALE_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Canal da venda" htmlFor="channel" hint="Ajuda a ver de onde vêm seus pedidos.">
              <Input
                id="channel"
                list="channel-options"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Instagram, WhatsApp, feira…"
                maxLength={60}
              />
              <datalist id="channel-options">
                {allChannels.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Entrega prevista (opcional)" htmlFor="delivery">
              <Input id="delivery" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        {/* ── Itens ── */}
        <Card>
          <CardHeader title="Itens" description="O que foi vendido. Custo é opcional (serve para calcular a margem)." />
          <CardContent className="space-y-3">
            {items.map((item, index) => (
              <div key={item.key} className="rounded-xl border border-line p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink-2">Item {index + 1}</span>
                  {items.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}
                      aria-label={`Remover item ${index + 1}`}
                    >
                      <Trash />
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  {products.length > 0 ? (
                    <Field label="Produto do catálogo" htmlFor={`prod-${item.key}`} className="sm:col-span-5">
                      <Select
                        id={`prod-${item.key}`}
                        value={item.productId ?? ""}
                        onChange={(e) => pickProduct(item.key, e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Item avulso</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                  <Field
                    label="Descrição"
                    htmlFor={`desc-${item.key}`}
                    className={products.length > 0 ? "sm:col-span-7" : "sm:col-span-12"}
                  >
                    <Input
                      id={`desc-${item.key}`}
                      value={item.description}
                      onChange={(e) => updateItem(item.key, { description: e.target.value })}
                      placeholder="Ex.: Vaso geométrico 15cm"
                      maxLength={200}
                    />
                  </Field>
                  <Field label="Qtd." htmlFor={`qty-${item.key}`} className="sm:col-span-2">
                    <Input
                      id={`qty-${item.key}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100000}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                    />
                  </Field>
                  <Field label="Valor unitário" htmlFor={`price-${item.key}`} className="sm:col-span-4">
                    <MoneyInput
                      id={`price-${item.key}`}
                      value={item.unitPriceCents}
                      onValueChange={(v) => updateItem(item.key, { unitPriceCents: v })}
                    />
                  </Field>
                  <Field label="Custo unitário" htmlFor={`cost-${item.key}`} className="sm:col-span-3">
                    <MoneyInput
                      id={`cost-${item.key}`}
                      value={item.unitCostCents}
                      onValueChange={(v) => updateItem(item.key, { unitCostCents: v })}
                    />
                  </Field>
                  <div className="flex flex-col justify-end sm:col-span-3">
                    <span className="mb-1.5 text-sm font-medium text-ink">Total do item</span>
                    <span className="flex h-10 items-center justify-end rounded-xl bg-hover px-3 text-sm font-semibold tabular-nums">
                      {formatBRL(item.quantity * item.unitPriceCents)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setItems((list) => [...list, emptyItem()])}>
              <Plus /> Adicionar item
            </Button>

            <div className="grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <Field label="Desconto" htmlFor="discount">
                <MoneyInput id="discount" value={discount} onValueChange={setDiscount} />
              </Field>
              <Field label="Frete cobrado do cliente" htmlFor="shipping">
                <MoneyInput id="shipping" value={shipping} onValueChange={setShipping} />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* ── Pagamento ── */}
        <Card>
          <CardHeader
            title="Pagamento"
            description={
              isEdit && initial && initial.paidCents > 0
                ? `Já recebido: ${formatBRL(initial.paidCents)}. Os pagamentos registrados são mantidos e abatidos do novo plano.`
                : "Como o cliente vai pagar. As cobranças e lembretes saem daqui."
            }
          />
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Forma de pagamento">
              {PLAN_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.value}
                  onClick={() => switchMode(m.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    mode === m.value
                      ? "border-accent bg-accent-soft"
                      : "border-line-strong hover:bg-hover",
                  )}
                >
                  <span className={cn("block text-sm font-semibold", mode === m.value ? "text-accent-ink" : "text-ink")}>
                    {m.label}
                  </span>
                  <span className="block text-xs text-ink-2">{m.hint}</span>
                </button>
              ))}
            </div>

            {mode === "avista" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Vencimento" htmlFor="avista-due">
                  <Input id="avista-due" type="date" value={avistaDue} onChange={(e) => setAvistaDue(e.target.value)} />
                </Field>
                {!isEdit ? (
                  <div className="flex flex-col justify-end gap-3">
                    <Checkbox
                      label="Já recebi esse valor"
                      description="Registra o pagamento junto com a venda."
                      checked={receivedNow}
                      onChange={(e) => setReceivedNow(e.target.checked)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {mode === "parcelado" || mode === "entrada" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {mode === "entrada" ? (
                  <>
                    <Field label="Valor da entrada" htmlFor="down" hint={`Vence na data da venda (${formatDateBR(date)}).`}>
                      <MoneyInput id="down" value={downCents} onValueChange={setDownCents} />
                    </Field>
                    {!isEdit ? (
                      <div className="flex items-end pb-1">
                        <Checkbox
                          label="Entrada já recebida"
                          checked={downReceived}
                          onChange={(e) => setDownReceived(e.target.checked)}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
                <Field label={mode === "entrada" ? "Parcelas do restante" : "Número de parcelas"} htmlFor="count">
                  <Select id="count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="1º vencimento" htmlFor="first-due">
                  <Input id="first-due" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
                </Field>
                <Field label="Frequência" htmlFor="frequency">
                  <Select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {FREQUENCY_LABEL[f]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : null}

            {!isEdit && ((mode === "avista" && receivedNow) || (mode === "entrada" && downReceived && downCents > 0)) ? (
              <Field label="Recebido via" htmlFor="method" className="sm:max-w-xs">
                <Select id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {/* Prévia / edição das parcelas */}
            <div className="rounded-xl border border-line">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarClock className="size-4 text-ink-2" aria-hidden />
                  {schedule.length} {schedule.length === 1 ? "parcela" : "parcelas"}
                </span>
                {mode !== "personalizado" && schedule.length > 0 ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent-ink hover:underline"
                    onClick={() => switchMode("personalizado")}
                  >
                    Ajustar manualmente
                  </button>
                ) : null}
              </div>
              {total <= 0 ? (
                <p className="px-3 py-4 text-sm text-ink-2">Adicione os itens com valor para montar o plano.</p>
              ) : mode === "personalizado" ? (
                <div className="space-y-2 p-3">
                  {rows.map((row, index) => (
                    <div key={row.key} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center gap-2">
                      <span className="text-center text-sm text-ink-2 tabular-nums">{index + 1}</span>
                      <Input
                        type="date"
                        aria-label={`Vencimento da parcela ${index + 1}`}
                        value={row.dueDate}
                        onChange={(e) => updateRow(row.key, { dueDate: e.target.value })}
                      />
                      <MoneyInput
                        aria-label={`Valor da parcela ${index + 1}`}
                        value={row.amountCents}
                        onValueChange={(v) => updateRow(row.key, { amountCents: v })}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                        aria-label={`Remover parcela ${index + 1}`}
                        disabled={rows.length === 1}
                      >
                        <Trash />
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const last = rows[rows.length - 1];
                        setRows((list) => [
                          ...list,
                          { key: uid(), dueDate: last ? addMonths(last.dueDate, 1) : today, amountCents: Math.max(0, total - scheduleSum) },
                        ]);
                      }}
                    >
                      <Plus /> Parcela
                    </Button>
                    {scheduleSum !== total && rows.length > 0 ? (
                      <Button variant="ghost" size="sm" onClick={fixDifference}>
                        <Wand /> Ajustar última para fechar o total
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {sortedSchedule.map((row, index) => (
                    <li key={`${row.dueDate}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="flex items-center gap-3">
                        <span className="w-5 text-ink-2 tabular-nums">{index + 1}</span>
                        <span className="inline-block first-letter:uppercase">{formatDateWeekday(row.dueDate)}</span>
                        <span className="text-ink-2">{formatDateBR(row.dueDate)}</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatBRL(row.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {total > 0 ? (
                <div
                  className={cn(
                    "flex justify-between border-t border-line px-3 py-2 text-sm",
                    scheduleSum === total ? "text-ink-2" : "text-critical-ink",
                  )}
                >
                  <span>Soma das parcelas</span>
                  <span className="font-medium tabular-nums">
                    {formatBRL(scheduleSum)} de {formatBRL(total)}
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Observações" />
          <CardContent>
            <Textarea
              aria-label="Observações"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cor do filamento, medidas, combinados com o cliente…"
              maxLength={2000}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Resumo ── */}
      <aside className="xl:sticky xl:top-8">
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium text-ink-2">Resumo</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-2">Itens</span>
                <span className="tabular-nums">{formatBRL(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-ink-2">Desconto</span>
                  <span className="tabular-nums">− {formatBRL(discount)}</span>
                </div>
              ) : null}
              {shipping > 0 ? (
                <div className="flex justify-between">
                  <span className="text-ink-2">Frete</span>
                  <span className="tabular-nums">+ {formatBRL(shipping)}</span>
                </div>
              ) : null}
            </div>
            <div className="border-t border-line pt-3">
              <p className="text-sm text-ink-2">Total</p>
              <p className={cn("text-3xl font-semibold tracking-tight", total < 0 && "text-critical-ink")}>{formatBRL(total)}</p>
            </div>
            {cost > 0 ? (
              <div className="space-y-1.5 rounded-xl bg-hover px-3 py-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-2">Custo estimado</span>
                  <span className="tabular-nums">{formatBRL(cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Margem</span>
                  <span className="font-medium tabular-nums">{margin === null ? "—" : formatPercent(margin)}</span>
                </div>
              </div>
            ) : null}
            <FormError message={error ?? (total > 0 && scheduleError && mode === "personalizado" ? scheduleError : null)} />
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Registrar venda"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => router.back()}>
              Cancelar
            </Button>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
