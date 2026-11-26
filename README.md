# 🧊 Gestão 3D

App web para organizar **vendas, cobranças e gastos** de quem vende impressão 3D.
Funciona no computador e no celular (dá para **instalar como app** na tela inicial) e
pode ser publicado de graça na internet para acessar de qualquer lugar.

---

## ✨ O que já faz

| Área | Recursos |
|---|---|
| **Vendas** | Itens (do catálogo ou avulsos), desconto, frete, canal de venda (Instagram, WhatsApp, feira…), situação (orçamento → em produção → pronto → entregue), custo estimado e margem |
| **Pagamentos** | À vista, **parcelado** (N× mensal/quinzenal/semanal), **entrada + parcelas** ou **personalizado** (datas e valores livres). Pagamentos **em partes**: registre qualquer valor e o app abate da parcela escolhida ou da mais antiga, mostrando quanto falta |
| **Cobranças** | Lista de atrasadas / vencem hoje / próximos dias, com botão **WhatsApp** que abre a mensagem pronta (com sua chave Pix) e botão **Receber** |
| **Lembretes automáticos** | Resumo diário por **notificação push** no celular/PC, alerta no painel e contador no menu |
| **Gastos** | Categorias, compras **parceladas** (ex.: impressora em 10×), contas a pagar |
| **Dashboard** | Lucro do mês/ano em regime de caixa (pagamentos recebidos − gastos pagos), recebido × gastos (12 meses), previsão de recebimentos, gastos por categoria, produtos mais vendidos, canais de venda |
| **Cadastros** | Clientes (histórico, quanto devem) e catálogo de produtos (preço, custo, margem, gramas, tempo de impressão) |
| **Outros** | Login com senha, tema claro/escuro, backup em JSON, PWA (instalável) |

---

## 🚀 Rodar no seu computador

Requisito: **Node.js 20.9+**.

```bash
npm install
npm run dev
```

Abra <http://localhost:3000> e crie sua conta. Os dados ficam no arquivo `data/app.db`.

### Ver com dados de exemplo

```bash
npm run db:demo     # cria data/demo.db com 12 meses de dados fictícios
npm run dev:demo    # abre o app usando o banco de demonstração
```

Login da demonstração: `demo@gestao3d.local` / `demo1234` (banco separado — não mexe nos seus dados).

### Abrir pelo celular (mesma rede Wi-Fi)

Com `npm run dev` rodando, acesse `http://IP-DO-SEU-PC:3000` no celular (o IP aparece em “Network” quando o servidor sobe).
As notificações push só funcionam com HTTPS — ou seja, depois de publicar (abaixo).

---

## 🌐 Publicar na internet (grátis) — acessar de qualquer PC e do celular

Usamos **Vercel** (hospedagem) + **Turso** (banco SQLite na nuvem). Os dois têm plano gratuito.

1. **GitHub** — crie um repositório **privado e vazio** (sem README) e envie o código:
   `git remote add origin <url-do-repo>` e `git push -u origin main`.
2. **Chaves** — `npm run vapid -- --vercel` cria o `.env.vercel.local` (fica só no seu PC) com
   `SETUP_CODE`, as chaves de notificação (`VAPID_*`), `CRON_SECRET` e `APP_TIMEZONE`.
