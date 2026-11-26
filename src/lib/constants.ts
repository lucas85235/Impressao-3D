// Enumerações e rótulos compartilhados entre servidor e cliente.
// Mantenha este arquivo livre de imports de servidor (é usado em componentes client).

export const APP_NAME = "Gestão 3D";

export const SALE_STATUSES = [
  "orcamento",
  "em_producao",
  "pronto",
  "entregue",
  "cancelado",
] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  orcamento: "Orçamento",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

/** Vendas nesses status não contam como faturamento nem geram cobranças. */
export const INACTIVE_SALE_STATUSES: readonly SaleStatus[] = ["orcamento", "cancelado"];

export const PAYMENT_METHODS = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

/** Sugestões de canal de venda (campo livre — servem para análises de divulgação). */
export const SALE_CHANNELS = [
  "Instagram",
  "WhatsApp",
  "Indicação",
  "Feira/Evento",
  "Shopee",
  "Mercado Livre",
  "Elo7",
  "Site",
  "Loja física",
  "Outro",
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Filamento",
  "Resina",
  "Peças e manutenção",
  "Equipamentos",
  "Energia elétrica",
  "Embalagens",
  "Frete e envio",
  "Marketing e anúncios",
  "Taxas e tarifas",
  "Ferramentas e software",
  "Outros",
];

export const FREQUENCIES = ["mensal", "quinzenal", "semanal"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  mensal: "Mensal",
  quinzenal: "A cada 15 dias",
  semanal: "Semanal",
};
