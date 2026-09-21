import { test } from "node:test";
import assert from "node:assert/strict";
import { HAS_DB, makeVariant } from "./helpers";

test("100% oversell protection: 10 concurrent reservations for 3 units -> exactly 3 succeed", { skip: !HAS_DB }, async () => {
  const { db, variant } = await makeVariant({ stock: 3 });
  const { reserveStock, OutOfStockError } = await import("@/services/inventory");
  const attempts = await Promise.allSettled(Array.from({ length: 10 }, () => db.$transaction((tx) => reserveStock(tx, [{ variantId: variant.id, quantity: 1 }]))));
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 3);
  assert.ok(attempts.filter((a) => a.status === "rejected").every((a) => (a as PromiseRejectedResult).reason instanceof OutOfStockError));
  const inv = await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  assert.equal(inv.reservedStock, 3);
  assert.equal(inv.stock, 3);
});

test("reserve -> confirm sale -> stock and reservation both drop; release returns units", { skip: !HAS_DB }, async () => {
  const { db, variant } = await makeVariant({ stock: 5 });
  const inv = await import("@/services/inventory");
  await db.$transaction((tx) => inv.reserveStock(tx, [{ variantId: variant.id, quantity: 2 }]));
  await db.$transaction((tx) => inv.confirmSale(tx, [{ variantId: variant.id, quantity: 2 }]));
  let row = await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  assert.deepEqual([row.stock, row.reservedStock], [3, 0]);
  await db.$transaction((tx) => inv.reserveStock(tx, [{ variantId: variant.id, quantity: 1 }]));
  await db.$transaction((tx) => inv.releaseStock(tx, [{ variantId: variant.id, quantity: 1 }]));
  row = await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  assert.deepEqual([row.stock, row.reservedStock], [3, 0]);
});

test("database CHECK constraint is the last line of defence (reserved > stock is impossible)", { skip: !HAS_DB }, async () => {
  const { db, variant } = await makeVariant({ stock: 1 });
  await assert.rejects(db.inventory.update({ where: { variantId: variant.id }, data: { reservedStock: 5 } }));
});
