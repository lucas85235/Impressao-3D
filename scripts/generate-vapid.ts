/**
 * Gera as chaves das notificações push (VAPID) e segredos sugeridos.
 *
 *   npm run vapid             → mostra as variáveis para copiar
 *   npm run vapid -- --write  → acrescenta o que faltar no .env.local (uso local, sem SETUP_CODE)
 *   npm run vapid -- --vercel → cria .env.vercel.local para importar na Vercel (produção)
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateVAPIDKeys } from "web-push";

const keys = generateVAPIDKeys();
const vars: Record<string, string> = {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: "mailto:seu-email@exemplo.com",
  CRON_SECRET: randomBytes(24).toString("base64url"),
  SETUP_CODE: randomBytes(9).toString("base64url"),
};

if (process.argv.includes("--vercel")) {
  const file = ".env.vercel.local";
  if (existsSync(file)) {
    console.log(`✓ ${file} já existe (mantido). Apague-o só se quiser chaves novas — isso desliga as notificações já ativadas.`);
  } else {
    // Sem VAPID_SUBJECT: na Vercel o app usa a própria URL de produção.
    writeFileSync(
      file,
      `# Variáveis de produção para a Vercel (Settings → Environment Variables → "Import .env").
# Arquivo só deste computador (o .gitignore já ignora). Guarde uma cópia: trocar as chaves
# VAPID desliga as notificações já ativadas nos aparelhos.

# 1) Cole aqui a URL e o token do banco criado no Turso:
DATABASE_URL=libsql://COLE-AQUI-A-URL-DO-TURSO
DATABASE_AUTH_TOKEN=COLE-AQUI-O-TOKEN-DO-TURSO

APP_TIMEZONE=America/Sao_Paulo

# Código pedido uma única vez, na tela de criar a conta no site publicado.
SETUP_CODE=${vars.SETUP_CODE}

# Notificações push e lembrete diário (gerados automaticamente).
VAPID_PUBLIC_KEY=${vars.VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY=${vars.VAPID_PRIVATE_KEY}
CRON_SECRET=${vars.CRON_SECRET}
`,
      "utf8",
    );
    console.log(`✓ Criado ${file}. Preencha DATABASE_URL e DATABASE_AUTH_TOKEN (Turso) e importe na Vercel.`);
  }
} else if (process.argv.includes("--write")) {
  const file = ".env.local";
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  // SETUP_CODE só é necessário em produção; localmente a conta é criada sem código.
  const missing = Object.entries(vars).filter(([k]) => k !== "SETUP_CODE" && !new RegExp(`^${k}=`, "m").test(current));
  if (missing.length === 0) {
    console.log(`✓ ${file} já tem todas as variáveis.`);
  } else {
    const block = `${current && !current.endsWith("\n") ? "\n" : ""}${missing.map(([k, v]) => `${k}=${v}`).join("\n")}\n`;
    appendFileSync(file, block);
    console.log(`✓ Adicionado em ${file}: ${missing.map(([k]) => k).join(", ")}`);
  }
} else {
  console.log("# Copie para .env.local (local) ou para as Environment Variables da Vercel:\n");
  for (const [k, v] of Object.entries(vars)) console.log(`${k}=${v}`);
  console.log("\n# Troque VAPID_SUBJECT pelo seu e-mail (mailto:) ou pela URL do app (https://...).");
}