3. **Turso** (banco) — no painel <https://app.turso.tech> (entre com o GitHub):
   - crie um banco na região **AWS US East (Virginia)**, vizinha da região padrão da Vercel (Washington);
   - copie a URL (`libsql://...`) e gere um token **sem expiração**;
   - cole os dois no `.env.vercel.local` (`DATABASE_URL` e `DATABASE_AUTH_TOKEN`).

   Pela [CLI do Turso](https://docs.turso.tech/cli/introduction) (no Windows, via WSL):
   `turso db create gestao3d`, `turso db show gestao3d --url` e `turso db tokens create gestao3d`.
4. **Vercel** — em <https://vercel.com/new>, entre com o GitHub e importe o repositório.
   Em *Environment Variables*, use **Import .env** e escolha o `.env.vercel.local`. Depois clique em **Deploy**.

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | do Turso |
   | `SETUP_CODE` | código pedido na criação da conta |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | chaves das notificações |
   | `CRON_SECRET` | segredo do lembrete diário |
   | `APP_TIMEZONE` | `America/Sao_Paulo` |
   | `VAPID_SUBJECT` (opcional) | `mailto:...` — sem ela, o app usa a própria URL |

   As variáveis valem para **Production**. Deploys de *preview* (outros branches/PRs) não aplicam
   migrações, para não mexer no banco de produção. Se quiser previews funcionando, crie um segundo banco
   no Turso, cadastre as variáveis dele em **Preview** e adicione `MIGRATE_ON_PREVIEW=1`.
5. **Deploy** — o build aplica as migrações no banco automaticamente. Cada `git push` no `main` publica de novo.
6. Abra o site e **crie sua conta** (ele pede o `SETUP_CODE`).
7. **No celular**: abra o site → *Adicionar à tela inicial* → **Configurações → Ativar notificações**.
   - iPhone: precisa do iOS 16.4+ e de abrir o app **pela tela inicial** antes de ativar.

> ⚖️ O plano grátis (Hobby) da Vercel é para uso pessoal e não comercial (a regra prática deles: serve quando
> ninguém ganha dinheiro com o projeto). Painel interno de um negócio fica numa zona cinzenta; para ficar 100%
> dentro das regras — e com certeza se o app virar loja/vitrine pública — use o plano Pro.

**Lembrete diário:** o `vercel.json` agenda `/api/cron/lembretes` todo dia às **11:00 UTC (08:00 de Brasília)**.
A Vercel envia o `CRON_SECRET` sozinha. Para mudar o horário, edite o `schedule` (formato cron, em UTC).
Também dá para usar qualquer agendador externo chamando a URL com o header `Authorization: Bearer <CRON_SECRET>`.

> 💡 Escolha regiões próximas para a função da Vercel e o banco do Turso — o app fica mais rápido.

---

## 🔐 Segurança

- Senhas com **scrypt**; sessão em cookie `httpOnly`; limite de tentativas de login (por IP e por e-mail).
- Trocar a senha desconecta os outros aparelhos.
- Cada página e cada ação conferem o login **no servidor**.
- Em produção, criar a conta inicial exige o `SETUP_CODE`.
- **Nunca** suba `.env.local` nem a pasta `data/` (já estão no `.gitignore`).
- Esqueceu a senha? `npm run senha` (gera uma nova; com as variáveis do banco certo carregadas).

---

## 🧰 Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | App em modo desenvolvimento (banco `data/app.db`) |
| `npm run dev:demo` | App com o banco de demonstração |
| `npm run db:demo` | (Re)cria o banco de demonstração |
| `npm run build` / `npm start` | Build de produção (aplica migrações) / servidor de produção |
| `npm run db:generate` | Gera migração após mudar `src/db/schema.ts` |
| `npm run db:migrate` | Aplica migrações no banco de `DATABASE_URL` |
| `npm run db:studio` | Abre o Drizzle Studio para ver o banco |
| `npm run vapid` | Gera chaves de notificação e segredos (`-- --write` grava no `.env.local`; `-- --vercel` cria o `.env.vercel.local`) |
| `npm run senha` | Redefine a senha de acesso |
| `npm test` · `npm run typecheck` · `npm run lint` | Testes, tipos e lint |

---

## 🏗️ Arquitetura

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) + React 19 + TypeScript |
| Estilo | Tailwind CSS 4 (tokens em `src/app/globals.css`) |
| Banco | SQLite via libSQL — arquivo local ou Turso na nuvem — com Drizzle ORM |
| Gráficos | Recharts 3 (paleta validada para daltonismo, claro/escuro) |
| Validação | Zod 4 |
| Push | Web Push (VAPID) + service worker (`public/sw.js`) |
| Testes | Vitest (regras de dinheiro, datas, parcelas e abatimento) |

```
src/
├── app/
│   ├── (auth)/            login e criação da conta
│   ├── (app)/             telas logadas: início, vendas, cobranças, clientes, gastos, produtos, configurações
│   ├── api/cron/          lembrete diário (push)
│   ├── api/export/        backup JSON
│   └── manifest.ts, icon.tsx, icons/   PWA
├── components/            UI (ui/, charts/, sales/, payments/, expenses/, ...)
├── db/                    schema Drizzle, conexão, dados padrão
├── lib/                   dinheiro, datas, WhatsApp, regras puras (domain/)
└── server/                auth, queries (leitura), actions (escrita), push, lembretes
drizzle/                   migrações SQL (versionadas)
scripts/                   migrate, demo, vapid, reset de senha
```

**Regras importantes:** dinheiro sempre em **centavos** (inteiros); datas de negócio como texto `AAAA-MM-DD`;
“hoje” calculado no fuso `APP_TIMEZONE`. O abatimento dos pagamentos está em `src/lib/domain/allocation.ts` (com testes).

---

## 🗺️ Próximas ideias (vendas e divulgação)

- **Vitrine pública** com fotos dos produtos e botão “pedir pelo WhatsApp”
- **Orçamento em PDF/link** para o cliente aprovar (vira venda com um clique)
- **Calculadora de preço**: filamento (R$/kg × gramas), energia, hora de máquina, falhas e margem
- **Gerador de posts/legendas** para Instagram a partir do catálogo
- **Estoque de filamento** por cor/material com alerta de reposição
- **Fila de produção** (kanban dos pedidos)
- Lembretes também por **e-mail/Telegram**; mensagens automáticas ao cliente (WhatsApp Business)
- Metas mensais, relatórios por cliente/canal, multiusuário (sócio/ajudante)
