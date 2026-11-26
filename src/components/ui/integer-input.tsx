"use client";

import { useRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { controlClass } from "./field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type" | "min" | "max"> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
};

/**
 * Campo de número inteiro (quantidade, dias…).
 * - Pode ficar vazio enquanto se digita; ao sair vazio (ou abaixo do mínimo) volta ao último valor válido.
 * - Ao tocar/clicar, seleciona o número: o primeiro dígito digitado já substitui (bom no celular).
 */
export function IntegerInput({
  value,
  onValueChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  className,
  onFocus,
  onBlur,
  onMouseDown,
  onMouseUp,
  onClick,
  ...props
}: Props) {
  // null = mostra o valor recebido; texto = o que está sendo digitado agora.
  const [draft, setDraft] = useState<string | null>(null);
  const focusingByPointer = useRef(false);

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={cn(controlClass, "h-10 tabular-nums", className)}
      value={draft ?? String(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, String(max).length);
        setDraft(digits);
        const n = Number(digits);
        if (digits && n >= min) onValueChange(Math.min(n, max));
      }}
      onMouseDown={(e) => {
        focusingByPointer.current = document.activeElement !== e.currentTarget;
        onMouseDown?.(e);
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        const initial = el.value;
        el.select();
        // Alguns navegadores (iOS) reposicionam o cursor logo após o foco: seleciona de novo no próximo
        // quadro, se nada foi digitado ainda.
        requestAnimationFrame(() => {
          if (document.activeElement === el && el.value === initial) el.select();
        });
        onFocus?.(e);
      }}
      onMouseUp={(e) => {
        // Ao soltar o dedo/mouse o navegador põe o cursor no ponto tocado: seleciona tudo de novo.
        if (focusingByPointer.current) {
          e.preventDefault();
          e.currentTarget.select();
        }
        onMouseUp?.(e);
      }}
      onClick={(e) => {
        // Último evento do toque (no celular o cursor ainda pode ter mudado depois do mouseup).
        if (focusingByPointer.current) e.currentTarget.select();
        focusingByPointer.current = false;
        onClick?.(e);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
