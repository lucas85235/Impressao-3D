import { MessageCircle } from "lucide-react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

/** Abre o WhatsApp (app ou web) com a mensagem de cobrança pronta. */
export function WhatsAppButton({
  href,
  label = "WhatsApp",
  variant = "secondary",
  size = "sm",
  className,
  hasPhone = true,
}: {
  href: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  hasPhone?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass({ variant, size, className })}
      title={hasPhone ? "Enviar cobrança pelo WhatsApp" : "Cliente sem telefone: você escolhe o contato no WhatsApp"}
    >
      <MessageCircle />
      {label}
    </a>
  );
}
