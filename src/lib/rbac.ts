/** Role-based access control. Pure functions; enforcement lives in lib/authz.ts (server-only). */
export type RoleName = "CUSTOMER" | "STAFF" | "ADMIN";

export const PERMISSIONS = [
  "admin.access",
  "products.read",
  "products.write",
  "products.delete",
  "usedDevice.secret.read",
  "usedDevice.secret.write",
  "orders.read",
  "orders.update",
  "orders.refund",
  "customers.read",
  "coupons.manage",
  "reviews.moderate",
  "settings.read",
  "settings.write",
  "audit.read",
  "users.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF: Permission[] = [
  "admin.access",
  "products.read",
  "products.write",
  "usedDevice.secret.read",
  "usedDevice.secret.write",
  "orders.read",
  "orders.update",
  "customers.read",
  "reviews.moderate",
];

const MATRIX: Record<RoleName, ReadonlySet<Permission>> = {
  CUSTOMER: new Set(),
  STAFF: new Set(STAFF),
  ADMIN: new Set(PERMISSIONS),
};

export function can(role: RoleName | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role]?.has(permission) ?? false;
}

export const isStaffOrAdmin = (role: RoleName | null | undefined) => role === "STAFF" || role === "ADMIN";
