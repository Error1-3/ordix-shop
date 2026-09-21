import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authz";
import { can } from "@/lib/rbac";
import { emptyProduct } from "@/lib/admin-form";
import { t } from "@/lib/t-static";
import { ProductEditor } from "@/components/product-editor";

export default async function NewProduct() {
  const actor = await requireAdminPage("products.write");
  const categories = await db.category.findMany({ select: { id: true, name: true, parentId: true }, orderBy: [{ position: "asc" }, { name: "asc" }] });
  return (
    <div><h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("admin.newProduct")}</h1>
      <ProductEditor initial={emptyProduct(categories[0]?.id ?? "")} categories={categories.map((c) => ({ id: c.id, name: c.name }))} canSecrets={can(actor.role, "usedDevice.secret.write")} /></div>
  );
}
