/**
 * Integration test helpers. Requires a REAL PostgreSQL:
 *   export TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/idevice_test
 *   DATABASE_URL=$TEST_DATABASE_URL npx prisma db push --force-reset && DATABASE_URL=$TEST_DATABASE_URL npm run db:constraints
 *   npm run test:integration
 * Tests are skipped (not failed) when TEST_DATABASE_URL is missing.
 */
export const HAS_DB = Boolean(process.env.TEST_DATABASE_URL);

export function setupEnv() {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
  process.env.AUTH_SECRET = "integration-test-secret-0123456789";
  process.env.DATA_ENCRYPTION_KEY = "1".repeat(64);
  process.env.LIQPAY_PUBLIC_KEY = "sandbox_i00000000";
  process.env.LIQPAY_PRIVATE_KEY = "sandbox_private_key_for_tests";
  process.env.LIQPAY_ALLOW_SANDBOX = "false";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.EMAIL_PROVIDER = "console";
  (process.env as Record<string, string>).NODE_ENV = "test";
}

export async function load() {
  setupEnv();
  const { db } = await import("@/lib/db");
  return db;
}

let n = 0;
/** Creates a category, a product with one variant and stock. Returns ids. */
export async function makeVariant(opts: { price?: number; stock?: number; condition?: "NEW" | "GOOD" } = {}) {
  const db = await load();
  const id = `${Date.now()}${++n}`;
  const cat = await db.category.upsert({ where: { slug: "it-iphone" }, update: {}, create: { slug: "it-iphone", name: "iPhone" } });
  const product = await db.product.create({ data: { slug: `it-${id}`, title: `Test iPhone ${id}`, model: "iPhone Test", sku: `IT-${id}`, price: opts.price ?? 1_000_000, categoryId: cat.id } });
  const variant = await db.productVariant.create({
    data: { productId: product.id, sku: `IT-${id}-V`, storage: "128 GB", color: "Black", condition: opts.condition ?? "NEW", price: opts.price ?? 1_000_000, inventory: { create: { stock: opts.stock ?? 3 } } },
  });
  return { db, product, variant, category: cat };
}

export const checkoutInput = (over: Record<string, unknown> = {}) => ({
  firstName: "Іван", lastName: "Тестовий", phone: "380671234567", email: `buyer${Date.now()}${++n}@example.com`, deliveryMethod: "NP_WAREHOUSE" as const,
  city: "Київ", cityRef: "8d5a980d-391c-11dd-90d9-001a92567626", warehouseRef: "1ec09d88-e1c2-11e3-8c4a-0050568002cf", warehouseName: "Відділення №1",
  paymentMethod: "LIQPAY_CARD" as const, acceptOffer: true as const, ...over,
});
