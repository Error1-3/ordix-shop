import "server-only";
import type { Prisma } from "@prisma/client";

export type StockItem = { variantId: string; quantity: number };

export class OutOfStockError extends Error {
  constructor(public readonly variantId: string) {
    super(`Out of stock: ${variantId}`);
    this.name = "OutOfStockError";
  }
}

// Sorted by variantId so concurrent transactions lock rows in the same order (no deadlocks).
const sorted = (items: StockItem[]) => [...items].sort((a, b) => (a.variantId < b.variantId ? -1 : 1));

/**
 * Atomically reserve stock. The WHERE clause is the guard: PostgreSQL re-evaluates it after taking the row lock,
 * so two buyers racing for the last unit can never both succeed — one UPDATE affects 0 rows.
 * (prisma/sql/constraints.sql adds CHECK (reservedStock <= stock) as a second line of defence.)
 * MUST run inside the same transaction that creates the order.
 */
export async function reserveStock(tx: Prisma.TransactionClient, items: StockItem[]): Promise<void> {
  for (const { variantId, quantity } of sorted(items)) {
    const n = await tx.$executeRaw`
      UPDATE "Inventory" SET "reservedStock" = "reservedStock" + ${quantity}, "updatedAt" = NOW()
      WHERE "variantId" = ${variantId} AND "stock" - "reservedStock" >= ${quantity}`;
    if (n !== 1) throw new OutOfStockError(variantId);
  }
}

/** Give reserved units back (payment failed / order cancelled / reservation expired). */
export async function releaseStock(tx: Prisma.TransactionClient, items: StockItem[]): Promise<void> {
  for (const { variantId, quantity } of sorted(items)) {
    await tx.$executeRaw`
      UPDATE "Inventory" SET "reservedStock" = GREATEST("reservedStock" - ${quantity}, 0), "updatedAt" = NOW()
      WHERE "variantId" = ${variantId}`;
  }
}

/** Reservation -> real sale: physical stock and reservation both go down. Fails loudly if invariants are violated. */
export async function confirmSale(tx: Prisma.TransactionClient, items: StockItem[]): Promise<void> {
  for (const { variantId, quantity } of sorted(items)) {
    const n = await tx.$executeRaw`
      UPDATE "Inventory" SET "stock" = "stock" - ${quantity}, "reservedStock" = "reservedStock" - ${quantity}, "updatedAt" = NOW()
      WHERE "variantId" = ${variantId} AND "reservedStock" >= ${quantity} AND "stock" >= ${quantity}`;
    if (n !== 1) throw new Error(`confirmSale invariant violated for variant ${variantId}`);
  }
  const ids = items.map((i) => i.variantId);
  // A sold-out physical device becomes SOLD.
  await tx.$executeRaw`
    UPDATE "UsedDevice" u SET "status" = 'SOLD', "updatedAt" = NOW()
    FROM "Inventory" i WHERE i."variantId" = u."variantId" AND u."variantId" = ANY(${ids}::text[]) AND i."stock" = 0`;
}

/** Recompute the denormalised Product.stock (sum of available units over active variants). */
export async function syncProductStock(tx: Prisma.TransactionClient, productIds: string[]): Promise<void> {
  if (!productIds.length) return;
  await tx.$executeRaw`
    UPDATE "Product" p SET "stock" = COALESCE((
      SELECT SUM(GREATEST(i."stock" - i."reservedStock", 0)) FROM "ProductVariant" v
      JOIN "Inventory" i ON i."variantId" = v.id WHERE v."productId" = p.id AND v."isActive"
    ), 0)
    WHERE p.id = ANY(${productIds}::text[])`;
}

export async function productIdsOfVariants(tx: Prisma.TransactionClient, variantIds: string[]): Promise<string[]> {
  const rows = await tx.productVariant.findMany({ where: { id: { in: variantIds } }, select: { productId: true }, distinct: ["productId"] });
  return rows.map((r) => r.productId);
}
