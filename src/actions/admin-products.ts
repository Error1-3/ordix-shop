"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, ForbiddenError } from "@/lib/authz";
import { encryptField, hashIdentifier } from "@/lib/crypto";
import { fieldErrors } from "@/lib/validators";
import { productPayloadSchema, type ProductPayload } from "@/lib/admin-validators";
import { slugify } from "@/lib/sanitize";
import { isAllowedImageUrl } from "@/lib/images";
import { syncProductStock } from "@/services/inventory";
import { revalidateCatalog } from "@/services/catalog";
import type { ActionState } from "@/lib/action-state";

type SaveResult = ActionState<{ id: string }>;

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "product";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const hit = await db.product.findFirst({ where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!hit) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export async function saveProductAction(payloadJson: string): Promise<SaveResult> {
  let actor;
  try {
    actor = await requirePermission("products.write");
  } catch (e) {
    return { error: e instanceof ForbiddenError ? "errors.forbidden" : "common.genericError" };
  }
  let raw: unknown;
  try { raw = JSON.parse(payloadJson); } catch { return { error: "common.genericError" }; }
  const parsed = productPayloadSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "common.genericError" };
  const p: ProductPayload = parsed.data;

  if (p.images.some((i) => !isAllowedImageUrl(i.url))) return { error: "Недозволене джерело зображення (лише Cloudinary акаунту магазину)" };
  const skus = p.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) return { error: "Артикули варіантів мають бути унікальними" };

  try {
    const before = p.id ? await db.product.findUnique({ where: { id: p.id }, include: { variants: { include: { inventory: true } } } }) : null;

    const productId = await db.$transaction(async (tx) => {
      const slug = p.slug ? await uniqueSlug(p.slug, p.id) : await uniqueSlug(p.title, p.id);
      const activeVariants = p.variants.filter((v) => v.isActive);
      const pool = activeVariants.length ? activeVariants : p.variants;
      const base = {
        title: p.title, slug, brand: p.brand, model: p.model, categoryId: p.categoryId, description: p.description, shortDescription: p.shortDescription,
        sku: p.sku, barcode: p.barcode, isActive: p.isActive, isFeatured: p.isFeatured, isNew: p.isNew,
        specifications: p.specifications as Prisma.InputJsonValue, faq: p.faq as Prisma.InputJsonValue, seoTitle: p.seoTitle, seoDescription: p.seoDescription,
        price: Math.min(...pool.map((v) => v.price as number)),
        compareAtPrice: pool.reduce<number | null>((m, v) => (v.compareAtPrice && (m === null || (v.price as number) < (m as number)) ? v.compareAtPrice : m), null),
        costPrice: pool[0]?.costPrice ?? null,
        hasUsed: p.variants.some((v) => v.condition !== "NEW"),
      };
      const product = p.id ? await tx.product.update({ where: { id: p.id }, data: base }) : await tx.product.create({ data: base });

      // ── variants ──
      const keyToId = new Map<string, string>();
      const keepIds: string[] = [];
      for (const [idx, v] of p.variants.entries()) {
        const vData = {
          sku: v.sku, storage: v.storage, color: v.color, colorHex: v.colorHex ?? null, condition: v.condition, simType: v.simType, connectivity: v.connectivity,
          price: v.price as number, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, warrantyMonths: v.warrantyMonths, weightGrams: v.weightGrams,
          isActive: v.isActive, position: idx,
        };
        const owned = v.id ? await tx.productVariant.findFirst({ where: { id: v.id, productId: product.id }, select: { id: true } }) : null;
        const variant = owned
          ? await tx.productVariant.update({ where: { id: owned.id }, data: vData })
          : await tx.productVariant.create({ data: { ...vData, productId: product.id } });
        keyToId.set(v.key, variant.id);
        keepIds.push(variant.id);

        // inventory: admin edits physical stock; reservations are owned by checkout and never overwritten here
        const inv = await tx.inventory.findUnique({ where: { variantId: variant.id } });
        if (inv && v.stock < inv.reservedStock) throw new AdminInputError(`«${v.sku}»: залишок не може бути меншим за резерв (${inv.reservedStock})`);
        await tx.inventory.upsert({
          where: { variantId: variant.id },
          create: { variantId: variant.id, stock: v.stock, lowStockThreshold: v.lowStockThreshold },
          update: { stock: v.stock, lowStockThreshold: v.lowStockThreshold },
        });

        // used device (public facts) + secret (encrypted)
        if (v.condition !== "NEW" && v.used) {
          const ud = await tx.usedDevice.upsert({
            where: { variantId: variant.id },
            create: { variantId: variant.id, ...v.used, inspectedAt: new Date() },
            update: { ...v.used },
          });
          if (v.secret) {
            const s = v.secret;
            const secretData = {
              imeiEncrypted: s.imei ? encryptField(s.imei) : null, imeiHash: s.imei ? hashIdentifier(s.imei) : null,
              serialEncrypted: s.serial ? encryptField(s.serial) : null, serialHash: s.serial ? hashIdentifier(s.serial) : null,
              purchaseCost: s.purchaseCost, purchaseSource: s.purchaseSource, supplier: s.supplier, internalNotes: s.internalNotes,
              testingChecklist: s.checklist as Prisma.InputJsonValue,
            };
            await tx.usedDeviceSecret.upsert({ where: { usedDeviceId: ud.id }, create: { usedDeviceId: ud.id, ...secretData }, update: secretData });
          }
        } else if (v.condition === "NEW") {
          await tx.usedDevice.deleteMany({ where: { variantId: variant.id } });
        }
      }

      // variants removed in the form: delete if never sold, otherwise just deactivate (order history must stay intact)
      const removed = await tx.productVariant.findMany({ where: { productId: product.id, id: { notIn: keepIds } }, select: { id: true, _count: { select: { orderItems: true } } } });
      for (const r of removed) {
        if (r._count.orderItems === 0) await tx.productVariant.delete({ where: { id: r.id } });
        else await tx.productVariant.update({ where: { id: r.id }, data: { isActive: false } });
      }

      // ── images (product-level and per-device) ──
      const keepImg: string[] = [];
      for (const [pos, img] of p.images.entries()) {
        const variantId = img.variantKey ? keyToId.get(img.variantKey) ?? null : null;
        const data = { url: img.url, publicId: img.publicId ?? null, alt: img.alt, position: pos, isPrimary: img.isPrimary, variantId, productId: product.id };
        const existing = img.id ? await tx.productImage.findFirst({ where: { id: img.id, productId: product.id }, select: { id: true } }) : null;
        const row = existing ? await tx.productImage.update({ where: { id: existing.id }, data }) : await tx.productImage.create({ data });
        keepImg.push(row.id);
      }
      await tx.productImage.deleteMany({ where: { productId: product.id, id: { notIn: keepImg } } });

      await syncProductStock(tx, [product.id]);
      await audit(
        {
          actor, action: p.id ? "product.update" : "product.create", entity: "Product", entityId: product.id,
          oldValue: before ? { title: before.title, price: before.price, isActive: before.isActive, variants: before.variants.map((v) => ({ sku: v.sku, price: v.price, stock: v.inventory?.stock })) } : undefined,
          newValue: { title: p.title, price: base.price, isActive: p.isActive, variants: p.variants.map((v) => ({ sku: v.sku, price: v.price, condition: v.condition, stock: v.stock, batteryHealth: v.used?.batteryHealth, hasSecret: Boolean(v.secret) })) },
        },
        tx,
      );
      return product.id;
    }, { timeout: 30_000 });

    revalidateCatalog();
    revalidatePath("/admin/products");
    return { ok: true, data: { id: productId }, message: "common.saved" };
  } catch (e) {
    if (e instanceof AdminInputError) return { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta as { target?: unknown })?.target ?? "");
      if (target.includes("imeiHash")) return { error: "Цей IMEI вже є в системі" };
      if (target.includes("serialHash")) return { error: "Цей серійний номер уже є в системі" };
      if (target.includes("sku")) return { error: "Такий артикул уже існує" };
      return { error: "Дублікат унікального значення" };
    }
    console.error("[admin] saveProduct failed", e);
    return { error: "common.genericError" };
  }
}

