/**
 * Redefine a senha de acesso (para quando esquecer). Usa o banco configurado em DATABASE_URL.
 *
 *   npm run senha                          → se houver um único usuário, gera uma senha nova
 *   npm run senha -- voce@email.com        → gera uma senha nova para esse e-mail
 *   npm run senha -- voce@email.com Nova#Senha123
 */
import { randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { authAttempts, sessions, users } from "../src/db/schema";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/server/password";

loadEnvConfig(process.cwd());

async function main() {
  const [emailArg, passwordArg] = process.argv.slice(2);
  const db = createDb();
  const all = await db.select({ id: users.id, email: users.email, name: users.name }).from(users);
  if (all.length === 0) {
    console.log("Nenhum usuário cadastrado ainda. Abra o app e crie a conta na tela inicial.");
    return;
  }

  const user = emailArg ? all.find((u) => u.email === emailArg.trim().toLowerCase()) : all.length === 1 ? all[0] : undefined;
  if (!user) {
    console.log(emailArg ? `E-mail não encontrado: ${emailArg}` : "Há mais de um usuário. Informe o e-mail:");
    console.log(all.map((u) => `  - ${u.email} (${u.name})`).join("\n"));
    process.exitCode = 1;
    return;
  }

  const password = passwordArg ?? randomBytes(9).toString("base64url");
  if (password.length < PASSWORD_MIN_LENGTH) {
    console.log(`A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    process.exitCode = 1;
    return;
  }

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await db.delete(authAttempts).where(eq(authAttempts.key, `login:${user.email}`));

  console.log(`✓ Senha de ${user.email} redefinida.`);
  if (!passwordArg) console.log(`  Nova senha: ${password}\n  (troque em Configurações → Sua conta)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
