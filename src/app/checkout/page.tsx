import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/authz";
import { liqpayConfigured, novaPoshtaConfigured } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/t-static";
import { getCartView } from "@/services/cart";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata: Metadata = { title: t("checkout.title"), robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const [cart, s] = await Promise.all([getCartView(user?.id), getSettings()]);
  if (cart.lines.length === 0) redirect("/cart");
  const profile = user ? await db.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true, phone: true, email: true } }) : null;

  return (
    <div className="container py-8 md:py-12">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl">{t("checkout.title")}</h1>
      <CheckoutForm
        cart={cart}
        prefill={{ firstName: profile?.firstName ?? "", lastName: profile?.lastName ?? "", phone: profile?.phone ?? "", email: profile?.email ?? "" }}
        config={{
          methods: { LIQPAY_CARD: s.payments.liqpayEnabled && liqpayConfigured(), NP_COD: s.payments.codEnabled, PAY_ON_RECEIVE: s.payments.payOnReceiveEnabled },
          cod: { prepaymentAmount: s.payments.codPrepaymentAmount, commissionPercent: s.payments.codCommissionPercent, commissionFixed: s.payments.codCommissionFixed, maxTotal: s.payments.codMaxTotal },
          delivery: { flatFee: s.shipping.flatFee, freeShippingThreshold: s.shipping.freeShippingThreshold, note: s.shipping.note },
          npReady: novaPoshtaConfigured(),
        }}
      />
    </div>
  );
}
