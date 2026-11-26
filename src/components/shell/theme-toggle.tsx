"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Pref = "light" | "dark" | "system";

function apply(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>("system");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o valor salvo no navegador
    if (saved === "light" || saved === "dark") setPref(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("theme") ?? "system") === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    // Mantém todos os seletores de tema da tela em sincronia.
    const onTheme = (e: Event) => setPref((e as CustomEvent<Pref>).detail);
    window.addEventListener("app-theme", onTheme);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("app-theme", onTheme);
    };
  }, []);

  function choose(next: Pref) {
    localStorage.setItem("theme", next);
    apply(next);
    window.dispatchEvent(new CustomEvent<Pref>("app-theme", { detail: next }));
  }

  const options: { value: Pref; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Auto", icon: Monitor },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-hover p-1" role="radiogroup" aria-label="Tema">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          onClick={() => choose(o.value)}
          className={cn(
            "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
            pref === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          <o.icon className="size-3.5" aria-hidden />
          {o.label}
        </button>
      ))}
    </div>
  );
}
