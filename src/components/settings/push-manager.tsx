"use client";

import { Bell, BellOff, Send, Smartphone, Trash } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/status";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/server/actions/settings";

type Device = { id: number; userAgent: string | null; createdAt: string; lastUsedAt: string | null };
type Support = "checking" | "unsupported" | "ios-needs-install" | "insecure" | "ok";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function describeDevice(ua: string | null): string {
  if (!ua) return "Dispositivo";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "Outro";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  return `${browser} · ${os}`;
}

export function PushManager({ vapidPublicKey, devices }: { vapidPublicKey: string | null; devices: Device[] }) {
  const [support, setSupport] = useState<Support>("checking");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let next: Support = "ok";
    if (!window.isSecureContext) next = "insecure";
    else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      next = ios && !standalone ? "ios-needs-install" : "unsupported";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção de recursos do navegador
    setSupport(next);
    if (next !== "ok") return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        setEndpoint(sub?.endpoint ?? null);
        // Garante que o servidor conhece a inscrição deste navegador (idempotente).
        if (sub) await savePushSubscriptionAction(JSON.parse(JSON.stringify(sub)), navigator.userAgent);
      })
      .catch(() => undefined);
  }, []);

  const subscribedHere = Boolean(endpoint);

  function enable() {
    if (!vapidPublicKey) return;
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        await navigator.serviceWorker.ready;
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          toast.error("Permissão negada. Libere as notificações nas configurações do navegador.");
          return;
        }
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));
        const result = await savePushSubscriptionAction(JSON.parse(JSON.stringify(sub)), navigator.userAgent);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setEndpoint(sub.endpoint);
        toast.success("Notificações ativadas neste dispositivo");
      } catch (err) {
        console.error(err);
        toast.error("Não foi possível ativar as notificações neste navegador.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setEndpoint(null);
      toast.success("Notificações desativadas neste dispositivo");
    });
  }

  function test() {
    startTransition(async () => {
      const result = await sendTestPushAction();
      if (!result.ok) toast.error(result.error);
      else toast.success(`Notificação enviada para ${result.data.sent} dispositivo(s)`);
    });
  }

  if (!vapidPublicKey) {
    return (
      <p className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning-ink">
        Notificações ainda não configuradas no servidor. Rode <code>npm run vapid</code> e adicione as chaves nas
        variáveis de ambiente (veja o README).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {support === "checking" ? (
          <span className="text-sm text-ink-2">Verificando este navegador…</span>
        ) : support === "ok" ? (
          subscribedHere ? (
            <>
              <Chip tone="good" icon={Bell}>
                Ativas neste dispositivo
              </Chip>
              <Button variant="secondary" size="sm" onClick={test} disabled={pending}>
                <Send /> Enviar teste
              </Button>
              <Button variant="ghost" size="sm" onClick={disable} disabled={pending}>
                <BellOff /> Desativar aqui
              </Button>
            </>
          ) : (
            <>
              <Button onClick={enable} disabled={pending || permission === "denied"}>
                <Bell /> Ativar notificações neste dispositivo
              </Button>
              {permission === "denied" ? (
                <span className="text-sm text-critical-ink">Bloqueadas no navegador — libere nas configurações do site.</span>
              ) : null}
            </>
          )
        ) : support === "ios-needs-install" ? (
          <p className="text-sm text-ink-2">
            No iPhone: toque em <strong>Compartilhar → Adicionar à Tela de Início</strong>, abra o app por lá e volte aqui para
            ativar.
          </p>
        ) : support === "insecure" ? (
          <p className="text-sm text-ink-2">
            Notificações exigem HTTPS (ou localhost). Funcionam quando o app estiver publicado na internet.
          </p>
        ) : (
          <p className="text-sm text-ink-2">Este navegador não suporta notificações push.</p>
        )}
      </div>

      {devices.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">Dispositivos que recebem lembretes</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Smartphone className="size-4 shrink-0 text-ink-2" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{describeDevice(d.userAgent)}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remover dispositivo"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removePushSubscriptionAction(d.id);
                      toast.success("Dispositivo removido");
                    })
                  }
                >
                  <Trash />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
