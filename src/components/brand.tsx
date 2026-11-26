import { cn } from "@/lib/utils";

/** Marca: cubo isométrico com camadas (impressão 3D). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 2.8 20 7.4v9.2L12 21.2l-8-4.6V7.4z" />
        <path d="M4 7.4 12 12l8-4.6M12 12v9.2" />
        <path d="M6.5 12.6 9.5 14.3M6.5 15.4l3 1.7" opacity={0.75} />
      </svg>
    </span>
  );
}
