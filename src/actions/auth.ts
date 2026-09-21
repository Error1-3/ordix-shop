"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getClientIp, } from "@/lib/request";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { safeRedirectPath } from "@/lib/sanitize";
import { consumeToken, issueToken } from "@/lib/tokens";
import { fieldErrors, forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validators";
import type { ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/authz";
import { passwordSchema } from "@/lib/validators";
import { sendAuthEmail } from "@/services/email";
import { mergeGuestCart } from "@/services/cart";
import { z } from "zod";
import { audit } from "@/lib/audit";

const BCRYPT_COST = 12;

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  const rl = await rateLimit(`register:${ip}`, LIMITS.register.limit, LIMITS.register.windowSec);
  if (!rl.ok) return { error: "checkout.error.RATE_LIMIT" };

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const existing = await db.user.findUnique({ where: { email: d.email }, select: { id: true } });
  // Anti-enumeration: same response whether or not the e-mail is taken.
  if (existing) return { ok: true, message: "auth.registered" };

  const user = await db.user.create({
    data: {
      email: d.email, firstName: d.firstName, lastName: d.lastName, name: `${d.firstName} ${d.lastName}`, phone: d.phone ?? null,
      passwordHash: await bcrypt.hash(d.password, BCRYPT_COST), role: "CUSTOMER",
      emailVerified: env().REQUIRE_EMAIL_VERIFICATION ? null : new Date(),
    },
  });
  if (env().REQUIRE_EMAIL_VERIFICATION) {
    try {
      const token = await issueToken(user.email, "EMAIL_VERIFY", user.id);
      await sendAuthEmail("registration", user.email, d.firstName, token);
    } catch (e) {
      console.error("[register] verification e-mail failed", e);
    }
  }
  return { ok: true, message: env().REQUIRE_EMAIL_VERIFICATION ? "auth.registered" : "auth.resetDone" };
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "auth.errors.invalid" };
  const callbackUrl = safeRedirectPath(String(formData.get("callbackUrl") ?? ""), "/account");

  try {
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as unknown as { code?: string }).code;
      if (code === "email_not_verified" || code === "too_many_attempts") return { error: `auth.errors.${code}` };
      return { error: "auth.errors.invalid" };
    }
    throw e;
  }
  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, role: true } });
  if (user) await mergeGuestCart(user.id);
  redirect(user && user.role !== "CUSTOMER" && callbackUrl === "/account" ? "/admin" : callbackUrl);
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function forgotPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  const rl = await rateLimit(`forgot:${ip}`, LIMITS.forgotPassword.limit, LIMITS.forgotPassword.windowSec);
  if (!rl.ok) return { error: "checkout.error.RATE_LIMIT" };
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (user?.isActive) {
    try {
      const token = await issueToken(user.email, "PASSWORD_RESET", user.id);
      await sendAuthEmail("password_reset", user.email, user.firstName ?? "", token);
    } catch (e) {
      console.error("[forgot] e-mail failed", e);
    }
  }
  return { ok: true, message: "auth.forgotSent" }; // identical either way
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse({ token: formData.get("token"), password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const consumed = await consumeToken(parsed.data.token, "PASSWORD_RESET");
  if (!consumed) return { error: "auth.resetInvalid" };
  await db.user.update({
    where: { email: consumed.email },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, BCRYPT_COST), failedLogins: 0, lockedUntil: null, emailVerified: new Date() },
  });
  return { ok: true, message: "auth.resetDone" };
}

export async function resendVerificationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  const rl = await rateLimit(`resend:${ip}`, 3, 3600);
  if (!rl.ok) return { error: "checkout.error.RATE_LIMIT" };
  const email = z.string().email().safeParse(String(formData.get("email") ?? "").toLowerCase().trim());
  if (!email.success) return { fieldErrors: { email: "Некоректний e-mail" } };
  const user = await db.user.findUnique({ where: { email: email.data } });
  if (user && !user.emailVerified) {
    try {
      await sendAuthEmail("verification", user.email, user.firstName ?? "", await issueToken(user.email, "EMAIL_VERIFY", user.id));
    } catch (e) {
      console.error("[resend] failed", e);
    }
  }
  return { ok: true, message: "auth.verifySent" };
}

export async function changePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/account/security");
  const parsed = z.object({ current: z.string().min(1).max(200), next: passwordSchema }).safeParse({ current: formData.get("current"), next: formData.get("next") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const rl = await rateLimit(`chpw:${user.id}`, 5, 900);
  if (!rl.ok) return { error: "checkout.error.RATE_LIMIT" };
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row?.passwordHash || !(await bcrypt.compare(parsed.data.current, row.passwordHash))) return { error: "account.wrongPassword" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.next, BCRYPT_COST) } });
  await audit({ actor: { id: user.id, email: user.email }, action: "user.password_change", entity: "User", entityId: user.id });
  return { ok: true, message: "account.passwordChanged" };
}
