import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";
import { DEFAULT_LOCALE } from "@/lib/t-static";
import { I18nProvider } from "@/components/i18n-provider";
import { SessionProvider } from "@/components/session-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CookieBanner } from "@/components/cookie-banner";
import { Analytics } from "@/components/analytics";
import { JsonLd } from "@/components/json-ld";
import { organizationLd, websiteLd } from "@/lib/seo";

const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: s.seo.defaultTitle, template: s.seo.titleTemplate },
    description: s.seo.defaultDescription,
    applicationName: s.store.name,
    openGraph: { type: "website", locale: "uk_UA", siteName: s.store.name, title: s.seo.defaultTitle, description: s.seo.defaultDescription, images: s.seo.ogImage ? [s.seo.ogImage] : undefined },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const ga4 = s.analytics.ga4Id || process.env.GOOGLE_ANALYTICS_ID;
  const gtm = s.analytics.gtmId || process.env.GOOGLE_TAG_MANAGER_ID;
  const pixel = s.analytics.metaPixelId || process.env.META_PIXEL_ID;
  return (
    <html lang={DEFAULT_LOCALE} className={onest.variable}>
      <body className="min-h-dvh font-sans">
        <I18nProvider locale={DEFAULT_LOCALE}>
          <SessionProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Перейти до вмісту</a>
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
            <CookieBanner />
            <Toaster position="top-center" richColors closeButton />
          </SessionProvider>
        </I18nProvider>
        <Analytics ga4={ga4} gtm={gtm} pixel={pixel} />
        <JsonLd data={[organizationLd(s.store), websiteLd(s.store.name)]} />
      </body>
    </html>
  );
}
