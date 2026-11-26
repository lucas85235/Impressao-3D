import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestão 3D — vendas, cobranças e gastos",
    short_name: "Gestão 3D",
    description: "Vendas, cobranças e gastos da sua impressão 3D.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f3f0",
    theme_color: "#f3f3f0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nova venda", url: "/vendas/nova" },
      { name: "Cobranças", url: "/cobrancas" },
      { name: "Novo gasto", url: "/gastos?novo=1" },
    ],
  };
}
