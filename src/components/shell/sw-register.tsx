"use client";

import { useEffect } from "react";

/** Registra o service worker (necessário para instalar como app e receber notificações). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // sem service worker o app funciona normalmente, só não recebe push
    });
  }, []);
  return null;
}
