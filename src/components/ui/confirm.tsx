"use client";

import { AlertDialog } from "radix-ui";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/utils";
import { Button, buttonClass, type ButtonSize, type ButtonVariant } from "./button";

/**
 * Botão que pede confirmação antes de executar uma ação destrutiva.
 */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel = "Excluir",
  onConfirm,
  successMessage,
  variant = "ghost",
  size = "sm",
  className,
  ariaLabel,
}: {
  children: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<ActionResult<unknown> | void>;
  successMessage?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger className={buttonClass({ variant, size, className })} aria-label={ariaLabel}>
        {children}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 shadow-2xl data-[state=open]:animate-[pop-in_160ms_ease-out]">
          <AlertDialog.Title className="text-lg font-semibold text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-sm text-ink-2">
            {description ?? "Essa ação não pode ser desfeita."}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel className={buttonClass({ variant: "secondary" })}>Cancelar</AlertDialog.Cancel>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await onConfirm();
                  if (result && !result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setOpen(false);
                  if (successMessage) toast.success(successMessage);
                })
              }
            >
              {pending ? "Aguarde…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
