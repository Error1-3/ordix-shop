import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/authz";
import { t } from "@/lib/t-static";
import { getCartView } from "@/services/cart";
import { CartClient } from "@/components/cart-client";

export const metadata: Metadata = { title: t("cart.title"), robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();
  const cart = await getCartView(user?.id);
  return (
    <div className="container py-8 md:py-12">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl">{t("cart.title")}</h1>
      <CartClient cart={cart} />
    </div>
  );
}
