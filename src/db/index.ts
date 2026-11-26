import "server-only";
import { createDb, type Db } from "./client";

// Reaproveita a conexão entre recarregamentos do dev server (HMR).
const globalForDb = globalThis as unknown as { __gestao3dDb?: Db };

export const db: Db = globalForDb.__gestao3dDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__gestao3dDb = db;
}
