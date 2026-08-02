import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PricingContent } from "@/components/marketing/pricing-content";
import { getPlanPricing } from "@/lib/marketing/pricing-plans";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

export const metadata: Metadata = {
  title: "Pricing -- Dentora AI",
  description: "Simple, transparent pricing for dental clinics of every size.",
};

export default async function PricingPage() {
  const [planPricing, navState] = await Promise.all([getPlanPricing(), getMarketingNavState()]);
  return (
    <>
      <MarketingHeader navState={navState} />
      <PricingContent planPricing={planPricing} />
      <MarketingFooter navState={navState} />
    </>
  );
}
