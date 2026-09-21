import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdminPage } from "@/lib/authz";
import { can } from "@/lib/rbac";
import { decryptField } from "@/lib/crypto";
import { emptySecret, emptyUsed, type ProductForm, type VariantForm } from "@/lib/admin-form";
import { t } from "@/lib/t-static";
import { ProductEditor } from "@/components/product-editor";

const safeDecrypt = (v: string | null) => { if (!v) return ""; try { return decryptField(v); } catch { return ""; } };
const uah = (n: number | null | undefined) => (n == null ? "" : String(n / 100));

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage("products.read");
  const { id } = await params;
  const [p, categories] = await Promise.all([
    db.product.findFirst({
      where: { id, deletedAt: null },
      include: { variants: { orderBy: { position: "asc" }, include: { inventory: true, usedDevice: { include: { secret: true } } } }, images: { orderBy: { position: "asc" } } },
    }),
    db.category.findMany({ select: { id: true, name: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
  ]);
  if (!p) notFound();

  const canSecrets = can(actor.role, "usedDevice.secret.read");
  const revealed = canSecrets && p.variants.some((v) => v.usedDevice?.secret);
  if (revealed) await audit({ actor, action: "usedDevice.secret_view", entity: "Product", entityId: p.id }); // every decrypt-for-display is logged

  const keyById = new Map<string, string>(p.variants.map((v) => [v.id, `v_${v.id}`] as const));
  const variants: VariantForm[] = p.variants.map((v) => {
    const u = v.usedDevice;
    const s = u?.secret;
    return {
      key: keyById.get(v.id)!, id: v.id, sku: v.sku, storage: v.storage ?? "", color: v.color ?? "", colorHex: v.colorHex ?? "", condition: v.condition, simType: v.simType ?? "", connectivity: v.connectivity ?? "",
      price: uah(v.price), compareAtPrice: uah(v.compareAtPrice), costPrice: uah(v.costPrice), warrantyMonths: v.warrantyMonths, weightGrams: v.weightGrams, isActive: v.isActive,
      stock: v.inventory?.stock ?? 0, reserved: v.inventory?.reservedStock ?? 0, lowStockThreshold: v.inventory?.lowStockThreshold ?? 2,
      used: u ? {
        status: u.status, batteryHealth: u.batteryHealth?.toString() ?? "", cycleCount: u.cycleCount?.toString() ?? "", deviceGrade: u.deviceGrade ?? "", physicalCondition: u.physicalCondition ?? "", screenCondition: u.screenCondition ?? "",
        cameraCondition: u.cameraCondition, faceIdStatus: u.faceIdStatus, touchIdStatus: u.touchIdStatus, trueToneStatus: u.trueToneStatus, speakerStatus: u.speakerStatus, microphoneStatus: u.microphoneStatus,
        chargingPortStatus: u.chargingPortStatus, wifiStatus: u.wifiStatus, bluetoothStatus: u.bluetoothStatus, simStatus: u.simStatus, accessoriesIncluded: u.accessoriesIncluded.join(", "), warrantyMonths: u.warrantyMonths, defects: u.defects ?? "", inspectionNotes: u.inspectionNotes ?? "",
      } : emptyUsed(),
      secret: s && canSecrets ? {
        imei: safeDecrypt(s.imeiEncrypted), serial: safeDecrypt(s.serialEncrypted), purchaseCost: uah(s.purchaseCost), purchaseSource: s.purchaseSource ?? "", supplier: s.supplier ?? "", internalNotes: s.internalNotes ?? "",
        checklist: Array.isArray(s.testingChecklist) ? (s.testingChecklist as { item: string; passed: boolean; note?: string }[]).map((c) => ({ item: c.item, passed: c.passed, note: c.note ?? "" })) : emptySecret().checklist,
      } : emptySecret(),
      hasSecretPermission: canSecrets,
    };
  });

  const initial: ProductForm = {
    id: p.id, title: p.title, slug: p.slug, brand: p.brand, model: p.model, categoryId: p.categoryId, description: p.description, shortDescription: p.shortDescription, sku: p.sku, barcode: p.barcode ?? "",
    isActive: p.isActive, isFeatured: p.isFeatured, isNew: p.isNew, seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "",
    specifications: Array.isArray(p.specifications) ? (p.specifications as ProductForm["specifications"]) : [], faq: Array.isArray(p.faq) ? (p.faq as ProductForm["faq"]) : [],
    variants, images: p.images.map((i) => ({ id: i.id, url: i.url, publicId: i.publicId ?? undefined, alt: i.alt, variantKey: i.variantId ? keyById.get(i.variantId) ?? null : null, isPrimary: i.isPrimary })),
  };
  return (
    <div><h1 className="mb-6 text-2xl font-semibold tracking-tight">{p.title}</h1>
      <ProductEditor initial={initial} categories={categories} canSecrets={can(actor.role, "usedDevice.secret.write")} /></div>
  );
}
