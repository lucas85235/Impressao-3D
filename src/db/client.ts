import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "file:./data/app.db";

/**
 * Cria a conexão com o banco.
 * - Local: `file:./data/app.db` (SQLite em arquivo, zero configuração).
 * - Nuvem: `libsql://<banco>.turso.io` + DATABASE_AUTH_TOKEN (Turso).
 */
export function createDb(url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL, authToken = process.env.DATABASE_AUTH_TOKEN) {
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  }
  const client = createClient({ url, authToken: authToken || undefined });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
