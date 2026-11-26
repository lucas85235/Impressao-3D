import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Só tem efeito quando o site é servido por HTTPS (em http://, como na rede local, o navegador ignora).
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Não restringe scripts (o tema usa um script inline); bloqueia <base>, plugins, iframes e formulários para fora.
  { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Permite abrir o servidor de desenvolvimento pelo celular na mesma rede (ex.: http://192.168.0.10:3000)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
