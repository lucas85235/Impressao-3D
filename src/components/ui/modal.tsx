"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Modal acessível. No celular vira uma "folha" que sobe de baixo; no desktop fica centralizado.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed z-50 flex max-h-[92dvh] flex-col overflow-hidden bg-surface shadow-2xl outline-none",
            "inset-x-0 bottom-0 rounded-t-3xl data-[state=open]:animate-[sheet-in_220ms_cubic-bezier(0.32,0.72,0,1)]",
            "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:data-[state=open]:animate-[pop-in_160ms_ease-out]",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 sm:pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold tracking-tight text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-ink-2">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="-mt-1 -mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
