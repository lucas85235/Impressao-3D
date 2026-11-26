"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/field";
import { SALE_STATUSES, SALE_STATUS_LABEL, type SaleStatus } from "@/lib/constants";
import { updateSaleStatusAction } from "@/server/actions/sales";

export function SaleStatusSelect({ saleId, status }: { saleId: number; status: SaleStatus }) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();
  return (
    <Select
      aria-label="Situação do pedido"
      className="h-9 w-auto min-w-40"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as SaleStatus;
        const previous = value;
        setValue(next);
        startTransition(async () => {
          const result = await updateSaleStatusAction(saleId, next);
          if (!result.ok) {
            setValue(previous);
            toast.error(result.error);
          } else {
            toast.success(`Situação: ${SALE_STATUS_LABEL[next]}`);
          }
        });
      }}
    >
      {SALE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {SALE_STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
