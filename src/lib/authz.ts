import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "./db";
import { can, type Permission, type RoleName } from "./rbac";

export type SessionUser = { id: string; email: string; role: RoleName; name: string | null };

/** Current user from the session cookie, re-validated against the DB (role / deactivation take effect immediately). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const u = await db.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, name: true, isActive: true } });
  if (!u || !u.isActive) return null;
  return { id: u.id, email: u.email, role: u.role, name: u.name };
}

export async function requireUser(callbackUrl = "/account"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Forbidden: ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("unauthenticated");
  if (!can(user.role, permission)) throw new ForbiddenError(permission);
  return user;
}

/** For admin pages: redirects instead of throwing. */
export async function requireAdminPage(permission: Permission = "admin.access"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (!can(user.role, permission)) redirect("/");
  return user;
}
