import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { getServerLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { directionForLocale } from "@/lib/i18n/types";
import { getServerCurrency } from "@/lib/currency/server";
import { CurrencyProvider } from "@/lib/currency/currency-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Loaded unconditionally (locale can change client-side without a full
// reload) but only ever applied via app/globals.css's `html[dir="rtl"]`
// override, so Latin-locale visitors never pay for it beyond the
// self-hosted font file being present in the bundle.
const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-arabic-sans",
  weight: "variable",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "Dentora AI",
  description: "AI-powered front desk for dental clinics.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, currency] = await Promise.all([getServerLocale(), getServerCurrency()]);

  return (
    <html
      lang={locale}
      dir={directionForLocale(locale)}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansArabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LocaleProvider initialLocale={locale}>
            <CurrencyProvider initialCurrency={currency}>{children}</CurrencyProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
