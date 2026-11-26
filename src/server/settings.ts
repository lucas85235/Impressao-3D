import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings-defaults";

export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db.select().from(settings);
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      (out as Record<string, unknown>)[row.key] = JSON.parse(row.value);
    } catch {
      // valor corrompido: mantém o padrão
    }
  }
  return out;
});

export async function saveSettings(partial: Partial<AppSettings>) {
  for (const [key, value] of Object.entries(partial)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    const json = JSON.stringify(value);
    await db
      .insert(settings)
      .values({ key, value: json })
      .onConflictDoUpdate({ target: settings.key, set: { value: json } });
  }
}
