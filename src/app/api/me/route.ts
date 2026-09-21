import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { cartCount } from "@/services/cart";

export const dynamic = "force-dynamic";

/** Per-visitor state for the (statically cached) storefront: who am I, cart size, wishlist ids. No sensitive data. */
export async function GET() {
  const user = await getCurrentUser();
  const [count, wl] = await Promise.all([
    cartCount(user?.id),
    user ? db.wishlistItem.findMany({ where: { wishlist: { userId: user.id } }, select: { productId: true } }) : Promise.resolve([]),
  ]);
  return NextResponse.json(
    { user: user ? { name: user.name, role: user.role } : null, cartCount: count, wishlist: wl.map((w) => w.productId) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
