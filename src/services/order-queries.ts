import "server-only";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/authz";
import { verifyOrderAccess } from "@/lib/order-access";

/** Customer-facing order projection. Contains no internal fields (costs, IP, raw provider payloads, device secrets). */
const ORDER_VIEW = {
  id: true, number: true, status: true, paymentMethod: true, paymentStatus: true, deliveryMethod: true, subtotal: true, discountTotal: true, deliveryCost: true,
  commission: true, total: true, codAmount: true, prepaymentAmount: true, couponCode: true, city: true, warehouseName: true, address: true, comment: true,
  firstName: true, lastName: true, phone: true, email: true, createdAt: true, paidAt: true, reservationExpiresAt: true, userId: true,
  items: { select: { id: true, productId: true, title: true, variantLabel: true, image: true, unitPrice: true, quantity: true, lineTotal: true, warrantyMonths: true, condition: true } },
  payments: { orderBy: { createdAt: "desc" as const }, take: 5, select: { id: true, status: true, amount: true, createdAt: true } },
  shipment: { select: { trackingNumber: true, status: true, statusCode: true, estimatedDelivery: true } },
  events: { orderBy: { createdAt: "asc" as const }, where: { type: { in: ["created", "status_changed", "shipment", "payment", "refund"] } }, select: { id: true, message: true, createdAt: true, type: true } },
} as const;

export type OrderView = NonNullable<Awaited<ReturnType<typeof getOrderByNumberForViewer>>>;

/** Owner (session) OR holder of the HMAC link may view. Anyone else gets null (=> 404, no existence leak). */
export async function getOrderByNumberForViewer(number: string, token?: string | null) {
  const order = await db.order.findUnique({ where: { number }, select: ORDER_VIEW });
  if (!order) return null;
  const user = await getCurrentUser();
  const isOwner = Boolean(user && order.userId === user.id);
  if (!isOwner && !verifyOrderAccess(number, token)) return null;
  return order;
}

export async function getOrderByIdForUser(id: string, userId: string) {
  return db.order.findFirst({ where: { id, userId }, select: ORDER_VIEW });
}

export async function listOrdersForUser(userId: string) {
  return db.order.findMany({
    where: { userId }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, number: true, status: true, paymentStatus: true, total: true, createdAt: true, items: { select: { title: true, image: true, quantity: true }, take: 4 } },
  });
}
