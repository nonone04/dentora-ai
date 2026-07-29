import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PricingContent } from "@/components/marketing/pricing-content";

export const metadata: Metadata = {
  title: "Pricing -- Dentora AI",
  description: "Simple, transparent pricing for dental clinics of every size.",
};

export default function PricingPage() {
  return (
    <>
      <MarketingHeader />
      <PricingContent />
      <MarketingFooter />
    </>
  );
}
