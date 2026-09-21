-- Extra integrity constraints Prisma cannot express. Apply once after the first migration:
--   npm run db:constraints
-- Idempotent: safe to re-run.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_stock_nonneg') THEN
    ALTER TABLE "Inventory" ADD CONSTRAINT inventory_stock_nonneg CHECK ("stock" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reserved_nonneg') THEN
    ALTER TABLE "Inventory" ADD CONSTRAINT inventory_reserved_nonneg CHECK ("reservedStock" >= 0);
  END IF;
  -- The invariant that makes overselling impossible even if application code has a bug:
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reserved_le_stock') THEN
    ALTER TABLE "Inventory" ADD CONSTRAINT inventory_reserved_le_stock CHECK ("reservedStock" <= "stock");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orderitem_qty_positive') THEN
    ALTER TABLE "OrderItem" ADD CONSTRAINT orderitem_qty_positive CHECK ("quantity" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_total_nonneg') THEN
    ALTER TABLE "Order" ADD CONSTRAINT order_total_nonneg CHECK ("total" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'variant_price_nonneg') THEN
    ALTER TABLE "ProductVariant" ADD CONSTRAINT variant_price_nonneg CHECK ("price" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'useddevice_battery_range') THEN
    ALTER TABLE "UsedDevice" ADD CONSTRAINT useddevice_battery_range CHECK ("batteryHealth" IS NULL OR ("batteryHealth" BETWEEN 0 AND 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_rating_range') THEN
    ALTER TABLE "Review" ADD CONSTRAINT review_rating_range CHECK ("rating" BETWEEN 1 AND 5);
  END IF;
END $$;
