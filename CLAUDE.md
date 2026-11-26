# Gestão 3D — guia para agentes

App web (PWA) de vendas, cobranças e gastos para um vendedor de impressão 3D. UI e textos em **pt-BR**.
Visão geral, deploy e roadmap: `README.md`.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript 6 · Tailwind 4 · Drizzle ORM + libSQL (arquivo local / Turso) · Zod 4 · Recharts 3 · radix-ui · sonner · web-push · Vitest.

**Next 16 ≠ versões antigas:** leia `node_modules/next/dist/docs/` antes de usar uma API nova.
Pontos já usados aqui: `src/proxy.ts` (não `middleware`), `params`/`searchParams`/`cookies()` são async,
`next lint` não existe (use `npm run lint`), páginas que dependem do banco sem ler cookies precisam de `export const dynamic = "force-dynamic"`.

## Comandos
- `npm run dev` (banco `data/app.db`) · `npm run dev:demo` (banco `data/demo.db`, login `demo@gestao3d.local` / `demo1234`)
- `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`
- Mudou `src/db/schema.ts` → `npm run db:generate` e versione a pasta `drizzle/` (o build aplica as migrações).

## Convenções (não quebre)
- **Dinheiro em centavos** (inteiros) em todo lugar. Formate com `formatBRL`. No formulário use `MoneyInput`.
- **Datas de negócio = string `YYYY-MM-DD`**; aritmética só via `src/lib/dates.ts`. "Hoje" = `todayISO()` (fuso `APP_TIMEZONE`).
- Regras puras em `src/lib/domain/` com testes (`*.test.ts`). Abatimento de pagamentos: `allocation.ts`
  (pagamento direcionado → parcela escolhida; resto → parcela mais antiga; excesso → crédito).
- Vendas `orcamento` e `cancelado` não contam em faturamento/cobranças (`INACTIVE_SALE_STATUSES`).
- Dashboard em **regime de caixa**: recebido = todos os pagamentos do período (inclusive de venda cancelada); gastos = só `paid = true`.
- Argumentos de Server Action chegam do cliente sem garantia de tipo: valide ids com `parseId` e o resto com Zod.
  Leitura + escrita que dependem uma da outra (saldo, primeira conta) vão em `db.transaction` (libSQL = `BEGIN IMMEDIATE`).
- **Leitura** em `src/server/queries/*` (com `import "server-only"`). **Escrita** em `src/server/actions/*` (`"use server"`):
  sempre `await requireUser()` primeiro, validar com Zod, devolver `ActionResult` (`ok()`/`fail()`), e `revalidatePath("/", "layout")`.
- Toda página logada chama `requireUser()` (o proxy só faz checagem otimista do cookie).
- Scripts (`scripts/*.ts`) não podem importar módulos com `server-only`; use `src/db/client.ts` e `src/server/password.ts`.

## UI
- Tokens de cor em `src/app/globals.css` (claro/escuro via `data-theme`). Use classes como `bg-surface`, `text-ink-2`, `border-line`.
- Paleta de gráficos validada (contraste + daltonismo): `series-1` (azul) = entradas/recebido, `series-2` (laranja) = gastos.
  Cores de status (good/warning/serious/critical) **só** para estado e sempre com ícone + texto (`Chip`).
- Grades responsivas sempre com base `grid-cols-1` (evita estourar a largura no celular); linhas densas usam container queries (`@container`, `@xl:`).
- Barra lateral aparece a partir de `lg`; layouts lado a lado de conteúdo geralmente a partir de `xl`.
- Ícones: lucide-react v1 (alguns nomes mudaram: `CircleExclamationPoint`, `Trash`…). Confira em `node_modules/lucide-react/dist/lucide-react.d.ts`.
