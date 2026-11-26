"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  clearLoginAttempts,
  createSession,
  destroySession,
  hashPassword,
  hasAnyUser,
  loginThrottle,
  PASSWORD_MIN_LENGTH,
  registerFailedLogin,
  requireUser,
  verifyPassword,
} from "@/server/auth";
import { saveSettings } from "@/server/settings";
import { fail, ok, safeInternalPath, type ActionResult } from "@/lib/utils";

/** Estado dos formulários de login/cadastro. Devolve os campos digitados para não apagá-los em caso de erro. */
export type AuthFormState = { error?: string; values?: Record<string, string> } | undefined;

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeInternalPath(formData.get("next"));
  const values = { email };
  if (!email || !password) return { error: "Informe e-mail e senha.", values };

  const key = `login:${email}`;
  const throttle = await loginThrottle(key);
  if (throttle.blocked) {
    return { error: `Muitas tentativas. Tente de novo em ${throttle.retryInMinutes} min.`, values };
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Mesmo custo de tempo com ou sem usuário (não revela quais e-mails existem).
  const valid = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
  if (!user || !valid) {
    await registerFailedLogin(key);
    return { error: "E-mail ou senha incorretos.", values };
  }

  await clearLoginAttempts(key);
  await createSession(user.id);
  redirect(next);
}

const setupSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome.").max(80),
    email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
    password: z.string().min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`).max(200),
    confirm: z.string(),
    businessName: z.string().trim().max(80).optional(),
  })
  .refine((v) => v.password === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export async function setupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (await hasAnyUser()) redirect("/login");

  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
  };
  const setupCode = process.env.SETUP_CODE;
  if (process.env.NODE_ENV === "production" && !setupCode) {
    return { error: "Por segurança, defina a variável SETUP_CODE no servidor antes de criar a conta (veja o README).", values };
  }
  if (setupCode && String(formData.get("setupCode") ?? "") !== setupCode) {
    return { error: "Código de configuração inválido.", values };
  }

  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    businessName: formData.get("businessName") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", values };

  const { name, email, password, businessName } = parsed.data;
  const [created] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id });
  if (businessName) await saveSettings({ businessName });

  await createSession(created.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual."),
    password: z.string().min(PASSWORD_MIN_LENGTH, `A nova senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`).max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export async function changePasswordAction(input: {
  current: string;
  password: string;
  confirm: string;
}): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const user = await db.query.users.findFirst({ where: eq(users.id, me.id) });
  if (!user || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return fail("Senha atual incorreta.");
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(eq(users.id, me.id));
  return ok();
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
});

export async function updateProfileAction(input: { name: string; email: string }): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const clash = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (clash && clash.id !== me.id) return fail("Esse e-mail já está em uso.");
  await db.update(users).set(parsed.data).where(eq(users.id, me.id));
  return ok();
}