class AdminInputError extends Error {}

export async function setProductActiveAction(id: string, active: boolean) {
  const actor = await requirePermission("products.write");
  const before = await db.product.findUnique({ where: { id }, select: { isActive: true } });
  await db.product.update({ where: { id }, data: { isActive: active } });
  await audit({ actor, action: active ? "product.activate" : "product.deactivate", entity: "Product", entityId: id, oldValue: before, newValue: { isActive: active } });
  revalidateCatalog();
  revalidatePath("/admin/products");
}

/** Soft delete: orders keep referencing the product; it just disappears from the shop and admin lists. */
export async function deleteProductAction(id: string) {
  const actor = await requirePermission("products.delete");
  const before = await db.product.findUnique({ where: { id }, select: { title: true, sku: true } });
  await db.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await audit({ actor, action: "product.delete", entity: "Product", entityId: id, oldValue: before });
  revalidateCatalog();
  revalidatePath("/admin/products");
}

export async function duplicateProductAction(id: string): Promise<{ ok: boolean; id?: string }> {
  const actor = await requirePermission("products.write");
  const src = await db.product.findUnique({ where: { id }, include: { variants: { where: { condition: "NEW" }, include: { inventory: true } }, images: { where: { variantId: null } } } });
  if (!src) return { ok: false };
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const copy = await db.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        slug: await uniqueSlug(`${src.title} copy`), title: `${src.title} (копія)`, brand: src.brand, model: src.model, description: src.description, shortDescription: src.shortDescription,
        categoryId: src.categoryId, price: src.price, compareAtPrice: src.compareAtPrice, costPrice: src.costPrice, sku: `${src.sku}-${suffix}`, isActive: false,
        specifications: (src.specifications ?? Prisma.JsonNull) as Prisma.InputJsonValue, faq: (src.faq ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
    for (const v of src.variants) {
      const nv = await tx.productVariant.create({
        data: { productId: created.id, sku: `${v.sku}-${suffix}`, storage: v.storage, color: v.color, colorHex: v.colorHex, condition: v.condition, simType: v.simType, connectivity: v.connectivity, price: v.price, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, warrantyMonths: v.warrantyMonths, weightGrams: v.weightGrams, position: v.position, isActive: false },
      });
      await tx.inventory.create({ data: { variantId: nv.id, stock: 0 } });
    }
    for (const i of src.images) await tx.productImage.create({ data: { productId: created.id, url: i.url, publicId: i.publicId, alt: i.alt, position: i.position, isPrimary: i.isPrimary } });
    await audit({ actor, action: "product.duplicate", entity: "Product", entityId: created.id, oldValue: { from: src.id } }, tx);
    return created;
  });
  revalidatePath("/admin/products");
  return { ok: true, id: copy.id };
}
