/**
 * Aplica as migrações do banco (pasta /drizzle) e garante os dados padrão.
 * Roda automaticamente no `npm run build` (inclusive no deploy da Vercel).
 *
 *   npm run db:migrate
 */
import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb, DEFAULT_DATABASE_URL } from "../src/db/client";
import { ensureDefaults } from "../src/db/defaults";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

  if (process.env.VERCEL && url.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL não configurada na Vercel. Crie um banco no Turso e defina DATABASE_URL e DATABASE_AUTH_TOKEN (veja o README).",
    );
  }

  const safeUrl = url.replace(/\/\/[^@]+@/, "//***@");
  console.log(`→ Aplicando migrações em ${safeUrl}`);
  const db = createDb(url);
  await migrate(db, { migrationsFolder: "drizzle" });
  await ensureDefaults(db);
  console.log("✓ Banco atualizado");
}

main().catch((err) => {
  console.error("✗ Falha ao migrar o banco:", err);
  process.exit(1);
});
