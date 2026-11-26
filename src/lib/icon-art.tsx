// Arte do ícone do app (usada para gerar os PNGs com ImageResponse).

const ACCENT = "#256abf";

export function IconArt({
  size,
  variant = "rounded",
}: {
  size: number;
  /** rounded: cantos arredondados · square: fundo cheio (iOS/maskable) · badge: só o desenho, branco */
  variant?: "rounded" | "square" | "maskable" | "badge";
}) {
  const padding = variant === "maskable" ? size * 0.24 : variant === "badge" ? size * 0.06 : size * 0.16;
  const glyph = Math.round(size - padding * 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: variant === "badge" ? "transparent" : ACCENT,
        borderRadius: variant === "rounded" ? size * 0.22 : 0,
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={variant === "badge" ? 2.2 : 1.7}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M12 2.8 20 7.4v9.2L12 21.2l-8-4.6V7.4z" />
        <path d="M4 7.4 12 12l8-4.6M12 12v9.2" />
        <path d="M6.5 12.6 9.5 14.3M6.5 15.4l3 1.7" />
      </svg>
    </div>
  );
}
