import Link from "next/link";
import { Heart } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { t } from "@/lib/t-static";
import { getProductCardsByIds } from "@/services/catalog";
import { ProductGrid } from "@/components/product-card";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const items = await db.wishlistItem.findMany({ where: { wishlist: { userId: user.id } }, orderBy: { createdAt: "desc" }, select: { productId: true } });
  const cards = await getProductCardsByIds(items.map((i) => i.productId));
  if (!cards.length) return <EmptyState icon={<Heart className="h-10 w-10" />} title={t("account.wishlistEmpty")} action={<Button asChild><Link href="/catalog">{t("cart.goCatalog")}</Link></Button>} />;
  return <ProductGrid items={cards} className="xl:grid-cols-3" />;
}
