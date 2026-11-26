// Padrões das configurações (sem imports de servidor: usado também no cliente).

export type AppSettings = {
  businessName: string;
  pixKey: string;
  /** Quantos dias antes do vencimento a cobrança entra nos lembretes. */
  reminderDaysAhead: number;
  templateReminder: string;
  templateOverdue: string;
  /** Última data (YYYY-MM-DD) em que o resumo diário foi enviado. */
  lastDigestDate: string | null;
};

export const DEFAULT_TEMPLATE_REMINDER = [
  "Oi, {cliente}! Tudo bem? 😊",
  "Passando para lembrar do pagamento de {valor} {parcela} referente a \"{pedido}\", com vencimento em {vencimento}.",
  "{pix}",
  "Qualquer dúvida é só me chamar. Obrigado!",
].join("\n");

export const DEFAULT_TEMPLATE_OVERDUE = [
  "Oi, {cliente}! Tudo bem?",
  "O pagamento de {valor} {parcela} referente a \"{pedido}\" venceu em {vencimento} e ainda consta em aberto aqui.",
  "{pix}",
  "Se já tiver pago, me avisa que eu atualizo. Obrigado!",
].join("\n");

export const DEFAULT_SETTINGS: AppSettings = {
  businessName: "Minha Loja 3D",
  pixKey: "",
  reminderDaysAhead: 3,
  templateReminder: DEFAULT_TEMPLATE_REMINDER,
  templateOverdue: DEFAULT_TEMPLATE_OVERDUE,
  lastDigestDate: null,
};

export const TEMPLATE_PLACEHOLDERS = [
  { key: "{cliente}", label: "Primeiro nome do cliente" },
  { key: "{valor}", label: "Valor em aberto" },
  { key: "{vencimento}", label: "Data de vencimento" },
  { key: "{parcela}", label: "\"(parcela 2/3)\" quando parcelado" },
  { key: "{pedido}", label: "Título da venda" },
  { key: "{pix}", label: "\"Chave Pix: ...\" (se configurada)" },
  { key: "{loja}", label: "Nome do seu negócio" },
];
