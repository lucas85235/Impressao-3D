"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/** Toaster que acompanha o tema (claro/escuro) escolhido no app. */
export function AppToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return <Toaster theme={theme} position="top-center" richColors closeButton duration={3500} />;
}
