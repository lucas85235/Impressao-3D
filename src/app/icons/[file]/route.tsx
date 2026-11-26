import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/icon-art";

// Ícones do PWA (manifest e notificações), gerados no build.
const ICONS = {
  "icon-192.png": { size: 192, variant: "rounded" },
  "icon-512.png": { size: 512, variant: "rounded" },
  "maskable-512.png": { size: 512, variant: "maskable" },
  "badge-96.png": { size: 96, variant: "badge" },
} as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const icon = ICONS[file as keyof typeof ICONS];
  if (!icon) return new Response("Not found", { status: 404 });
  return new ImageResponse(<IconArt size={icon.size} variant={icon.variant} />, {
    width: icon.size,
    height: icon.size,
  });
}
