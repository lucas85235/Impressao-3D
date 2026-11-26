"use client";

import { useState, type InputHTMLAttributes } from "react";
import { formatMoneyPlain } from "@/lib/money";
import { cn } from "@/lib/utils";
import { controlClass } from "./field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  /** Valor controlado em centavos. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (cents: number) => void;
  /** Se informado, envia os centavos num <input hidden> com este nome. */
  name?: string;
};

const MAX_DIGITS = 11; // até R$ 999.999.999,99

/**
 * Campo de dinheiro estilo app de banco: os dígitos entram pela direita
 * (digitar 1-2-3-4 mostra 12,34). Sem ambiguidade de vírgula/ponto.
 */
export function MoneyInput({ value, defaultValue = 0, onValueChange, name, className, ...props }: Props) {
  const [inner, setInner] = useState(defaultValue);
  const cents = value ?? inner;

  function update(next: number) {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">R$</span>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn(controlClass, "h-10 pl-10 tabular-nums", className)}
        value={cents === 0 ? "" : formatMoneyPlain(cents)}
        placeholder={props.placeholder ?? "0,00"}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITS);
          update(digits ? Number(digits) : 0);
        }}
        onFocus={(e) => {
          const el = e.currentTarget;
          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
          props.onFocus?.(e);
        }}
      />
      {name ? <input type="hidden" name={name} value={cents} /> : null}
    </div>
  );
}
