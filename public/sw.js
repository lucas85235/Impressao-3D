/* Service worker do Gestão 3D: recebe notificações push e abre o app ao tocar. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Gestão 3D", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Gestão 3D";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag || "gestao3d",
      renotify: true,
      data: { url: data.url || "/cobrancas" },
    }),
  );
});

/** Só abre páginas do próprio app (nunca outro domínio vindo do payload). */
function appUrl(raw) {
  try {
    const url = new URL(raw || "/", self.location.origin);
    if (url.origin === self.location.origin) return url.href;
  } catch {
    // URL inválida: cai no padrão
  }
  return new URL("/cobrancas", self.location.origin).href;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = appUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) return client.navigate(target);
          return;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
