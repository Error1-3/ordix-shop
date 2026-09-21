/** Order status state machine. Every status change (admin action, payment callback, cron) goes through canTransition. */
export const ORDER_STATUSES = [
  "PENDING",
  "PAYMENT_PENDING",
  "PAID",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURN_REQUESTED",
  "RETURNED",
] as const;
export type OrderStatusName = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatusName, OrderStatusName[]> = {
  PENDING: ["PAYMENT_PENDING", "PAID", "PROCESSING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["PACKED", "CANCELLED", "REFUNDED"],
  PACKED: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "RETURN_REQUESTED", "RETURNED"],
  DELIVERED: ["RETURN_REQUESTED", "REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED", "REFUNDED"],
  RETURNED: ["REFUNDED"],
};

export function canTransition(from: OrderStatusName, to: OrderStatusName): boolean {
  return from === to ? false : TRANSITIONS[from].includes(to);
}

export function allowedNext(from: OrderStatusName): OrderStatusName[] {
  return TRANSITIONS[from];
}

export const isTerminal = (s: OrderStatusName) => TRANSITIONS[s].length === 0;

/** Statuses from which the reserved (not yet sold) stock must be released on cancellation. */
export function holdsReservation(s: OrderStatusName): boolean {
  return s === "PENDING" || s === "PAYMENT_PENDING";
}

export const ORDER_STATUS_LABEL_UK: Record<OrderStatusName, string> = {
  PENDING: "Нове",
  PAYMENT_PENDING: "Очікує оплату",
  PAID: "Оплачено",
  PROCESSING: "В обробці",
  PACKED: "Упаковано",
  SHIPPED: "Відправлено",
  DELIVERED: "Доставлено",
  CANCELLED: "Скасовано",
  REFUNDED: "Повернено кошти",
  RETURN_REQUESTED: "Запит на повернення",
  RETURNED: "Повернено",
};
