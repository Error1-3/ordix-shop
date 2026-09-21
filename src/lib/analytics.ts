"use client";

/**
 * Thin, consent-aware event helper. Events go to whichever of GTM dataLayer / GA4 gtag / Meta Pixel are loaded.
 * Nothing is sent before the visitor accepts analytics cookies (see <CookieBanner/> and <Analytics/>).
 */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export type Item = { item_id: string; item_name: string; price: number; quantity?: number; item_variant?: string; item_category?: string };
type EventName = "view_item" | "add_to_cart" | "begin_checkout" | "purchase" | "search" | "wishlist" | "refund";

export const hasConsent = () => typeof document !== "undefined" && document.cookie.includes("consent=all");

const GA_NAME: Record<EventName, string> = {
  view_item: "view_item", add_to_cart: "add_to_cart", begin_checkout: "begin_checkout", purchase: "purchase", search: "search", wishlist: "add_to_wishlist", refund: "refund",
};
const META_NAME: Partial<Record<EventName, string>> = {
  view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase", search: "Search", wishlist: "AddToWishlist",
};

export function track(event: EventName, params: { value?: number; currency?: string; items?: Item[]; transaction_id?: string; search_term?: string } = {}) {
  if (typeof window === "undefined" || !hasConsent()) return;
  const payload = { currency: "UAH", ...params };
  window.dataLayer?.push({ event: GA_NAME[event], ecommerce: payload, ...payload });
  window.gtag?.("event", GA_NAME[event], payload);
  const meta = META_NAME[event];
  if (meta && window.fbq) {
    window.fbq("track", meta, {
      value: params.value, currency: "UAH", content_ids: params.items?.map((i) => i.item_id), content_type: "product", search_string: params.search_term,
    });
  }
}

export const toItem = (p: { id: string; title: string; price: number; variant?: string; category?: string; quantity?: number }): Item => ({
  item_id: p.id, item_name: p.title, price: p.price / 100, quantity: p.quantity ?? 1, item_variant: p.variant, item_category: p.category,
});
