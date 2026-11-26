import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasAnyUser } from "@/server/auth";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Criar conta" };
// Depende do banco (existe usuário?) e do cookie: nunca pode ser gerada no build.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");
  const requireCode = Boolean(process.env.SETUP_CODE) || process.env.NODE_ENV === "production";
  return <SetupForm requireCode={requireCode} />;
}
