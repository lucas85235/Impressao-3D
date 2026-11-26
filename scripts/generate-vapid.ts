/**
 * Gera as chaves das notificações push (VAPID) e segredos sugeridos.
 *
 *   npm run vapid            → mostra as variáveis para copiar (ex.: para a Vercel)
 *   npm run vapid -- --write → acrescenta o que faltar no .env.local (uso local, sem SETUP_CODE)
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { generateVAPIDKeys } from "web-push";

const keys = generateVAPIDKeys();
const vars: Record<string, string> = {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: "mailto:seu-email@exemplo.com",
  CRON_SECRET: randomBytes(24).toString("base64url"),
  SETUP_CODE: randomBytes(9).toString("base64url"),
};

if (process.argv.includes("--write")) {
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
