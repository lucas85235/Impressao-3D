"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/field";

export function CategoryFilter({ categories, value }: { categories: { id: number; name: string }[]; value: number | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Select
      aria-label="Filtrar por categoria"
      className="h-9 w-auto min-w-44"
      value={value ?? ""}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        if (e.target.value) next.set("categoria", e.target.value);
        else next.delete("categoria");
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    >
      <option value="">Todas as categorias</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}
