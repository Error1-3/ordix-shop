import { test } from "node:test";
import assert from "node:assert/strict";
import { can, isStaffOrAdmin, PERMISSIONS } from "@/lib/rbac";

test("customers have no admin permissions", () => {
  for (const p of PERMISSIONS) assert.equal(can("CUSTOMER", p), false, p);
  assert.equal(can(null, "admin.access"), false);
  assert.equal(can(undefined, "orders.read"), false);
});

test("admins have every permission", () => {
  for (const p of PERMISSIONS) assert.ok(can("ADMIN", p), p);
});

test("staff can manage orders/products and read device secrets but not settings, coupons or refunds", () => {
  assert.ok(can("STAFF", "orders.update"));
  assert.ok(can("STAFF", "usedDevice.secret.read"));
  assert.equal(can("STAFF", "settings.write"), false);
  assert.equal(can("STAFF", "orders.refund"), false);
  assert.equal(can("STAFF", "coupons.manage"), false);
  assert.equal(can("STAFF", "users.manage"), false);
  assert.equal(can("STAFF", "products.delete"), false);
});

test("isStaffOrAdmin", () => {
  assert.ok(isStaffOrAdmin("STAFF") && isStaffOrAdmin("ADMIN"));
  assert.equal(isStaffOrAdmin("CUSTOMER"), false);
});
